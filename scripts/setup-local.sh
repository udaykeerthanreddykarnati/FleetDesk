#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .env.local ]]; then
  MYSQL_PASSWORD="$(openssl rand -hex 24)"
  PG_VECTOR_PASSWORD="$(openssl rand -hex 24)"
  SESSION_SECRET="$(openssl rand -base64 48)"
  cat > .env.local <<ENV
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3307
MYSQL_USER=fleet_app
MYSQL_PASSWORD=${MYSQL_PASSWORD}
MYSQL_DATABASE=fleet_logistics
PG_VECTOR_PASSWORD=${PG_VECTOR_PASSWORD}
PG_VECTOR_URL=postgresql://fleet_app:${PG_VECTOR_PASSWORD}@127.0.0.1:5433/fleet_vectors
SESSION_SECRET=${SESSION_SECRET}
OLLAMA_BASE_URL=http://127.0.0.1:11434
EMBEDDING_MODEL=nomic-embed-text
ENV
  chmod 600 .env.local
fi
./scripts/start-local-databases.sh
./scripts/init-databases.sh
echo "Initial local setup is complete. Next run: npm run db:seed"
