require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { pool, testarConexao } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'chave_seguranca_skillmarket';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Endpoints simples para o Render verificar se a API está saudável.
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', servico: 'SkillMarket API' });
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Configuração do transportador do Nodemailer
const transportador = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ==========================================
// ROTAS DE ADMINISTRAÇÃO (MODERAÇÃO)
// ==========================================

// Login do Administrador
app.post('/api/admin/login', (req, res) => {
    const { email, senha } = req.body;

    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_SENHA) {
        return res.status(503).json({ erro: 'Acesso administrativo ainda não foi configurado no servidor.' });
    }

    if (email === process.env.ADMIN_EMAIL && senha === process.env.ADMIN_SENHA) {
        const tokenAdmin = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
        return res.json({ mensagem: 'Login de administrador efetuado!', tokenAdmin });
    }
    return res.status(401).json({ erro: 'Credenciais de administrador inválidas.' });
});

function autenticarAdmin(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ erro: 'Acesso administrativo não autorizado.' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.role !== 'admin') {
            return res.status(403).json({ erro: 'Acesso administrativo não autorizado.' });
        }
        req.admin = payload;
        next();
    } catch (_) {
        return res.status(401).json({ erro: 'Sessão administrativa inválida ou expirada.' });
    }
}

// Listar perfis pendentes
app.get('/api/admin/pendentes', autenticarAdmin, async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT p.*, u.nome, u.email 
            FROM perfis p 
            JOIN usuarios u ON p.usuario_id = u.id 
            WHERE p.status = 'pendente'
        `);
        res.json(resultado.rows);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao buscar perfis pendentes.' });
    }
});

// Aprovar ou Rejeitar perfil
app.patch('/api/admin/avaliar/:id', autenticarAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['aprovado', 'rejeitado'].includes(status)) {
        return res.status(400).json({ erro: 'Status administrativo inválido.' });
    }
    try {
        await pool.query('UPDATE perfis SET status = $1 WHERE id = $2', [status, id]);
        res.json({ mensagem: `Perfil marcado como ${status}.` });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao atualizar status do perfil.' });
    }
});

// ==========================================
// AUTENTICAÇÃO DE USUÁRIOS
// ==========================================

function autenticarUsuario(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ erro: 'Faça login para continuar.' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (!payload.id) {
            return res.status(401).json({ erro: 'Sessão de usuário inválida.' });
        }
        req.usuario = { id: Number(payload.id), email: payload.email };
        next();
    } catch (_) {
        return res.status(401).json({ erro: 'Sua sessão expirou. Entre novamente.' });
    }
}

async function buscarConversaDoUsuario(conversaId, usuarioId) {
    const resultado = await pool.query(
        `SELECT id, usuario_a_id, usuario_b_id, criada_em, atualizada_em
         FROM conversas
         WHERE id = $1 AND (usuario_a_id = $2 OR usuario_b_id = $2)`,
        [conversaId, usuarioId]
    );
    return resultado.rows[0] || null;
}

// ==========================================
// CHAT INTERNO
// ==========================================

// Cria (ou reaproveita) uma conversa entre o usuário logado e um profissional aprovado.
app.post('/api/chat/conversas', autenticarUsuario, async (req, res) => {
    const profissionalId = Number(req.body.profissional_id);
    const usuarioId = Number(req.usuario.id);

    if (!Number.isInteger(profissionalId) || profissionalId <= 0) {
        return res.status(400).json({ erro: 'Profissional inválido.' });
    }

    if (profissionalId === usuarioId) {
        return res.status(400).json({ erro: 'Você não pode iniciar uma conversa consigo mesmo.' });
    }

    try {
        const profissional = await pool.query(
            `SELECT u.id
             FROM usuarios u
             JOIN perfis p ON p.usuario_id = u.id
             WHERE u.id = $1 AND p.status = 'aprovado'`,
            [profissionalId]
        );

        if (profissional.rows.length === 0) {
            return res.status(404).json({ erro: 'Este profissional não está disponível para conversa.' });
        }

        const usuarioA = Math.min(usuarioId, profissionalId);
        const usuarioB = Math.max(usuarioId, profissionalId);

        const resultado = await pool.query(
            `INSERT INTO conversas (usuario_a_id, usuario_b_id)
             VALUES ($1, $2)
             ON CONFLICT (usuario_a_id, usuario_b_id)
             DO UPDATE SET usuario_a_id = EXCLUDED.usuario_a_id
             RETURNING id`,
            [usuarioA, usuarioB]
        );

        return res.status(200).json({ conversaId: resultado.rows[0].id });
    } catch (erro) {
        console.error('Erro ao iniciar conversa:', erro);
        return res.status(500).json({ erro: 'Não foi possível iniciar a conversa.' });
    }
});

// Lista as conversas do usuário, já com última mensagem e quantidade não lida.
app.get('/api/chat/conversas', autenticarUsuario, async (req, res) => {
    const usuarioId = Number(req.usuario.id);

    try {
        const resultado = await pool.query(
            `SELECT
                c.id,
                c.criada_em,
                c.atualizada_em,
                CASE WHEN c.usuario_a_id = $1 THEN ub.id ELSE ua.id END AS outro_usuario_id,
                CASE
                    WHEN c.usuario_a_id = $1 THEN COALESCE(NULLIF(pb.nome_completo, ''), ub.nome)
                    ELSE COALESCE(NULLIF(pa.nome_completo, ''), ua.nome)
                END AS outro_nome,
                CASE WHEN c.usuario_a_id = $1 THEN pb.area_atuacao ELSE pa.area_atuacao END AS outro_area,
                CASE WHEN c.usuario_a_id = $1 THEN pb.foto_perfil ELSE pa.foto_perfil END AS outro_foto,
                lm.id AS ultima_mensagem_id,
                lm.conteudo AS ultima_mensagem,
                lm.remetente_id AS ultima_mensagem_remetente_id,
                lm.enviada_em AS ultima_mensagem_em,
                (
                    SELECT COUNT(*)::int
                    FROM mensagens mn
                    WHERE mn.conversa_id = c.id
                      AND mn.remetente_id <> $1
                      AND mn.lida_em IS NULL
                ) AS nao_lidas
             FROM conversas c
             JOIN usuarios ua ON ua.id = c.usuario_a_id
             JOIN usuarios ub ON ub.id = c.usuario_b_id
             LEFT JOIN perfis pa ON pa.usuario_id = ua.id
             LEFT JOIN perfis pb ON pb.usuario_id = ub.id
             LEFT JOIN LATERAL (
                SELECT m.id, m.conteudo, m.remetente_id, m.enviada_em
                FROM mensagens m
                WHERE m.conversa_id = c.id
                ORDER BY m.id DESC
                LIMIT 1
             ) lm ON TRUE
             WHERE c.usuario_a_id = $1 OR c.usuario_b_id = $1
             ORDER BY COALESCE(lm.enviada_em, c.atualizada_em) DESC`,
            [usuarioId]
        );

        return res.json(resultado.rows);
    } catch (erro) {
        console.error('Erro ao listar conversas:', erro);
        return res.status(500).json({ erro: 'Não foi possível carregar suas conversas.' });
    }
});

// Retorna até as 100 mensagens mais recentes de uma conversa.
app.get('/api/chat/conversas/:id/mensagens', autenticarUsuario, async (req, res) => {
    const conversaId = Number(req.params.id);
    const usuarioId = Number(req.usuario.id);

    if (!Number.isInteger(conversaId) || conversaId <= 0) {
        return res.status(400).json({ erro: 'Conversa inválida.' });
    }

    try {
        const conversa = await buscarConversaDoUsuario(conversaId, usuarioId);
        if (!conversa) {
            return res.status(404).json({ erro: 'Conversa não encontrada.' });
        }

        const resultado = await pool.query(
            `WITH ultimas AS (
                SELECT m.id, m.conversa_id, m.remetente_id, m.conteudo, m.enviada_em, m.lida_em
                FROM mensagens m
                WHERE m.conversa_id = $1
                ORDER BY m.id DESC
                LIMIT 100
             )
             SELECT * FROM ultimas ORDER BY id ASC`,
            [conversaId]
        );

        return res.json(resultado.rows);
    } catch (erro) {
        console.error('Erro ao carregar mensagens:', erro);
        return res.status(500).json({ erro: 'Não foi possível carregar as mensagens.' });
    }
});

// Envia uma nova mensagem.
app.post('/api/chat/conversas/:id/mensagens', autenticarUsuario, async (req, res) => {
    const conversaId = Number(req.params.id);
    const usuarioId = Number(req.usuario.id);
    const conteudo = String(req.body.conteudo || '').trim();

    if (!Number.isInteger(conversaId) || conversaId <= 0) {
        return res.status(400).json({ erro: 'Conversa inválida.' });
    }

    if (!conteudo) {
        return res.status(400).json({ erro: 'Digite uma mensagem antes de enviar.' });
    }

    if (conteudo.length > 2000) {
        return res.status(400).json({ erro: 'A mensagem pode ter no máximo 2.000 caracteres.' });
    }

    const client = await pool.connect();
    try {
        const conversa = await client.query(
            `SELECT id FROM conversas
             WHERE id = $1 AND (usuario_a_id = $2 OR usuario_b_id = $2)`,
            [conversaId, usuarioId]
        );

        if (conversa.rows.length === 0) {
            return res.status(404).json({ erro: 'Conversa não encontrada.' });
        }

        await client.query('BEGIN');
        const inserida = await client.query(
            `INSERT INTO mensagens (conversa_id, remetente_id, conteudo)
             VALUES ($1, $2, $3)
             RETURNING id, conversa_id, remetente_id, conteudo, enviada_em, lida_em`,
            [conversaId, usuarioId, conteudo]
        );
        await client.query('UPDATE conversas SET atualizada_em = NOW() WHERE id = $1', [conversaId]);
        await client.query('COMMIT');

        return res.status(201).json(inserida.rows[0]);
    } catch (erro) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        console.error('Erro ao enviar mensagem:', erro);
        return res.status(500).json({ erro: 'Não foi possível enviar a mensagem.' });
    } finally {
        client.release();
    }
});

// Marca como lidas todas as mensagens recebidas naquela conversa.
app.patch('/api/chat/conversas/:id/ler', autenticarUsuario, async (req, res) => {
    const conversaId = Number(req.params.id);
    const usuarioId = Number(req.usuario.id);

    if (!Number.isInteger(conversaId) || conversaId <= 0) {
        return res.status(400).json({ erro: 'Conversa inválida.' });
    }

    try {
        const conversa = await buscarConversaDoUsuario(conversaId, usuarioId);
        if (!conversa) {
            return res.status(404).json({ erro: 'Conversa não encontrada.' });
        }

        const resultado = await pool.query(
            `UPDATE mensagens
             SET lida_em = NOW()
             WHERE conversa_id = $1
               AND remetente_id <> $2
               AND lida_em IS NULL
             RETURNING id`,
            [conversaId, usuarioId]
        );

        return res.json({ marcadasComoLidas: resultado.rowCount });
    } catch (erro) {
        console.error('Erro ao marcar mensagens como lidas:', erro);
        return res.status(500).json({ erro: 'Não foi possível atualizar as mensagens.' });
    }
});

// Contador usado no cabeçalho para o badge de mensagens.
app.get('/api/chat/nao-lidas', autenticarUsuario, async (req, res) => {
    const usuarioId = Number(req.usuario.id);

    try {
        const resultado = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM mensagens m
             JOIN conversas c ON c.id = m.conversa_id
             WHERE (c.usuario_a_id = $1 OR c.usuario_b_id = $1)
               AND m.remetente_id <> $1
               AND m.lida_em IS NULL`,
            [usuarioId]
        );

        return res.json({ total: resultado.rows[0].total });
    } catch (erro) {
        console.error('Erro ao contar mensagens não lidas:', erro);
        return res.status(500).json({ erro: 'Não foi possível atualizar o contador de mensagens.' });
    }
});

// ==========================================
// ROTAS PÚBLICAS E DE USUÁRIOS
// ==========================================

app.get('/api/teste', (req, res) => {
    res.json({ status: "Servidor está online!" });
});

// 1. CADASTRO (SIGN UP)
app.post('/api/signup', async (req, res) => {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ erro: 'Por favor, preencha todos os campos.' });
    }

    try {
        const resultadoEmail = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (resultadoEmail.rows.length > 0) {
            return res.status(400).json({ erro: 'Este e-mail já está cadastrado.' });
        }

        const hash = await bcrypt.hash(senha, 10);
        const codigoOTP = Math.floor(100000 + Math.random() * 900000).toString();

        const novoUsuario = await pool.query(
            'INSERT INTO usuarios (nome, email, senha, codigo_verificacao, verificado) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [nome, email, hash, codigoOTP, false]
        );

        const opcoesEmail = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Valide seu e-mail - Skill Market',
            text: `Olá ${nome}! Seu código de verificação para acesso ao Skill Market é: ${codigoOTP}`
        };

        await transportador.sendMail(opcoesEmail);

        res.status(201).json({
            mensagem: 'Código enviado!',
            usuarioId: novoUsuario.rows[0].id,
            email: email
        });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro interno ao processar cadastro no servidor.' });
    }
});

// 2. VERIFICAR CÓDIGO DO E-MAIL
app.post('/api/verificar-codigo', async (req, res) => {
    const { email, codigo } = req.body;

    try {
        const resultado = await pool.query(
            'SELECT * FROM usuarios WHERE email = $1 AND codigo_verificacao = $2',
            [email, codigo]
        );

        if (resultado.rows.length === 0) {
            return res.status(400).json({ erro: 'Código de verificação inválido ou incorreto.' });
        }

        await pool.query(
            'UPDATE usuarios SET verificado = TRUE, codigo_verificacao = NULL WHERE email = $1',
            [email]
        );

        res.json({ mensagem: 'E-mail validado com sucesso!' });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao processar validação.' });
    }
});

// 3. LOGIN (SIGN IN)
app.post('/api/signin', async (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ erro: 'Preencha todos os campos.' });
    }

    try {
        const resultado = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        const usuario = resultado.rows[0];

        if (!usuario) {
            return res.status(400).json({ erro: 'E-mail ou senha inválidos.' });
        }

        if (!usuario.verificado) {
            return res.status(400).json({ erro: 'Por favor, valide seu e-mail antes de acessar a conta.' });
        }

        const valida = await bcrypt.compare(senha, usuario.senha);
        if (!valida) {
            return res.status(400).json({ erro: 'E-mail ou senha inválidos.' });
        }

        const token = jwt.sign({ id: usuario.id, email: usuario.email }, JWT_SECRET, { expiresIn: '4h' });

        return res.json({
            mensagem: 'Login efetuado com sucesso!',
            token,
            usuarioId: usuario.id
        });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro interno de processamento.' });
    }
});

// 4. SOLICITAR RECUPERAÇÃO DE SENHA
app.post('/api/esqueci-senha', async (req, res) => {
    const { email } = req.body;

    try {
        const resultado = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (resultado.rows.length === 0) {
            return res.status(400).json({ erro: 'E-mail não localizado no sistema.' });
        }

        const token = crypto.randomBytes(20).toString('hex');
        await pool.query('UPDATE usuarios SET token_recuperacao = $1 WHERE email = $2', [token, email]);

        const frontendUrl = (process.env.FRONTEND_URL || 'https://skill-market-redesign.vercel.app').replace(/\/$/, '');
        const linkRedefinicao = `${frontendUrl}/redefinir-senha.html?token=${token}`;

        const opcoesEmail = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Recuperação de Senha - Skill Market',
            text: `Olá! Você solicitou a redefinição de sua senha. Clique no link para alterá-la: ${linkRedefinicao}`
        };

        await transportador.sendMail(opcoesEmail);
        res.json({ mensagem: 'Link enviado!' });

    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao processar recuperação de senha.' });
    }
});

// 5. ATUALIZAR NOVA SENHA
app.post('/api/redefinir-senha', async (req, res) => {
    const { token, novaSenha } = req.body;

    try {
        const resultado = await pool.query('SELECT * FROM usuarios WHERE token_recuperacao = $1', [token]);
        if (resultado.rows.length === 0) {
            return res.status(400).json({ erro: 'Token inválido ou expirado.' });
        }

        const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

        await pool.query(
            'UPDATE usuarios SET senha = $1, token_recuperacao = NULL WHERE token_recuperacao = $2',
            [novaSenhaHash, token]
        );

        res.json({ mensagem: 'Senha alterada!' });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao atualizar senha.' });
    }
});

// 6. ATUALIZAÇÃO DA INTENÇÃO
app.post('/api/intencao', async (req, res) => {
    const { usuario_id, intencao } = req.body;

    try {
        await pool.query('UPDATE usuarios SET intencao = $1 WHERE id = $2', [intencao, usuario_id]);
        res.status(200).json({ mensagem: 'Intenção registrada!' });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao salvar intenção.' });
    }
});

// 7. SALVAR PERFIL DO PROFISSIONAL (Vai para "pendente")
app.post('/api/perfil', async (req, res) => {
    const {
        usuario_id, nome_completo, area_atuacao, localizacao, sobre_voce, qualidades, telefone, instagram, email_contato, site, fotos, foto_perfil
    } = req.body;

    try {
        const queryUpsert = `
            INSERT INTO perfis (
                usuario_id, nome_completo, area_atuacao, localizacao, sobre_voce, qualidades, telefone, instagram, email_contato, site, fotos, foto_perfil, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pendente')
            ON CONFLICT (usuario_id) 
            DO UPDATE SET 
                nome_completo = EXCLUDED.nome_completo,
                area_atuacao = EXCLUDED.area_atuacao,
                localizacao = EXCLUDED.localizacao,
                sobre_voce = EXCLUDED.sobre_voce,
                qualidades = EXCLUDED.qualidades,
                telefone = EXCLUDED.telefone,
                instagram = EXCLUDED.instagram,
                email_contato = EXCLUDED.email_contato,
                site = EXCLUDED.site,
                fotos = EXCLUDED.fotos,
                foto_perfil = EXCLUDED.foto_perfil,
                status = 'pendente' -- Sempre volta para pendente após edição para ser aprovado novamente
            RETURNING id;
        `;

        const valores = [usuario_id, nome_completo, area_atuacao, localizacao, sobre_voce, qualidades, telefone, instagram, email_contato, site, fotos, foto_perfil];
        const resultado = await pool.query(queryUpsert, valores);
        res.status(200).json({ mensagem: 'Perfil salvo e enviado para análise do Administrador!', perfilId: resultado.rows[0].id });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao salvar perfil.' });
    }
});

// 8. ROTA DE AVALIAÇÃO DO PERFIL (CURTIDAS)
app.post('/api/perfil/:usuario_id/avaliar', async (req, res) => {
    const { usuario_id } = req.params;
    const { tipo } = req.body;

    try {
        const coluna = tipo === 'like' ? 'likes' : 'dislikes';
        const query = `UPDATE perfis SET ${coluna} = ${coluna} + 1 WHERE usuario_id = $1 RETURNING likes, dislikes`;
        const resultado = await pool.query(query, [usuario_id]);
        res.json(resultado.rows[0]);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao processar avaliação.' });
    }
});

// 9. BUSCAR TODOS OS PERFIS (Só mostra os aprovados)
app.get('/api/perfis', async (req, res) => {
    const { busca } = req.query;

    try {
        let query = `
            SELECT p.*, u.nome, u.email 
            FROM perfis p 
            JOIN usuarios u ON p.usuario_id = u.id
            WHERE p.status = 'aprovado'
        `;
        let valores = [];

        if (busca) {
            query += ` AND (p.nome_completo ILIKE $1 OR p.area_atuacao ILIKE $1 OR p.qualidades ILIKE $1 OR p.localizacao ILIKE $1)`;
            valores.push(`%${busca}%`);
        }

        const resultado = await pool.query(query, valores);
        res.json(resultado.rows);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao buscar profissionais.' });
    }
});

// 10. BUSCAR UM ÚNICO PERFIL PELO ID DO USUÁRIO
app.get('/api/perfil/:usuario_id', async (req, res) => {
    const { usuario_id } = req.params;

    try {
        const resultado = await pool.query(
            `SELECT p.*, u.nome, u.email 
             FROM perfis p 
             JOIN usuarios u ON p.usuario_id = u.id 
             WHERE p.usuario_id = $1`, 
            [usuario_id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ erro: 'Perfil não encontrado.' });
        }

        res.json(resultado.rows[0]);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao obter dados do perfil.' });
    }
});

// INICIALIZADOR DO SERVIDOR
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ Servidor rodando em 0.0.0.0:${PORT}`);
    testarConexao().catch(() => {});

    transportador.verify(function (error, success) {
        if (error) {
            console.log("✗ Erro no servidor de e-mails (Nodemailer):", error.message);
        } else {
            console.log("✓ Servidor de e-mails (Nodemailer) ativo!");
        }
    });
});