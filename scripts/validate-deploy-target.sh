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
# A pre-derived identity without a port is completed to :5432, matching what
# both `new URL()` and this script's own URL parser do, so `host/railway` and
# `host:5432/railway` are the same database and not a false alarm.
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

# ---------------------------------------------------------------------------
# Connection-string parsing.
#
# ★ WHY THIS IS AWK AND NOT TWO sed EXPRESSIONS (FIX-2, credential leak)
#
# The previous version stripped userinfo with `sed -E 's#^[^@/]*@##'`. That
# expression cuts at the FIRST `@` and refuses to cross a `/`, so:
#
#   password containing `@`  -> only the head of the password was removed and
#       the TAIL of the password was carried into the "host", which the
#       DEC-165 failure message then printed in full.
#   password containing `/`  -> the expression did not match at all and the
#       ENTIRE connection string, user and password included, became the
#       "identity" and was printed.
#
# The comment above the old function promised credentials "are never emitted".
# It was false, and the accompanying test used the password `s3cret`, which
# contains neither character, so it stayed green beside the hole. Passwords
# with `@` are ordinary in Postgres URLs.
#
# Second defect fixed here: `new URL()` (the TypeScript side, databaseIdentity.ts)
# splits userinfo at the LAST `@`, the sed expression split at the FIRST. The
# two guards could therefore derive DIFFERENT identities from one URL. This
# parser now follows `new URL()`: authority ends at the first `/`, `?` or `#`,
# and userinfo ends at the LAST `@` inside that authority.
#
# Fail-closed on anything that does not parse cleanly: an unvalidated host is
# never emitted, so a malformed URL produces NO output (exit 1) and the caller
# refuses with a message that does not contain the value. A raw `/` inside a
# password makes the string an invalid URL — `new URL()` throws on it too —
# and it is rejected here rather than smeared into a printable "identity".
# ---------------------------------------------------------------------------
identity_from_url() {
  printf '%s' "$1" | awk '
    {
      s = $0

      # 1. scheme
      if (match(s, /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//)) s = substr(s, RLENGTH + 1)

      # 2. authority ends at the first "/", "?" or "#" (WHATWG URL, and what
      #    new URL() does). Everything after it is path/query.
      cut = 0
      for (i = 1; i <= length(s); i++) {
        c = substr(s, i, 1)
        if (c == "/" || c == "?" || c == "#") { cut = i; break }
      }
      if (cut > 0) { authority = substr(s, 1, cut - 1); tail = substr(s, cut) }
      else         { authority = s; tail = "" }

      # 3. userinfo ends at the LAST "@" inside the authority.
      last = 0
      for (i = 1; i <= length(authority); i++)
        if (substr(authority, i, 1) == "@") last = i
      if (last > 0) authority = substr(authority, last + 1)

      # 4. host[:port], with bracketed IPv6 support.
      port = ""
      if (substr(authority, 1, 1) == "[") {
        close_bracket = index(authority, "]")
        if (close_bracket == 0) exit 1
        host = substr(authority, 1, close_bracket)
        rest = substr(authority, close_bracket + 1)
        if (rest != "") {
          if (substr(rest, 1, 1) != ":") exit 1
          port = substr(rest, 2)
        }
      } else {
        colon = 0
        for (i = 1; i <= length(authority); i++)
          if (substr(authority, i, 1) == ":") colon = i
        if (colon > 0) { host = substr(authority, 1, colon - 1); port = substr(authority, colon + 1) }
        else           { host = authority }
      }
      if (port == "") port = "5432"

      # 5. database = first path segment, query stripped.
      db = tail
      sub(/^\//, "", db)
      sub(/[?#].*$/, "", db)

      host = tolower(host)
      db = tolower(db)

      # 6. VALIDATE BEFORE EMITTING. Anything that is not a plain hostname or a
      #    bracketed IPv6 literal, or a purely numeric port, is refused with no
      #    output — leftover credential text can never reach a printed message.
      if (host !~ /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/ && host !~ /^\[[0-9a-f:.]+\]$/) exit 1
      if (port !~ /^[0-9]+$/) exit 1
      if (db != "" && db !~ /^[a-z0-9._-]+$/) exit 1

      printf "%s:%s/%s", host, port, db
    }'
}

# A pre-derived identity is operator-typed, so it is validated with the SAME
# rules and completed with the SAME :5432 default as a parsed URL (FIX-5:
# `host/railway` used to be unequal to `host:5432/railway` and raised a false
# DEC-165 alarm). Output on failure is empty, never the input.
normalize_identity() {
  printf '%s' "$1" | awk '
    {
      s = $0
      gsub(/^[ \t]+|[ \t]+$/, "", s)
      if (s == "") exit 1
      # A pasted connection string here would smuggle credentials into a
      # printable value. Refuse it and tell the operator which variable to use.
      if (index(s, "@") > 0 || index(s, "://") > 0) exit 1

      slash = index(s, "/")
      if (slash > 0) { hostport = substr(s, 1, slash - 1); db = substr(s, slash + 1) }
      else           { hostport = s; db = "" }
      sub(/[?#].*$/, "", db)

      port = ""
      if (substr(hostport, 1, 1) == "[") {
        close_bracket = index(hostport, "]")
        if (close_bracket == 0) exit 1
        host = substr(hostport, 1, close_bracket)
        rest = substr(hostport, close_bracket + 1)
        if (rest != "") {
          if (substr(rest, 1, 1) != ":") exit 1
          port = substr(rest, 2)
        }
      } else {
        colon = 0
        for (i = 1; i <= length(hostport); i++)
          if (substr(hostport, i, 1) == ":") colon = i
        if (colon > 0) { host = substr(hostport, 1, colon - 1); port = substr(hostport, colon + 1) }
        else           { host = hostport }
      }
      if (port == "") port = "5432"

      host = tolower(host)
      db = tolower(db)
      if (host !~ /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/ && host !~ /^\[[0-9a-f:.]+\]$/) exit 1
      if (port !~ /^[0-9]+$/) exit 1
      if (db != "" && db !~ /^[a-z0-9._-]+$/) exit 1

      printf "%s:%s/%s", host, port, db
    }'
}

# host part of a normalized `host:port/database`.
host_of_identity() {
  printf '%s' "$1" | awk '{ n = index($0, "/"); s = (n > 0) ? substr($0, 1, n - 1) : $0
                            c = 0
                            for (i = 1; i <= length(s); i++) if (substr(s, i, 1) == ":") c = i
                            if (substr(s, 1, 1) == "[") { b = index(s, "]"); print substr(s, 1, b) }
                            else if (c > 0) print substr(s, 1, c - 1)
                            else print s }'
}

# database part of a normalized `host:port/database`.
database_of_identity() {
  printf '%s' "$1" | awk '{ n = index($0, "/"); if (n > 0) print substr($0, n + 1); else print "" }'
}

normalize_fingerprint() {
  printf '%s' "$1" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' | tr '[:upper:]' '[:lower:]'
}

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
  [ -n "$app_identity" ] || fail "APP_DATABASE_URL is set but no valid host:port could be parsed from it (value not shown). A password containing a raw '/' makes the string an invalid URL — percent-encode it as %2F."
elif [ -n "${APP_DB_IDENTITY:-}" ]; then
  app_identity="$(normalize_identity "$APP_DB_IDENTITY" || true)"
  [ -n "$app_identity" ] || fail "APP_DB_IDENTITY is set but is not a bare host[:port]/database (value not shown). It must carry no credentials and no scheme — put a full connection string in APP_DATABASE_URL instead."
fi

migration_identity=""
if [ -n "${MIGRATION_DATABASE_URL:-}" ]; then
  migration_identity="$(identity_from_url "$MIGRATION_DATABASE_URL" || true)"
  [ -n "$migration_identity" ] || fail "MIGRATION_DATABASE_URL is set but no valid host:port could be parsed from it (value not shown). A password containing a raw '/' makes the string an invalid URL — percent-encode it as %2F."
elif [ -n "${MIGRATION_DB_IDENTITY:-}" ]; then
  migration_identity="$(normalize_identity "$MIGRATION_DB_IDENTITY" || true)"
  [ -n "$migration_identity" ] || fail "MIGRATION_DB_IDENTITY is set but is not a bare host[:port]/database (value not shown). It must carry no credentials and no scheme — put a full connection string in MIGRATION_DATABASE_URL instead."
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
#
# ★ FIX-4: the fingerprint is matched against the HOST ALONE, not against the
# whole `host:port/database` string. Matching the whole string let the value
# `railway` pass — that is the DATABASE NAME, identical on all three Railway
# databases (DEC-2026-08-28-165), so it was satisfied by every host that ever
# existed. Measured before the fix: ENFORCE=1, fingerprint `railway`, host
# `trolley` where `sakura` was expected -> exit 0. The pin verified nothing.
#
# A fingerprint equal to the database name is therefore refused outright rather
# than silently accepted: it can only have been meant as a host fragment, and
# as a database name it distinguishes nothing.
expected_db_fingerprint="$(normalize_fingerprint "${!expected_db_fingerprint_var:-}")"
verified_identity="${migration_identity:-$app_identity}"
if [ -n "$expected_db_fingerprint" ]; then
  if [ -n "$verified_identity" ]; then
    verified_host="$(host_of_identity "$verified_identity")"
    verified_database="$(database_of_identity "$verified_identity")"
    if [ -n "$verified_database" ] && [ "$expected_db_fingerprint" = "$verified_database" ]; then
      fail "$expected_db_fingerprint_var for $environment is set to the DATABASE NAME, not to a host fragment. All Railway databases here are named the same (DEC-165), so this pins nothing. Use the word between '@' and '.proxy' in the connection string, e.g. sakura / trolley / thomas / centerbeam."
    fi
    case "$verified_host" in
      *"$expected_db_fingerprint"*) : ;;
      *) fail "database target mismatch for $environment: the resolved database HOST does not contain the fingerprint declared in $expected_db_fingerprint_var (host and fingerprint not shown)" ;;
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
