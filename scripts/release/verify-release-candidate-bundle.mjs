#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA_RE = /^[0-9a-f]{40}$/;
const MIGRATION_ROOT = 'server/migrations/';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
};

export const canonicalManifestBody = (manifest) => {
  const { manifestSha256: _manifestSha256, ...body } = manifest;
  return `${JSON.stringify(stableValue(body))}\n`;
};

export const hashCanonicalManifest = (manifest) => sha256(canonicalManifestBody(manifest));

const git = (repo, args, encoding = 'utf8') =>
  execFileSync('git', ['-C', repo, ...args], {
    encoding,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const gitText = (repo, args) => git(repo, args).trim();
const gitFile = (repo, sha, path) => git(repo, ['show', `${sha}:${path}`], null);

const listMigrationPaths = (repo, sha) => {
  const output = gitText(repo, ['ls-tree', '-r', '--name-only', sha, '--', MIGRATION_ROOT]);
  return output
    ? output
        .split('\n')
        .filter((path) => path.startsWith(MIGRATION_ROOT))
        .sort()
    : [];
};

const isRecognizedSbom = (format, parsed) => {
  if (format === 'cyclonedx-json') return parsed?.bomFormat === 'CycloneDX';
  if (format === 'spdx-json') return typeof parsed?.spdxVersion === 'string';
  return false;
};

export function verifyReleaseCandidateBundle({ manifest, repo }) {
  const errors = [];
  const add = (code, detail) => errors.push({ code, detail });
  const candidateSha = manifest?.candidateSha;
  const previousSha = manifest?.previousVerifiedSha;

  if (manifest?.schemaVersion !== 1) add('MANIFEST_SCHEMA_UNSUPPORTED', 'schemaVersion must equal 1');
  if (!SHA_RE.test(candidateSha ?? '')) add('CANDIDATE_SHA_INVALID', 'candidateSha must be a full lowercase SHA-1');
  if (!SHA_RE.test(previousSha ?? '')) add('PREVIOUS_SHA_INVALID', 'previousVerifiedSha must be a full lowercase SHA-1');
  if (manifest?.authorization !== 'NOT_AUTHORIZED') {
    add('AUTHORIZATION_MUST_REMAIN_NOT_AUTHORIZED', 'bundle verification cannot assert release authorization');
  }
  if (manifest?.cleanBuild !== true) add('CLEAN_BUILD_ASSERTION_REQUIRED', 'cleanBuild must be explicitly true');
  if (!SHA_RE.test(manifest?.treeSha ?? '')) add('TREE_SHA_INVALID', 'treeSha must be a full lowercase SHA-1');
  if (!/^[0-9a-f]{64}$/.test(manifest?.manifestSha256 ?? '')) {
    add('MANIFEST_HASH_INVALID', 'manifestSha256 must be a lowercase SHA-256');
  } else if (hashCanonicalManifest(manifest) !== manifest.manifestSha256) {
    add('MANIFEST_HASH_MISMATCH', 'canonical manifest body does not match manifestSha256');
  }

  if (errors.some(({ code }) => code === 'CANDIDATE_SHA_INVALID' || code === 'PREVIOUS_SHA_INVALID')) {
    return finish(manifest, errors);
  }

  try {
    gitText(repo, ['cat-file', '-e', `${candidateSha}^{commit}`]);
  } catch {
    add('CANDIDATE_COMMIT_MISSING', candidateSha);
    return finish(manifest, errors);
  }
  try {
    gitText(repo, ['cat-file', '-e', `${previousSha}^{commit}`]);
  } catch {
    add('PREVIOUS_COMMIT_MISSING', previousSha);
    return finish(manifest, errors);
  }

  const actualTreeSha = gitText(repo, ['rev-parse', `${candidateSha}^{tree}`]);
  if (manifest.treeSha !== actualTreeSha) add('TREE_SHA_MISMATCH', `expected ${actualTreeSha}`);

  try {
    git(repo, ['merge-base', '--is-ancestor', previousSha, candidateSha]);
  } catch {
    add('ROLLBACK_SHA_NOT_ANCESTOR', `${previousSha} is not an ancestor of ${candidateSha}`);
  }

  verifyGitArtifact({ manifestEntry: manifest.lockfile, label: 'LOCKFILE', repo, candidateSha, add });
  const sbomBytes = verifyGitArtifact({
    manifestEntry: manifest.sbom,
    label: 'SBOM',
    repo,
    candidateSha,
    add,
  });
  if (sbomBytes) {
    try {
      const parsed = JSON.parse(sbomBytes.toString('utf8'));
      if (!isRecognizedSbom(manifest.sbom?.format, parsed)) {
        add('SBOM_FORMAT_UNRECOGNIZED', 'expected cyclonedx-json or spdx-json matching payload');
      }
    } catch {
      add('SBOM_JSON_INVALID', 'SBOM must be valid JSON');
    }
  }

  const candidateMigrations = listMigrationPaths(repo, candidateSha);
  const ledger = Array.isArray(manifest.migrations) ? manifest.migrations : [];
  const ledgerPaths = ledger.map((entry) => entry?.path);
  if (JSON.stringify(ledgerPaths) !== JSON.stringify([...ledgerPaths].sort())) {
    add('MIGRATION_LEDGER_NOT_SORTED', 'migration entries must be sorted by path');
  }
  if (new Set(ledgerPaths).size !== ledgerPaths.length) add('MIGRATION_LEDGER_DUPLICATE', 'duplicate migration path');
  if (JSON.stringify(ledgerPaths) !== JSON.stringify(candidateMigrations)) {
    add('MIGRATION_LEDGER_INCOMPLETE', 'ledger must exactly equal candidate migration inventory');
  }
  for (const entry of ledger) {
    verifyGitArtifact({ manifestEntry: entry, label: 'MIGRATION', repo, candidateSha, add });
  }

  const previousMigrations = listMigrationPaths(repo, previousSha);
  const candidateSet = new Set(candidateMigrations);
  for (const path of previousMigrations) {
    if (!candidateSet.has(path)) {
      add('ROLLBACK_MIGRATION_DELETED', path);
      continue;
    }
    const before = gitFile(repo, previousSha, path);
    const after = gitFile(repo, candidateSha, path);
    if (!before.equals(after)) add('ROLLBACK_MIGRATION_MODIFIED', path);
  }

  return finish(manifest, errors);
}

function verifyGitArtifact({ manifestEntry, label, repo, candidateSha, add }) {
  if (!manifestEntry || typeof manifestEntry.path !== 'string' || !/^[0-9a-f]{64}$/.test(manifestEntry.sha256 ?? '')) {
    add(`${label}_ENTRY_INVALID`, 'path and lowercase SHA-256 are required');
    return null;
  }
  let bytes;
  try {
    bytes = gitFile(repo, candidateSha, manifestEntry.path);
  } catch {
    add(`${label}_OBJECT_MISSING`, manifestEntry.path);
    return null;
  }
  const actual = sha256(bytes);
  if (actual !== manifestEntry.sha256) add(`${label}_HASH_MISMATCH`, manifestEntry.path);
  return bytes;
}

function finish(manifest, errors) {
  const sortedErrors = errors.sort((a, b) => `${a.code}:${a.detail}`.localeCompare(`${b.code}:${b.detail}`));
  return stableValue({
    schemaVersion: 1,
    taskId: 'REL-001-T01',
    candidateSha: manifest?.candidateSha ?? null,
    authorization: 'NOT_AUTHORIZED',
    verified: sortedErrors.length === 0,
    releaseGo: false,
    errors: sortedErrors,
  });
}

function parseArgs(argv) {
  const values = { repo: process.cwd(), manifest: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--repo') values.repo = argv[++index];
    else if (argv[index] === '--manifest') values.manifest = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (!values.manifest) throw new Error('--manifest is required');
  return values;
}

async function main() {
  let result;
  try {
    const args = parseArgs(process.argv.slice(2));
    const manifest = JSON.parse(readFileSync(resolve(args.manifest), 'utf8'));
    result = verifyReleaseCandidateBundle({ manifest, repo: resolve(args.repo) });
  } catch (error) {
    result = finish(null, [{ code: 'VERIFIER_INPUT_ERROR', detail: error instanceof Error ? error.message : String(error) }]);
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.verified ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
