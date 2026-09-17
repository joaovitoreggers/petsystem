-- ---------------------------------------------------------------------------
-- 010 — Passkeys no lugar do reconhecimento facial, e a PET guardando o que
--       o assistente ja perguntava
-- ---------------------------------------------------------------------------
-- Estas duas mudancas chegaram pela main enquanto o schema ainda era criado
-- pelo synchronize do TypeORM. Com o schema versionado (ver 001), a entidade
-- deixou de criar tabela sozinha: o que nao estiver escrito aqui simplesmente
-- nao existe no banco. Sem esta migration, o login por biometria e o detalhe
-- da PET quebrariam com "column does not exist" — e so em producao, porque um
-- banco de desenvolvimento antigo ainda teria as colunas que o synchronize
-- criou um dia.

-- ── Passkey (WebAuthn) ──────────────────────────────────────────────────────
-- O id e o credential ID que o autenticador da plataforma gera (base64url),
-- nao um uuid nosso: quem batiza a credencial e o aparelho.
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
    id character varying NOT NULL,
    user_id uuid NOT NULL,
    public_key bytea NOT NULL,
    counter bigint NOT NULL,
    device_type character varying NOT NULL,
    backed_up boolean NOT NULL,
    transports jsonb,
    last_used_at timestamp with time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id)
);

-- A credencial morre com a conta: sem dono, uma chave publica guardada aqui
-- so responderia a pergunta "de quem era isso?".
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webauthn_credentials_user_id_fkey'
  ) THEN
    ALTER TABLE public.webauthn_credentials
      ADD CONSTRAINT webauthn_credentials_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- O login por biometria e "discoverable": o servidor recebe o credential ID
-- sem saber de antemao quem e a pessoa, e precisa resolver o dono. Listar as
-- passkeys de um usuario tambem passa por aqui.
CREATE INDEX IF NOT EXISTS webauthn_credentials_user_id_idx
  ON public.webauthn_credentials (user_id);

-- O token de aparelho antigo (segredo sorteado e guardado no navegador) saiu
-- junto com o reconhecimento facial simulado. A tabela fica sem leitor nenhum
-- no codigo, e o que sobra dentro dela e hash de segredo que nao autentica
-- mais nada — guardar isso indefinidamente e so risco parado.
DROP TABLE IF EXISTS public.device_credentials;

-- ── Campos da PET que o assistente ja coletava ─────────────────────────────
-- Descricao, tipo de servico, empresa executante, horario previsto e o
-- checklist eram preenchidos na tela e descartados na emissao: a PET nascia
-- sem o que foi respondido para ela existir. Guardar isso e o que permite
-- reabrir a permissao depois e ver em que condicoes ela foi emitida.
ALTER TABLE work_permits
  ADD COLUMN IF NOT EXISTS description character varying,
  ADD COLUMN IF NOT EXISTS service_type character varying,
  ADD COLUMN IF NOT EXISTS executing_company character varying,
  ADD COLUMN IF NOT EXISTS planned_start character varying,
  ADD COLUMN IF NOT EXISTS planned_end character varying,
  ADD COLUMN IF NOT EXISTS checklist jsonb,
  ADD COLUMN IF NOT EXISTS fire_watch_rounds jsonb;

-- Tudo anulavel de proposito: as PETs ja emitidas nao tem essas respostas, e
-- inventar um valor padrao para elas seria registrar como respondido algo que
-- ninguem respondeu.
COMMENT ON COLUMN work_permits.checklist IS
  'Respostas SIM/NAO/NA do assistente, chaveadas por "<area>:<grupo>:<indice>".';
COMMENT ON COLUMN work_permits.fire_watch_rounds IS
  'Ronda de vigia de fogo pos-termino (NR-18): 4 checagens a cada 30 min nas 2h seguintes.';
