#!/usr/bin/env node
// Stanowisko lokalne NOC — przenosi flagi i klucze AI ze stagingu do lokalnego server.env.
// Wejscie: /private/tmp/stanowisko-noc/railway-staging.json (railway variables --json)
// Wyjscie: /private/tmp/stanowisko-noc/server.env (chmod 600, POZA repo — nigdy nie commitowac).

import fs from 'node:fs';
const v = JSON.parse(fs.readFileSync('/private/tmp/stanowisko-noc/railway-staging.json','utf8'));
// ZAKAZANE wprost (instrukcja + bezpieczeństwo)
const DENY = new Set([
  'DATABASE_URL','DATABASE_PUBLIC_URL','REDIS_URL','REDIS_HOST','REDIS_PORT','REDIS_PASSWORD',
  'APP_BUILD_SHA','FORCE_SUPERADMIN_EMAILS',
  // płatności / poczta / powiadomienia produkcyjne
  'STRIPE_SECRET_KEY','STRIPE_PUBLISHABLE_KEY','STRIPE_WEBHOOK_SECRET',
  'SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_SECURE','SMTP_FROM','EMAIL_FROM',
  'ALERT_EMAIL_ENABLED','ALERT_EMAIL_RECIPIENTS','ADMIN_EMAIL',
  'SLACK_WEBHOOK_URL','AI_SLACK_WEBHOOK_URL','AI_COST_SLACK_WEBHOOK_URL','AI_OPS_SLACK_WEBHOOK_URL',
  'WHATSAPP_FROM','WHATSAPP_SID','WHATSAPP_TO','WHATSAPP_TOKEN',
  'SENTRY_DSN','VITE_SENTRY_DSN','INBOX_WEBHOOK_SECRET',
  'GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_CALLBACK_URL','LINKEDIN_CLIENT_ID','LINKEDIN_CLIENT_SECRET',
  // konfiguracja bazy stagingu
  'DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD','DB_SSL','DB_SSL_REJECT_UNAUTHORIZED',
  'DB_CONNECTION_TIMEOUT','DB_MANAGED_SCHEMA','DB_TYPE','RELEASE_TARGET_DB_HOST_FINGERPRINT',
  'FINANCE_IMPORT_ORG_ID',
  // środowisko / Railway (RAILWAY_* włączyłoby isRunningInsideRailway → guardy myślą, że to Railway)
  'NODE_ENV','APP_ENV','DEV','FRONTEND_URL','LOG_LEVEL',
]);
const out = [];
for (const [k, raw] of Object.entries(v)) {
  if (DENY.has(k)) continue;
  if (k.startsWith('RAILWAY_')) continue;
  const val = String(raw ?? '');
  if (val.includes('\n')) continue;
  out.push(`${k}=${val}`);
}
out.sort();
fs.writeFileSync('/private/tmp/stanowisko-noc/server.env', out.join('\n') + '\n', { mode: 0o600 });
console.log('przeniesione:', out.length);
console.log(out.map(l=>l.split('=')[0]).join(' '));
