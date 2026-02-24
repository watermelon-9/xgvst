#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION_FILE="${ROOT_DIR}/packages/workers/migrations/0001_p23_proto_d1.sql"
DB_NAME="xgvst_quote"

if [[ ! -f "${MIGRATION_FILE}" ]]; then
  echo "migration file not found: ${MIGRATION_FILE}" >&2
  exit 1
fi

cd "${ROOT_DIR}/packages/workers"

MIGRATION_REL="migrations/0001_p23_proto_d1.sql"

echo "[p23] applying local D1 migration..."
corepack pnpm exec wrangler d1 execute "${DB_NAME}" --local --file="${MIGRATION_REL}"

echo "[p23] local migration completed."

echo "[p23] to apply remote manually (recommended after backup):"
echo "  cd ${ROOT_DIR}/packages/workers"
echo "  corepack pnpm exec wrangler d1 export ${DB_NAME} --remote --output ./backups/${DB_NAME}-$(date +%Y%m%d-%H%M%S).sql"
echo "  corepack pnpm exec wrangler d1 execute ${DB_NAME} --remote --file=${MIGRATION_REL}"
