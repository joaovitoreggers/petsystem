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

- Node.js 20+ e npm
- Um navegador com acesso à câmera para testar o front-end de verdade

## Rodando o back-end

```bash
npm install
npm run backend:seed    # popula os usuários de teste (idempotente)
npm run backend:serve   # sobe em http://localhost:3000/api
```

Variáveis de ambiente (arquivo `.env` na raiz, lido via `@nestjs/config`):

| Variável           | Padrão               | Descrição                                          |
|--------------------|----------------------|------------------------------------------------------|
| `JWT_SECRET`        | `dev-secret`         | Segredo usado para assinar o JWT                     |
| `JWT_EXPIRES_IN`    | `8h`                 | Validade do token                                     |
| `DATABASE_PATH`     | `petsystem.sqlite`   | Caminho do arquivo SQLite                             |
| `ACCESS_MIN_LEVEL`  | `2`                  | Nível mínimo de `accessLevel` para autorizar a entrada |
| `PORT`              | `3000`               | Porta do servidor HTTP                                |

### Usuários de teste (criados por `npm run backend:seed`)

| Email                             | Senha       | Role         | Nível de acesso | Código do QR (crachá) |
|-----------------------------------|-------------|--------------|------------------|-------------------------|
| porteiro@petsystem.local          | senha123    | porteiro     | 5 (autorizado)   | QR-PORTEIRO-001         |
| joao.silva@petsystem.local        | senha123    | funcionario  | 3 (autorizado)   | QR-FUNC-AUTORIZADO      |
| maria.souza@petsystem.local       | senha123    | estagiario   | 1 (negado)       | QR-ESTAGIARIO-NEGADO    |

Gere QR codes reais com o texto de `qrCode` acima (qualquer gerador de QR) para
testar a leitura pela câmera.

## Rodando o front-end

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
  registro durável e auditável é o `AccessEvent`, que sempre vai para o banco.
- Fora de escopo nesta sessão: cadastro de PET/áreas/medições, painel de
  monitoria, tela de cadastro de usuário, recuperação de senha e MFA.
