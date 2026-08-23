import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test, { afterEach } from 'node:test';
import { generateReleaseCandidateBundle } from '../../../scripts/release/generate-release-candidate-bundle.mjs';
import {
  hashCanonicalManifest,
  verifyReleaseCandidateBundle,
} from '../../../scripts/release/verify-release-candidate-bundle.mjs';
const roots = [],
  hash = (v) => createHash('sha256').update(v).digest('hex'),
  git = (r, a) => execFileSync('git', ['-C', r, ...a], { encoding: 'utf8' }).trim();
afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});
const write = (r, p, b) => {
  const t = resolve(r, p);
  mkdirSync(dirname(t), { recursive: true });
  writeFileSync(t, b);
};
const commit = (r, m) => {
  git(r, ['add', '.']);
  git(r, ['commit', '-m', m]);
  return git(r, ['rev-parse', 'HEAD']);
};
function fx(sql = 'ALTER TABLE base ADD COLUMN name text;\n') {
  const repo = mkdtempSync(resolve(tmpdir(), 'rel-v-')),
    out = mkdtempSync(resolve(tmpdir(), 'rel-b-'));
  roots.push(repo, out);
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.email', 'x@y']);
  git(repo, ['config', 'user.name', 'x']);
  write(
    repo,
    'package-lock.json',
    JSON.stringify({
      lockfileVersion: 3,
      packages: { 'node_modules/a': { name: 'a', version: '1.0.0' } },
    }) + '\n'
  );
  write(repo, 'server/migrations/001.sql', 'CREATE TABLE base(id text);\n');
  const previousVerifiedSha = commit(repo, 'previous');
  write(repo, 'server/migrations/002.sql', sql);
  const candidateSha = commit(repo, 'candidate');
  const treeSha = git(repo, ['rev-parse', `${candidateSha}^{tree}`]);
  git(repo, ['branch', 'release-candidate', candidateSha]);
  const receipts = {};
  for (const name of ['backendBuild', 'frontendBuild', 'reporter82', 'typecheck']) {
    const p = resolve(out, `${name}.json`);
    writeFileSync(
      p,
      JSON.stringify({
        gateId: name,
        command: `npm run ${name}`,
        candidateSha,
        treeSha,
        exitCode: 0,
        denominator: name === 'reporter82' ? 82 : { tests: 1 },
        missingEvidence: 0,
        invalidEvidence: 0,
        startedAt: '2026-08-17T10:00:00.000Z',
        finishedAt: '2026-08-17T10:01:00.000Z',
        logDigest: '1'.repeat(64),
        artifactDigest: '2'.repeat(64),
        provenanceType: 'local-process',
      })
    );
    receipts[name] = p;
  }
  const manifest = generateReleaseCandidateBundle({
    repo,
    candidateSha,
    previousVerifiedSha,
    candidateRef: 'refs/heads/release-candidate',
    receiptFiles: receipts,
    outputDir: out,
  });
  return { repo, out, manifest, candidateSha, previousVerifiedSha, receipts };
}
test('valid local bundle is explicitly unattested and never GO', () => {
  const x = fx(),
    r = verifyReleaseCandidateBundle({ manifest: x.manifest, repo: x.repo, bundleDir: x.out });
  assert.equal(r.verified, true);
  assert.equal(r.technicalStatus, 'UNATTESTED_LOCAL_RECEIPTS');
  assert.equal(r.authorization, 'NOT_AUTHORIZED');
  assert.equal(r.releaseGo, false);
});
test('CLI output and exit code are deterministic', () => {
  const x = fx(),
    mp = resolve(x.out, 'release-candidate-manifest.json'),
    script = resolve('scripts/release/verify-release-candidate-bundle.mjs');
  const a = spawnSync(process.execPath, [script, '--repo', x.repo, '--manifest', mp], {
      encoding: 'utf8',
    }),
    b = spawnSync(process.execPath, [script, '--repo', x.repo, '--manifest', mp], {
      encoding: 'utf8',
    });
  assert.equal(a.status, 0);
  assert.equal(b.status, 0);
  assert.equal(a.stdout, b.stdout);
  assert.equal(JSON.parse(a.stdout).releaseGo, false);
});
test('fails closed for tamper, stale receipt provenance, ref mismatch, dirty tree and GO', () => {
  for (const mode of [
    'tamper',
    'stale',
    'provenance',
    'digest',
    'tree',
    'gate',
    'ref',
    'dirty',
    'go',
  ]) {
    const x = fx(),
      m = structuredClone(x.manifest);
    if (mode === 'tamper') writeFileSync(resolve(x.out, 'sbom.cdx.json'), '{}');
    if (['stale', 'provenance', 'digest', 'tree', 'gate'].includes(mode)) {
      const e = m.receipts[0],
        b = JSON.parse(readFileSync(resolve(x.out, e.path)));
      if (mode === 'stale') b.candidateSha = '0'.repeat(40);
      if (mode === 'provenance') b.provenanceType = 'self-asserted';
      if (mode === 'digest') b.logDigest = 'bad';
      if (mode === 'tree') b.treeSha = '0'.repeat(40);
      if (mode === 'gate') b.gateId = 'wrong';
      writeFileSync(resolve(x.out, e.path), JSON.stringify(b));
      e.sha256 = hash(readFileSync(resolve(x.out, e.path)));
      m.manifestSha256 = hashCanonicalManifest(m);
    }
    if (mode === 'ref') git(x.repo, ['branch', '-f', 'release-candidate', x.previousVerifiedSha]);
    if (mode === 'dirty') write(x.repo, 'dirty.txt', 'x');
    if (mode === 'go') m.authorization = 'GO';
    const r = verifyReleaseCandidateBundle({ manifest: m, repo: x.repo, bundleDir: x.out });
    assert.equal(r.verified, false, mode);
    assert.equal(r.releaseGo, false);
  }
});
test('independently regenerates SBOM and rejects rehashed truncation, duplicates and malformed purl', () => {
  const expectedCode = {
    truncate: 'SBOM_COMPONENT_COUNT_MISMATCH',
    'duplicate-ref': 'SBOM_BOM_REF_DUPLICATE',
    'duplicate-purl': 'SBOM_PURL_DUPLICATE',
    'invalid-purl': 'SBOM_PURL_INVALID',
  };
  for (const mode of ['truncate', 'duplicate-ref', 'duplicate-purl', 'invalid-purl']) {
    const x = fx(),
      m = structuredClone(x.manifest),
      sbomPath = resolve(x.out, m.sbom.path),
      sbom = JSON.parse(readFileSync(sbomPath));
    if (mode === 'truncate') sbom.components.length = 0;
    if (mode === 'duplicate-ref') {
      sbom.components.push(structuredClone(sbom.components[0]));
    }
    if (mode === 'duplicate-purl') {
      const duplicate = structuredClone(sbom.components[0]);
      duplicate['bom-ref'] += '-different';
      sbom.components.push(duplicate);
    }
    if (mode === 'invalid-purl') {
      sbom.components[0].purl = 'not-a-purl';
      sbom.components[0]['bom-ref'] = 'not-a-purl';
    }
    const bytes = `${JSON.stringify(sbom, null, 2)}\n`;
    writeFileSync(sbomPath, bytes);
    m.sbom.sha256 = hash(bytes);
    m.manifestSha256 = hashCanonicalManifest(m);
    const r = verifyReleaseCandidateBundle({ manifest: m, repo: x.repo, bundleDir: x.out });
    assert.equal(r.verified, false, mode);
    assert.ok(r.errors.some((error) => error.code === 'SBOM_CANONICAL_REGEN_MISMATCH'), mode);
    assert.ok(r.errors.some((error) => error.code === expectedCode[mode]), mode);
  }
});
test('rejects nonancestor and historical migration mutation/deletion', () => {
  for (const mode of ['nonancestor', 'mutation', 'deletion']) {
    const x = fx(),
      m = structuredClone(x.manifest);
    if (mode === 'nonancestor') {
      git(x.repo, ['checkout', '--orphan', 'other']);
      write(x.repo, 'other', 'x');
      const s = commit(x.repo, 'other');
      m.previousVerifiedSha = s;
    } else {
      git(x.repo, ['checkout', '-q', x.candidateSha]);
      if (mode === 'mutation') write(x.repo, 'server/migrations/001.sql', 'changed');
      else rmSync(resolve(x.repo, 'server/migrations/001.sql'));
      const s = commit(x.repo, mode);
      git(x.repo, ['branch', '-f', 'release-candidate', s]);
      m.candidateSha = s;
      m.treeSha = git(x.repo, ['rev-parse', `${s}^{tree}`]);
    }
    const r = verifyReleaseCandidateBundle({ manifest: m, repo: x.repo, bundleDir: x.out });
    assert.equal(r.verified, false, mode);
  }
});
test('rejects destructive and unclassified migration statements without comment/string false hits', () => {
  for (const sql of [
    'DROP TABLE base;',
    'DROP INDEX idx;',
    'DROP SEQUENCE seq;',
    'DROP POLICY p ON base;',
    'DROP MATERIALIZED VIEW mv;',
    'DROP TRIGGER t ON base;',
    'TRUNCATE base;',
    'ALTER TABLE base DROP COLUMN id;',
    'ALTER TABLE base DROP CONSTRAINT c;',
    'ALTER TABLE base RENAME TO other;',
    'DELETE FROM base;',
    'UPDATE base SET id=id;',
    'DROP TABLE base CASCADE;',
    'VACUUM base;',
    'WITH doomed AS (SELECT id FROM base) DELETE FROM base WHERE id IN (SELECT id FROM doomed);',
    'WITH changed AS (SELECT id FROM base) UPDATE base SET id=id FROM changed;',
    'WiTh changed AS (SELECT id FROM "base") UpDaTe "base" SET "id"="id";',
    'INSERT INTO base(id) VALUES (1) ON CONFLICT (id) DO UPDATE SET id=excluded.id;',
    'ALTER TABLE base ADD COLUMN safe text; DROP INDEX idx;',
    '/* unterminated comment',
    "COMMENT ON TABLE base IS 'unterminated",
    'CREATE FUNCTION f() RETURNS void AS $body$ BEGIN NULL; END; LANGUAGE plpgsql;',
    'DO $$ BEGIN PERFORM dangerous_side_effect(); END $$;',
    'DO $$ BEGIN UPDATE base SET id=id; END $$;',
  ]) {
    const x = fx(sql),
      r = verifyReleaseCandidateBundle({ manifest: x.manifest, repo: x.repo, bundleDir: x.out });
    assert.equal(r.verified, false, sql);
    assert.match(
      JSON.stringify(r.errors),
      /DESTRUCTIVE_|MIGRATION_STATEMENT_UNCLASSIFIED|MIGRATION_LEXICAL_ERROR/
    );
  }
  for (const sql of [
    '-- DROP TABLE ignored;\nALTER TABLE base ADD COLUMN safe text;',
    "COMMENT ON TABLE base IS 'DROP TABLE ignored';",
    "CREATE OR REPLACE VIEW v AS SELECT 'DROP TABLE ignored' AS note;",
    "CREATE OR REPLACE FUNCTION f() RETURNS text AS $$ BEGIN RETURN 'DELETE FROM base'; END $$ LANGUAGE plpgsql;",
    'CREATE FUNCTION f() RETURNS void AS $body$ BEGIN NULL; END; $body$ LANGUAGE plpgsql;',
    'CREATE INDEX IF NOT EXISTS idx ON base(id);',
    'CREATE UNIQUE INDEX IF NOT EXISTS unique_idx ON base(id);',
    "INSERT INTO base(id) VALUES ('UPDATE base SET id=id');",
    'ALTER TABLE "base" ADD COLUMN "MixedCase" text;',
    'ALTER TABLE "base" ALTER COLUMN "MixedCase" DROP NOT NULL;',
    'CREATE OR REPLACE VIEW "MixedView" AS SELECT 1 AS "Value";',
    'ALTER TABLE base ADD COLUMN safe text; CREATE INDEX safe_idx ON base(safe);',
    'CREATE TABLE child(id text, parent_id text REFERENCES base(id) ON DELETE CASCADE);',
    'CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON base FOR EACH ROW EXECUTE FUNCTION reject_change();',
    'CREATE OR REPLACE TRIGGER immutable BEFORE UPDATE OR DELETE ON base FOR EACH ROW EXECUTE FUNCTION reject_change();',
    "DO $$ BEGIN IF to_regclass('public.base') IS NULL THEN RAISE EXCEPTION 'missing'; END IF; END $$;",
    'BEGIN; ALTER TABLE base ADD COLUMN guarded text; COMMIT;',
    'BEGIN; DROP INDEX IF EXISTS idx; CREATE UNIQUE INDEX idx ON base(id); COMMIT;',
    'BEGIN; DROP INDEX IF EXISTS idx_fs_pack_active_type; CREATE UNIQUE INDEX idx_fs_pack_active_type_period ON base(id); COMMIT;',
    "BEGIN; DO $$ DECLARE status_def text; BEGIN SELECT pg_get_constraintdef(oid) INTO status_def FROM pg_constraint; IF status_def LIKE '%ARCHIVED%' THEN RAISE EXCEPTION 'already'; END IF; END $$; ALTER TABLE valuations DROP CONSTRAINT valuations_status_check; ALTER TABLE valuations ADD CONSTRAINT valuations_status_check CHECK (status IN ('DRAFT','REVIEW','APPROVED','ARCHIVED')); COMMIT;",
  ]) {
    const x = fx(sql),
      r = verifyReleaseCandidateBundle({ manifest: x.manifest, repo: x.repo, bundleDir: x.out });
    assert.equal(r.verified, true, sql);
  }
});
