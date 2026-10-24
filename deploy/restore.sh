#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
if [[ $# -ne 3 ]]; then
  echo "Usage: $0 backup.tar.age age-private-key-file NEW_EMPTY_DATABASE_URL" >&2
  exit 2
fi
restore_work=$(mktemp -d)
trap 'rm -rf "$restore_work"' EXIT
age -d -i "$2" "$1" | tar -xf - -C "$restore_work"
# The destination must be a separate, empty database. Never drop production automatically.
pg_restore --dbname="$3" --no-owner --no-privileges --exit-on-error "$restore_work/database.dump"
if [[ -f "$restore_work/storage.tar.gz" ]]; then
  echo "Storage archive is present. Extract it into a separate restore directory before switching traffic."
  cp "$restore_work/storage.tar.gz" ./restored-storage.tar.gz
fi
echo "Database restored. Verify accounts, document exports, and record counts before switching DATABASE_URL."
