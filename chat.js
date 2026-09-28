(() => {
    const CHAT_API_URL = 'https://skillmarket-api-7gpd.onrender.com/api';
    const token = localStorage.getItem('token');
    const usuarioId = Number(localStorage.getItem('usuarioId'));

    const app = document.getElementById('chatApp');
    if (!app) return;

    if (!token || !usuarioId) {
        window.location.href = `signin.html?redirect=${encodeURIComponent('mensagens.html')}`;
        return;
    }

    const listaEl = document.getElementById('chatConversationList');
    const vazioEl = document.getElementById('chatEmpty');
    const roomEl = document.getElementById('chatRoom');
    const messagesEl = document.getElementById('chatMessages');
    const formEl = document.getElementById('chatForm');
    const inputEl = document.getElementById('chatInput');
    const sendEl = document.getElementById('chatSend');
    const charEl = document.getElementById('chatCharCount');
    const refreshEl = document.getElementById('chatRefresh');
    const backEl = document.getElementById('chatBack');
    const partnerAvatarEl = document.getElementById('chatPartnerAvatar');
    const partnerNameEl = document.getElementById('chatPartnerName');
    const partnerAreaEl = document.getElementById('chatPartnerArea');
    const partnerProfileEl = document.getElementById('chatPartnerProfile');

    let conversas = [];
    let conversaAtivaId = null;
    let assinaturaMensagens = '';
    let buscandoMensagens = false;
    let pollingMensagens = null;
    let pollingConversas = null;

    function headers(json = false) {
        const h = { 'Authorization': `Bearer ${token}` };
        if (json) h['Content-Type'] = 'application/json';
        return h;
    }

    function tratarSessaoExpirada(resposta) {
        if (resposta.status !== 401) return false;
        localStorage.removeItem('token');
        localStorage.removeItem('usuarioId');
        window.location.href = `signin.html?redirect=${encodeURIComponent('mensagens.html')}`;
        return true;
    }

    function normalizarData(valor) {
        if (!valor) return null;
        const data = new Date(valor);
        return Number.isNaN(data.getTime()) ? null : data;
    }

    function formatarHora(valor) {
        const data = normalizarData(valor);
        if (!data) return '';
        return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(data);
    }

    function formatarDataLista(valor) {
        const data = normalizarData(valor);
        if (!data) return '';
        const hoje = new Date();
        const mesmaData = data.toDateString() === hoje.toDateString();
        if (mesmaData) return formatarHora(valor);
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        if (data.toDateString() === ontem.toDateString()) return 'Ontem';
        return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(data);
    }

    function rotuloDia(valor) {
        const data = normalizarData(valor);
        if (!data) return '';
        const hoje = new Date();
        if (data.toDateString() === hoje.toDateString()) return 'Hoje';
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        if (data.toDateString() === ontem.toDateString()) return 'Ontem';
        return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(data);
    }

    function criarAvatar(src, nome, classe) {
        const img = document.createElement('img');
        img.className = classe;
        img.src = src || 'imagens/placeholder-usuario.png';
        img.alt = nome ? `Foto de ${nome}` : 'Foto do usuário';
        img.onerror = () => { img.src = 'imagens/placeholder-usuario.png'; };
        return img;
    }

    function mostrarErroLista(texto) {
        listaEl.replaceChildren();
        const box = document.createElement('div');
        box.className = 'chat-list-state chat-list-state--error';
        box.innerHTML = '<strong>Não foi possível carregar o chat.</strong>';
        const p = document.createElement('p');
        p.textContent = texto;
        box.appendChild(p);
        listaEl.appendChild(box);
    }

    function renderizarConversas() {
        listaEl.replaceChildren();

        if (conversas.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'chat-list-state';
            empty.innerHTML = '<strong>Nenhuma conversa ainda.</strong><p>Abra o perfil de um profissional para iniciar seu primeiro contato.</p>';
            listaEl.appendChild(empty);
            return;
        }

        conversas.forEach(conversa => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'chat-conversation-item';
            if (Number(conversa.id) === Number(conversaAtivaId)) item.classList.add('is-active');
            item.dataset.conversaId = conversa.id;
            item.setAttribute('aria-label', `Abrir conversa com ${conversa.outro_nome || 'usuário'}`);

            item.appendChild(criarAvatar(conversa.outro_foto, conversa.outro_nome, 'chat-list-avatar'));

            const body = document.createElement('span');
            body.className = 'chat-list-body';

            const top = document.createElement('span');
            top.className = 'chat-list-top';
            const name = document.createElement('strong');
            name.textContent = conversa.outro_nome || 'Usuário do Skill Market';
            const time = document.createElement('time');
            time.textContent = formatarDataLista(conversa.ultima_mensagem_em || conversa.atualizada_em);
            top.append(name, time);

            const bottom = document.createElement('span');
            bottom.className = 'chat-list-bottom';
            const preview = document.createElement('span');
            preview.className = 'chat-list-preview';
            if (conversa.ultima_mensagem) {
                const prefixo = Number(conversa.ultima_mensagem_remetente_id) === usuarioId ? 'Você: ' : '';
                preview.textContent = prefixo + conversa.ultima_mensagem;
            } else {
                preview.textContent = 'Conversa iniciada · envie uma mensagem';
            }
            bottom.appendChild(preview);

            const naoLidas = Number(conversa.nao_lidas) || 0;
            if (naoLidas > 0) {
                const badge = document.createElement('span');
                badge.className = 'chat-list-badge';
                badge.textContent = naoLidas > 99 ? '99+' : String(naoLidas);
                bottom.appendChild(badge);
                item.classList.add('has-unread');
            }

            body.append(top, bottom);
            item.appendChild(body);
            item.addEventListener('click', () => abrirConversa(Number(conversa.id)));
            listaEl.appendChild(item);
        });
    }

    async function carregarConversas({ silencioso = false, selecionarUrl = false } = {}) {
        try {
            const resposta = await fetch(`${CHAT_API_URL}/chat/conversas`, { headers: headers() });
            if (tratarSessaoExpirada(resposta)) return;
            const dados = await resposta.json();
            if (!resposta.ok) throw new Error(dados.erro || 'Erro ao carregar conversas.');

            conversas = Array.isArray(dados) ? dados : [];
            renderizarConversas();

            if (selecionarUrl) {
                const idUrl = Number(new URLSearchParams(window.location.search).get('conversa'));
                if (idUrl && conversas.some(c => Number(c.id) === idUrl)) {
                    await abrirConversa(idUrl, { atualizarUrl: false });
                }
            } else if (conversaAtivaId && !conversas.some(c => Number(c.id) === Number(conversaAtivaId))) {
                fecharConversaMobile();
            }

            if (typeof carregarContadorMensagens === 'function') carregarContadorMensagens();
        } catch (erro) {
            if (!silencioso) mostrarErroLista(erro.message || 'Tente novamente em instantes.');
        }
    }

    function preencherCabecalhoConversa(conversa) {
        partnerNameEl.textContent = conversa.outro_nome || 'Usuário do Skill Market';
        partnerAreaEl.textContent = conversa.outro_area || 'Cliente Skill Market';
        partnerAvatarEl.src = conversa.outro_foto || 'imagens/placeholder-usuario.png';
        partnerAvatarEl.alt = `Foto de ${conversa.outro_nome || 'usuário'}`;

        if (conversa.outro_area) {
            partnerProfileEl.href = `perfil.html?id=${encodeURIComponent(conversa.outro_usuario_id)}`;
            partnerProfileEl.hidden = false;
        } else {
            partnerProfileEl.hidden = true;
        }
    }

    async function abrirConversa(id, { atualizarUrl = true } = {}) {
        const conversa = conversas.find(c => Number(c.id) === Number(id));
        if (!conversa) return;

        conversaAtivaId = Number(id);
        assinaturaMensagens = '';
        preencherCabecalhoConversa(conversa);
        vazioEl.hidden = true;
        roomEl.hidden = false;
        app.classList.add('has-active-conversation');
        renderizarConversas();

        if (atualizarUrl) {
            const url = new URL(window.location.href);
            url.searchParams.set('conversa', String(id));
            window.history.replaceState({}, '', url);
        }

        messagesEl.innerHTML = '<div class="chat-messages-loading"><span></span><span></span><span></span></div>';
        await carregarMensagens({ silencioso: false, forcarScroll: true });
        inputEl.focus({ preventScroll: true });
    }

    function fecharConversaMobile() {
        conversaAtivaId = null;
        assinaturaMensagens = '';
        roomEl.hidden = true;
        vazioEl.hidden = false;
        app.classList.remove('has-active-conversation');
        const url = new URL(window.location.href);
        url.searchParams.delete('conversa');
        window.history.replaceState({}, '', url);
        renderizarConversas();
    }

    function criarSeparadorDia(texto) {
        const div = document.createElement('div');
        div.className = 'chat-day-separator';
        const span = document.createElement('span');
        span.textContent = texto;
        div.appendChild(span);
        return div;
    }

    function renderizarMensagens(mensagens, { forcarScroll = false } = {}) {
        const pertoDoFim = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 120;
        messagesEl.replaceChildren();

        if (mensagens.length === 0) {
            const inicio = document.createElement('div');
            inicio.className = 'chat-first-message';
            inicio.innerHTML = '<div class="chat-first-icon">✦</div><strong>Comece a conversa</strong><p>Apresente seu projeto, explique o que precisa e combine os próximos passos por aqui.</p>';
            messagesEl.appendChild(inicio);
            return;
        }

        let ultimoDia = '';
        mensagens.forEach(msg => {
            const dia = rotuloDia(msg.enviada_em);
            if (dia && dia !== ultimoDia) {
                messagesEl.appendChild(criarSeparadorDia(dia));
                ultimoDia = dia;
            }

            const propria = Number(msg.remetente_id) === usuarioId;
            const linha = document.createElement('div');
            linha.className = `chat-message-row ${propria ? 'is-own' : 'is-other'}`;

            const bolha = document.createElement('div');
            bolha.className = 'chat-message-bubble';
            const texto = document.createElement('p');
            texto.textContent = msg.conteudo;
            const meta = document.createElement('div');
            meta.className = 'chat-message-meta';
            const hora = document.createElement('time');
            hora.textContent = formatarHora(msg.enviada_em);
            meta.appendChild(hora);

            if (propria) {
                const status = document.createElement('span');
                status.className = 'chat-read-status';
                status.textContent = msg.lida_em ? '✓✓ Lida' : '✓ Enviada';
                meta.appendChild(status);
            }

            bolha.append(texto, meta);
            linha.appendChild(bolha);
            messagesEl.appendChild(linha);
        });

        if (forcarScroll || pertoDoFim) {
            requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
        }
    }

    async function carregarMensagens({ silencioso = true, forcarScroll = false } = {}) {
        if (!conversaAtivaId || buscandoMensagens) return;
        buscandoMensagens = true;

        try {
            const conversaConsultada = conversaAtivaId;
            const resposta = await fetch(`${CHAT_API_URL}/chat/conversas/${conversaConsultada}/mensagens`, { headers: headers() });
            if (tratarSessaoExpirada(resposta)) return;
            const dados = await resposta.json();
            if (!resposta.ok) throw new Error(dados.erro || 'Erro ao carregar mensagens.');
            if (conversaConsultada !== conversaAtivaId) return;

            const mensagens = Array.isArray(dados) ? dados : [];
            const novaAssinatura = mensagens.map(m => `${m.id}:${m.lida_em || ''}`).join('|');
            if (novaAssinatura !== assinaturaMensagens || forcarScroll) {
                assinaturaMensagens = novaAssinatura;
                renderizarMensagens(mensagens, { forcarScroll });
            }

            const temNaoLidasRecebidas = mensagens.some(m => Number(m.remetente_id) !== usuarioId && !m.lida_em);
            if (temNaoLidasRecebidas) await marcarComoLidas(conversaConsultada);
        } catch (erro) {
            if (!silencioso) {
                messagesEl.replaceChildren();
                const erroEl = document.createElement('div');
                erroEl.className = 'chat-room-error';
                erroEl.textContent = erro.message || 'Não foi possível carregar as mensagens.';
                messagesEl.appendChild(erroEl);
            }
        } finally {
            buscandoMensagens = false;
        }
    }

    async function marcarComoLidas(conversaId) {
        try {
            const resposta = await fetch(`${CHAT_API_URL}/chat/conversas/${conversaId}/ler`, {
                method: 'PATCH',
                headers: headers()
            });
            if (!resposta.ok) return;
            const conversa = conversas.find(c => Number(c.id) === Number(conversaId));
            if (conversa) conversa.nao_lidas = 0;
            renderizarConversas();
            if (typeof carregarContadorMensagens === 'function') carregarContadorMensagens();
        } catch (_) {}
    }

    async function enviarMensagem() {
        const conteudo = inputEl.value.trim();
        if (!conteudo || !conversaAtivaId) return;

        sendEl.disabled = true;
        inputEl.disabled = true;

        try {
            const resposta = await fetch(`${CHAT_API_URL}/chat/conversas/${conversaAtivaId}/mensagens`, {
                method: 'POST',
                headers: headers(true),
                body: JSON.stringify({ conteudo })
            });
            if (tratarSessaoExpirada(resposta)) return;
            const dados = await resposta.json();
            if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível enviar a mensagem.');

            inputEl.value = '';
            atualizarContadorCaracteres();
            redimensionarTextarea();
            assinaturaMensagens = '';
            await carregarMensagens({ silencioso: false, forcarScroll: true });
            await carregarConversas({ silencioso: true });
        } catch (erro) {
            alert(erro.message || 'Não foi possível enviar a mensagem.');
        } finally {
            sendEl.disabled = false;
            inputEl.disabled = false;
            inputEl.focus();
        }
    }

    function redimensionarTextarea() {
        inputEl.style.height = 'auto';
        inputEl.style.height = `${Math.min(inputEl.scrollHeight, 132)}px`;
    }

    function atualizarContadorCaracteres() {
        const n = inputEl.value.length;
        charEl.textContent = `${n}/2000`;
        charEl.classList.toggle('is-near-limit', n >= 1800);
    }

    formEl.addEventListener('submit', (e) => {
        e.preventDefault();
        enviarMensagem();
    });

    inputEl.addEventListener('input', () => {
        redimensionarTextarea();
        atualizarContadorCaracteres();
    });

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            enviarMensagem();
        }
    });

    refreshEl.addEventListener('click', async () => {
        refreshEl.classList.add('is-loading');
        await carregarConversas({ silencioso: false });
        await carregarMensagens({ silencioso: true });
        window.setTimeout(() => refreshEl.classList.remove('is-loading'), 350);
    });

    backEl.addEventListener('click', fecharConversaMobile);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            carregarConversas({ silencioso: true });
            carregarMensagens({ silencioso: true });
        }
    });

    async function iniciar() {
        await carregarConversas({ silencioso: false, selecionarUrl: true });
        pollingMensagens = window.setInterval(() => carregarMensagens({ silencioso: true }), 3000);
        pollingConversas = window.setInterval(() => carregarConversas({ silencioso: true }), 10000);
    }

    window.addEventListener('beforeunload', () => {
        clearInterval(pollingMensagens);
        clearInterval(pollingConversas);
    });

    iniciar();
})();
