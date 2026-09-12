/** DRAFT E4: local default. Explicit staging operator mode is prepared for review only.
 * Run CLI using node; canonical TypeScript service is loaded lazily through tsx/esm/api.
 * No dotenv, remote default, password output, scheduler or application bootstrap.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const DBR77 = 'a3e05d4a-5397-419d-b486-8e44366c0063';
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export class E4SafetyError extends Error {
  constructor(code) { super(code); this.name = 'E4SafetyError'; this.code = code; }
}
export const fail = (code) => { throw new E4SafetyError(code); };
export const qi = (s) => '"' + String(s).replaceAll('"', '""') + '"';
export function parseArgs(args) {
  const options = { apply: false, target: 'local' };
  for (const arg of args) {
    if (arg === '--apply') options.apply = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (/^--(target|target-manifest|expected-host|expected-database|tls-ca|backup|manifest|out)=.+/.test(arg)) {
      const i = arg.indexOf('='); const k = arg.slice(2, i);
      if (options[k] && k !== 'target') fail('DUPLICATE_ARGUMENT');
      options[k] = arg.slice(i + 1);
    } else fail('UNKNOWN_ARGUMENT');
  }
  if (options.apply && options.dryRun) fail('CONFLICTING_MODES');
  if (!options['target-manifest'] || !options.manifest) fail('TARGET_AND_MANIFEST_REQUIRED');
  if (!['local', 'staging'].includes(options.target)) fail('UNSUPPORTED_TARGET');
  return options;
}
export function assertTarget(connectionString, target, operation, options = { target: 'local' }) {
  let url; try { url = new URL(connectionString); } catch { fail('DATABASE_URL_REQUIRED'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.search) fail('DATABASE_URL_UNSUPPORTED');
  const host = url.hostname; const port = Number(url.port || 5432);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (options.target === 'local') {
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(host) || port !== 6455 || !/^cx4_[a-z0-9_]+$/.test(database)) fail('LOCAL_CX4_DATABASE_REQUIRED');
    if (target.executionEnvironment !== 'local-copy') fail('TARGET_CONTRACT_MISMATCH');
  } else if (options.target === 'staging') {
    if (!options['expected-host'] || !options['expected-database']) fail('OPERATOR_EXPECTED_IDENTITY_REQUIRED');
    if (host !== options['expected-host'] || database !== options['expected-database']) fail('OPERATOR_IDENTITY_MISMATCH');
    if (target.executionEnvironment !== 'staging') fail('TARGET_CONTRACT_MISMATCH');
    tlsConfiguration(options);
  } else fail('UNSUPPORTED_TARGET');
  if (target.version !== 1 || target.operation !== operation || target.intendedEnvironment !== 'staging') fail('TARGET_CONTRACT_MISMATCH');
  if (target.host !== host || target.port !== port || target.database !== database) fail('TARGET_DATABASE_MISMATCH');
  if (!Array.isArray(target.organizationIds) || !target.organizationIds.length || new Set(target.organizationIds).size !== target.organizationIds.length) fail('EXACT_ORGANIZATIONS_REQUIRED');
  return { host, port, database };
}
export function tlsConfiguration(options) {
  if (options.target === 'local') return false; // Explicit loopback transport, no inherited PGSSLMODE.
  const caPath = options['tls-ca'];
  if (!caPath || !path.isAbsolute(caPath)) fail('OPERATOR_TLS_CA_REQUIRED');
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') fail('OPERATOR_TLS_OVERRIDE_FORBIDDEN');
  let ca;
  try {
    if (!fs.statSync(caPath).isFile()) fail('OPERATOR_TLS_CA_INVALID');
    ca = fs.readFileSync(caPath, 'utf8');
    // Require PEM certificate material, not a permissive empty/custom TLS configuration.
    const certificates = ca.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
    if (!certificates?.length) fail('OPERATOR_TLS_CA_INVALID');
    for (const certificate of certificates) new crypto.X509Certificate(certificate);
  } catch { fail('OPERATOR_TLS_CA_INVALID'); }
  return { ca, rejectUnauthorized: true };
}
export function outsideRepo(p) {
  if (!p || !path.isAbsolute(p)) fail('ABSOLUTE_OUTPUT_REQUIRED');
  // Parent must already exist; canonicalize it to catch symlinks into any checkout.
  const parent = fs.realpathSync(path.dirname(p));
  let cursor = parent;
  while (true) {
    if (fs.existsSync(path.join(cursor, '.git'))) fail('OUTPUT_INSIDE_CHECKOUT');
    const next = path.dirname(cursor); if (next === cursor) break; cursor = next;
  }
  const out = path.join(parent, path.basename(p));
  if (out === repoRoot || out.startsWith(repoRoot + path.sep)) fail('OUTPUT_INSIDE_REPO');
  return out;
}
export function writePrivate(p, value) {
  const dest = outsideRepo(p);
  const fd = fs.openSync(dest, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  // A newly created credential pathname must be durable before COMMIT too.
  const parentFd = fs.openSync(path.dirname(dest), fs.constants.O_RDONLY);
  try { fs.fsyncSync(parentFd); } finally { fs.closeSync(parentFd); }
  return dest;
}
function openPrivateArtifact(p) {
  const fd = fs.openSync(outsideRepo(p), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  const st = fs.fstatSync(fd);
  if (!st.isFile() || (st.mode & 0o077)) { fs.closeSync(fd); fail('BACKUP_ARTIFACT_NOT_PRIVATE'); }
  return { fd, st };
}
export async function verifyBackup(target) {
  const b = target.backup;
  if (!b || b.host !== target.host || b.port !== target.port || b.database !== target.database || b.kind !== 'pg_dump-custom-full' || !/^[a-f0-9]{64}$/.test(b.sha256 || '')) fail('FULL_BACKUP_REQUIRED');
  const { fd, st } = openPrivateArtifact(b.path);
  try {
    if (st.size < 5 || !Number.isFinite(Date.parse(b.createdAt)) || Date.parse(b.createdAt) > Date.now()) fail('BACKUP_INVALID_OR_STALE');
    // Freshness is an explicit reviewed policy, not an arbitrary universal one-hour timeout.
    if (b.maxAgeSeconds != null && (!Number.isFinite(b.maxAgeSeconds) || b.maxAgeSeconds <= 0 || Date.now() - Date.parse(b.createdAt) > b.maxAgeSeconds * 1000)) fail('BACKUP_EXCEEDS_REVIEWED_AGE');
    const hash = crypto.createHash('sha256');
    let header;
    for await (const chunk of fs.createReadStream(b.path, { fd, autoClose: false })) { if (!header) header = chunk.subarray(0, 5).toString(); hash.update(chunk); }
    const after = fs.fstatSync(fd);
    if (after.size !== st.size || after.mtimeMs !== st.mtimeMs || after.ctimeMs !== st.ctimeMs) fail('BACKUP_CHANGED_DURING_READ');
    if (header !== 'PGDMP' || hash.digest('hex') !== b.sha256) fail('BACKUP_DIGEST_MISMATCH');
  } finally { fs.closeSync(fd); }
  // Hash + header proves file identity, NOT restorability. Full restore output is retained for human review, not trusted as a magic PASS bit.
  if (!b.restoreEvidence || !/^[a-f0-9]{64}$/.test(b.restoreEvidence.sha256 || '')) fail('RESTORE_EVIDENCE_REQUIRED');
  const artifact = openPrivateArtifact(b.restoreEvidence.path);
  let evidence;
  try { evidence = fs.readFileSync(artifact.fd); } finally { fs.closeSync(artifact.fd); }
  if (crypto.createHash('sha256').update(evidence).digest('hex') !== b.restoreEvidence.sha256) fail('RESTORE_EVIDENCE_MISMATCH');
  if (evidence.length < 1) fail('RESTORE_RESULTS_EMPTY');
}
export async function connect(options, operation) {
  const target = JSON.parse(fs.readFileSync(options['target-manifest'], 'utf8'));
  const identity = assertTarget(process.env.DATABASE_URL, target, operation, options);
  if (options.apply) {
    if (!options.backup || options.backup !== target.backup?.path) fail('EXPLICIT_BACKUP_PATH_REQUIRED');
    await verifyBackup(target);
  }
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: tlsConfiguration(options), max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT current_database() AS db');
    if (r.rows[0].db !== identity.database) fail('CONNECTED_DATABASE_MISMATCH');
    await client.query(options.apply ? 'BEGIN ISOLATION LEVEL SERIALIZABLE' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query('SET LOCAL search_path = public, pg_catalog');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
  } catch (e) { await releaseResources({ client, pool }); throw e; }
  return { target, client, pool };
}
async function releaseResources(context) {
  const warnings = [];
  try { context.client.release(); } catch { warnings.push('CLIENT_RELEASE_FAILED'); }
  try { await context.pool.end(); } catch { warnings.push('POOL_END_FAILED'); }
  // Only fixed codes: never emit pg errors, connection strings or credential content.
  for (const code of warnings) { try { console.warn(`E4_WARNING ${code}`); } catch {} }
  return warnings;
}
export async function finish(context, commit, originalError) {
  let transactionError;
  try { await context.client.query(commit ? 'COMMIT' : 'ROLLBACK'); }
  catch {
    transactionError = new E4SafetyError(commit ? 'COMMIT_OUTCOME_UNKNOWN' : 'ROLLBACK_OUTCOME_UNKNOWN');
    if (commit) { try { await context.client.query('ROLLBACK'); } catch {} }
  }
  const cleanupWarnings = await releaseResources(context);
  // Resource cleanup cannot replace the database outcome or original safety refusal.
  if (originalError) throw originalError;
  if (transactionError) throw transactionError;
  return { committed: commit, cleanupWarnings };
}
export function isMain(meta) { return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(meta); }
export function reportFailure(error) {
  // Only errors created by this module carry publishable codes; raw PG/network/JSON details stay private.
  const code = error instanceof E4SafetyError && /^[A-Z][A-Z0-9_]+$/.test(error.code) ? error.code : 'UNCLASSIFIED_FAILURE';
  console.error(`E4_STOP ${code}`);
  if (code === 'COMMIT_OUTCOME_UNKNOWN') console.error('Commit acknowledgement was not received. Reconcile using a fresh connection before any retry; rollback is NOT confirmed.');
  process.exitCode = 1;
}
