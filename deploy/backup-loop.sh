#!/bin/sh
# Daily mongodump into /backups, plus a copy of the question pictures (/media, if mounted).
# Prunes archives older than KEEP_DAYS.
set -eu
while true; do
  ts=$(date -u +%Y%m%d-%H%M%S)
  out="/backups/fnjee-$ts.archive.gz"
  if mongodump --uri="$MONGO_URI" --archive="$out" --gzip; then
    echo "[backup] ok $out"
  else
    echo "[backup] FAILED $ts" >&2
    rm -f "$out"
  fi
  if [ -d /media ]; then
    # pictures are content-addressed (never change), so a plain incremental copy is enough
    mkdir -p /backups/media && cp -n /media/* /backups/media/ 2>/dev/null || true
    echo "[backup] media synced ($(ls /backups/media | wc -l) files)"
  fi
  find /backups -name 'fnjee-*.archive.gz' -mtime +"$KEEP_DAYS" -delete
  sleep 86400
done
