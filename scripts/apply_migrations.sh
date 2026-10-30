#!/usr/bin/env bash
# Apply the Converge migrations to a PostgreSQL database that has PostGIS.
#
# Usage:
#   DATABASE_URL=postgres://user:pass@host:5432/db ./scripts/apply_migrations.sh
#
# Set SHIM=1 to also create the local `auth` schema shim. Leave it unset when
# applying to a real Supabase project, which already provides it.
# Set SEED=1 to load supabase/seed.sql afterwards.
set -euo pipefail

DB="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
# Override to run the client from elsewhere, e.g. inside a container:
#   PSQL="docker exec -i my-postgres psql -U postgres" ./scripts/apply_migrations.sh
PSQL="${PSQL:-psql}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Applying Converge migrations to $DB"

if [ "${SHIM:-0}" = "1" ]; then
  echo "  -> supabase/tests/00_auth_shim.sql (local auth shim)"
  $PSQL "$DB" -v ON_ERROR_STOP=1 -q -f "$HERE/../supabase/tests/00_auth_shim.sql"
fi

for file in "$HERE/../supabase/migrations"/*.sql; do
  echo "  -> $(basename "$file")"
  $PSQL "$DB" -v ON_ERROR_STOP=1 -q -f "$file"
done

if [ "${SEED:-0}" = "1" ]; then
  echo "  -> supabase/seed.sql"
  $PSQL "$DB" -v ON_ERROR_STOP=1 -q -f "$HERE/../supabase/seed.sql"
fi

echo "Done."
