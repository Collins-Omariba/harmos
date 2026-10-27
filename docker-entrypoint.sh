#!/bin/sh
set -eu

# The image ships a seeded SQLite database. On the first run the named volume
# is empty, so copy the seed in. Subsequent runs keep the volume's database.
if [ ! -f /data/harmos.db ]; then
  echo "No database at /data/harmos.db — installing the seeded demo database."
  cp /app/seed/harmos.db /data/harmos.db
fi

mkdir -p /data/.cache

exec "$@"
