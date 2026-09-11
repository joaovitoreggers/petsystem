#!/usr/bin/env bash
# Roda os testes end-to-end (Playwright) contra a stack real do docker
# compose — front-end, back-end e Postgres de verdade, não mocks. Precisa
# de Node/npm no host (diferente de test.sh) porque o Playwright dirige um
# Chromium local contra a stack. Sobe a stack se ainda não estiver de pé,
# garante que o banco está semeado (os testes fazem login com as contas de
# `npm run backend:seed`) e roda a suíte.
set -euo pipefail
cd "$(dirname "$0")"

docker compose up -d --build
docker compose exec backend npm run backend:seed

npx playwright install chromium --with-deps >/dev/null
npx playwright test "$@"
