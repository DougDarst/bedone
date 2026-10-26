#!/usr/bin/env bash
# Starts PocketBase for end-to-end tests: a throwaway database, this repo's
# migrations and hooks, and the built frontend from pb_public. Playwright
# starts and stops it (see playwright.config.ts). Run `npm run build` first.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${E2E_PORT:-8097}"
DIR="$(mktemp -d)"
cleanup() { rm -rf "$DIR"; }
trap cleanup EXIT INT TERM

FLAGS=(--dir "$DIR" --migrationsDir "$ROOT/pb_migrations" --hooksDir "$ROOT/pb_hooks")

# A superuser must exist before serving, or PocketBase opens a browser tab
# with its setup page.
"$ROOT/pocketbase" superuser upsert "${E2E_SUPERUSER_EMAIL:-e2e@example.test}" \
  "${E2E_SUPERUSER_PASSWORD:-e2e-superuser-password}" "${FLAGS[@]}" >/dev/null

"$ROOT/pocketbase" serve --http "127.0.0.1:$PORT" --publicDir "$ROOT/pb_public" "${FLAGS[@]}"
