-- 004_porteiro_ve_ocorrencias.sql
--
-- O porteiro recebeu criar_ocorrencia em 002, mas nao visualizar_ocorrencias:
-- podia registrar e nao podia reler o que registrou. Incoerencia de seed,
-- percebida ao testar a matriz de acesso por cargo.
--
-- Entra como migration nova, e nao como correcao da 002: migration aplicada
-- nao se edita. Quem ja rodou a 002 aplica so esta; quem for rodar do zero
-- aplica as duas em ordem e chega no mesmo lugar.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.slug = 'visualizar_ocorrencias'
WHERE r.slug = 'porteiro'
ON CONFLICT DO NOTHING;
