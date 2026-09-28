const API_URL = 'https://skillmarket-api-7gpd.onrender.com/api';

// --- CONFIGURAÇÃO DE CABEÇALHO DINÂMICO ---
function configurarHeaderDinamico() {
    const token = localStorage.getItem('token');
    const usuarioId = localStorage.getItem('usuarioId');
    const menuSignIn = document.getElementById('menu-signin');
    const menuSignUp = document.getElementById('menu-signup');
    const menuPerfil = document.getElementById('menu-perfil');

    const linkMeuPerfil = document.getElementById('linkMeuPerfil');
    const linkMeuPerfilMenu = document.getElementById('linkMeuPerfilMenu');

    configurarAcessoChat(token);

    if (usuarioId) {
        if (linkMeuPerfil) linkMeuPerfil.href = `perfil.html?id=${usuarioId}`;
        if (linkMeuPerfilMenu) linkMeuPerfilMenu.href = `perfil.html?id=${usuarioId}`;
    }

    if (token) {
        if (menuSignIn) menuSignIn.style.display = 'none';
        if (menuSignUp) menuSignUp.style.display = 'none';
        if (menuPerfil) menuPerfil.style.display = 'block';

        if (usuarioId) {
            fetch(`${API_URL}/perfil/${usuarioId}`)
                .then(res => res.json())
                .then(prof => {
                    if (prof && prof.foto_perfil) {
                        document.querySelectorAll('.imagem2-header').forEach(img => {
                            img.src = prof.foto_perfil;
                        });
                    }
                })
                .catch(() => {});
        }
    } else {
        if (menuSignIn) menuSignIn.style.display = 'block';
        if (menuSignUp) menuSignUp.style.display = 'block';
        if (menuPerfil) menuPerfil.style.display = 'none';
    }
}

let intervaloContadorChat = null;

function criarBadgeMensagens(id) {
    const badge = document.createElement('span');
    badge.id = id;
    badge.className = 'chat-unread-badge';
    badge.hidden = true;
    badge.textContent = '0';
    return badge;
}

function configurarAcessoChat(token) {
    const nav = document.querySelector('.itens-header');
    let menuMensagens = document.getElementById('menu-mensagens');

    if (nav && !menuMensagens) {
        menuMensagens = document.createElement('li');
        menuMensagens.id = 'menu-mensagens';
        menuMensagens.style.display = 'none';

        const link = document.createElement('a');
        link.href = 'mensagens.html';
        link.className = 'nav-message-link';
        link.append(document.createTextNode('Mensagens'));
        link.appendChild(criarBadgeMensagens('chatUnreadBadge'));
        menuMensagens.appendChild(link);

        const referencia = document.getElementById('menu-signin') || document.getElementById('menu-signup');
        nav.insertBefore(menuMensagens, referencia || null);
    }

    const submenu = document.querySelector('.submenu-perfil');
    let linkSubmenu = document.getElementById('linkMensagensMenu');
    if (submenu && !linkSubmenu) {
        linkSubmenu = document.createElement('a');
        linkSubmenu.id = 'linkMensagensMenu';
        linkSubmenu.href = 'mensagens.html';
        linkSubmenu.className = 'submenu-mensagens-link';
        linkSubmenu.append(document.createTextNode('Mensagens'));
        linkSubmenu.appendChild(criarBadgeMensagens('chatUnreadBadgeMenu'));
        const sair = document.getElementById('btnSair');
        submenu.insertBefore(linkSubmenu, sair || null);
    }

    if (token) {
        if (menuMensagens) menuMensagens.style.display = 'list-item';
        if (linkSubmenu) linkSubmenu.style.display = 'flex';
        carregarContadorMensagens();
        if (!intervaloContadorChat) {
            intervaloContadorChat = window.setInterval(carregarContadorMensagens, 30000);
        }
    } else {
        if (menuMensagens) menuMensagens.style.display = 'none';
        if (linkSubmenu) linkSubmenu.style.display = 'none';
        atualizarBadgeMensagens(0);
        if (intervaloContadorChat) {
            clearInterval(intervaloContadorChat);
            intervaloContadorChat = null;
        }
    }
}

function atualizarBadgeMensagens(total) {
    const valor = Number(total) || 0;
    ['chatUnreadBadge', 'chatUnreadBadgeMenu'].forEach(id => {
        const badge = document.getElementById(id);
        if (!badge) return;
        badge.textContent = valor > 99 ? '99+' : String(valor);
        badge.hidden = valor <= 0;
    });
}

async function carregarContadorMensagens() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const resposta = await fetch(`${API_URL}/chat/nao-lidas`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resposta.ok) return;
        const dados = await resposta.json();
        atualizarBadgeMensagens(dados.total);
    } catch (_) {
        // O contador é complementar; falhas temporárias não interrompem a navegação.
    }
}

document.addEventListener('DOMContentLoaded', () => {
    configurarHeaderDinamico();
    preencherFormularioPerfil();
});

// --- SAIR DA CONTA ---
const btnSair = document.getElementById('btnSair');
if (btnSair) {
    btnSair.addEventListener('click', function (e) {
        e.preventDefault();
        ['token', 'usuarioId', 'emailValidando', 'tokenAdmin'].forEach(chave => localStorage.removeItem(chave));
        alert('Sessão encerrada!');
        window.location.href = 'index.html';
    });
}

// --- PROCESSAMENTO DO LOGIN (SIGN IN) ---
const formLogin = document.getElementById('formLogin');
const mensagemErroLogin = document.getElementById('mensagemErroLogin');

if (formLogin) {
    formLogin.addEventListener('submit', async function (evento) {
        evento.preventDefault();

        const email = document.getElementById('loginEmail').value.trim();
        const senha = document.getElementById('loginSenha').value;

        try {
            const resposta = await fetch(`${API_URL}/signin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha })
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                if (mensagemErroLogin) mensagemErroLogin.textContent = dados.erro || 'Falha ao autenticar.';
                return;
            }

            localStorage.setItem('token', dados.token);
            localStorage.setItem('usuarioId', dados.usuarioId);

            const redirect = new URLSearchParams(window.location.search).get('redirect');
            const destinoSeguro = redirect && /^[a-zA-Z0-9_.-]+\.html(?:\?.*)?$/.test(redirect);
            window.location.href = destinoSeguro ? redirect : `perfil.html?id=${dados.usuarioId}`;
        } catch (erro) {
            if (mensagemErroLogin) mensagemErroLogin.textContent = 'Erro ao conectar ao servidor.';
        }
    });
}

// --- BUSCA NO CABEÇALHO ---
const campoBuscaHeader = document.getElementById('campoBuscaHeader');
const btnBuscarHeader = document.getElementById('btnBuscarHeader');

function executarBuscaHeader() {
    if (!campoBuscaHeader) return;
    const termo = campoBuscaHeader.value.trim();
    window.location.href = `busca.html?busca=${encodeURIComponent(termo)}`;
}

if (btnBuscarHeader && campoBuscaHeader) {
    btnBuscarHeader.addEventListener('click', executarBuscaHeader);
    campoBuscaHeader.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executarBuscaHeader();
    });
}

// --- RENDERIZAR RESULTADOS DA BUSCA (BUSCA.HTML) ---
const containerResultados = document.getElementById('containerResultados');
const containerProfissionais = document.getElementById('containerProfissionais'); // Para index.html

async function carregarResultadosBusca() {
    // Detecta onde deve renderizar (na index ou na busca)
    const renderTarget = containerResultados || containerProfissionais;
    if (!renderTarget) return;

    const parametros = new URLSearchParams(window.location.search);
    const termoBusca = parametros.get('busca') || '';

    if (campoBuscaHeader) campoBuscaHeader.value = termoBusca;

    try {
        const url = termoBusca ? `${API_URL}/perfis?busca=${encodeURIComponent(termoBusca)}` : `${API_URL}/perfis`;
        const resposta = await fetch(url);
        const profissionais = await resposta.json();

        renderTarget.innerHTML = '';

        if (!Array.isArray(profissionais) || profissionais.length === 0) {
            renderTarget.innerHTML = '<div class="empty-state">Nenhum profissional aprovado foi localizado.</div>';
            return;
        }

        profissionais.forEach(prof => {
            const card = document.createElement('article');
            const fotoExibicao = prof.foto_perfil || 'imagens/placeholder-usuario.png';
            const nome = prof.nome_completo || prof.nome || 'Profissional';
            const area = prof.area_atuacao || 'Serviços digitais';
            const localizacao = prof.localizacao || 'Atendimento online';
            const descricao = prof.sobre_voce
                ? prof.sobre_voce.substring(0, containerResultados ? 125 : 105) + (prof.sobre_voce.length > (containerResultados ? 125 : 105) ? '...' : '')
                : 'Este profissional ainda não adicionou uma apresentação.';
            const qualidades = prof.qualidades
                ? prof.qualidades.split(',').map(item => item.trim()).filter(Boolean).slice(0, 3)
                : [];

            if (containerResultados) {
                card.className = 'card-resultado';
                card.innerHTML = `
                    <div class="result-card-head">
                        <img src="${fotoExibicao}" alt="Foto de ${nome}" class="avatar-card-resultado">
                        <div class="result-card-title">
                            <h2>${nome}</h2>
                            <span>${area}</span>
                        </div>
                    </div>
                    <div class="result-card-location">⌖ ${localizacao}</div>
                    <div class="card-resultado-info"><p>${descricao}</p></div>
                    ${qualidades.length ? `<div class="result-card-tags">${qualidades.map(q => `<span>${q}</span>`).join('')}</div>` : ''}
                    <a href="perfil.html?id=${prof.usuario_id}" class="btn-resultado">Ver perfil</a>
                `;
            } else {
                card.className = 'card professional-card';
                card.innerHTML = `
                    <div class="frontofcard">
                        <img src="${fotoExibicao}" alt="Foto de ${nome}" class="home-professional-avatar">
                        <div>
                            <strong>${nome}</strong>
                            <p>${area}</p>
                        </div>
                    </div>
                    <div class="backofcard">
                        <p>${descricao}</p>
                        <div class="home-card-meta">⌖ ${localizacao}</div>
                        <a href="perfil.html?id=${prof.usuario_id}">Ver perfil</a>
                    </div>
                `;
            }
            renderTarget.appendChild(card);
        });

    } catch (erro) {
        console.error(erro);
    }
}

if (containerResultados || containerProfissionais) {
    carregarResultadosBusca();
}

// --- EXIBIÇÃO DO PERFIL DINÂMICO COMPLETO (PERFIL.HTML) ---
const cNome = document.getElementById('cNome');

if (cNome) {
    async function carregarPerfilCompleto() {
        const parametros = new URLSearchParams(window.location.search);
        
        let usuarioId = parametros.get('id');
        if (!usuarioId) {
            usuarioId = localStorage.getItem('usuarioId');
        }

        if (!usuarioId) {
            window.location.href = 'index.html';
            return;
        }

        try {
            const resposta = await fetch(`${API_URL}/perfil/${usuarioId}`);
            
            // VERIFICA SE QUEM ESTÁ ACESSANDO TEM TOKEN DE ADMIN
            const isAdmin = localStorage.getItem('tokenAdmin') !== null;
            const isDonoDoPerfil = usuarioId === localStorage.getItem('usuarioId');
            
            if (!resposta.ok) {
                if (isDonoDoPerfil) {
                    alert('Você ainda não configurou seu perfil profissional. Vamos preencher seus dados agora!');
                    window.location.href = 'perfil-profissional.html';
                } else {
                    alert('Perfil ainda não configurado por este profissional.');
                    window.location.href = 'index.html';
                }
                return;
            }

            const prof = await resposta.json();

            // LÓGICA DE BLOQUEIO ATUALIZADA (Permite o Admin acessar)
            if (prof.status === 'pendente' && isDonoDoPerfil) {
                alert("Atenção: Seu perfil está em análise pelos administradores. Ele só aparecerá nas buscas após ser aprovado.");
            } else if (prof.status === 'rejeitado' && isDonoDoPerfil) {
                alert("Atenção: Seu perfil foi REJEITADO. Por favor, edite suas informações para uma nova análise.");
            } else if (prof.status !== 'aprovado' && !isDonoDoPerfil && !isAdmin) {
                // Se não for aprovado, não for o dono E NÃO FOR ADMIN, bloqueia!
                alert("Este perfil não está disponível para visualização pública no momento.");
                window.location.href = 'index.html';
                return;
            }

            cNome.textContent = prof.nome_completo || prof.nome;
            document.getElementById('cLocalizacao').textContent = prof.localizacao || 'Sem localização';
            document.getElementById('cEmpresa').textContent = prof.area_atuacao || 'Especialista';
            document.getElementById('cBio').textContent = prof.sobre_voce || 'Este profissional não adicionou descrição.';

            const avatarImg = document.getElementById('cAvatar');
            if (avatarImg) {
                avatarImg.src = prof.foto_perfil || 'imagens/placeholder-usuario.png';
            }

            const cQualidades = document.getElementById('cQualidades');
            cQualidades.innerHTML = '';
            if (prof.qualidades) {
                prof.qualidades.split(',').forEach(q => {
                    if (q.trim() !== '') {
                        const tag = document.createElement('span');
                        tag.className = 'tag-q';
                        tag.textContent = q.trim();
                        cQualidades.appendChild(tag);
                    }
                });
            }

            document.getElementById('cWhats').href = prof.email_contato ? `mailto:${prof.email_contato}` : '#';
            document.getElementById('cWhatsReal').href = prof.telefone ? `https://wa.me/${prof.telefone.replace(/\D/g, '')}` : '#';
            document.getElementById('cInsta').href = prof.instagram ? `https://instagram.com/${prof.instagram.replace('@', '')}` : '#';
            const cSite = document.getElementById('cSite');
            if (cSite) {
                if (prof.site) {
                    const siteUrl = /^https?:\/\//i.test(prof.site) ? prof.site : `https://${prof.site}`;
                    cSite.href = siteUrl;
                    cSite.style.display = 'flex';
                } else {
                    cSite.style.display = 'none';
                }
            }

            document.getElementById('numLikes').textContent = prof.likes || 0;
            document.getElementById('numDislikes').textContent = prof.dislikes || 0;

            const cPortfolio = document.getElementById('cPortfolio');
            cPortfolio.innerHTML = '';
            if (prof.fotos && prof.fotos.trim() !== '') {
                const arrayFotos = prof.fotos.split('|');
                arrayFotos.forEach(fotoBase64 => {
                    if (fotoBase64.trim() !== '') {
                        const imgDiv = document.createElement('div');
                        imgDiv.className = 'portfolio-img-c';
                        imgDiv.style.backgroundImage = `url(${fotoBase64})`;
                        cPortfolio.appendChild(imgDiv);
                    }
                });
            } else {
                for (let i = 0; i < 4; i++) {
                    const place = document.createElement('div');
                    place.className = 'portfolio-img-c';
                    cPortfolio.appendChild(place);
                }
            }

            configurarBotaoChatPerfil(usuarioId, isDonoDoPerfil);
            configurarBotoesAvaliacao(usuarioId);

        } catch (erro) {
            console.error(erro);
        }
    }

    function configurarBotaoChatPerfil(profissionalId, isDonoDoPerfil) {
        const botao = document.getElementById('btnIniciarChat');
        if (!botao) return;

        if (isDonoDoPerfil) {
            botao.hidden = true;
            return;
        }

        botao.hidden = false;
        botao.onclick = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                const retorno = `perfil.html?id=${encodeURIComponent(profissionalId)}`;
                window.location.href = `signin.html?redirect=${encodeURIComponent(retorno)}`;
                return;
            }

            const textoOriginal = botao.innerHTML;
            botao.disabled = true;
            botao.innerHTML = '<span class="chat-button-spinner" aria-hidden="true"></span> Abrindo conversa...';

            try {
                const resposta = await fetch(`${API_URL}/chat/conversas`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ profissional_id: Number(profissionalId) })
                });
                const dados = await resposta.json();

                if (resposta.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('usuarioId');
                    const retorno = `perfil.html?id=${encodeURIComponent(profissionalId)}`;
                    window.location.href = `signin.html?redirect=${encodeURIComponent(retorno)}`;
                    return;
                }

                if (!resposta.ok) {
                    alert(dados.erro || 'Não foi possível abrir a conversa.');
                    return;
                }

                window.location.href = `mensagens.html?conversa=${encodeURIComponent(dados.conversaId)}`;
            } catch (_) {
                alert('Não foi possível conectar ao chat agora. Tente novamente.');
            } finally {
                botao.disabled = false;
                botao.innerHTML = textoOriginal;
            }
        };
    }

    function configurarBotoesAvaliacao(usuarioId) {
        const btnLike = document.getElementById('btnLike');
        const btnDislike = document.getElementById('btnDislike');

        if (btnLike && btnDislike) {
            btnLike.addEventListener('click', () => votar(usuarioId, 'like'));
            btnDislike.addEventListener('click', () => votar(usuarioId, 'dislike'));
        }
    }

    async function votar(usuarioId, tipo) {
        try {
            const resposta = await fetch(`${API_URL}/perfil/${usuarioId}/avaliar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo })
            });
            const dados = await resposta.json();
            if (resposta.ok) {
                document.getElementById('numLikes').textContent = dados.likes;
                document.getElementById('numDislikes').textContent = dados.dislikes;
            }
        } catch (erro) {
            console.error(erro);
        }
    }

    carregarPerfilCompleto();
}
// --- FORMULÁRIO DE EDICÃO DE PERFIL ---
async function preencherFormularioPerfil() {
    const formPerfil = document.getElementById('formPerfil');
    if (!formPerfil) return;

    const usuarioId = localStorage.getItem('usuarioId');
    if (!usuarioId) return;

    try {
        const resposta = await fetch(`${API_URL}/perfil/${usuarioId}`);
        if (!resposta.ok) return;

        const prof = await resposta.json();

        if (document.getElementById('nomeCompleto')) document.getElementById('nomeCompleto').value = prof.nome_completo || '';
        if (document.getElementById('areaAtuacao')) document.getElementById('areaAtuacao').value = prof.area_atuacao || '';
        if (document.getElementById('localizacao')) document.getElementById('localizacao').value = prof.localizacao || '';
        if (document.getElementById('sobreVoce')) document.getElementById('sobreVoce').value = prof.sobre_voce || '';
        if (document.getElementById('telefone')) document.getElementById('telefone').value = prof.telefone || '';
        if (document.getElementById('instagram')) document.getElementById('instagram').value = prof.instagram || '';
        if (document.getElementById('emailContato')) document.getElementById('emailContato').value = prof.email_contato || '';
        if (document.getElementById('site')) document.getElementById('site').value = prof.site || '';

        if (prof.foto_perfil) {
            const previewAvatar = document.getElementById('previewAvatar');
            if (previewAvatar) previewAvatar.src = prof.foto_perfil;
        }

        const qualidadesContainer = document.getElementById('qualidadesContainer');
        const btnAddQualidade = document.getElementById('btnAddQualidade');
        if (qualidadesContainer && btnAddQualidade && prof.qualidades) {
            const inputsExistentes = qualidadesContainer.querySelectorAll('.input-qualidade');
            inputsExistentes.forEach(input => input.remove());

            prof.qualidades.split(',').forEach(q => {
                if (q.trim() !== '') {
                    const novoInput = document.createElement('input');
                    novoInput.type = 'text';
                    novoInput.className = 'input-qualidade';
                    novoInput.value = q.trim();
                    qualidadesContainer.insertBefore(novoInput, btnAddQualidade);
                }
            });
        }

        const imagensContainer = document.getElementById('imagensContainer');
        const btnAddImagem = document.getElementById('btnAddImagem');
        if (imagensContainer && btnAddImagem && prof.fotos) {
            const labelsExistentes = imagensContainer.querySelectorAll('.imagem-upload');
            labelsExistentes.forEach(label => {
                const img = label.querySelector('img');
                if (img && img.id !== 'previewAvatar') {
                    label.remove();
                }
            });

            prof.fotos.split('|').forEach(fotoBase64 => {
                if (fotoBase64.trim() !== '') {
                    const novoLabel = document.createElement('label');
                    novoLabel.className = 'imagem-upload';

                    const novaImg = document.createElement('img');
                    novaImg.src = fotoBase64;
                    novaImg.className = 'preview-imagem';

                    const novoInputImagem = document.createElement('input');
                    novoInputImagem.type = 'file';
                    novoInputImagem.accept = 'image/*';
                    novoInputImagem.className = 'input-imagem';
                    novoInputImagem.hidden = true;

                    novoLabel.appendChild(novaImg);
                    novoLabel.appendChild(novoInputImagem);
                    imagensContainer.insertBefore(novoLabel, btnAddImagem);

                    ativarPreview(novoInputImagem);
                }
            });
        }

    } catch (erro) {
        console.error(erro);
    }
}

// --- FORMULÁRIO DE CADASTRO (SIGN UP) ---
const formCadastro = document.getElementById('formCadastro');
const mensagemErroCadastro = document.getElementById('mensagemErro');

if (formCadastro) {
    formCadastro.addEventListener('submit', async function (evento) {
        evento.preventDefault(); 

        const nome = document.getElementById('nome').value.trim();
        const email = document.getElementById('email').value.trim();
        const senha = document.getElementById('senha').value;
        const confirmarSenha = document.getElementById('confirmarSenha').value;

        if (!nome || !email || !senha || !confirmarSenha) {
            mensagemErroCadastro.textContent = 'Preencha todos os campos.';
            return;
        }

        if (senha.length < 6) {
            mensagemErroCadastro.textContent = 'A senha precisa de pelo menos 6 caracteres.';
            return;
        }

        if (senha !== confirmarSenha) {
            mensagemErroCadastro.textContent = 'As senhas não coincidem.';
            return;
        }

        mensagemErroCadastro.textContent = '';

        try {
            const resposta = await fetch(`${API_URL}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, email, senha })
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                mensagemErroCadastro.textContent = dados.erro || 'Não foi possível cadastrar.';
                return;
            }

            localStorage.setItem('usuarioId', dados.usuarioId);
            localStorage.setItem('emailValidando', email);
            window.location.href = 'verificar.html';

        } catch (erro) {
            mensagemErroCadastro.textContent = 'Servidor offline.';
        }
    });
}

// --- INTENÇÃO ---
const opcaoContratar = document.getElementById('opcaoContratar');
const opcaoAmbos = document.getElementById('opcaoAmbos');

async function registrarIntencao(tipoIntencao, paginaRedirecionamento) {
    const usuarioId = localStorage.getItem('usuarioId');

    if (!usuarioId) {
        alert("Sessão expirada. Realize o cadastro novamente.");
        window.location.href = "signup.html";
        return;
    }

    try {
        const resposta = await fetch(`${API_URL}/intencao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: parseInt(usuarioId), intencao: tipoIntencao })
        });

        if (resposta.ok) {
            window.location.href = paginaRedirecionamento;
        } else {
            alert("Erro ao registrar intenção.");
        }
    } catch (erro) {
        alert("Erro de conexão.");
    }
}

if (opcaoContratar) {
    opcaoContratar.addEventListener('click', function(e) {
        e.preventDefault();
        registrarIntencao('Apenas contratar', 'perfil-contratante.html');
    });
}

if (opcaoAmbos) {
    opcaoAmbos.addEventListener('click', function(e) {
        e.preventDefault();
        registrarIntencao('Contratar e oferecer', 'perfil-profissional.html');
    });
}

// --- GESTÃO DE IMAGENS E PREVIEW DO PORTFÓLIO ---
function ativarPreview(inputImagem) {
    inputImagem.addEventListener('change', function () {
        const arquivo = inputImagem.files[0];
        if (!arquivo) return;

        const leitor = new FileReader();
        leitor.onload = function (evento) {
            const imgPreview = inputImagem.parentElement.querySelector('.preview-imagem');
            imgPreview.src = evento.target.result;
        };
        leitor.readAsDataURL(arquivo);
    });
}

document.querySelectorAll('.input-imagem').forEach(ativarPreview);

const btnAddImagem = document.getElementById('btnAddImagem');
const imagensContainer = document.getElementById('imagensContainer');

if (btnAddImagem && imagensContainer) {
    btnAddImagem.addEventListener('click', function () {
        const novoLabel = document.createElement('label');
        novoLabel.className = 'imagem-upload';

        const novaImg = document.createElement('img');
        novaImg.src = 'imagens/placeholder-paisagem.png';
        novaImg.alt = '';
        novaImg.className = 'preview-imagem';

        const novoInputImagem = document.createElement('input');
        novoInputImagem.type = 'file';
        novoInputImagem.accept = 'image/*';
        novoInputImagem.className = 'input-imagem';
        novoInputImagem.hidden = true;

        novoLabel.appendChild(novaImg);
        novoLabel.appendChild(novoInputImagem);

        imagensContainer.insertBefore(novoLabel, btnAddImagem);
        ativarPreview(novoInputImagem);
    });
}

// --- FORMULÁRIO SALVAR PERFIL COMPLETO ---
const formPerfil = document.getElementById('formPerfil');

if (formPerfil) {
    formPerfil.addEventListener('submit', async function (evento) {
        evento.preventDefault();

        const usuarioId = localStorage.getItem('usuarioId');
        if (!usuarioId) {
            alert('Erro: Usuário não identificado.');
            window.location.href = 'signup.html';
            return;
        }

        const nomeCompleto = document.getElementById('nomeCompleto').value.trim();
        const areaAtuacao = document.getElementById('areaAtuacao').value.trim();
        const localizacao = document.getElementById('localizacao').value.trim();
        const sobreVoce = document.getElementById('sobreVoce').value.trim();
        const telefone = document.getElementById('telefone').value.trim();
        const instagram = document.getElementById('instagram').value.trim();
        const emailContato = document.getElementById('emailContato').value.trim();
        const site = document.getElementById('site').value.trim();

        const previewAvatar = document.getElementById('previewAvatar');
        let fotoPerfilBase64 = null;
        if (previewAvatar && previewAvatar.src && previewAvatar.src.startsWith('data:image')) {
            fotoPerfilBase64 = previewAvatar.src;
        }

        const inputsQualidade = document.querySelectorAll('.input-qualidade');
        const listaQualidades = [];
        inputsQualidade.forEach(input => {
            if (input.value.trim() !== "") {
                listaQualidades.push(input.value.trim());
            }
        });
        const qualidadesTexto = listaQualidades.join(', ');

        const previews = document.querySelectorAll('.preview-imagem');
        const arrayImagens = [];
        previews.forEach(img => {
            if (img.id !== 'previewAvatar' && img.src && img.src.startsWith('data:image')) {
                arrayImagens.push(img.src);
            }
        });
        const fotosTexto = arrayImagens.join('|');

        try {
            const resposta = await fetch(`${API_URL}/perfil`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usuario_id: parseInt(usuarioId),
                    nome_completo: nomeCompleto,
                    area_atuacao: areaAtuacao,
                    localizacao: localizacao,
                    sobre_voce: sobreVoce,
                    qualidades: qualidadesTexto,
                    telefone: telefone,
                    instagram: instagram,
                    email_contato: emailContato,
                    site: site,
                    fotos: fotosTexto,
                    foto_perfil: fotoPerfilBase64
                })
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                alert(dados.erro || 'Falha ao salvar perfil.');
                return;
            }

            alert('Perfil enviado para moderação! Assim que aprovado pelo Administrador, ele ficará público.');
            window.location.href = `perfil.html?id=${usuarioId}`;

        } catch (erro) {
            console.error(erro);
            alert('Não foi possível salvar o perfil.');
        }
    });
}

// --- ADICIONAR CAMPOS DE QUALIDADES ---
const btnAddQualidade = document.getElementById('btnAddQualidade');
const qualidadesContainer = document.getElementById('qualidadesContainer');

if (btnAddQualidade && qualidadesContainer) {
    btnAddQualidade.addEventListener('click', function () {
        const novoInput = document.createElement('input');
        novoInput.type = 'text';
        novoInput.className = 'input-qualidade';
        novoInput.placeholder = 'Qualidade';

        qualidadesContainer.insertBefore(novoInput, btnAddQualidade);
        novoInput.focus();
    });
}

// --- VERIFICAÇÃO DE E-MAIL (OTP) ---
const formVerificar = document.getElementById('formVerificar');
const msgErroVerificar = document.getElementById('mensagemErroVerificacao');

if (formVerificar) {
    formVerificar.addEventListener('submit', async function (e) {
        e.preventDefault();
        const codigo = document.getElementById('codigoVerificacao').value.trim();
        const email = localStorage.getItem('emailValidando');

        if (!email) {
            alert('Sessão expirada. Realize o cadastro novamente.');
            window.location.href = 'signup.html';
            return;
        }

        try {
            const resposta = await fetch(`${API_URL}/verificar-codigo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, codigo })
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                msgErroVerificar.textContent = dados.erro || 'Falha na validação.';
                return;
            }

            alert('E-mail validado com sucesso!');
            localStorage.removeItem('emailValidando');
            window.location.href = 'intencao.html';

        } catch (erro) {
            msgErroVerificar.textContent = 'Erro ao processar validação.';
        }
    });
}

// --- RECUPERAÇÃO DE SENHA (ESQUECI A SENHA) ---
const formEsqueci = document.getElementById('formEsqueci');
const msgErroEsqueci = document.getElementById('mensagemErroEsqueci');

if (formEsqueci) {
    formEsqueci.addEventListener('submit', async function (e) {
        e.preventDefault();
        const email = document.getElementById('esqueciEmail').value.trim();

        try {
            const resposta = await fetch(`${API_URL}/esqueci-senha`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                msgErroEsqueci.textContent = dados.erro || 'Falha ao solicitar link.';
                return;
            }

            alert('Link de redefinição enviado para o seu e-mail!');
            window.location.href = 'signin.html';

        } catch (erro) {
            msgErroEsqueci.textContent = 'Falha ao processar solicitação.';
        }
    });
}

// --- REDEFINIÇÃO DE SENHA ---
const formRedefinir = document.getElementById('formRedefinir');
const msgErroRedefinir = document.getElementById('mensagemErroRedefinir');

if (formRedefinir) {
    formRedefinir.addEventListener('submit', async function (e) {
        e.preventDefault();
        const novaSenha = document.getElementById('novaSenha').value;
        const confirmarNovaSenha = document.getElementById('confirmarNovaSenha').value;

        if (novaSenha !== confirmarNovaSenha) {
            msgErroRedefinir.textContent = 'As senhas não coincidem.';
            return;
        }

        const parametros = new URLSearchParams(window.location.search);
        const token = parametros.get('token');

        if (!token) {
            alert('Token de redefinição inválido.');
            window.location.href = 'index.html';
            return;
        }

        try {
            const resposta = await fetch(`${API_URL}/redefinir-senha`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, novaSenha })
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                msgErroRedefinir.textContent = dados.erro || 'Falha ao redefinir a senha.';
                return;
            }

            alert('Senha alterada com sucesso! Faça login.');
            window.location.href = 'signin.html';

        } catch (erro) {
            msgErroRedefinir.textContent = 'Erro ao processar redefinição.';
        }
    });
}

// ==========================================
// PAINEL ADMINISTRATIVO (ADMIN.HTML)
// ==========================================
const formAdmin = document.getElementById('formAdmin');
const secaoLoginAdmin = document.getElementById('secaoLoginAdmin');
const secaoPainelAdmin = document.getElementById('secaoPainelAdmin');
const containerPendentes = document.getElementById('containerPendentes');

if (formAdmin) {
    if (localStorage.getItem('tokenAdmin')) {
        abrirPainelAdmin();
    }

    formAdmin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value;
        const senha = document.getElementById('adminSenha').value;

        try {
            const resposta = await fetch(`${API_URL}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha })
            });
            const dados = await resposta.json();

            if (!resposta.ok) {
                document.getElementById('msgErroAdmin').textContent = dados.erro;
                return;
            }

            localStorage.setItem('tokenAdmin', dados.tokenAdmin);
            abrirPainelAdmin();
        } catch (erro) {
            document.getElementById('msgErroAdmin').textContent = 'Erro ao conectar.';
        }
    });
}

function abrirPainelAdmin() {
    secaoLoginAdmin.style.display = 'none';
    secaoPainelAdmin.style.display = 'flex';
    carregarPerfisPendentes();
}

const btnSairAdmin = document.getElementById('btnSairAdmin');
if (btnSairAdmin) {
    btnSairAdmin.addEventListener('click', () => {
        localStorage.removeItem('tokenAdmin');
        window.location.reload();
    });
}

async function carregarPerfisPendentes() {
    try {
        const tokenAdmin = localStorage.getItem('tokenAdmin');
        const resposta = await fetch(`${API_URL}/admin/pendentes`, {
            headers: { 'Authorization': `Bearer ${tokenAdmin || ''}` }
        });
        const pendentes = await resposta.json();

        if (resposta.status === 401 || resposta.status === 403) {
            localStorage.removeItem('tokenAdmin');
            if (secaoPainelAdmin) secaoPainelAdmin.style.display = 'none';
            if (secaoLoginAdmin) secaoLoginAdmin.style.display = 'grid';
            const erro = document.getElementById('msgErroAdmin');
            if (erro) erro.textContent = pendentes.erro || 'Sua sessão administrativa expirou. Entre novamente.';
            return;
        }

        if (!resposta.ok) throw new Error(pendentes.erro || 'Erro ao carregar perfis pendentes.');

        containerPendentes.innerHTML = '';
        if (pendentes.length === 0) {
            containerPendentes.innerHTML = '<div class="empty-state">Nenhum perfil pendente de aprovação.</div>';
            return;
        }

        pendentes.forEach(prof => {
            const card = document.createElement('div');
            card.className = 'card-resultado';
            const fotoExibicao = prof.foto_perfil || 'imagens/placeholder-usuario.png';

            card.innerHTML = `
                <img src="${fotoExibicao}" class="avatar-card-resultado">
                <h2>${prof.nome_completo || prof.nome}</h2>
                <div class="card-resultado-info" style="margin-bottom: 10px;">
                    <p><strong>Área:</strong> ${prof.area_atuacao}</p>
                    <p style="margin-top:5px; font-size:12px;">${prof.sobre_voce ? prof.sobre_voce.substring(0, 80) + '...' : ''}</p>
                </div>
                
                <!-- NOVO BOTÃO QUE ABRE O PERFIL EM UMA NOVA ABA -->
                <a href="perfil.html?id=${prof.usuario_id}" target="_blank" style="background-color: #3b82f6; color: white; padding: 10px; border-radius: 10px; text-decoration: none; font-size: 13px; font-weight: bold; margin-bottom: 15px; width: 100%; display: block; box-sizing: border-box;">🔍 Analisar Perfil Completo</a>

                <div style="display: flex; gap: 10px; width: 100%;">
                    <button onclick="avaliarPerfil(${prof.id}, 'aprovado')" style="flex: 1; background-color: #10b981; color: white; border: none; padding: 10px; border-radius: 10px; cursor: pointer; font-weight: bold;">✔ Aprovar</button>
                    <button onclick="avaliarPerfil(${prof.id}, 'rejeitado')" style="flex: 1; background-color: #ef4444; color: white; border: none; padding: 10px; border-radius: 10px; cursor: pointer; font-weight: bold;">✖ Rejeitar</button>
                </div>
            `;
            containerPendentes.appendChild(card);
        });
    } catch (erro) {
        console.error("Erro ao carregar pendentes:", erro);
    }
}

async function avaliarPerfil(perfilId, statusDecisao) {
    if (!confirm(`Tem certeza que deseja ${statusDecisao} este perfil?`)) return;

    try {
        const tokenAdmin = localStorage.getItem('tokenAdmin');
        const resposta = await fetch(`${API_URL}/admin/avaliar/${perfilId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenAdmin || ''}`
            },
            body: JSON.stringify({ status: statusDecisao })
        });

        if (resposta.status === 401 || resposta.status === 403) {
            localStorage.removeItem('tokenAdmin');
            alert('Sua sessão administrativa expirou. Entre novamente.');
            window.location.reload();
            return;
        }

        if (resposta.ok) {
            alert(`Perfil ${statusDecisao} com sucesso!`);
            carregarPerfisPendentes();
        } else {
            alert('Falha ao atualizar o perfil.');
        }
    } catch (erro) {
        alert('Erro ao conectar com o servidor.');
    }
}