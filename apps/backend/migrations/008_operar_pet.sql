-- ---------------------------------------------------------------------------
-- 008 — Medir e encerrar PET também é trabalho do técnico
-- ---------------------------------------------------------------------------
-- A migration 007 tirou a emissão da mão de quem administra, mas deixou duas
-- portas abertas: registrar medição atmosférica e encerrar a permissão. As
-- duas rotas exigiam só estar logado, então o gestor continuava medindo e
-- encerrando PET pela tela.
--
-- São os mesmos atos de campo da emissão: quem mede o O₂ está com o
-- detector na mão dentro do espaço confinado, e quem encerra está dizendo
-- que a frente foi desmobilizada em segurança. Isso é assinatura técnica,
-- não acompanhamento gerencial.
--
-- Permissão separada de `emitir_pet` de propósito: são momentos diferentes
-- da mesma PET, e um dia pode fazer sentido que quem emite não seja quem
-- encerra. Hoje as duas vão para o mesmo cargo; se a regra mudar, muda sem
-- precisar desmontar nada.
INSERT INTO permissions (slug, name, category, description) VALUES
  ('operar_pet', 'Medir e encerrar PET', 'pet', 'Registrar medicao atmosferica e encerrar uma permissao em campo.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'operador'
  AND p.slug = 'operar_pet'
ON CONFLICT DO NOTHING;
