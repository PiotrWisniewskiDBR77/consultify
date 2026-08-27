#!/usr/bin/env bash
# deploy-demo.sh — wypchnij aktualny Londyn branch na demo.consultify.ai
# Użycie: ./scripts/deploy-demo.sh [commit-sha]
#
# Bez argumentu: push HEAD i triggeruje build z demo branch.
# Z SHA:         deployuje konkretny commit (commitSha w Railway API).
#
# Bezpieczeństwo:
#   - NIE dotyka production ani staging
#   - Przed pobraniem tokenu i pushem uruchamia repozytoryjną bramkę celu dla demo
#   - Wymaga RELEASE_TARGET_DB_HOST_FINGERPRINT i DEMO_DB_HOST_FINGERPRINT
#   - Wymaga aktywnej sesji railway CLI (railway whoami)
#   - Token pobierany z ~/.railway/config.json (bez haseł w env)

set -euo pipefail

PROJECT_ID="a6d59e88-263d-45f3-96bc-861f66bf467b"
SERVICE_ID="8f65b820-3d55-4dd9-8076-929d01cc4157"
DEMO_ENV_ID="a257fce9-33f0-4e10-8e7c-a9cec472f377"  # demo environment

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# GIT_REF describes the push destination (origin/demo), not the operator's
# current local branch. The guard must approve the destination before any token
# is read or any external side effect occurs.
DEPLOY_ENVIRONMENT=demo \
GIT_REF=refs/heads/demo \
FRONTEND_URL=https://demo.consultify.ai \
  "$SCRIPT_DIR/validate-deploy-target.sh"

RAILWAY_TOKEN=$(python3 -c "
import json
with open('$HOME/.railway/config.json') as f:
    d = json.load(f)
print(d.get('user', {}).get('accessToken', ''))
")

if [ -z "$RAILWAY_TOKEN" ]; then
  echo "❌ Brak tokenu Railway. Zaloguj się: railway login"
  exit 1
fi

gql() {
  curl -s -X POST "https://backboard.railway.app/graphql/v2" \
    -H "Authorization: Bearer $RAILWAY_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$1"
}

# --- Push do origin/demo ---
echo "📤 Push Londyn → origin/demo..."
CURRENT=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT" != "Londyn" ]; then
  echo "⚠️  Aktualny branch: $CURRENT (nie Londyn). Kontynuuję push."
fi
git push origin HEAD:demo --force-with-lease
echo "✅ Push zakończony: $(git rev-parse --short HEAD)"

# --- Triggeruj deploy przez Railway API ---
echo ""
echo "🚀 Triggeruję Railway deploy (demo env, latestCommit)..."
RESULT=$(gql "{\"query\": \"mutation { serviceInstanceDeploy(environmentId: \\\"$DEMO_ENV_ID\\\", serviceId: \\\"$SERVICE_ID\\\", latestCommit: true) }\"}")
STATUS=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('serviceInstanceDeploy','?'))")

if [ "$STATUS" = "True" ] || [ "$STATUS" = "true" ]; then
  echo "✅ Deploy wyzwolony!"
else
  echo "❌ Błąd wyzwalania deploy:"
  echo "$RESULT" | python3 -m json.tool
  exit 1
fi

# --- Czekaj i raportuj status ---
echo ""
echo "⏳ Czekam na start builda..."
sleep 5

for i in $(seq 1 24); do  # max 12 min (24 × 30s)
  STATUS=$(gql "{\"query\": \"{ deployments(input: { environmentId: \\\"$DEMO_ENV_ID\\\", serviceId: \\\"$SERVICE_ID\\\" }) { edges { node { id status meta } } } }\"}" \
    | python3 -c "
import json, sys
d = json.load(sys.stdin)
e = d['data']['deployments']['edges']
if not e:
    print('UNKNOWN')
else:
    n = e[0]['node']
    meta = n.get('meta', {}) or {}
    branch = meta.get('branch', '') if isinstance(meta, dict) else ''
    sha = meta.get('commitHash', '')[:8] if isinstance(meta, dict) else ''
    print(f'{n[\"status\"]}|{branch}|{sha}')
" 2>/dev/null)

  IFS='|' read -r BUILD_STATUS BUILD_BRANCH BUILD_SHA <<< "$STATUS"
  echo "  [$(date +%H:%M:%S)] $BUILD_STATUS — $BUILD_BRANCH/$BUILD_SHA"

  case "$BUILD_STATUS" in
    SUCCESS)
      echo ""
      echo "✅ Deploy gotowy! → https://demo.consultify.ai"
      exit 0
      ;;
    FAILED|CRASHED|REMOVED)
      echo ""
      echo "❌ Deploy FAILED. Sprawdź logi: railway logs --environment demo"
      exit 1
      ;;
  esac

  sleep 30
done

echo ""
echo "⏱  Timeout (12 min). Sprawdź ręcznie: https://railway.app/project/$PROJECT_ID"
