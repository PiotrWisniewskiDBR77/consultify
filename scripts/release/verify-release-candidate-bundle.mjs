#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[0-9a-f]{40}$/,
  HASH = /^[0-9a-f]{64}$/,
  ROOT = 'server/migrations/';
const REQUIRED = ['backendBuild', 'frontendBuild', 'reporter82', 'typecheck'];
const hash = (v) => createHash('sha256').update(v).digest('hex');
const stable = (v) =>
  Array.isArray(v)
    ? v.map(stable)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, stable(v[k])])
        )
      : v;
export const canonicalManifestBody = (m) => {
  const { manifestSha256: _, ...body } = m;
  return `${JSON.stringify(stable(body))}\n`;
};
export const hashCanonicalManifest = (m) => hash(canonicalManifestBody(m));
const git = (r, a, e = 'utf8') =>
  execFileSync('git', ['-C', r, ...a], { encoding: e, stdio: ['ignore', 'pipe', 'pipe'] });
const text = (r, a) => git(r, a).trim(),
  file = (r, s, p) => git(r, ['show', `${s}:${p}`], null);
const migrations = (r, s) => {
  const o = text(r, ['ls-tree', '-r', '--name-only', s, '--', ROOT]);
  return o
    ? o
        .split('\n')
        .filter((p) => p.startsWith(ROOT))
        .sort()
    : [];
};
function lexicalStatements(sql) {
  const statements = [];
  let current = '';
  for (let index = 0; index < sql.length; ) {
    if (sql.startsWith('--', index)) {
      const end = sql.indexOf('\n', index + 2);
      index = end < 0 ? sql.length : end + 1;
      current += ' ';
      continue;
    }
    if (sql.startsWith('/*', index)) {
      const end = sql.indexOf('*/', index + 2);
      index = end < 0 ? sql.length : end + 2;
      current += ' ';
      continue;
    }
    const quote = sql[index];
    if (quote === "'" || quote === '"') {
      index += 1;
      while (index < sql.length) {
        if (sql[index] === quote) {
          if (sql[index + 1] === quote) index += 2;
          else {
            index += 1;
            break;
          }
        } else index += 1;
      }
      current += ' __LITERAL__ ';
      continue;
    }
    if (quote === '$') {
      const match = sql.slice(index).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        const delimiter = match[0];
        const end = sql.indexOf(delimiter, index + delimiter.length);
        index = end < 0 ? sql.length : end + delimiter.length;
        current += ' __BODY__ ';
        continue;
      }
    }
    if (quote === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      index += 1;
      continue;
    }
    current += quote;
    index += 1;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

export function classifyMigrationSql(sql) {
  return lexicalStatements(sql).map((statement) => {
    const normalized = statement.replace(/\s+/g, ' ').trim().toUpperCase();
    if (/\bCASCADE\b/.test(normalized))
      return { classification: 'DENY', code: 'DESTRUCTIVE_CASCADE' };
    if (
      /^DROP\s+(?:INDEX|SEQUENCE|POLICY|MATERIALIZED\s+VIEW|TABLE|SCHEMA|TYPE|DOMAIN|DATABASE|EXTENSION|FUNCTION|PROCEDURE|VIEW|TRIGGER)\b/.test(
        normalized
      )
    )
      return { classification: 'DENY', code: 'DESTRUCTIVE_DROP' };
    if (/^TRUNCATE\b/.test(normalized))
      return { classification: 'DENY', code: 'DESTRUCTIVE_TRUNCATE' };
    if (/^ALTER\s+TABLE\b.*\bDROP\s+(?:COLUMN|CONSTRAINT)\b/.test(normalized))
      return { classification: 'DENY', code: 'DESTRUCTIVE_ALTER_DROP' };
    if (/^ALTER\s+(?:TABLE|TYPE)\b.*\bRENAME\s+(?:TO|COLUMN)\b/.test(normalized))
      return { classification: 'DENY', code: 'DESTRUCTIVE_RENAME' };
    if (
      /^(?:DELETE\s+FROM|UPDATE\s+)/.test(normalized) ||
      /\bON\s+CONFLICT\b.*\bDO\s+UPDATE\b/.test(normalized)
    )
      return { classification: 'DENY', code: 'DESTRUCTIVE_DATA_REWRITE' };
    if (/^CREATE\s+OR\s+REPLACE\s+(?:FUNCTION|PROCEDURE|VIEW)\b/.test(normalized))
      return { classification: 'ALLOW', code: 'SAFE_PROGRAMMABLE_REPLACE' };
    if (
      /^CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX|SEQUENCE|TYPE|POLICY|TRIGGER|EXTENSION)\b/.test(
        normalized
      )
    )
      return { classification: 'ALLOW', code: 'SAFE_CREATE' };
    if (/^ALTER\s+TABLE\b.*\bADD\s+(?:COLUMN|CONSTRAINT)\b/.test(normalized))
      return { classification: 'ALLOW', code: 'SAFE_ALTER_ADD' };
    if (/^ALTER\s+TYPE\b.*\bADD\s+VALUE\b/.test(normalized))
      return { classification: 'ALLOW', code: 'SAFE_ENUM_ADD' };
    if (/^(?:COMMENT\s+ON|GRANT\s+|INSERT\s+INTO\s+)/.test(normalized))
      return { classification: 'ALLOW', code: 'SAFE_METADATA_OR_APPEND' };
    return { classification: 'UNCLASSIFIED', code: 'MIGRATION_STATEMENT_UNCLASSIFIED' };
  });
}

export function verifyReleaseCandidateBundle({ manifest: m, repo, bundleDir = process.cwd() }) {
  const errors = [],
    add = (code, detail) => errors.push({ code, detail }),
    c = m?.candidateSha,
    p = m?.previousVerifiedSha;
  if (m?.schemaVersion !== 2) add('MANIFEST_SCHEMA_UNSUPPORTED', 'schemaVersion must equal 2');
  if (!SHA.test(c ?? '')) add('CANDIDATE_SHA_INVALID', 'full lowercase SHA required');
  if (!SHA.test(p ?? '')) add('PREVIOUS_SHA_INVALID', 'full lowercase SHA required');
  if (m?.authorization !== 'NOT_AUTHORIZED')
    add('AUTHORIZATION_MUST_REMAIN_NOT_AUTHORIZED', 'GO is owner-only');
  if (m?.technicalStatus !== 'UNATTESTED_LOCAL_RECEIPTS')
    add('TECHNICAL_STATUS_INVALID', 'local receipts must remain UNATTESTED_LOCAL_RECEIPTS');
  if (typeof m?.candidateRef !== 'string' || !m.candidateRef.startsWith('refs/'))
    add('CANDIDATE_REF_INVALID', 'explicit refs/* required');
  if (!SHA.test(m?.treeSha ?? '')) add('TREE_SHA_INVALID', 'full tree SHA required');
  if (!HASH.test(m?.manifestSha256 ?? '')) add('MANIFEST_HASH_INVALID', 'SHA-256 required');
  else if (hashCanonicalManifest(m) !== m.manifestSha256)
    add('MANIFEST_HASH_MISMATCH', 'canonical body mismatch');
  if (!SHA.test(c ?? '') || !SHA.test(p ?? '')) return finish(m, errors);
  for (const [s, code] of [
    [c, 'CANDIDATE_COMMIT_MISSING'],
    [p, 'PREVIOUS_COMMIT_MISSING'],
  ])
    try {
      text(repo, ['cat-file', '-e', `${s}^{commit}`]);
    } catch {
      add(code, s);
    }
  if (errors.some((e) => e.code.endsWith('_COMMIT_MISSING'))) return finish(m, errors);
  const tree = text(repo, ['rev-parse', `${c}^{tree}`]);
  if (m.treeSha !== tree) add('TREE_SHA_MISMATCH', `expected ${tree}`);
  try {
    const actual = text(repo, ['rev-parse', '--verify', m.candidateRef]);
    if (actual !== c) add('CANDIDATE_REF_MISMATCH', actual);
  } catch {
    add('CANDIDATE_REF_MISSING', m.candidateRef);
  }
  if (text(repo, ['status', '--porcelain=v1', '--untracked-files=all']))
    add('WORKTREE_DIRTY', 'repository has changes');
  try {
    git(repo, ['merge-base', '--is-ancestor', p, c]);
  } catch {
    add('ROLLBACK_SHA_NOT_ANCESTOR', p);
  }
  gitArtifact(m.lockfile, 'LOCKFILE', repo, c, add);
  const sb = external(m.sbom, 'SBOM', bundleDir, add);
  if (sb)
    try {
      const j = JSON.parse(sb);
      if (j.bomFormat !== 'CycloneDX' || j.specVersion !== '1.5')
        add('SBOM_FORMAT_UNRECOGNIZED', 'CycloneDX 1.5 required');
      if (j.metadata?.properties?.find((x) => x.name === 'consultify:candidateSha')?.value !== c)
        add('SBOM_CANDIDATE_MISMATCH', c);
      if (m.sbom.sourceLockfileSha256 !== m.lockfile.sha256)
        add('SBOM_LOCKFILE_BINDING_MISMATCH', 'lock hash differs');
    } catch {
      add('SBOM_JSON_INVALID', 'invalid JSON');
    }
  const cm = migrations(repo, c),
    pm = migrations(repo, p),
    ledger = Array.isArray(m.migrations) ? m.migrations : [],
    lp = ledger.map((x) => x?.path);
  if (JSON.stringify(lp) !== JSON.stringify([...lp].sort()))
    add('MIGRATION_LEDGER_NOT_SORTED', 'sort required');
  if (new Set(lp).size !== lp.length) add('MIGRATION_LEDGER_DUPLICATE', 'duplicates');
  if (JSON.stringify(lp) !== JSON.stringify(cm))
    add('MIGRATION_LEDGER_INCOMPLETE', 'inventory differs');
  for (const e of ledger) gitArtifact(e, 'MIGRATION', repo, c, add);
  const cs = new Set(cm),
    ps = new Set(pm);
  for (const x of pm) {
    if (!cs.has(x)) {
      add('ROLLBACK_MIGRATION_DELETED', x);
      continue;
    }
    if (!file(repo, p, x).equals(file(repo, c, x))) add('ROLLBACK_MIGRATION_MODIFIED', x);
  }
  for (const x of cm.filter((x) => !ps.has(x))) {
    const classifications = classifyMigrationSql(file(repo, c, x).toString());
    if (classifications.length === 0) add('MIGRATION_STATEMENT_UNCLASSIFIED', `${x}:empty`);
    classifications.forEach((result, index) => {
      if (result.classification !== 'ALLOW') add(result.code, `${x}:statement-${index + 1}`);
    });
  }
  const receipts = Array.isArray(m.receipts) ? m.receipts : [],
    names = receipts.map((x) => x?.name);
  for (const n of REQUIRED) if (!names.includes(n)) add('REQUIRED_RECEIPT_MISSING', n);
  if (new Set(names).size !== names.length) add('RECEIPT_DUPLICATE', 'names');
  for (const e of receipts) {
    const b = external(e, 'RECEIPT', bundleDir, add);
    if (!b) continue;
    try {
      const r = JSON.parse(b);
      if (r.gateId !== e.name) add('RECEIPT_GATE_ID_MISMATCH', e.name);
      if (typeof r.command !== 'string' || !r.command.trim())
        add('RECEIPT_COMMAND_MISSING', e.name);
      if (r.candidateSha !== c) add('RECEIPT_CANDIDATE_MISMATCH', e.name);
      if (r.treeSha !== m.treeSha) add('RECEIPT_TREE_MISMATCH', e.name);
      if (r.exitCode !== 0) add('RECEIPT_GATE_FAILED', e.name);
      if (
        !r.denominator ||
        (typeof r.denominator !== 'number' && typeof r.denominator !== 'object')
      )
        add('RECEIPT_DENOMINATOR_MISSING', e.name);
      if (!HASH.test(r.logDigest ?? '') || !HASH.test(r.artifactDigest ?? ''))
        add('RECEIPT_DIGEST_INVALID', e.name);
      const started = Date.parse(r.startedAt),
        finished = Date.parse(r.finishedAt);
      if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started)
        add('RECEIPT_TIME_INVALID', e.name);
      if (r.provenanceType !== 'local-process') add('RECEIPT_PROVENANCE_UNSUPPORTED', e.name);
      if (e.provenanceType !== r.provenanceType || e.gateId !== r.gateId)
        add('RECEIPT_PROVENANCE_BINDING_MISMATCH', e.name);
      if (
        e.name === 'reporter82' &&
        (r.denominator !== 82 || r.missingEvidence !== 0 || r.invalidEvidence !== 0)
      )
        add('REPORTER82_INVALID', e.name);
    } catch {
      add('RECEIPT_JSON_INVALID', e.name ?? e.path);
    }
  }
  return finish(m, errors);
}
function gitArtifact(e, l, r, c, add) {
  if (!e || typeof e.path !== 'string' || !HASH.test(e.sha256 ?? '')) {
    add(`${l}_ENTRY_INVALID`, 'path/hash');
    return;
  }
  try {
    if (hash(file(r, c, e.path)) !== e.sha256) add(`${l}_HASH_MISMATCH`, e.path);
  } catch {
    add(`${l}_OBJECT_MISSING`, e.path);
  }
}
function external(e, l, d, add) {
  if (
    !e ||
    typeof e.path !== 'string' ||
    e.path.startsWith('/') ||
    e.path.includes('..') ||
    !HASH.test(e.sha256 ?? '')
  ) {
    add(`${l}_ENTRY_INVALID`, 'safe path/hash');
    return null;
  }
  try {
    const b = readFileSync(resolve(d, e.path));
    if (hash(b) !== e.sha256) add(`${l}_HASH_MISMATCH`, e.path);
    return b;
  } catch {
    add(`${l}_FILE_MISSING`, e.path);
    return null;
  }
}
function finish(m, errors) {
  const e = errors.sort((a, b) => `${a.code}:${a.detail}`.localeCompare(`${b.code}:${b.detail}`));
  return stable({
    schemaVersion: 2,
    taskId: 'REL-001-T01',
    candidateSha: m?.candidateSha ?? null,
    technicalStatus: e.length ? 'NOT_VERIFIED' : 'UNATTESTED_LOCAL_RECEIPTS',
    authorization: 'NOT_AUTHORIZED',
    verified: e.length === 0,
    releaseGo: false,
    errors: e,
  });
}
function args(a) {
  const v = { repo: process.cwd(), manifest: null };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--repo') v.repo = a[++i];
    else if (a[i] === '--manifest') v.manifest = a[++i];
    else throw Error(`Unknown argument: ${a[i]}`);
  }
  if (!v.manifest) throw Error('--manifest is required');
  return v;
}
async function main() {
  let result;
  try {
    const a = args(process.argv.slice(2)),
      mp = resolve(a.manifest);
    result = verifyReleaseCandidateBundle({
      manifest: JSON.parse(readFileSync(mp, 'utf8')),
      repo: resolve(a.repo),
      bundleDir: dirname(mp),
    });
  } catch (e) {
    result = finish(null, [
      { code: 'VERIFIER_INPUT_ERROR', detail: e instanceof Error ? e.message : String(e) },
    ]);
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.verified ? 0 : 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
