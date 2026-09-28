# Configuração de e-mail no Render Free

O Render Free bloqueia tráfego SMTP de saída nas portas 25, 465 e 587. Esta versão usa a API HTTPS da Brevo para os e-mails de verificação e recuperação de senha.

## Passos
1. Crie uma conta gratuita na Brevo.
2. Em Settings > Senders, Domains & Dedicated IPs > Senders, adicione e verifique o seu endereço remetente.
3. Em SMTP & API > API Keys, crie uma API key.
4. No Render > Environment, adicione:
   - BREVO_API_KEY = sua chave
   - EMAIL_FROM = o mesmo endereço verificado na Brevo
   - EMAIL_FROM_NAME = Skill Market
5. Faça redeploy do backend.

`EMAIL_PASS` não é mais necessário nesta versão.
