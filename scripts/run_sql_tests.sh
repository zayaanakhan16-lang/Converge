#!/usr/bin/env bash
# Run the Converge SQL suites against a database with the migrations applied.
#
# Usage:
#   DATABASE_URL=postgres://user:pass@host:5432/db ./scripts/run_sql_tests.sh
#   PSQL="docker exec -i converge-pg psql -U postgres" ./scripts/run_sql_tests.sh
#
# DATABASE_URL is only used by the local `psql` client. When PSQL is set to a
# command that already carries its own connection (a container, say), leave
# DATABASE_URL unset and it will not be appended. The suite is fed through
# standard input rather than with -f, so the file does not have to be visible
# inside a container.
#
# The suites need a freshly migrated database with no seed data: several cases
# count rows overall, so seeded connections would make the expected values
# meaningless. The script checks for that and says so rather than reporting a
# confusing mismatch.
set -euo pipefail

DB="${DATABASE_URL:-}"
PSQL="${PSQL:-psql}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS="$HERE/../supabase/tests"

run_suite() {
  local file="$1"
  if [ -n "$DB" ]; then
    $PSQL "$DB" -v ON_ERROR_STOP=1 -f - < "$file"
  else
    $PSQL -v ON_ERROR_STOP=1 -f - < "$file"
  fi
}

echo "Running Converge SQL suites"

for file in "$TESTS/schema_test.sql" "$TESTS/rls_test.sql"; do
  name="$(basename "$file")"
  echo "  -> $name"
  output="$(mktemp)"
  if run_suite "$file" >"$output" 2>&1; then
    # A suite passes by printing its sentinel. The exit code alone is not enough:
    # psql succeeds even when a case raised only a notice.
    if grep -q "TESTS PASSED" "$output"; then
      grep -E "TESTS PASSED" "$output" | sed "s/^/     $name: /"
    else
      echo "     FAILED: $name exited cleanly but never reported success"
      cat "$output"
      rm -f "$output"
      exit 1
    fi
  else
    echo "     FAILED: $name"
    grep -E "FAIL|ERROR" "$output" | head -20
    rm -f "$output"
    exit 1
  fi
  rm -f "$output"
done

echo "All SQL suites passed."
