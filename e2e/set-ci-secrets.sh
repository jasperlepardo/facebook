#!/usr/bin/env bash
# Push local E2E credentials to GitHub Actions secrets.
# Requires: gh auth login, and values in .env.local (or env).
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v gh >/dev/null; then
  echo "Install GitHub CLI: https://cli.github.com/" >&2
  exit 1
fi

load_env() {
  local key="$1"
  if [[ -n "${!key:-}" ]]; then
    echo "${!key}"
    return
  fi
  if [[ -f .env.local ]]; then
    local line
    line=$(grep -E "^${key}=" .env.local | tail -1 || true)
    if [[ -n "$line" ]]; then
      echo "${line#*=}" | sed -e 's/^["'\'']//' -e 's/["'\'']$//'
      return
    fi
  fi
  echo ""
}

EMAIL=$(load_env E2E_EMAIL)
PASS=$(load_env E2E_PASSWORD)
BASE=$(load_env E2E_BASE_URL)
# Prefer dedicated CI URL; fall back to PLAYWRIGHT_BASE_URL or prompt
if [[ -z "$BASE" ]]; then
  BASE=$(load_env PLAYWRIGHT_BASE_URL)
fi

if [[ -z "$EMAIL" || -z "$PASS" ]]; then
  echo "Set E2E_EMAIL and E2E_PASSWORD in .env.local first." >&2
  exit 1
fi

if [[ -z "$BASE" ]]; then
  read -r -p "Deployed app URL for CI (e.g. https://resibo.vercel.app): " BASE
fi
if [[ -z "$BASE" ]]; then
  echo "E2E_BASE_URL is required for CI." >&2
  exit 1
fi

echo "Setting secrets on $(gh repo view --json nameWithOwner -q .nameWithOwner)…"
printf '%s' "$BASE"  | gh secret set E2E_BASE_URL
printf '%s' "$EMAIL" | gh secret set E2E_EMAIL
printf '%s' "$PASS"  | gh secret set E2E_PASSWORD
echo "Done. Re-run the CI workflow to exercise the e2e job."
