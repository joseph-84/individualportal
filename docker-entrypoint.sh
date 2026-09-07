#!/bin/sh
set -e

echo "[entrypoint] applying database migrations..."
npx prisma migrate deploy

echo "[entrypoint] seeding (idempotent — upserts admin/roles, skips demo data if present)..."
npx tsx prisma/seed.ts

echo "[entrypoint] starting server..."
exec node server.js
