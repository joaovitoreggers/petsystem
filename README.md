# PET Digital — Login, Validação de QR Code e Contagem de Pessoas

Fatia vertical do Desafio 8 (PET Digital / Inova Marechal Challenge): autenticação,
validação de entrada por QR code e contagem de pessoas pela câmera, como prova de
conceito isolada. Monorepo Nx com back-end NestJS e front-end Angular.

O código (nomes de classes, arquivos, rotas, campos de DTO etc.) é todo em inglês;
apenas este README e os comentários no código ficam em português.

## Estrutura

```
apps/
  backend/    # NestJS — AuthModule, UsersModule, EmployeesModule, QrValidationModule
  frontend/   # Angular — telas do design PET Digital (rota /pet), sem integração com o back-end
```

> **Estado atual do front-end:** o Angular hoje renderiza só o design/protótipo
> do PET Digital (fluxo do técnico no celular e painel do gestor no desktop),
> com dados mockados localmente — não faz nenhuma chamada HTTP. As telas
> antigas (login, CRUD de usuários/funcionários, crachás, scanner de QR) foram
> removidas do front-end porque não faziam parte do design entregue; o
> back-end e as APIs abaixo continuam existindo e podem ser testados
> diretamente (curl/Postman) enquanto a integração real não é refeita.

`Usuario` (login — porteiro/operador, autentica via `/auth/login`) e
`Employee`/funcionário (pessoa de campo validada nas tentativas de entrada,
não faz login) são entidades **separadas** — um funcionário não é
necessariamente também um usuário do sistema, e vice-versa.

Fronteira entre módulos do back-end: `AuthModule` acessa `User` só através de
`UsersService` (exportado por `UsersModule`); `QrValidationModule` acessa
`Employee` só através de `EmployeesService` (exportado por
`EmployeesModule`) — nenhum módulo acessa o repositório interno de outro
diretamente.

## Requisitos

- Docker e Docker Compose (caminho recomendado — sobe tudo com persistência)
- Ou, para rodar sem Docker: Node.js 20+, npm e um PostgreSQL acessível
- Um navegador com acesso à câmera para testar o front-end de verdade

## Rodando com Docker (recomendado)

```bash
./run.sh
```

Faz tudo: cria `.env` a partir de `.env.example` (com um `JWT_SECRET`
aleatório) se ele ainda não existir, sobe os três containers — front-end
(Nginx), back-end (NestJS) e banco (PostgreSQL, dados persistidos em um
volume nomeado) — espera cada um ficar saudável, e popula os usuários de
teste. Não precisa de Node/npm instalado na máquina, só Docker.

- Front-end: http://localhost:58080 (o Nginx do container serve o build do
  Angular e faz proxy de `/api/*` para o container do back-end — sem CORS)
- Back-end (acesso direto, opcional): http://localhost:53001/api
- Postgres (acesso direto, opcional): `localhost:55432` (mapeado para a porta
  interna 5432)

As três portas do lado do host (`55432`, `53001`, `58080`) são deliberadamente
incomuns para reduzir a chance de colisão com outros serviços já rodando no
seu servidor — só a porta do front-end (`58080`) realmente precisa ficar
acessível de fora do Docker, para o Cloudflare Tunnel apontar pra ela.

`./run.sh` é idempotente — rodar de novo não recria o `.env` nem duplica os
usuários de teste. Se preferir os comandos manuais:

```bash
docker compose up --build -d --wait   # ou: npm run docker:up
docker compose exec backend npm run backend:seed   # ou: npm run docker:seed
```

Os dados ficam no volume nomeado `petsystem_db_data`: sobrevivem a
`docker compose down` / `up` e a reinícios dos containers. Para descartar tudo
e começar do zero: `docker compose down -v`.

Variáveis de ambiente opcionais (copie `.env.example` para `.env` na raiz para
customizar — todas têm um default funcional no `docker-compose.yml`, e
`run.sh` já cria o arquivo pra você):

| Variável           | Padrão       | Descrição                                              |
|--------------------|--------------|----------------------------------------------------------|
| `DB_USERNAME`       | `petsystem`  | Usuário do Postgres                                       |
| `DB_PASSWORD`       | `petsystem`  | Senha do Postgres                                          |
| `DB_NAME`           | `petsystem`  | Nome do banco                                              |
| `JWT_SECRET`        | `dev-secret` | Segredo usado para assinar o JWT — troque em produção      |
| `JWT_EXPIRES_IN`    | `8h`         | Validade do token                                          |

## Rodando sem Docker

Precisa de um PostgreSQL acessível — o mais simples é subir só o banco via
Docker (`docker compose up -d db`, exposto em `localhost:55432`) e rodar
back-end/front-end localmente:

```bash
npm install
DB_PORT=55432 npm run backend:seed    # popula os usuários de teste (idempotente)
DB_PORT=55432 npm run backend:serve   # sobe em http://localhost:3000/api
```

Variáveis de ambiente (mesmas da tabela acima, mais):

| Variável   | Padrão      | Descrição                          |
|------------|-------------|-------------------------------------|
| `DB_HOST`  | `localhost` | Host do Postgres                     |
| `DB_PORT`  | `5432`      | Porta do Postgres                    |
| `PORT`     | `3000`      | Porta do servidor HTTP do back-end   |

### Usuários de teste — contas de login (criadas por `npm run backend:seed`)

| Email                        | Senha    | Role     |
|-------------------------------|----------|----------|
| porteiro@petsystem.local      | senha123 | porteiro |
| operador@petsystem.local      | senha123 | operador |

### Funcionários de teste — validados no QR (criados por `npm run backend:seed`)

| Nome            | Role                | Acesso a áreas de risco | Serviço de correção |
|-----------------|---------------------|:------------------------:|:---------------------:|
| João Ferreira   | tecnico_seguranca   | ✅                        | ✅                     |
| Marcos Lima     | operador_de_campo   | ✅                        | ❌                     |
| Patricia Alves  | estagiaria          | ❌                        | ❌                     |

As duas permissões são independentes uma da outra. O QR do crachá de cada
funcionário é o próprio `id` (uuid) — gerado uma vez na criação e nunca
reaproveitado como um campo separado, então uma edição futura no cadastro
nunca invalida um crachá já impresso/gerado. Como o valor é gerado no banco,
não dá para listá-lo aqui: faça login e abra a tela **Crachás** (`/badges`)
para ver a lista de funcionários e gerar o QR de cada um sob demanda — ela
também aparece no log do `npm run backend:seed`.

Front-end local (aponta para `http://localhost:3000/api` por padrão):

```bash
npm run frontend:serve   # sobe em http://localhost:4200
```

Faça login com um dos usuários de teste acima; a tela de validação (`/scanner`)
pede acesso à câmera, conta quantas pessoas estão em frente a ela e conduz a
leitura de QR (uma ou várias, conforme a contagem).

## Testes

```bash
./test.sh
```

Builda a imagem do back-end (que carrega o monorepo Nx inteiro — ver a nota
em `apps/backend/Dockerfile`) e roda testes + build de back-end e front-end
dentro dela, sem precisar de Node/npm no host e sem subir banco (os testes
usam mocks). Equivalente manual, se já tiver Node/npm instalados:

```bash
npx nx run backend:test    # lógica de autorização, duplicidade e o Guard de JWT
npx nx run frontend:test
```

## Deploy num servidor caseiro (EasyPanel + Cloudflare Tunnel)

Nenhuma das duas ferramentas precisa de configuração especial neste repo — o
`docker-compose.yml` que você já usa com `./run.sh` localmente é o mesmo que
sobe no EasyPanel. Passo a passo:

### 1. Preparar o servidor

1. Instale o Docker no servidor caseiro, se ainda não tiver
   (`curl -sSL https://get.docker.com | sh`).
2. Instale o EasyPanel seguindo o instalador oficial
   (https://easypanel.io/docs/installation) e acesse o painel web dele.

### 2. Criar o serviço no EasyPanel

1. Crie um **Project** novo (ou use um existente).
2. Dentro do projeto, crie um serviço do tipo **Compose** (App via Docker
   Compose) apontando para este repositório Git — branch `main` — e para o
   `docker-compose.yml` na raiz.
3. Na aba de variáveis de ambiente do serviço, defina pelo menos:
   `JWT_SECRET` (gere um valor aleatório — `openssl rand -hex 32` — nunca use
   o default `dev-secret` aqui), e opcionalmente `DB_USERNAME`, `DB_PASSWORD`,
   `DB_NAME`, `JWT_EXPIRES_IN` (defaults na tabela acima).
   Se seu serviço não tiver uma aba de variáveis, um arquivo `.env` na raiz
   do projeto no servidor (copiado de `.env.example`) resolve do mesmo jeito.
4. Faça o deploy. O EasyPanel builda as três imagens (`db`, `backend`,
   `frontend`) e sobe os containers — o volume nomeado `petsystem_db_data`
   garante que os dados do Postgres sobrevivem a redeploys.

### 3. Popular os usuários de teste

Pelo terminal/console do serviço `backend` no EasyPanel (ou via SSH no
servidor, se preferir rodar direto):

```bash
docker compose exec backend npm run backend:seed
```

### 4. Conferir localmente no servidor antes de expor

Antes de abrir pro mundo, valide direto no servidor (via SSH, ou uma sessão
de terminal do próprio EasyPanel):

```bash
curl http://localhost:53001/api/health          # {"status":"ok"}
curl -X POST http://localhost:53001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"porteiro@petsystem.local","password":"senha123"}'
```

### 5. Criar o Cloudflare Tunnel

1. No [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/) →
   **Networks → Tunnels**, crie um tunnel novo (tipo "Cloudflared").
2. Siga o comando de instalação que o próprio dashboard mostra para instalar
   e conectar o `cloudflared` no servidor caseiro (ele roda como um serviço
   em background, autenticado com um token — não precisa editar nenhum
   arquivo de config manualmente nesse fluxo).
3. Em **Public Hostnames**, adicione um hostname (o subdomínio que você quer
   usar) apontando para `http://localhost:58080` — a porta do `frontend` no
   `docker-compose.yml`. Não é preciso apontar nada para o back-end: o Nginx
   do container `frontend` já faz o proxy interno de `/api` para o `backend`.

### 6. Testar em produção

Acesse o hostname configurado no navegador, faça login com um dos usuários
de teste e confirme que a tela `/scanner` carrega. Depois, use a tela
**Crachás** (`/badges`) para gerar QR codes reais e testar a leitura pela
câmera num dispositivo de verdade.

### Atualizando depois do primeiro deploy

Dê `git push` na branch que o EasyPanel acompanha e clique em redeploy no
painel (ou configure o auto-deploy do EasyPanel nesse branch). Os containers
são recriados, mas o volume `petsystem_db_data` — e portanto os usuários e o
histórico de `AccessEvent` — persiste normalmente.

## Fluxo de validação (API)

1. `POST /api/auth/login` `{ email, password }` → `{ accessToken, user }`
2. `POST /api/qr-validation/attempts` (autenticado) → cria uma tentativa em
   `AWAITING_DETECTION`
3. `POST /api/qr-validation/attempts/:id/detection` `{ personCount }` →
   transiciona para `AWAITING_READS`
4. `POST /api/qr-validation/attempts/:id/reads` `{ qrCode }` (uma vez por
   pessoa detectada) → busca o `Employee` pelo `qrCode` (que é o próprio
   `id`), checa duplicidade, autoriza só se `canAccessRiskAreas` for
   verdadeiro, registra um `AccessEvent` e avança a máquina de estados; ao
   atingir a quantidade esperada de leituras **distintas**, a tentativa vai
   para `COMPLETE` e expõe `finalResult` (`AUTHORIZED` somente se todas as
   leituras foram autorizadas)

Uma leitura repetida do mesmo `qrCode` na mesma tentativa é rejeitada com
`409 Conflict` e registra um `AccessEvent` com resultado `DUPLICATE`, sem
contar como uma leitura distinta.

## CRUD de usuários (API)

Contas de login (porteiro/operador) — `name`, `email`, `password`, `role`.
Todas as rotas abaixo exigem o JWT (`Authorization: Bearer <token>`); a tela
`/users` no front-end (mesmo estilo simples do login/crachás, provisório) usa
exatamente essa API.

| Rota | Descrição |
|------|-----------|
| `GET /api/users` | Lista todos os usuários |
| `GET /api/users/:id` | Busca um usuário — `404` se não existir |
| `POST /api/users` | Cria um usuário — `409` se o email já estiver em uso |
| `PATCH /api/users/:id` | Atualiza campos parcialmente (senha só é trocada se enviada; `409` se o novo email já pertencer a outro usuário) |
| `DELETE /api/users/:id` | Remove um usuário — `409` se for o próprio usuário autenticado, `404` se não existir |

Nenhuma resposta inclui o campo `password` (nem o hash).

## CRUD de funcionários (API)

Pessoas de campo validadas pelo `QrValidationModule` — `name`, `role`, e as
duas permissões independentes `canAccessRiskAreas` e
`canPerformCorrectiveService` (ambas booleanas, default `false`). Sem
`email`/`password`: funcionário não faz login. Mesmas garantias de JWT da
API de usuários; a tela `/employees` usa exatamente essa API.

| Rota | Descrição |
|------|-----------|
| `GET /api/employees` | Lista todos os funcionários |
| `GET /api/employees/:id` | Busca um funcionário — `404` se não existir |
| `POST /api/employees` | Cria um funcionário |
| `PATCH /api/employees/:id` | Atualiza campos parcialmente — `404` se não existir |
| `DELETE /api/employees/:id` | Remove um funcionário — `404` se não existir |

`canAccessRiskAreas` é a permissão realmente aplicada hoje (é o que o
`QrValidationModule` verifica para autorizar uma leitura de QR).
`canPerformCorrectiveService` é capturada e validada normalmente pelo CRUD,
mas ainda não é verificada por nenhum fluxo — não existe, nesta fase, um
"serviço de correção" para gatear (ver Observações e riscos conhecidos).

## Padrões de projeto aplicados

- **Strategy** (Passport): `LocalStrategy` (login) e `JwtStrategy` (rota
  protegida) — `apps/backend/src/app/auth/strategies`
- **Guard**: `JwtAuthGuard` protegendo as rotas de `QrValidationController`
- **Repository**: `IUserRepository`, `IEmployeeRepository` e
  `IAccessEventRepository`, com implementações TypeORM injetadas por token —
  desacopla o domínio do ORM
- **DTO + Pipes**: `class-validator` em todo corpo de requisição, com
  `ValidationPipe` global
- **Dependency Injection**: nativa do NestJS e do Angular
- **State**: `AccessAttempt` (back-end) e `ScannerState` (front-end, união
  discriminada) modelam explicitamente
  `aguardando detecção → aguardando N leituras distintas → completo/expirado`,
  em vez de flags booleanas soltas — ver
  `apps/backend/src/app/qr-validation/state/attempt.state.ts`

## Observações e riscos conhecidos

- **`Employee` é quem carrega o crachá, não `User`.** O `id` (uuid) de cada
  funcionário É o conteúdo do QR — nenhum campo `qrCode` separado. Um
  usuário de login não é necessariamente também um funcionário, e
  vice-versa: são tabelas independentes, sem relação entre si nesta fase. Se
  precisar amarrar as duas coisas no futuro (uma pessoa que faz login *e*
  carrega crachá), isso ainda não existe — hoje seriam dois cadastros
  separados.
- **`canAccessRiskAreas` é a única permissão realmente aplicada hoje.**
  `canPerformCorrectiveService` é armazenada e validada pelo CRUD, mas não
  gateia nada ainda — não existe um fluxo de "serviço de correção" nesta
  fase para ela proteger.
- **Mudança de schema incompatível com deploys anteriores**: `User` perdeu a
  coluna `access_level` (a autorização de entrada agora é decidida pelo
  `Employee`, não pelo usuário logado), e `AccessEvent.user_id` virou
  `AccessEvent.employee_id`. Se você tiver um volume `petsystem_db_data` de
  antes dessa mudança, apague-o e recrie (`docker compose down -v`) — o
  `synchronize: true` do TypeORM não migra esse tipo de mudança de coluna
  automaticamente.
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
  monitoria, recuperação de senha e MFA.

## Proposta de melhoria: pré-modelagem de dados (v2)

Modelo conceitual/lógico para o sistema completo do Desafio 8 (PET Digital),
além do recorte de autenticação/QR implementado nesta fase — registrado aqui
como proposta para orientar as próximas etapas (cadastro de PET, áreas,
medições de gás e painel de monitoria, hoje fora de escopo).

### Desafio 8 — Digitalização da PET

Modelo conceitual/lógico, anterior à escolha de tecnologia. Os tipos de dado
aqui são genéricos (texto, número, data/hora) — o mapeamento para tipos
específicos de um SGBD fica para a modelagem física, na implementação.

Esta versão incorpora as decisões tomadas depois da primeira modelagem: nível
de acesso por usuário/área, origem da medição (manual ou sensor) e o fluxo de
contagem de pessoas pela câmera com leituras de QR distintas e sem
duplicidade.

### 1. Entidades identificadas

| Entidade | O que representa |
|----------|-------------------|
| Usuario | Qualquer pessoa que usa o sistema (operador, técnico SESMT ou aprovador) |
| Area | Local/setor físico onde a PET será executada |
| PET | A Permissão de Entrada de Trabalho em si, com seu ciclo de vida |
| TipoGas | Cada gás monitorado (O₂, LEL, H₂S, CO etc.) |
| LimiteGas | Faixa segura de cada tipo de gás, com data de vigência |
| Medicao | Cada leitura de gás feita em campo, vinculada a uma PET |
| HistoricoStatusPET | Registro (log) de cada mudança de status de uma PET |
| Assinatura | Assinatura digital de solicitante ou aprovador em uma PET |
| TentativaEntrada | *(novo)* Uma tentativa de acesso a uma área, iniciada quando a câmera detecta uma ou mais pessoas |
| EventoAcesso | *(novo)* Cada leitura de QR feita dentro de uma tentativa de entrada, e o resultado dessa leitura |

### 2. Atributos por entidade

#### Usuario
| Atributo | Tipo | Observação |
|----------|------|------------|
| id | identificador único | PK |
| nome | texto | |
| email | texto | único |
| papel | enumeração | Operador \| Técnico SESMT \| Aprovador |
| nivel_acesso | número/enumeração | *(novo)* nível de credencial do funcionário, comparado ao exigido pela área |

#### Area
| Atributo | Tipo | Observação |
|----------|------|------------|
| id | identificador único | PK |
| nome | texto | |
| setor | texto | |
| nivel_minimo_exigido | número/enumeração | *(novo)* nível mínimo de acesso exigido para entrar nessa área |

#### PET
| Atributo | Tipo | Observação |
|----------|------|------------|
| id | identificador único | PK |
| area_id | referência | FK → Area |
| solicitante_id | referência | FK → Usuario |
| aprovador_id | referência | FK → Usuario, nulo até a aprovação |
| status | enumeração | rascunho \| pendente \| aprovada \| em_execucao \| suspensa_por_risco \| encerrada \| cancelada \| expirada |
| descricao_atividade | texto | |
| data_abertura | data/hora | |
| data_validade | data/hora | fim previsto da autorização |

#### TipoGas
| Atributo | Tipo | Observação |
|----------|------|------------|
| id | identificador único | PK |
| nome | texto | ex.: O₂, LEL, H₂S, CO |
| unidade_medida | texto | ex.: %, ppm |

#### LimiteGas
| Atributo | Tipo | Observação |
|----------|------|------------|
| id | identificador único | PK |
| tipo_gas_id | referência | FK → TipoGas |
| valor_minimo | número decimal | |
| valor_maximo | número decimal | |
| vigente_desde | data/hora | permite versionar limites ao longo do tempo |

#### Medicao
| Atributo | Tipo | Observação |
|----------|------|------------|
| id | identificador único | PK |
| pet_id | referência | FK → PET |
| tipo_gas_id | referência | FK → TipoGas |
| medido_por_id | referência | FK → Usuario, nulo quando `origem` é sensor |
| origem | enumeração | *(novo)* manual \| sensor |
| valor_medido | número decimal | |
| limite_min_registrado | número decimal | cópia do limite vigente no momento da leitura |
| limite_max_registrado | número decimal | cópia do limite vigente no momento da leitura |
| dentro_do_limite | verdadeiro/falso | calculado no momento do registro |
| registrado_em | data/hora | |

#### HistoricoStatusPET
| Atributo | Tipo | Observação |
|----------|------|------------|
| id | identificador único | PK |
| pet_id | referência | FK → PET |
| status_anterior | enumeração | |
| status_novo | enumeração | |
| alterado_por_id | referência | FK → Usuario, nulo quando a mudança é automática |
| motivo | texto | |
| registrado_em | data/hora | |

#### Assinatura
| Atributo | Tipo | Observação |
|----------|------|------------|
| id | identificador único | PK |
| pet_id | referência | FK → PET |
| usuario_id | referência | FK → Usuario |
| papel_assinatura | enumeração | solicitante \| aprovador |
| registrado_em | data/hora | |

#### TentativaEntrada *(novo)*
| Atributo | Tipo | Observação |
|----------|------|------------|
| id | identificador único | PK |
| area_id | referência | FK → Area |
| pet_id | referência | FK → PET, nulo se não houver PET ativa na área no momento |
| pessoas_detectadas | número inteiro | quantidade contada pela câmera ao iniciar a tentativa |
| status | enumeração | aguardando_leituras \| completa \| expirada |
| iniciada_em | data/hora | |
| finalizada_em | data/hora | nulo até completar ou expirar |

#### EventoAcesso *(novo)*
| Atributo | Tipo | Observação |
|----------|------|------------|
| id | identificador único | PK |
| tentativa_id | referência | FK → TentativaEntrada |
| usuario_id | referência | FK → Usuario, identificado pelo QR lido |
| resultado | enumeração | autorizado \| negado_nivel_insuficiente \| negado_duplicidade |
| registrado_em | data/hora | |

### 3. Relacionamentos

| Relacionamento | Cardinalidade | Significado |
|-----------------|----------------|-------------|
| Usuario → PET | 1:N | um usuário solicita várias PETs |
| Usuario → PET | 1:N | um usuário aprova várias PETs |
| Area → PET | 1:N | uma área recebe várias PETs ao longo do tempo |
| PET → Medicao | 1:N | uma PET recebe várias medições |
| TipoGas → Medicao | 1:N | um tipo de gás aparece em várias medições |
| TipoGas → LimiteGas | 1:N | um tipo de gás pode ter limites diferentes ao longo do tempo |
| Usuario → Medicao | 1:N | um usuário registra várias medições (quando `origem` é manual) |
| PET → HistoricoStatusPET | 1:N | uma PET acumula várias mudanças de status |
| Usuario → HistoricoStatusPET | 1:N | um usuário pode ter alterado o status de várias PETs (opcional) |
| PET → Assinatura | 1:N | uma PET recebe pelo menos duas assinaturas (solicitante e aprovador) |
| Usuario → Assinatura | 1:N | um usuário assina várias PETs |
| Area → TentativaEntrada | 1:N | *(novo)* uma área acumula várias tentativas de entrada |
| PET → TentativaEntrada | 1:N | *(novo)* uma PET autoriza várias tentativas de entrada ao longo de sua execução |
| TentativaEntrada → EventoAcesso | 1:N | *(novo)* uma tentativa agrupa uma leitura de QR por pessoa detectada |
| Usuario → EventoAcesso | 1:N | *(novo)* um usuário pode aparecer em várias leituras de QR ao longo do tempo |

### 4. Observações de modelagem

- **Medicao guarda uma cópia (snapshot) do limite vigente**, em vez de só referenciar `LimiteGas`. Isso garante que uma auditoria futura veja a regra que valia no momento da leitura, mesmo que o limite seja recalibrado depois.
- **HistoricoStatusPET é um log de apenas inserção** (nunca `update`/`delete`). É essa tabela que resolve, na prática, a perda de rastreabilidade citada no desafio.
- **PET tem dois relacionamentos distintos com Usuario** (solicitante e aprovador) — na modelagem física isso vira duas chaves estrangeiras separadas na mesma tabela `PET`, apontando para `Usuario`.
- **TentativaEntrada.status é uma máquina de estados**, no mesmo espírito da máquina de estados da PET: começa em `aguardando_leituras`, e só muda para `completa` quando o número de `EventoAcesso` com `resultado = autorizado` (e `usuario_id` não repetido) atinge `pessoas_detectadas`; muda para `expirada` se isso não acontecer dentro de uma janela de tempo.
- **A duplicidade é verificada dentro do escopo de uma única `TentativaEntrada`**: o mesmo `usuario_id` não pode gerar dois `EventoAcesso` com `resultado = autorizado` na mesma tentativa — uma segunda leitura do mesmo QR é registrada com `resultado = negado_duplicidade`.
- **O QR code do crachá deveria conter apenas o `usuario_id`**, nada além disso — nome, papel e nível de acesso continuam vivendo só no banco, consultados no momento da leitura.
- **`nivel_minimo_exigido` ficou em Area, não em PET.** Decisão de simplicidade: o risco de uma área tende a ser uma característica do local, não de cada permissão emitida para ele. Se o time identificar a necessidade de uma PET específica exigir um nível maior que o padrão da área, isso pode virar um campo opcional em PET que sobrescreve o da área — não incluído nesta versão por não ter sido demandado ainda.
- **Ainda em aberto:** quem são os "responsáveis pela PET" para efeito de notificação de um `EventoAcesso` negado. Hoje só `solicitante_id` e `aprovador_id` existem em PET; se for necessário notificar mais gente (ex.: SESMT de plantão), isso ainda vai exigir uma tabela nova de relação N:N entre PET e Usuario.
- Este é o nível conceitual/lógico. A modelagem física (tipos de dado exatos, índices, constraints, particionamento) depende da tecnologia de banco escolhida na implementação — deliberadamente fora do escopo deste documento.
