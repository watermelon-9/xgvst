#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS_DIR="${ROOT_DIR}/packages/workers/migrations"
DB_NAME="xgvst_quote"

if [[ ! -d "${MIGRATIONS_DIR}" ]]; then
  echo "migrations dir not found: ${MIGRATIONS_DIR}" >&2
  exit 1
fi

MIGRATION_REL="${MIGRATION_REL:-$(find "${MIGRATIONS_DIR}" -maxdepth 1 -name '*.sql' | sort | tail -n 1 | xargs basename)}"
MIGRATION_FILE="${MIGRATIONS_DIR}/${MIGRATION_REL}"

if [[ -z "${MIGRATION_REL}" || ! -f "${MIGRATION_FILE}" ]]; then
  echo "migration file not found: ${MIGRATION_FILE}" >&2
  exit 1
fi

cd "${ROOT_DIR}/packages/workers"

echo "[p23] applying local D1 migration: ${MIGRATION_REL}"
corepack pnpm exec wrangler d1 execute "${DB_NAME}" --local --file="migrations/${MIGRATION_REL}"

echo "[p23] local migration completed."

echo "[p23] to apply remote manually (recommended after backup):"
echo "  cd ${ROOT_DIR}/packages/workers"
echo "  corepack pnpm exec wrangler d1 export ${DB_NAME} --remote --output ./backups/${DB_NAME}-$(date +%Y%m%d-%H%M%S).sql"
echo "  corepack pnpm exec wrangler d1 execute ${DB_NAME} --remote --file=migrations/${MIGRATION_REL}"

echo "[p23] quick index check (local):"
cat <<'SQL'
  corepack pnpm exec wrangler d1 execute xgvst_quote --local --command "PRAGMA index_list('users');"
  corepack pnpm exec wrangler d1 execute xgvst_quote --local --command "PRAGMA index_list('self_selects');"
SQL
