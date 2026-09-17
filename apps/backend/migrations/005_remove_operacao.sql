-- ---------------------------------------------------------------------------
-- 005 — Remove portas, tarefas, ocorrencias, dispositivos, alertas e auditoria
-- ---------------------------------------------------------------------------
-- As funcionalidades foram retiradas do sistema. O codigo saiu antes; esta
-- migration tira o que ficou no banco, para o schema nao guardar tabela que
-- nada le nem escreve.
--
-- Isto apaga dado, e nao ha volta por aqui: as migrations 003 e 004 criaram
-- essas tabelas, mas nao guardam o conteudo delas. Quem precisar do
-- historico de portas ou da trilha de auditoria tem que ter feito copia do
-- banco antes de aplicar.
--
-- Por que uma migration nova em vez de apagar a 003: arquivo ja aplicado nao
-- se edita. O executor confere o checksum de cada um e para se algo mudou
-- por baixo — e o historico do schema tambem e registro, inclusive quando
-- registra que algo foi criado e depois removido.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
-- A ordem segue as dependencias: door_events e alerts apontam para doors,
-- doors aponta para devices. CASCADE cobre indices e constraints que sobrem.
DROP TABLE IF EXISTS door_events CASCADE;
DROP TABLE IF EXISTS alerts      CASCADE;
DROP TABLE IF EXISTS doors       CASCADE;
DROP TABLE IF EXISTS tasks       CASCADE;
DROP TABLE IF EXISTS occurrences CASCADE;
DROP TABLE IF EXISTS devices     CASCADE;
DROP TABLE IF EXISTS audit_logs  CASCADE;

-- ---------------------------------------------------------------------------
-- Permissoes que sobraram sem funcionalidade
-- ---------------------------------------------------------------------------
-- Sem as telas e sem as rotas, estas permissoes nao liberam mais nada. Deixa-
-- las cadastradas faria a futura tela de cargos oferecer caixinhas que nao
-- produzem efeito nenhum — pior do que nao oferecer.
--
-- As linhas de role_permissions somem junto pela FK com ON DELETE CASCADE,
-- inclusive a concessao que a migration 004 deu ao porteiro.
DELETE FROM permissions WHERE slug IN (
  'visualizar_portas',
  'visualizar_eventos',
  'visualizar_alertas',
  'visualizar_tarefas',
  'criar_tarefa',
  'editar_tarefa',
  'visualizar_ocorrencias',
  'criar_ocorrencia',
  'gerenciar_dispositivos',
  'visualizar_logs'
);
