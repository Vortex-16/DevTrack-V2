#!/usr/bin/env bash
# db-backup.sh — Manual Neon Postgres backup script for DevTrack V2
#
# Usage:
#   ./infra/scripts/db-backup.sh
#
# Requirements:
#   - pg_dump installed (brew install postgresql / apt install postgresql-client)
#   - DATABASE_URL or DIRECT_URL set in environment (or pass via .env)
#   - Optional: AWS_S3_BUCKET for automatic S3 upload
#
# Output:
#   Local file: backups/devtrack_YYYYMMDD_HHMMSS.dump
#   Optional:   Uploaded to s3://$AWS_S3_BUCKET/backups/

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$REPO_ROOT/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="devtrack_${TIMESTAMP}.dump"
BACKUP_PATH="$BACKUP_DIR/$FILENAME"

# Load .env from apps/api if DATABASE_URL is not already set
if [[ -z "${DATABASE_URL:-}" ]]; then
  ENV_FILE="$REPO_ROOT/apps/api/.env"
  if [[ -f "$ENV_FILE" ]]; then
    # Export only DATABASE_URL and DIRECT_URL lines
    set -a
    # shellcheck disable=SC2046
    export $(grep -E '^(DATABASE_URL|DIRECT_URL)=' "$ENV_FILE" | xargs)
    set +a
  fi
fi

if [[ -z "${DIRECT_URL:-}" && -z "${DATABASE_URL:-}" ]]; then
  echo "[ERROR] Neither DATABASE_URL nor DIRECT_URL is set."
  echo "        Set DIRECT_URL for a non-pooled connection required by pg_dump."
  exit 1
fi

# Prefer DIRECT_URL (non-pooled) for pg_dump
DB_URL="${DIRECT_URL:-$DATABASE_URL}"

# ─── Create backup directory ──────────────────────────────────
mkdir -p "$BACKUP_DIR"

echo "[DevTrack] Starting backup: $FILENAME"

# ─── Run pg_dump ──────────────────────────────────────────────
pg_dump \
  --format=custom \
  --compress=9 \
  --no-password \
  "$DB_URL" \
  --file="$BACKUP_PATH"

echo "[DevTrack] Backup complete: $BACKUP_PATH"
echo "[DevTrack] Size: $(du -sh "$BACKUP_PATH" | cut -f1)"

# ─── Optional S3 upload ───────────────────────────────────────
if [[ -n "${AWS_S3_BUCKET:-}" ]]; then
  echo "[DevTrack] Uploading to s3://$AWS_S3_BUCKET/backups/$FILENAME"
  aws s3 cp "$BACKUP_PATH" "s3://$AWS_S3_BUCKET/backups/$FILENAME" \
    --storage-class STANDARD_IA
  echo "[DevTrack] Upload complete."
fi

# ─── Prune old local backups (keep last 7) ────────────────────
echo "[DevTrack] Pruning old backups (keeping last 7)..."
ls -1t "$BACKUP_DIR"/*.dump 2>/dev/null | tail -n +8 | xargs -r rm -f
echo "[DevTrack] Done."
