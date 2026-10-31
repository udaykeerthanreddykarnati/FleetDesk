#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .env.local ]]; then echo "Missing .env.local. Run ./scripts/setup-local.sh first."; exit 1; fi
set -a
source .env.local
set +a
DATA="$PWD/.local-data"
mkdir -p "$DATA/mysql" "$DATA/postgres" /tmp/fleet-logistics-pg

MYSQLD="$(command -v mysqld)"
MYSQL_BASEDIR="$(brew --prefix mysql)"
if [[ ! -d "$DATA/mysql/mysql" ]]; then
  "$MYSQLD" --initialize-insecure --basedir="$MYSQL_BASEDIR" --datadir="$DATA/mysql" --user="$(id -un)"
fi
if ! mysqladmin --protocol=tcp --host=127.0.0.1 --port="${MYSQL_PORT:-3307}" --user=root ping --silent >/dev/null 2>&1; then
  "$MYSQLD" --daemonize --user="$(id -un)" --basedir="$MYSQL_BASEDIR" --datadir="$DATA/mysql" \
    --socket=/tmp/fleet-logistics-mysql.sock --pid-file="$DATA/mysql.pid" --port="${MYSQL_PORT:-3307}" \
    --bind-address=127.0.0.1 --mysqlx=0 --log-error="$DATA/mysql.log"
  for attempt in $(seq 1 40); do
    if mysqladmin --protocol=tcp --host=127.0.0.1 --port="${MYSQL_PORT:-3307}" --user=root ping --silent >/dev/null 2>&1; then break; fi
    sleep 1
  done
  mysqladmin --protocol=tcp --host=127.0.0.1 --port="${MYSQL_PORT:-3307}" --user=root ping --silent
fi

INITDB="$(command -v initdb)"
PG_CTL="$(command -v pg_ctl)"
if [[ ! -f "$DATA/postgres/PG_VERSION" ]]; then
  "$INITDB" -D "$DATA/postgres" -U postgres --auth-local=trust --auth-host=trust --no-locale -E UTF8
fi
if ! pg_isready --host=127.0.0.1 --port=5433 >/dev/null 2>&1; then
  "$PG_CTL" -D "$DATA/postgres" -l "$DATA/postgres.log" -o "-h 127.0.0.1 -p 5433 -k /tmp/fleet-logistics-pg" start
fi

mysql --protocol=tcp --host=127.0.0.1 --port="${MYSQL_PORT:-3307}" --user=root <<SQL
CREATE DATABASE IF NOT EXISTS fleet_logistics CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'fleet_app'@'127.0.0.1' IDENTIFIED BY '${MYSQL_PASSWORD}';
ALTER USER 'fleet_app'@'127.0.0.1' IDENTIFIED BY '${MYSQL_PASSWORD}';
GRANT ALL PRIVILEGES ON fleet_logistics.* TO 'fleet_app'@'127.0.0.1';
SQL

if psql --host=127.0.0.1 --port=5433 --username=postgres --dbname=postgres --tuples-only --no-align --command="SELECT 1 FROM pg_roles WHERE rolname='fleet_app'" | grep -q '^1$'; then
  psql --host=127.0.0.1 --port=5433 --username=postgres --dbname=postgres --set=ON_ERROR_STOP=1 --command="ALTER ROLE fleet_app WITH PASSWORD '${PG_VECTOR_PASSWORD}'"
else
  psql --host=127.0.0.1 --port=5433 --username=postgres --dbname=postgres --set=ON_ERROR_STOP=1 --command="CREATE ROLE fleet_app LOGIN PASSWORD '${PG_VECTOR_PASSWORD}'"
fi
if ! psql --host=127.0.0.1 --port=5433 --username=postgres --dbname=postgres --tuples-only --no-align --command="SELECT 1 FROM pg_database WHERE datname='fleet_vectors'" | grep -q '^1$'; then
  createdb --host=127.0.0.1 --port=5433 --username=postgres --owner=fleet_app fleet_vectors
fi
psql --host=127.0.0.1 --port=5433 --username=postgres --dbname=postgres --command='GRANT ALL PRIVILEGES ON DATABASE fleet_vectors TO fleet_app' >/dev/null
echo "Local databases are ready on MySQL :${MYSQL_PORT:-3307} and PostgreSQL :5433. Data is stored in .local-data/."
