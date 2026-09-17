-- ---------------------------------------------------------------------------
-- 006 — Da cargo as contas que nasceram sem nenhum
-- ---------------------------------------------------------------------------
-- A migration 002 ligou papel (users.role) a cargo (roles) para quem existia
-- naquele momento, mas o cadastro de usuarios continuou criando conta sem
-- fazer essa ligacao. Resultado: toda conta criada depois da 002 entrava sem
-- permissao nenhuma — a pessoa logava num sistema onde nada aparecia e nada
-- funcionava, sem erro que explicasse o porque.
--
-- O cadastro passou a ligar sozinho (AccessControlService.sincronizarCargo).
-- Esta migration cobre quem ficou no meio do caminho.
--
-- So mexe em quem nao tem cargo nenhum: quem ja tem fica como esta, inclusive
-- se alguem tiver recebido um cargo diferente do papel de propósito.
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
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
)
ON CONFLICT DO NOTHING;
