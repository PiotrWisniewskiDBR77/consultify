import fs from 'fs';
import path from 'path';

const envFile = process.env.ENV_FILE;
if (!envFile) {
  console.error('[dev] ENV_FILE is required for this script.');
  process.exit(1);
}

const repoRoot = process.cwd();
const p = path.resolve(repoRoot, envFile);
if (!fs.existsSync(p)) {
  console.error(`[dev] Missing required env file: ${p}`);
  console.error('[dev] Create it by copying `.env.staging.local.example` to `.env.staging.local` and fill DATABASE_URL.');
  process.exit(1);
}

const raw = fs.readFileSync(p, 'utf-8');

// Robust env parsing (handles CRLF + invisible unicode chars)
const stripInvisible = (s) =>
  String(s || '')
    // BOM + zero-width + NBSP
    .replace(/[\uFEFF\u200B\u200C\u200D\u2060\u00A0]/g, '')
    .trim();

const parseEnvLines = () => {
  const out = new Map();
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const l = stripInvisible(line);
    if (!l || l.startsWith('#')) continue;
    const idx = l.indexOf('=');
    if (idx < 0) continue;
    const key = stripInvisible(l.slice(0, idx));
    let value = stripInvisible(l.slice(idx + 1));
    // strip simple quotes
    value = value.replace(/^['"]|['"]$/g, '');
    if (key) out.set(key, value);
  }
  return out;
};

const env = parseEnvLines();
const getLineValue = (key) => {
  const v = env.get(key);
  return v ? String(v).trim() : null;
};

const databaseUrl = getLineValue('DATABASE_URL');
const publicDatabaseUrl = getLineValue('DATABASE_PUBLIC_URL');
const dbHost = getLineValue('DB_HOST');
const dbName = getLineValue('DB_NAME');
const dbUser = getLineValue('DB_USER');
const dbPassword = getLineValue('DB_PASSWORD');
const dbPort = getLineValue('DB_PORT');

const effectiveUrl = publicDatabaseUrl || databaseUrl;
const hasUrl = !!effectiveUrl;
const hasParts = !!(dbHost && dbName && dbUser && dbPassword);

if (!hasUrl && !hasParts) {
  console.error(
    `[dev] ${envFile} must contain DATABASE_PUBLIC_URL=..., DATABASE_URL=..., or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD (and optionally DB_PORT/DB_SSL).`
  );
  process.exit(1);
}

if (effectiveUrl) {
  if (raw.includes('USER:PASSWORD@HOST') || raw.includes('postgresql://USER:PASSWORD@HOST')) {
    console.error(
      `[dev] ${envFile} still contains placeholder DATABASE_URL/DATABASE_PUBLIC_URL. Please paste the real staging URL.`
    );
    process.exit(1);
  }
  if (!/^postgres(ql)?:\/\//i.test(effectiveUrl)) {
    console.error(`[dev] ${envFile} DATABASE_PUBLIC_URL/DATABASE_URL doesn't look like Postgres.`);
    process.exit(1);
  }
  if (/\.railway\.internal(?::\d+)?\b/i.test(effectiveUrl)) {
    console.error(
      `[dev] ${envFile} DATABASE_PUBLIC_URL/DATABASE_URL points to *.railway.internal (private Railway network).`
    );
    console.error(
      `[dev] For local dev, use the database service (pgvector/Postgres) → Connect → Public/External connection string.`
    );
    process.exit(1);
  }
  if (/@(localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?\//i.test(effectiveUrl)) {
    console.error(
      `[dev] ${envFile} DATABASE_PUBLIC_URL/DATABASE_URL points to localhost. External Postgres is required for app runtime.`
    );
    process.exit(1);
  }
}

if (hasParts && /\.railway\.internal\b/i.test(String(dbHost))) {
  console.error(`[dev] ${envFile} DB_HOST is *.railway.internal (private Railway network).`);
  console.error(
    `[dev] For local dev, use the database service (pgvector/Postgres) → Connect → Public/External host.`
  );
  process.exit(1);
}

if (hasParts && /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(String(dbHost))) {
  console.error(`[dev] ${envFile} DB_HOST points to localhost. External Postgres is required for app runtime.`);
  process.exit(1);
}

console.log(`[dev] Using env file: ${envFile}`);

