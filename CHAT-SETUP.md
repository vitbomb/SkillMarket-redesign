# Chat interno — configuração

O chat usa o mesmo login JWT já existente no Skill Market. As mensagens ficam salvas no PostgreSQL do Neon e a interface consulta novas mensagens periodicamente (aprox. a cada 3 segundos enquanto uma conversa está aberta).

## 1. Criar as tabelas no Neon

No Neon, abra o projeto > **SQL Editor**, cole todo o conteúdo de `backend/migrations/001_chat.sql` e execute uma única vez.

O script cria:

- `conversas`: um registro por par de usuários;
- `mensagens`: histórico das mensagens;
- índices para listagem, histórico e mensagens não lidas.

O script usa `IF NOT EXISTS`, então uma nova execução não recria as tabelas. Não apague as tabelas depois que o chat estiver em uso, pois isso apagaria o histórico.

## 2. Publicar o backend

O `backend/server.js` ganhou rotas protegidas por JWT:

- `POST /api/chat/conversas`
- `GET /api/chat/conversas`
- `GET /api/chat/conversas/:id/mensagens`
- `POST /api/chat/conversas/:id/mensagens`
- `PATCH /api/chat/conversas/:id/ler`
- `GET /api/chat/nao-lidas`

Depois do commit/push, faça o deploy no Render. Nenhuma variável de ambiente nova é necessária para o chat.

## 3. Publicar o frontend

A nova página é `mensagens.html` e sua lógica está em `chat.js`. O menu “Mensagens” só aparece para usuários autenticados. No perfil de outro profissional aprovado aparece o botão **Enviar mensagem**.

Depois do commit/push, publique a nova versão na Vercel.

## Segurança implementada

- O ID do remetente vem do JWT, não do corpo enviado pelo navegador.
- Só participantes da conversa podem carregar, enviar ou marcar mensagens como lidas.
- Não é possível iniciar conversa consigo mesmo.
- Novas conversas só podem ser iniciadas a partir de um profissional aprovado.
- Mensagens são limitadas a 2.000 caracteres no frontend, backend e banco.
- A interface usa `textContent` para mensagens, evitando interpretar HTML enviado por usuários.
