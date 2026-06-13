#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found. Create it from .env.example" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

: "${GITHUB_OWNER_REPO:?Must set GITHUB_OWNER_REPO in .env}"
: "${STAGING_RULESET_ID:?Must set STAGING_RULESET_ID in .env}"

REMOTE="${1:-origin}"

echo "=== Disabling staging branch protection ==="
gh api -X PUT "repos/$GITHUB_OWNER_REPO/rulesets/$STAGING_RULESET_ID" \
  -f enforcement=disabled > /dev/null

echo "=== Force pushing $REMOTE/main -> $REMOTE/staging ==="
git fetch "$REMOTE" main staging
git push "$REMOTE" main:staging --force

echo "=== Re-enabling staging branch protection ==="
gh api -X PUT "repos/$GITHUB_OWNER_REPO/rulesets/$STAGING_RULESET_ID" \
  -f enforcement=active > /dev/null

echo "=== Done ==="
