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
// Login do Administrador
app.post('/api/admin/login', (req, res) => {
    const { email, senha } = req.body;
    
    // --- ESPIONANDO AS VARIÁVEIS NO TERMINAL ---
    console.log("=== TENTATIVA DE LOGIN ADMIN ===");
    console.log(`O que você digitou na tela -> Email: '${email}' | Senha: '${senha}'`);
    console.log(`O que o servidor leu no .env -> Email: '${process.env.ADMIN_EMAIL}' | Senha: '${process.env.ADMIN_SENHA}'`);
    // -------------------------------------------

    if (email === process.env.ADMIN_EMAIL && senha === process.env.ADMIN_SENHA) {
        const tokenAdmin = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
        return res.json({ mensagem: 'Login de Admin efetuado!', tokenAdmin });
    }
    return res.status(401).json({ erro: 'Credenciais de administrador inválidas.' });
});

// Listar perfis pendentes
app.get('/api/admin/pendentes', async (req, res) => {
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
app.patch('/api/admin/avaliar/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // Deve receber 'aprovado' ou 'rejeitado'
    try {
        await pool.query('UPDATE perfis SET status = $1 WHERE id = $2', [status, id]);
        res.json({ mensagem: `Perfil marcado como ${status}.` });
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao atualizar status do perfil.' });
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

        const linkRedefinicao = `https://skill-market-ruby.vercel.app/redefinir-senha.html?token=${token}`;

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
app.listen(PORT, () => {
    console.log(`✓ Servidor rodando localmente na porta ${PORT}`);
    testarConexao().catch(() => {});

    transportador.verify(function (error, success) {
        if (error) {
            console.log("✗ Erro no servidor de e-mails (Nodemailer):", error.message);
        } else {
            console.log("✓ Servidor de e-mails (Nodemailer) ativo!");
        }
    });
});