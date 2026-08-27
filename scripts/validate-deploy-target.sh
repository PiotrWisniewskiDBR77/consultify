#!/usr/bin/env bash

set -euo pipefail

# =============================================================================
# validate-deploy-target.sh — pre-deploy target guard
#
# WHERE THIS RUNS: GitHub Actions (.github/workflows/railway-deploy.yml) and
# scripts/deploy-demo.sh on an operator laptop. It does NOT run inside Railway,
# so every variable it needs must be handed to it by the workflow / the caller.
# Setting a variable only in the Railway panel does not reach this script.
#
# WHAT IT PROVES
#   §A  ref, Railway environment name and frontend host match the environment.
#   §B  the database the MIGRATION will connect to and the database the
#       APPLICATION will connect to are the same database (DEC-2026-08-28-165).
#
# §B TAKES TWO INDEPENDENT INPUTS, ON PURPOSE:
#   APP_DATABASE_URL        — copied from the APPLICATION service's DATABASE_URL
#   MIGRATION_DATABASE_URL  — copied from the MIGRATION / release-gate target
# Both are parsed here into host:port/database; credentials are never read into
# a variable that is printed and never appear in any message. A single declared
# label read by both sides (the previous design) agrees by construction and can
# never observe a divergence — that is why it was replaced.
#
# Pre-derived identities may be supplied instead of URLs, for operators who do
# not want connection strings in CI secrets:
#   APP_DB_IDENTITY / MIGRATION_DB_IDENTITY   e.g. sakura.proxy.rlwy.net:1234/railway
#
# ARMING (DEPLOY_TARGET_GUARD_ENFORCE)
#   unset / 0 / false / warn  -> ADVISORY. Missing §B inputs produce a LOUD
#                               warning and the deploy proceeds. Merging this
#                               branch therefore does not freeze deployments.
#   1 / true / enforce        -> FAIL-CLOSED. Missing §B inputs block the deploy.
#   In BOTH modes a divergence that is actually observed blocks the deploy.
#   Advisory mode postpones the requirement to SUPPLY the inputs; it never
#   forgives a mismatch that the guard can see.
# =============================================================================

environment="${DEPLOY_ENVIRONMENT:-${1:-}}"
git_ref="${GIT_REF:-${GITHUB_REF:-}}"
frontend_url="${FRONTEND_URL:-}"
railway_environment="${TARGET_ENVIRONMENT:-${RAILWAY_ENVIRONMENT_NAME:-}}"
enforce_raw="$(printf '%s' "${DEPLOY_TARGET_GUARD_ENFORCE:-}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"

case "$enforce_raw" in
  1|true|yes|on|enforce) enforce=1 ;;
  *) enforce=0 ;;
esac

extract_host() {
  printf '%s' "$1" | sed -E 's#^[a-zA-Z]+://##; s#/.*$##'
}

fail() {
  printf 'deploy-target: %s\n' "$1" >&2
  exit 1
}

warn() {
  printf 'deploy-target: WARNING: %s\n' "$1" >&2
  if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    printf '::warning title=deploy-target guard not armed::%s\n' "$1"
  fi
}

# Missing §B input: hard failure when armed, loud warning when not.
require_or_warn() {
  if [ "$enforce" -eq 1 ]; then
    fail "$1 (DEPLOY_TARGET_GUARD_ENFORCE is on)"
  fi
  warn "$1 — DEPLOY_TARGET_GUARD_ENFORCE is not set, so the deploy is ALLOWED TO CONTINUE without a verified database target. Set DEPLOY_TARGET_GUARD_ENFORCE=1 once the variables are configured."
  unverified=1
}

# Parse host:port/database out of a connection string. Credentials are dropped
# before anything else and are never emitted.
identity_from_url() {
  printf '%s' "$1" \
    | sed -E 's#^[a-zA-Z0-9+.-]+://##' \
    | sed -E 's#^[^@/]*@##' \
    | awk '
        {
          rest = $0
          slash = index(rest, "/")
          if (slash > 0) { hostport = substr(rest, 1, slash - 1); db = substr(rest, slash + 1) }
          else { hostport = rest; db = "" }
          sub(/[?].*$/, "", db)
          colon = index(hostport, ":")
          if (colon > 0) { host = substr(hostport, 1, colon - 1); port = substr(hostport, colon + 1) }
          else { host = hostport; port = "5432" }
          if (port == "") port = "5432"
          if (host == "") exit 1
          printf "%s:%s/%s", host, port, db
        }' \
    | tr '[:upper:]' '[:lower:]'
}

normalize_identity() {
  printf '%s' "$1" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' | tr '[:upper:]' '[:lower:]'
}

normalize_fingerprint() {
  printf '%s' "$1" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' | tr '[:upper:]' '[:lower:]'
}

# Railway-generated environment domains are currently crossed: the demo
# environment also uses stage.consultinity.ai. Remove that alias only after the
# supervisor completes the E0 domain uncrossing.
case "$environment" in
  staging)
    expected_refs="refs/heads/develop refs/heads/staging"
    expected_environment="staging"
    allowed_hosts="staging.consultify.ai"
    expected_db_fingerprint_var="STAGING_DB_HOST_FINGERPRINT"
    ;;
  demo)
    expected_refs="refs/heads/demo"
    expected_environment="demo"
    allowed_hosts="demo.consultify.ai stage.consultinity.ai"
    expected_db_fingerprint_var="DEMO_DB_HOST_FINGERPRINT"
    ;;
  production)
    expected_refs="refs/heads/main"
    expected_environment="production"
    allowed_hosts="consultify.ai www.consultify.ai"
    expected_db_fingerprint_var="PRODUCTION_DB_HOST_FINGERPRINT"
    ;;
  *)
    fail "unknown DEPLOY_ENVIRONMENT '$environment' (expected staging, demo, or production)"
    ;;
esac

# ---------------------------------------------------------------------------
# §A — ref / environment / frontend host. These need no new configuration, so
# they stay unconditionally fail-closed regardless of arming.
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# §B — migration target vs application target. Two independent inputs.
# ---------------------------------------------------------------------------

unverified=0

app_identity=""
if [ -n "${APP_DATABASE_URL:-}" ]; then
  app_identity="$(identity_from_url "$APP_DATABASE_URL" || true)"
  [ -n "$app_identity" ] || fail "APP_DATABASE_URL is set but no host could be parsed from it (value not shown)"
elif [ -n "${APP_DB_IDENTITY:-}" ]; then
  app_identity="$(normalize_identity "$APP_DB_IDENTITY")"
fi

migration_identity=""
if [ -n "${MIGRATION_DATABASE_URL:-}" ]; then
  migration_identity="$(identity_from_url "$MIGRATION_DATABASE_URL" || true)"
  [ -n "$migration_identity" ] || fail "MIGRATION_DATABASE_URL is set but no host could be parsed from it (value not shown)"
elif [ -n "${MIGRATION_DB_IDENTITY:-}" ]; then
  migration_identity="$(normalize_identity "$MIGRATION_DB_IDENTITY")"
fi

# An observed divergence blocks in EVERY mode. This is the DEC-165 recurrence.
if [ -n "$app_identity" ] && [ -n "$migration_identity" ] && [ "$app_identity" != "$migration_identity" ]; then
  fail "DEC-165 DIVERGENCE for $environment: the application and the migration point at DIFFERENT databases (app '$app_identity' vs migration '$migration_identity'). Migrating would apply the chain to a database the application never reads. Deployment refused."
fi

if [ -z "$app_identity" ]; then
  require_or_warn "missing APP_DATABASE_URL (or APP_DB_IDENTITY) for $environment — the database the application will use cannot be determined, so a DEC-165 divergence cannot be detected"
fi
if [ -z "$migration_identity" ]; then
  require_or_warn "missing MIGRATION_DATABASE_URL (or MIGRATION_DB_IDENTITY) for $environment — the database the migration will use cannot be determined, so a DEC-165 divergence cannot be detected"
fi

# Environment pin: a DERIVED host compared against a DECLARED fingerprint. This
# catches "both sides agree, but on the wrong environment's database".
expected_db_fingerprint="$(normalize_fingerprint "${!expected_db_fingerprint_var:-}")"
verified_identity="${migration_identity:-$app_identity}"
if [ -n "$expected_db_fingerprint" ]; then
  if [ -n "$verified_identity" ]; then
    case "$verified_identity" in
      *"$expected_db_fingerprint"*) : ;;
      *) fail "database target mismatch for $environment: the resolved database identity does not contain the fingerprint declared in $expected_db_fingerprint_var" ;;
    esac
  else
    require_or_warn "$expected_db_fingerprint_var is declared but no database identity could be derived for $environment, so the declaration verifies nothing"
  fi
else
  require_or_warn "missing $expected_db_fingerprint_var for $environment — the resolved database host is not pinned to this environment"
fi

# Legacy declaration kept for the in-Railway release gate. When both
# declarations are present they must still agree; a contradiction is a
# configuration error in every mode.
release_fingerprint="$(normalize_fingerprint "${RELEASE_TARGET_DB_HOST_FINGERPRINT:-}")"
if [ -n "$release_fingerprint" ] && [ -n "$expected_db_fingerprint" ] \
  && [ "$release_fingerprint" != "$expected_db_fingerprint" ]; then
  fail "declaration conflict for $environment: RELEASE_TARGET_DB_HOST_FINGERPRINT and $expected_db_fingerprint_var disagree (values not shown)"
fi

if [ "$unverified" -eq 1 ]; then
  printf 'deploy-target: PASSED WITHOUT DATABASE VERIFICATION for %s (%s -> %s). Guard not armed.\n' \
    "$environment" "$git_ref" "$frontend_host"
  exit 0
fi

printf 'deploy-target: ok for %s (%s -> %s, db identity verified: migration and application agree)\n' \
  "$environment" "$git_ref" "$frontend_host"
