#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; source .env.local; set +a
mysql --protocol=tcp --host=127.0.0.1 --port="${MYSQL_PORT:-3307}" --user=root < backend/sql/mysql/001_schema.sql
mysql --protocol=tcp --host=127.0.0.1 --port="${MYSQL_PORT:-3307}" --user=root < backend/sql/mysql/002_programmability.sql
psql --host=127.0.0.1 --port=5433 --username=postgres --dbname=fleet_vectors --set=ON_ERROR_STOP=1 --file=backend/sql/postgres/001_vector_schema.sql
psql --host=127.0.0.1 --port=5433 --username=postgres --dbname=fleet_vectors --set=ON_ERROR_STOP=1 --command='GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fleet_app'
echo "MySQL schema, views, triggers and routines plus the pgvector schema are ready."
