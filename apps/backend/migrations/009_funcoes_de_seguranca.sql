-- ---------------------------------------------------------------------------
-- 009 — Funções de segurança do funcionário
-- ---------------------------------------------------------------------------
-- Função de segurança não é cargo. O cargo (`team_members.role`) é a
-- profissão da pessoa — "Soldador", "Técnico de Segurança do Trabalho" — e
-- continua exatamente como está. A função de segurança é o que ela está
-- habilitada a exercer DENTRO de uma atividade: vigia de espaço confinado,
-- socorrista.
--
-- Uma pessoa pode ter as duas, uma ou nenhuma, e isso muda ao longo do
-- tempo sem que a profissão dela mude.
--
-- Guardado como array de texto, e não como tabela de ligação: a lista é
-- curta e fechada (hoje duas funções), pertence só ao funcionário e nunca é
-- consultada de fora para dentro. Uma tabela a mais aqui seria estrutura
-- sem pergunta que a justifique.
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS safety_roles text[] NOT NULL DEFAULT '{}';

-- Quem já estava cadastrado continua sem função nenhuma: habilitar alguém
-- como vigia é decisão do SESMT, não algo que uma migration deva supor.
COMMENT ON COLUMN team_members.safety_roles IS
  'Funcoes de seguranca habilitadas (vigia, socorrista). Nao confundir com role, que e o cargo profissional.';
