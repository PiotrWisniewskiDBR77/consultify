#!/usr/bin/env bash

set -euo pipefail

environment="${DEPLOY_ENVIRONMENT:-${1:-}}"
git_ref="${GIT_REF:-${GITHUB_REF:-}}"
frontend_url="${FRONTEND_URL:-}"
railway_environment="${TARGET_ENVIRONMENT:-${RAILWAY_ENVIRONMENT_NAME:-}}"

extract_host() {
  printf '%s' "$1" | sed -E 's#^[a-zA-Z]+://##; s#/.*$##'
}

fail() {
  printf 'deploy-target: %s\n' "$1" >&2
  exit 1
}

# Railway-generated environment domains are currently crossed: the demo
# environment also uses stage.consultinity.ai. Remove that alias only after the
# supervisor completes the E0 domain uncrossing.
case "$environment" in
  staging)
    expected_refs="refs/heads/develop refs/heads/staging"
    expected_environment="staging"
    allowed_hosts="staging.consultify.ai"
    ;;
  demo)
    expected_refs="refs/heads/demo"
    expected_environment="demo"
    allowed_hosts="demo.consultify.ai stage.consultinity.ai"
    ;;
  production)
    expected_refs="refs/heads/main"
    expected_environment="production"
    allowed_hosts="consultify.ai www.consultify.ai"
    ;;
  *)
    fail "unknown DEPLOY_ENVIRONMENT '$environment' (expected staging, demo, or production)"
    ;;
esac

[ -n "$git_ref" ] || fail "missing git ref (set GIT_REF or GITHUB_REF)"
ref_ok=1
for expected_ref in $expected_refs; do
  if [ "$git_ref" = "$expected_ref" ]; then
    ref_ok=0
    break
  fi
done

[ "$ref_ok" -eq 0 ] || fail "ref '$git_ref' does not match $environment branch list '$expected_refs'"

if [ -n "$railway_environment" ] && [ "$railway_environment" != "$expected_environment" ]; then
  fail "Railway environment '$railway_environment' does not match expected '$expected_environment'"
fi

[ -n "$frontend_url" ] || fail "missing FRONTEND_URL for $environment validation"

frontend_host="$(extract_host "$frontend_url")"
host_ok=1
for allowed_host in $allowed_hosts; do
  if [ "$frontend_host" = "$allowed_host" ]; then
    host_ok=0
    break
  fi
done

[ "$host_ok" -eq 0 ] || fail "frontend host '$frontend_host' is not allowed for $environment (expected one of: $allowed_hosts)"

printf 'deploy-target: ok for %s (%s -> %s)\n' "$environment" "$git_ref" "$frontend_host"
