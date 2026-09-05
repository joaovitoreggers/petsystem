# PET Digital — Login, Validação de QR Code e Contagem de Pessoas

Fatia vertical do Desafio 8 (PET Digital / Inova Marechal Challenge): autenticação,
validação de entrada por QR code e contagem de pessoas pela câmera, como prova de
conceito isolada. Monorepo Nx com back-end NestJS e front-end Angular.

O código (nomes de classes, arquivos, rotas, campos de DTO etc.) é todo em inglês;
apenas este README e os comentários no código ficam em português.

## Estrutura

```
apps/
  backend/    # NestJS — AuthModule, UsersModule, QrValidationModule
  frontend/   # Angular — Auth (lazy) e QrScanner (lazy)
```

Fronteira entre módulos do back-end: `QrValidationModule` e `AuthModule` nunca
acessam o repositório de `User` diretamente — sempre através de `UsersService`
(exportado por `UsersModule`).

## Requisitos

- Docker e Docker Compose (caminho recomendado — sobe tudo com persistência)
- Ou, para rodar sem Docker: Node.js 20+, npm e um PostgreSQL acessível
- Um navegador com acesso à câmera para testar o front-end de verdade

## Rodando com Docker (recomendado)

Sobe os três containers — front-end (Nginx), back-end (NestJS) e banco
(PostgreSQL, com dados persistidos em um volume nomeado) — orquestrados pelo
`docker-compose.yml`:

```bash
docker compose up --build   # ou: npm run docker:up
```

- Front-end: http://localhost:8080 (o Nginx do container serve o build do
  Angular e faz proxy de `/api/*` para o container do back-end — sem CORS)
- Back-end (acesso direto, opcional): http://localhost:3000/api
- Postgres (acesso direto, opcional): `localhost:5433` (mapeado para a porta
  interna 5432, para não colidir com um Postgres já rodando na sua máquina)

Popule os usuários de teste dentro do container já em execução:

```bash
docker compose exec backend npm run backend:seed   # ou: npm run docker:seed
```

Os dados ficam no volume nomeado `petsystem_db_data`: sobrevivem a
`docker compose down` / `up` e a reinícios dos containers. Para descartar tudo
e começar do zero: `docker compose down -v`.

Variáveis de ambiente opcionais (copie `.env.example` para `.env` na raiz para
customizar — todas têm um default funcional no `docker-compose.yml`):

| Variável           | Padrão       | Descrição                                              |
|--------------------|--------------|----------------------------------------------------------|
| `DB_USERNAME`       | `petsystem`  | Usuário do Postgres                                       |
| `DB_PASSWORD`       | `petsystem`  | Senha do Postgres                                          |
| `DB_NAME`           | `petsystem`  | Nome do banco                                              |
| `JWT_SECRET`        | `dev-secret` | Segredo usado para assinar o JWT — troque em produção      |
| `JWT_EXPIRES_IN`    | `8h`         | Validade do token                                          |
| `ACCESS_MIN_LEVEL`  | `2`          | Nível mínimo de `accessLevel` para autorizar a entrada     |

## Rodando sem Docker

Precisa de um PostgreSQL acessível — o mais simples é subir só o banco via
Docker (`docker compose up -d db`, exposto em `localhost:5433`) e rodar
back-end/front-end localmente:

```bash
npm install
DB_PORT=5433 npm run backend:seed    # popula os usuários de teste (idempotente)
DB_PORT=5433 npm run backend:serve   # sobe em http://localhost:3000/api
```

Variáveis de ambiente (mesmas da tabela acima, mais):

| Variável   | Padrão      | Descrição                          |
|------------|-------------|-------------------------------------|
| `DB_HOST`  | `localhost` | Host do Postgres                     |
| `DB_PORT`  | `5432`      | Porta do Postgres                    |
| `PORT`     | `3000`      | Porta do servidor HTTP do back-end   |

### Usuários de teste (criados por `npm run backend:seed`)

| Email                             | Senha       | Role         | Nível de acesso | Código do QR (crachá) |
|-----------------------------------|-------------|--------------|------------------|-------------------------|
| porteiro@petsystem.local          | senha123    | porteiro     | 5 (autorizado)   | QR-PORTEIRO-001         |
| joao.silva@petsystem.local        | senha123    | funcionario  | 3 (autorizado)   | QR-FUNC-AUTORIZADO      |
| maria.souza@petsystem.local       | senha123    | estagiario   | 1 (negado)       | QR-ESTAGIARIO-NEGADO    |

Gere QR codes reais com o texto de `qrCode` acima (qualquer gerador de QR) para
testar a leitura pela câmera.

Front-end local (aponta para `http://localhost:3000/api` por padrão):

```bash
npm run frontend:serve   # sobe em http://localhost:4200
```

Faça login com um dos usuários de teste acima; a tela de validação (`/scanner`)
pede acesso à câmera, conta quantas pessoas estão em frente a ela e conduz a
leitura de QR (uma ou várias, conforme a contagem).

## Testes

```bash
npx nx run backend:test    # lógica de autorização, duplicidade e o Guard de JWT
npx nx run frontend:test
```

## Fluxo de validação (API)

1. `POST /api/auth/login` `{ email, password }` → `{ accessToken, user }`
2. `POST /api/qr-validation/attempts` (autenticado) → cria uma tentativa em
   `AWAITING_DETECTION`
3. `POST /api/qr-validation/attempts/:id/detection` `{ personCount }` →
   transiciona para `AWAITING_READS`
4. `POST /api/qr-validation/attempts/:id/reads` `{ qrCode }` (uma vez por
   pessoa detectada) → valida o nível de acesso, checa duplicidade, registra um
   `AccessEvent` e avança a máquina de estados; ao atingir a quantidade
   esperada de leituras **distintas**, a tentativa vai para `COMPLETE` e expõe
   `finalResult` (`AUTHORIZED` somente se todas as leituras foram autorizadas)

Uma leitura repetida do mesmo `qrCode` na mesma tentativa é rejeitada com
`409 Conflict` e registra um `AccessEvent` com resultado `DUPLICATE`, sem
contar como uma leitura distinta.

## Padrões de projeto aplicados

- **Strategy** (Passport): `LocalStrategy` (login) e `JwtStrategy` (rota
  protegida) — `apps/backend/src/app/auth/strategies`
- **Guard**: `JwtAuthGuard` protegendo as rotas de `QrValidationController`
- **Repository**: `IUserRepository` e `IAccessEventRepository`, com
  implementações TypeORM injetadas por token — desacopla o domínio do ORM
- **DTO + Pipes**: `class-validator` em todo corpo de requisição, com
  `ValidationPipe` global
- **Dependency Injection**: nativa do NestJS e do Angular
- **State**: `AccessAttempt` (back-end) e `ScannerState` (front-end, união
  discriminada) modelam explicitamente
  `aguardando detecção → aguardando N leituras distintas → completo/expirado`,
  em vez de flags booleanas soltas — ver
  `apps/backend/src/app/qr-validation/state/attempt.state.ts`

## Observações e riscos conhecidos

- **Contagem de pessoas via câmera é o maior risco técnico do projeto.** O
  modelo (TensorFlow.js + COCO-SSD) roda inteiramente no navegador; seu
  desempenho varia bastante por hardware. **Teste cedo, no dispositivo e na
  câmera reais da apresentação** — ajuste o limiar de confiança em
  `PersonDetectorService` (`PERSON_CONFIDENCE_THRESHOLD` em
  `qr-scanner.component.ts`) conforme necessário.
- A tentativa de validação (`AccessAttempt`) vive em memória no processo do
  back-end (TTL de 2 minutos) — suficiente para esta prova de conceito; o
  registro durável e auditável é o `AccessEvent`, persistido no PostgreSQL
  (volume `petsystem_db_data` quando rodando via Docker).
- A imagem Docker do back-end não é otimizada para tamanho: o monorepo Nx
  compartilha um único `node_modules` entre back-end e front-end, então o
  container do back-end acaba carregando também as dependências do Angular.
  Suficiente para esta prova de conceito.
- Fora de escopo nesta sessão: cadastro de PET/áreas/medições, painel de
  monitoria, tela de cadastro de usuário, recuperação de senha e MFA.
