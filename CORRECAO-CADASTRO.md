# Correção do cadastro / verificação de e-mail

Esta versão corrige o caso em que um usuário podia ficar criado no banco antes da conclusão do envio do e-mail de verificação.

Mudanças principais:
- e-mails normalizados para minúsculas;
- conta já existente e ainda não verificada recebe um novo código, em vez de erro de e-mail duplicado;
- se o primeiro envio de e-mail falhar, a conta recém-criada é removida para não ficar presa;
- nova rota `POST /api/reenviar-codigo`;
- botão "Reenviar código" na tela de verificação;
- botão de cadastro fica desabilitado enquanto a requisição está em andamento, evitando cliques duplos;
- mensagens de erro de cadastro ficam mais claras;
- falhas do Nodemailer agora aparecem nos logs do Render.

Nenhuma alteração no banco de dados é necessária para esta correção.
