# Skill Market — redesign visual

Esta versão reorganiza o front-end para uma linguagem visual mais próxima de um marketplace/SaaS moderno, preservando a integração já existente com o backend.

## Principais mudanças

- Novo sistema visual global: fundo neutro, azul usado como cor de ação, cartões brancos, bordas e sombras discretas.
- Cabeçalho totalmente refeito e responsivo, com navegação em português.
- Home reconstruída com hero, busca principal, categorias, profissionais dinâmicos, seção “Como funciona” e CTA.
- Busca reorganizada com sugestões/filtros laterais e cards de resultado mais informativos.
- Perfil público refeito com hierarquia de informação, contatos, habilidades, avaliação e portfólio.
- Formulários de perfil reorganizados em seções claras e responsivas.
- Login, cadastro, verificação e recuperação de senha unificados em um único padrão visual.
- Página “Sobre” refeita com apresentação do projeto e equipe.
- Página de ajuda refeita sem cards 3D/flip e com FAQ.
- Painel administrativo reestilizado.
- `lang` alterado para `pt-BR` e textos/labels padronizados em português.
- Adicionados `placeholder-usuario.png` e `placeholder-paisagem.png`, que eram referenciados pelo projeto mas não existiam.
- Pequenos ajustes no `script.js` apenas para os cards dinâmicos acompanharem o novo layout e para exibir o site/portfólio do profissional quando informado.

## Integração preservada

Os IDs usados pelo `script.js`, as páginas do fluxo e os endpoints atuais foram mantidos. O `backend/server.js` não foi alterado neste redesign.

## Observações importantes do backend

Antes de publicar uma versão definitiva, vale revisar a segurança das rotas administrativas. O backend atualmente gera um `tokenAdmin`, mas as rotas de listagem e aprovação/rejeição não validam esse token. Além disso, o login administrativo contém logs das credenciais no console do servidor. Esses pontos não foram alterados aqui porque este pacote foi focado no redesign do front-end.

## Tema claro/escuro
- Adicionado `theme.js`, carregado antes do CSS em todas as páginas para evitar flash de tema incorreto.
- O tema inicial respeita a preferência do sistema operacional quando o usuário ainda não escolheu um tema.
- A escolha manual é persistida no `localStorage` (`skillmarket-theme`).
- O botão de tema é inserido automaticamente no cabeçalho; no painel administrativo, que não possui cabeçalho global, ele aparece de forma flutuante.
- O tema escuro cobre home, busca, perfis, autenticação, formulários, ajuda, sobre, painel administrativo, footer e componentes gerados dinamicamente.
- Foram adicionados `color-scheme`, estilos de autofill, foco, contraste e suporte a `prefers-reduced-motion`.

## Atualização: senhas e painel administrativo

- Todos os campos de senha agora possuem botão de mostrar/ocultar senha (ícone de olho), inclusive login, cadastro, redefinição e painel administrativo.
- As rotas administrativas de listagem e avaliação agora exigem o token JWT de administrador.
- Foram removidos logs que exibiam as credenciais administrativas no terminal do servidor.
- O link de redefinição de senha dos usuários agora usa `FRONTEND_URL`, com fallback para `https://skill-market-redesign.vercel.app`.
- O arquivo `backend/.env.example` documenta as variáveis necessárias sem incluir segredos reais.

### Acesso ao painel

A página é `admin.html`. As credenciais administrativas são definidas no servidor pelas variáveis de ambiente `ADMIN_EMAIL` e `ADMIN_SENHA`. Em produção, esses valores devem ficar configurados no provedor do backend (por exemplo, Render) e nunca devem ser enviados ao GitHub.
