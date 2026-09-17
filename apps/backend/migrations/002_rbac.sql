-- 002_rbac.sql
--
-- Controle de acesso baseado em papel (RBAC): Cargo -> Permissoes -> Usuario.
--
-- Ate aqui o papel era um texto na coluna users.role, conferido por um guard
-- que comparava strings. Funciona enquanto os papeis sao quatro e nunca
-- mudam; quebra no dia em que alguem precisa de "gestor que nao desativa
-- funcionario", porque a unica saida vira espalhar if pelo codigo.
--
-- Com as tabelas abaixo, a pergunta que o sistema faz deixa de ser "qual o
-- cargo desta pessoa" e passa a ser "esta pessoa tem esta permissao" — que e
-- a pergunta certa, e a unica que continua valendo quando cargos novos forem
-- criados pela tela de administracao.
--
-- A coluna users.role continua existindo e sendo preenchida: o codigo atual
-- depende dela, e remover agora quebraria autenticacao, isolamento por
-- tenant e os testes de integracao. A migration liga os dois mundos
-- (ver o INSERT de user_roles no fim), e a troca acontece por etapas.

-- ---------------------------------------------------------------------------
-- Cargos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Chave estavel usada no codigo e no JWT; o nome e so exibicao e pode ser
  -- reescrito sem quebrar nada.
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  -- Cargo de sistema nao pode ser apagado pela tela: sem ADMINISTRADOR
  -- ninguem consegue voltar a administrar o sistema.
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Permissoes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Ex.: 'editar_funcionario'. E este texto que aparece no codigo, no guard
  -- e na tela de administracao.
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  -- Agrupa na tela de administracao (funcionarios, portas, tarefas…) para a
  -- lista nao virar cinquenta caixas soltas.
  category    text NOT NULL DEFAULT 'geral',
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Cargo -> Permissoes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       uuid NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

-- ---------------------------------------------------------------------------
-- Usuario -> Cargos
-- ---------------------------------------------------------------------------
-- Tabela propria, e nao uma coluna em users, porque um funcionario pode
-- acumular cargos (o gestor que tambem cobre a portaria no fim de semana) e
-- porque o vinculo carrega dados proprios: quem atribuiu e quando.
CREATE TABLE IF NOT EXISTS user_roles (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  -- Quem concedeu o cargo. ON DELETE SET NULL: apagar o usuario que concedeu
  -- nao pode apagar o registro de que a concessao aconteceu.
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role_id)
);

-- Consulta mais frequente do sistema: "quais permissoes este usuario tem",
-- feita a cada requisicao protegida.
CREATE INDEX IF NOT EXISTS idx_user_roles_user       ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);

-- ---------------------------------------------------------------------------
-- Seed: os quatro cargos
-- ---------------------------------------------------------------------------
-- ON CONFLICT DO NOTHING em tudo que segue: a migration roda uma vez so, mas
-- um seed que quebra em banco ja populado e uma armadilha para quem for
-- restaurar um dump por cima.
INSERT INTO roles (slug, name, description, is_system) VALUES
  ('administrador', 'Administrador', 'Acesso completo: industrias, cargos, permissoes, dispositivos e logs.', true),
  ('gestor',        'Gestor',        'Gerencia funcionarios, tarefas, ocorrencias e acompanha a industria.',        true),
  ('operador',      'Operador',      'Executa tarefas, registra ocorrencias e acompanha alertas.',                 true),
  ('porteiro',      'Porteiro',      'Monitora portas, eventos e alertas da industria.',                           true)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed: permissoes
-- ---------------------------------------------------------------------------
INSERT INTO permissions (slug, name, category, description) VALUES
  ('visualizar_dashboard',    'Ver dashboard',            'geral',        'Abrir o painel inicial do proprio perfil.'),
  ('visualizar_portas',       'Ver portas',               'portas',       'Ver a situacao das portas da industria.'),
  ('visualizar_eventos',      'Ver eventos',              'portas',       'Ver o historico de abertura e fechamento.'),
  ('visualizar_alertas',      'Ver alertas',              'alertas',      'Ver alertas da industria.'),
  ('visualizar_funcionarios', 'Ver funcionarios',         'funcionarios', 'Ver a lista de funcionarios.'),
  ('criar_funcionario',       'Cadastrar funcionario',    'funcionarios', 'Incluir novo funcionario.'),
  ('editar_funcionario',      'Editar funcionario',       'funcionarios', 'Alterar dados e cargo de um funcionario.'),
  ('desativar_funcionario',   'Desativar funcionario',    'funcionarios', 'Tirar o acesso de um funcionario sem apagar o historico.'),
  ('criar_tarefa',            'Criar tarefa',             'tarefas',      'Abrir tarefa e atribuir responsavel.'),
  ('editar_tarefa',           'Editar tarefa',            'tarefas',      'Alterar situacao, prazo ou responsavel.'),
  ('visualizar_tarefas',      'Ver tarefas',              'tarefas',      'Ver as tarefas da industria.'),
  ('criar_ocorrencia',        'Registrar ocorrencia',     'ocorrencias',  'Abrir ocorrencia.'),
  ('visualizar_ocorrencias',  'Ver ocorrencias',          'ocorrencias',  'Ver as ocorrencias da industria.'),
  ('gerenciar_industrias',    'Gerenciar industrias',     'admin',        'Criar, editar e desativar industrias.'),
  ('gerenciar_dispositivos',  'Gerenciar dispositivos',   'admin',        'Cadastrar sensores e controladores.'),
  ('visualizar_relatorios',   'Ver relatorios',           'relatorios',   'Abrir relatorios e exportacoes.'),
  ('gerenciar_permissoes',    'Gerenciar permissoes',     'admin',        'Criar cargos e definir o que cada um pode fazer.'),
  ('visualizar_logs',         'Ver logs de auditoria',    'admin',        'Consultar o registro de acoes do sistema.')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed: o que cada cargo pode fazer
-- ---------------------------------------------------------------------------
-- ADMINISTRADOR: tudo o que existir, inclusive permissao criada depois desta
-- migration — por isso e um SELECT sobre a tabela inteira, e nao uma lista.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'administrador'
ON CONFLICT DO NOTHING;

-- GESTOR: gerencia a propria industria, mas nao mexe na estrutura do sistema
-- (cargos, permissoes, industrias, dispositivos, logs).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.slug IN (
  'visualizar_dashboard', 'visualizar_portas', 'visualizar_eventos',
  'visualizar_alertas', 'visualizar_funcionarios', 'criar_funcionario',
  'editar_funcionario', 'desativar_funcionario', 'criar_tarefa',
  'editar_tarefa', 'visualizar_tarefas', 'criar_ocorrencia',
  'visualizar_ocorrencias', 'visualizar_relatorios'
)
WHERE r.slug = 'gestor'
ON CONFLICT DO NOTHING;

-- OPERADOR: executa o proprio trabalho. Ve tarefas e ocorrencias, nao ve a
-- lista de funcionarios nem relatorios.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.slug IN (
  'visualizar_dashboard', 'visualizar_alertas', 'visualizar_tarefas',
  'editar_tarefa', 'criar_ocorrencia', 'visualizar_ocorrencias'
)
WHERE r.slug = 'operador'
ON CONFLICT DO NOTHING;

-- PORTEIRO: portas, eventos e alertas. Nada de tarefas, funcionarios ou
-- relatorios — nao faz parte do posto.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.slug IN (
  'visualizar_dashboard', 'visualizar_portas', 'visualizar_eventos',
  'visualizar_alertas', 'criar_ocorrencia'
)
WHERE r.slug = 'porteiro'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Liga os usuarios que ja existem aos cargos novos
-- ---------------------------------------------------------------------------
-- Sem isto, ao passar a checar permissao no lugar de papel, todo mundo que ja
-- estava cadastrado ficaria sem permissao nenhuma — inclusive o administrador,
-- e ninguem conseguiria entrar para arrumar.
--
-- O mapa cobre os textos que users.role usa hoje; cargo desconhecido fica
-- sem vinculo de proposito, porque adivinhar permissao para cargo que
-- ninguem reconhece e o caminho para dar acesso a mais do que se pretendia.
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.slug = CASE
  WHEN u.role IN ('platform-admin', 'admin')        THEN 'administrador'
  WHEN u.role IN ('gestor', 'gestor_sesmt')         THEN 'gestor'
  WHEN u.role IN ('porteiro')                       THEN 'porteiro'
  WHEN u.role IN ('operador', 'operador_de_campo',
                  'tecnico', 'tecnico_seguranca')   THEN 'operador'
  ELSE NULL
END
ON CONFLICT DO NOTHING;
