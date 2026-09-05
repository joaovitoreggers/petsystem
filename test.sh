#!/usr/bin/env bash
# Roda os testes e o build de back-end e front-end dentro da imagem Docker do
# back-end (o monorepo Nx inteiro já vive lá — ver a nota em
# apps/backend/Dockerfile), então isso funciona sem precisar de Node/npm no
# host. Não sobe banco nem front-end: os testes usam mocks, não uma conexão
# real com o Postgres.
set -euo pipefail
cd "$(dirname "$0")"

docker compose build backend
docker compose run --rm --no-deps backend npx nx run-many -t test build
