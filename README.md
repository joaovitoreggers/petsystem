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
