-- 003_operacao.sql
--
-- Portas, dispositivos, eventos, alertas, tarefas, ocorrencias e auditoria.
--
-- Tudo aqui pertence a uma industria, e "industria" e a filial que o projeto
-- ja tinha (tabela branches, sob company_groups). Reaproveitar em vez de
-- criar uma tabela industries em paralelo foi decisao de projeto: o
-- isolamento por tenant ja existe, ja e testado (ver auth/tenant-scope.ts) e
-- ter dois sistemas de isolamento concorrentes e como ter dois relogios —
-- nunca se sabe qual esta certo.
--
-- Por isso toda tabela abaixo carrega company_group_id e branch_id: sao as
-- duas colunas que o filtro de tenant ja sabe ler.

-- ---------------------------------------------------------------------------
-- Funcionario: campos que faltavam em users
-- ---------------------------------------------------------------------------
-- ADD COLUMN IF NOT EXISTS em vez de recriar a tabela: users ja tem dado e
-- e referenciada por user_roles.
ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf          text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone        text;
-- 'ativo' | 'inativo'. Desativar preserva o historico; apagar destruiria a
-- autoria de tarefas, ocorrencias e eventos ja registrados.
ALTER TABLE users ADD COLUMN IF NOT EXISTS status       text NOT NULL DEFAULT 'ativo';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_access  timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cpf ON users(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_branch     ON users(branch_id);

-- ---------------------------------------------------------------------------
-- Dispositivos
-- ---------------------------------------------------------------------------
-- Nenhum sensor fisico esta conectado hoje. A tabela existe para o dia em
-- que estiver, e ate la os eventos entram por API — ver o endpoint de
-- simulacao em doors. Nao ha integracao fisica fingida em lugar nenhum.
CREATE TABLE IF NOT EXISTS devices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_group_id uuid NOT NULL REFERENCES company_groups(id) ON DELETE CASCADE,
  branch_id        uuid REFERENCES branches(id) ON DELETE SET NULL,
  name             text NOT NULL,
  -- 'sensor_porta' | 'controlador' | 'leitor_qr' | 'outro'
  type             text NOT NULL DEFAULT 'sensor_porta',
  -- Identificador fisico (serial, MAC, topico MQTT): e por ele que o
  -- aparelho se apresenta quando enviar evento.
  identifier       text NOT NULL,
  status           text NOT NULL DEFAULT 'offline',
  last_seen_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT devices_identifier_unique UNIQUE (company_group_id, identifier)
);
CREATE INDEX IF NOT EXISTS idx_devices_branch ON devices(branch_id);

-- ---------------------------------------------------------------------------
-- Portas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doors (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_group_id uuid NOT NULL REFERENCES company_groups(id) ON DELETE CASCADE,
  branch_id        uuid NOT NULL REFERENCES branches(id)       ON DELETE CASCADE,
  name             text NOT NULL,
  location         text,
  -- 'aberta' | 'fechada' | 'offline' | 'bloqueada'
  status           text NOT NULL DEFAULT 'fechada',
  -- ON DELETE SET NULL: trocar o sensor nao pode apagar a porta.
  device_id        uuid REFERENCES devices(id) ON DELETE SET NULL,
  -- Desde quando esta no status atual. E o que responde "aberta ha quanto
  -- tempo", que e a pergunta do porteiro e o gatilho do alerta de porta
  -- aberta demais.
  status_since     timestamptz NOT NULL DEFAULT now(),
  last_event_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT doors_name_unique UNIQUE (branch_id, name)
);
CREATE INDEX IF NOT EXISTS idx_doors_branch ON doors(branch_id);
CREATE INDEX IF NOT EXISTS idx_doors_status ON doors(branch_id, status);

-- ---------------------------------------------------------------------------
-- Eventos de porta
-- ---------------------------------------------------------------------------
-- Append-only: e o historico que responde "quem abriu, quando e por onde".
-- Guarda o status anterior junto com o novo porque a pergunta que se faz
-- depois nunca e "qual o status", e sim "o que mudou".
CREATE TABLE IF NOT EXISTS door_events (
  id               bigserial PRIMARY KEY,
  company_group_id uuid NOT NULL REFERENCES company_groups(id) ON DELETE CASCADE,
  branch_id        uuid NOT NULL REFERENCES branches(id)       ON DELETE CASCADE,
  door_id          uuid NOT NULL REFERENCES doors(id)          ON DELETE CASCADE,
  previous_status  text,
  new_status       text NOT NULL,
  -- De onde veio: 'dispositivo' | 'manual' | 'simulacao'
  source           text NOT NULL DEFAULT 'dispositivo',
  device_id        uuid REFERENCES devices(id) ON DELETE SET NULL,
  -- Quem provocou, quando foi acao de pessoa. ON DELETE SET NULL: desligar o
  -- funcionario nao apaga o registro de que o evento aconteceu.
  user_id          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
-- O historico e sempre lido do mais recente para o mais antigo, por filial
-- ou por porta: os dois indices cobrem as duas telas.
CREATE INDEX IF NOT EXISTS idx_door_events_branch ON door_events(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_door_events_door   ON door_events(door_id,   created_at DESC);

-- ---------------------------------------------------------------------------
-- Alertas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_group_id uuid NOT NULL REFERENCES company_groups(id) ON DELETE CASCADE,
  branch_id        uuid NOT NULL REFERENCES branches(id)       ON DELETE CASCADE,
  door_id          uuid REFERENCES doors(id) ON DELETE CASCADE,
  -- 'porta_aberta_demais' | 'porta_offline' | 'dispositivo_offline'
  -- | 'porta_fora_horario' | 'evento_inesperado'
  type             text NOT NULL,
  title            text NOT NULL,
  description      text,
  -- 'baixa' | 'media' | 'alta' | 'critica'
  severity         text NOT NULL DEFAULT 'media',
  -- 'ativo' | 'reconhecido' | 'resolvido'
  status           text NOT NULL DEFAULT 'ativo',
  created_at       timestamptz NOT NULL DEFAULT now(),
  acknowledged_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at  timestamptz
);
-- A consulta da tela e sempre "alertas ativos desta filial".
CREATE INDEX IF NOT EXISTS idx_alerts_branch_status ON alerts(branch_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Tarefas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_group_id uuid NOT NULL REFERENCES company_groups(id) ON DELETE CASCADE,
  branch_id        uuid NOT NULL REFERENCES branches(id)       ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  -- 'baixa' | 'media' | 'alta' | 'urgente'
  priority         text NOT NULL DEFAULT 'media',
  -- 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
  status           text NOT NULL DEFAULT 'pendente',
  assigned_to      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  due_at           timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_branch   ON tasks(branch_id, status);
-- "Minhas tarefas" e a tela mais aberta do operador.
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assigned_to, status);

-- ---------------------------------------------------------------------------
-- Ocorrencias
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS occurrences (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_group_id uuid NOT NULL REFERENCES company_groups(id) ON DELETE CASCADE,
  branch_id        uuid NOT NULL REFERENCES branches(id)       ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  priority         text NOT NULL DEFAULT 'media',
  -- 'aberta' | 'em_analise' | 'resolvida' | 'cancelada'
  status           text NOT NULL DEFAULT 'aberta',
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_to      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_occurrences_branch ON occurrences(branch_id, status);

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
-- Append-only, e de proposito sem foreign key obrigatoria para user_id: o
-- registro de que uma acao aconteceu nao pode desaparecer porque o autor foi
-- removido depois. E o mesmo motivo de guardar `details` como jsonb — o
-- retrato do que mudou continua legivel mesmo que a tabela de origem mude.
CREATE TABLE IF NOT EXISTS audit_logs (
  id               bigserial PRIMARY KEY,
  user_id          uuid REFERENCES users(id) ON DELETE SET NULL,
  company_group_id uuid,
  branch_id        uuid,
  -- Ex.: 'login', 'funcionario.editado', 'porta.evento'
  action           text NOT NULL,
  entity_type      text,
  entity_id        text,
  details          jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_branch  ON audit_logs(branch_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Seed: as portas de exemplo, por filial
-- ---------------------------------------------------------------------------
-- Uma porta por nome em cada filial existente. Rodar de novo nao duplica
-- (ON CONFLICT sobre a UNIQUE de branch_id + name).
INSERT INTO doors (company_group_id, branch_id, name, location, status)
SELECT b.company_group_id, b.id, d.name, d.location, 'fechada'
FROM branches b
CROSS JOIN (VALUES
  ('Porta Principal',          'Acesso administrativo'),
  ('Porta Producao',           'Area de producao'),
  ('Porta Expedicao',          'Doca de expedicao'),
  ('Porta Almoxarifado',       'Almoxarifado central'),
  ('Porta Carga e Descarga',   'Patio de caminhoes'),
  ('Porta Emergencia',         'Saida de emergencia')
) AS d(name, location)
ON CONFLICT (branch_id, name) DO NOTHING;
