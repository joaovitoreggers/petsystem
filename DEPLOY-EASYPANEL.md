# Deploy no Easypanel

Três serviços dentro de **um projeto** do Easypanel: banco (Postgres), back-end
e front-end. Só o front-end recebe domínio público; ele encaminha `/api` para o
back-end pela rede interna (mesma origem, sem CORS — e é isso que a biometria
WebAuthn exige).

Nos exemplos, o projeto se chama `pitantech` e os serviços `db`, `backend` e
`frontend`. O endereço interno de um serviço é `<projeto>_<serviço>` (ex.:
`pitantech_backend`); se preferir, o Easypanel aceita `$(PROJECT_NAME)_backend`.

## 1. Banco de dados

**+ Service → Postgres**, nome `db`. Guarde usuário, senha e nome do banco que
o Easypanel mostrar na aba de conexão.

## 2. Back-end

**+ Service → App**, nome `backend`.

- **Source:** GitHub (este repositório, branch de produção).
- **Build:** Dockerfile, caminho `apps/backend/Dockerfile`, **contexto na raiz**
  do repositório (`/`).
- **Porta interna:** `3000`. Não precisa de domínio.
- **Variáveis de ambiente:**

```
NODE_ENV=production
PORT=3000
DB_HOST=pitantech_db
DB_PORT=5432
DB_USERNAME=<usuário do Postgres>
DB_PASSWORD=<senha do Postgres>
DB_NAME=<banco do Postgres>
JWT_SECRET=<segredo longo e aleatório, ex.: openssl rand -hex 32>
JWT_EXPIRES_IN=8h
WEBAUTHN_RP_ID=app.seudominio.com.br
WEBAUTHN_RP_ORIGIN=https://app.seudominio.com.br
PUBLIC_APP_URL=https://app.seudominio.com.br
# Opcionais (ver .env.example): OPENAI_API_KEY, OPENAI_MODEL, TWILIO_*
```

`WEBAUTHN_RP_ID` é só o domínio (sem `https://`); `WEBAUTHN_RP_ORIGIN` e
`PUBLIC_APP_URL` levam `https://` e nenhuma barra no final. Precisam bater com o
domínio do front-end, senão o navegador recusa a biometria.

- **Health check** (opcional): `GET /api/health` na porta 3000.

## 3. Front-end

**+ Service → App**, nome `frontend`.

- **Build:** Dockerfile, caminho `apps/frontend/Dockerfile`, contexto na raiz.
- **Variável:** `BACKEND_URL=http://pitantech_backend:3000`
- **Domínio:** o do app (ex.: `app.seudominio.com.br`), porta `80`, HTTPS
  ligado (Let's Encrypt do Easypanel).

## 4. Primeiro acesso: criar o administrador

O banco nasce vazio (as tabelas são criadas sozinhas na primeira subida do
back-end). Crie o administrador da plataforma **uma vez**, no **Console** do
serviço `backend`:

```bash
ADMIN_EMAIL=voce@empresa.com ADMIN_PASSWORD='uma-senha-forte-com-12+' npm run backend:bootstrap-admin
```

Rodar de novo é inofensivo (se o e-mail existe, nada muda). **Não rode
`backend:seed` em produção:** ele cria usuários de teste com a senha fixa
`senha123`. Empresas, filiais, usuários e o resto se cadastram pelo próprio
sistema, logado como esse administrador.

## Pontos de atenção

- **Memória no build:** o `npm ci` + build do Angular pede ~2 GB livres no
  servidor. Se o build morrer sem erro claro, é memória.
- **Esquema do banco:** o back-end usa `synchronize: true` (o TypeORM ajusta as
  tabelas sozinho a cada subida). Prático para começar, mas em produção com
  dados reais vale migrar para *migrations* antes de mudar entidades.
- **Backup:** ative o backup do Postgres no Easypanel (aba do serviço `db`).
- **Segredos:** `JWT_SECRET` fraco ou igual ao padrão gera um aviso no log do
  back-end ao subir em produção.
- **Atualizar:** novo commit na branch de produção → **Deploy** nos serviços
  que mudaram (ou ligue o deploy automático por webhook do GitHub).
