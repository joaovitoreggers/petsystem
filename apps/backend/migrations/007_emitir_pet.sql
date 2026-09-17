-- ---------------------------------------------------------------------------
-- 007 — Emitir PET é trabalho do técnico
-- ---------------------------------------------------------------------------
-- Até aqui, qualquer conta autenticada podia abrir uma permissão de entrada e
-- trabalho: a rota exigia só estar logado. Na prática isso deixava o
-- administrador emitindo PET, e quem responde por uma PET em campo é o
-- técnico de segurança — é ele que vistoria a frente, mede a atmosfera e
-- assina.
--
-- A permissão nasce aqui e é concedida apenas ao cargo operador (que é onde
-- o papel "tecnico" cai — ver AccessControlService.CARGO_POR_PAPEL).
--
-- Administrador NÃO recebe, de propósito. É a única permissão do sistema que
-- ele não tem, e é intencional: administrar o sistema não é assinar por uma
-- frente de trabalho. Quem administra continua enxergando as PETs; só não as
-- emite.
INSERT INTO permissions (slug, name, category, description) VALUES
  ('emitir_pet', 'Emitir PET', 'pet', 'Abrir uma permissao de entrada e trabalho em campo.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'operador'
  AND p.slug = 'emitir_pet'
ON CONFLICT DO NOTHING;
