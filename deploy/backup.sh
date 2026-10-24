#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")/.."
set -a
source .env
set +a
: "${DATABASE_URL:?Set DATABASE_URL}"
: "${BACKUP_DIR:?Set BACKUP_DIR}"
: "${BACKUP_RECIPIENT:?Set an age public recipient}"
command -v age >/dev/null
command -v pg_dump >/dev/null
mkdir -p "$BACKUP_DIR"
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT
trap 'node --import tsx scripts/backup-event.ts ERROR || true' ERR
pg_dump --dbname="$DATABASE_URL" --format=custom --file="$work_dir/database.dump"
if [[ -d "${STORAGE_PATH:-storage}" ]]; then
    tar -czf "$work_dir/storage.tar.gz" -C "${STORAGE_PATH:-storage}" .
fi
archive="$BACKUP_DIR/lamariva-$(date -u +%Y%m%dT%H%M%SZ).tar.age"
tar -C "$work_dir" -cf - . | age -r "$BACKUP_RECIPIENT" -o "$archive"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'lamariva-*.tar.age' -mtime "+${BACKUP_RETENTION_DAYS:-14}" -delete
node --import tsx scripts/backup-event.ts OK
echo "Encrypted backup created: $archive"
