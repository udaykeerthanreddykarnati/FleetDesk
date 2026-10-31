#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
DATA="$PWD/.local-data"
if [[ -f "$DATA/mysql.pid" ]]; then kill "$(cat "$DATA/mysql.pid")" 2>/dev/null || true; fi
if [[ -f "$DATA/postgres/PG_VERSION" ]]; then "$(command -v pg_ctl)" -D "$DATA/postgres" stop -m fast || true; fi
echo "Stopped the isolated local database servers."
