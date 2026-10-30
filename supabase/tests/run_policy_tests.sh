#!/usr/bin/env bash
# Run the policy tests against a freshly migrated database.
#
# Builds on `run_migrations.sh`: it creates the database, applies every
# migration, then runs `policies.sql`. Any failed assertion raises an exception,
# which `ON_ERROR_STOP` turns into a non-zero exit.
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="${1:-converge_policy_check}"
PSQL=(psql -v ON_ERROR_STOP=1 -q)

if ! "${PSQL[@]}" -d postgres -c 'select 1' >/dev/null 2>&1; then
  PSQL=(sudo -n -u postgres "${PSQL[@]}")
fi

"$ROOT/supabase/tests/run_migrations.sh" "$DB" >/dev/null || {
  echo "migrations failed; run supabase/tests/run_migrations.sh directly for detail"
  exit 1
}

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp "$ROOT"/supabase/tests/policies.sql "$STAGE"/
chmod -R a+rX "$STAGE"

if out=$("${PSQL[@]}" -d "$DB" -f "$STAGE/policies.sql" 2>&1); then
  echo "policy tests: PASS"
  echo "$out" | grep -i "policy tests passed" || true
else
  echo "policy tests: FAIL"
  echo "$out" | head -20
  exit 1
fi
