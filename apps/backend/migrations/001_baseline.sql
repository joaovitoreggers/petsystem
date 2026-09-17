-- 001_baseline.sql
--
-- Retrato do schema que o TypeORM vinha criando sozinho (synchronize: true).
--
-- Existe para o banco deixar de depender do synchronize sem quebrar quem ja
-- tem as tabelas: e idempotente (IF NOT EXISTS, constraints protegidas),
-- entao rodar num banco existente nao faz nada e rodar num banco vazio cria
-- tudo do zero. A partir daqui, toda mudanca de schema e uma migration
-- numerada.

--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it




--
-- Name: access_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.access_events (
    id integer NOT NULL,
    employee_id uuid,
    result character varying NOT NULL,
    qr_code_read character varying,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: access_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE IF NOT EXISTS public.access_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: access_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.access_events_id_seq OWNED BY public.access_events.id;


--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.branches (
    id uuid NOT NULL,
    company_group_id uuid NOT NULL,
    name character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: company_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.company_groups (
    id uuid NOT NULL,
    name character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: device_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.device_credentials (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    secret_hash character varying NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.employees (
    id uuid NOT NULL,
    name character varying NOT NULL,
    role character varying NOT NULL,
    can_access_risk_areas boolean DEFAULT false NOT NULL,
    can_perform_corrective_service boolean DEFAULT false NOT NULL,
    company_group_id uuid,
    branch_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.team_members (
    registration character varying NOT NULL,
    name character varying NOT NULL,
    role character varying NOT NULL,
    company character varying NOT NULL,
    unit character varying NOT NULL,
    company_group_id uuid,
    branch_id uuid,
    is_third_party boolean DEFAULT false NOT NULL,
    documents jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL,
    name character varying NOT NULL,
    email character varying NOT NULL,
    password character varying NOT NULL,
    role character varying NOT NULL,
    company_group_id uuid,
    branch_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: work_permits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.work_permits (
    id character varying NOT NULL,
    areas jsonb NOT NULL,
    location character varying NOT NULL,
    unit character varying NOT NULL,
    company_group_id uuid,
    branch_id uuid,
    team_size integer NOT NULL,
    date character varying NOT NULL,
    start character varying NOT NULL,
    "end" character varying DEFAULT ''::character varying NOT NULL,
    time_label character varying NOT NULL,
    technician character varying NOT NULL,
    status character varying NOT NULL,
    coordinates character varying DEFAULT ''::character varying NOT NULL,
    gas jsonb,
    alarm boolean DEFAULT false NOT NULL,
    duration_minutes integer,
    critical_alerts jsonb,
    company_phone character varying,
    close_reason character varying,
    closed_by character varying,
    readings jsonb,
    team jsonb,
    atmosphere_alerts jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: access_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_events ALTER COLUMN id SET DEFAULT nextval('public.access_events_id_seq'::regclass);


--
-- Name: team_members PK_0319e633b920fa63a4063fbe084; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_0319e633b920fa63a4063fbe084') THEN
    ALTER TABLE public.team_members ADD CONSTRAINT "PK_0319e633b920fa63a4063fbe084" PRIMARY KEY (registration);
  END IF;
END $$;


--
-- Name: work_permits PK_1aad42aa6f052f8a9447b25f337; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_1aad42aa6f052f8a9447b25f337') THEN
    ALTER TABLE public.work_permits ADD CONSTRAINT "PK_1aad42aa6f052f8a9447b25f337" PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: company_groups PK_76d7cb05e9a438d2db15c1236b8; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_76d7cb05e9a438d2db15c1236b8') THEN
    ALTER TABLE public.company_groups ADD CONSTRAINT "PK_76d7cb05e9a438d2db15c1236b8" PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: branches PK_7f37d3b42defea97f1df0d19535; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_7f37d3b42defea97f1df0d19535') THEN
    ALTER TABLE public.branches ADD CONSTRAINT "PK_7f37d3b42defea97f1df0d19535" PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: device_credentials PK_96678b2954bc2c8d4d5be68f011; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_96678b2954bc2c8d4d5be68f011') THEN
    ALTER TABLE public.device_credentials ADD CONSTRAINT "PK_96678b2954bc2c8d4d5be68f011" PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_a3ffb1c0c8416b9fc6f907b7433') THEN
    ALTER TABLE public.users ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: access_events PK_b5edb54463ff60f59a3d40f71e3; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_b5edb54463ff60f59a3d40f71e3') THEN
    ALTER TABLE public.access_events ADD CONSTRAINT "PK_b5edb54463ff60f59a3d40f71e3" PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: employees PK_b9535a98350d5b26e7eb0c26af4; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_b9535a98350d5b26e7eb0c26af4') THEN
    ALTER TABLE public.employees ADD CONSTRAINT "PK_b9535a98350d5b26e7eb0c26af4" PRIMARY KEY (id);
  END IF;
END $$;


--
-- Name: IDX_97672ac88f789774dd47f7c8be; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_97672ac88f789774dd47f7c8be" ON public.users USING btree (email);


--
-- PostgreSQL database dump complete
--


