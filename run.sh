#!/usr/bin/env bash
# Sobe o ambiente (front-end, back-end e Postgres) via Docker Compose e
# popula os usuários de teste. Pensado tanto para dev local quanto para um
# primeiro deploy num servidor caseiro (ex.: EasyPanel apontando pra este
# docker-compose.yml) — não assume Node/npm instalados no host, só Docker.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  if command -v openssl >/dev/null 2>&1; then
    JWT_SECRET="$(openssl rand -hex 32)"
    sed "s/^JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env > .env.tmp && mv .env.tmp .env
  fi
  echo "Criado .env a partir de .env.example (com um JWT_SECRET aleatório)."
  echo "Revise os demais valores antes de expor este servidor à internet."
fi

docker compose up --build -d --wait

echo "Populando usuários de teste (idempotente)..."
docker compose exec backend npm run backend:seed

cat <<EOF

Pronto:
  Front-end: http://localhost:8080
  Back-end:  http://localhost:3000/api

Logs:    docker compose logs -f
Parar:   docker compose down
EOF
