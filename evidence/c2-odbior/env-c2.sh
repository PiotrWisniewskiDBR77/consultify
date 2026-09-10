# C2-ODBIÓR — środowisko pomiarowe. Wczytanie server.env z cudzysłowowaniem wartości.
while IFS= read -r line; do
  case "$line" in ''|'#'*) continue;; esac
  key="${line%%=*}"; val="${line#*=}"
  export "$key=$val"
done < ~/Developer/consultify-secrets/server.env
unset DB_HOST DB_NAME DB_USER DB_PASSWORD DB_PORT DB_SSL DB_SSLMODE DISABLE_RATE_LIMIT
# Z30: kasujemy WSZYSTKIE poświadczenia poczty wyniesione z server.env
unset SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_SECURE SMTP_FROM EMAIL_FROM
unset ENABLE_TEST_AUTH_BYPASS
export NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54418/codex1_staging_1009"
export ENABLE_V8_GLOBAL=true
export RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce
export DISABLE_SCHEDULER=true
