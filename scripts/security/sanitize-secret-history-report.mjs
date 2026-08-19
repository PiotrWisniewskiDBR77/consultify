#!/usr/bin/env node

/** Convert a local, unredacted gitleaks JSON report into commit-safe evidence.
 * The raw value is never printed or copied; only SHA-256 is retained.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error('usage: sanitize-secret-history-report.mjs <gitleaks.json> <safe-output.json>');
}

const findings = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const providerForRule = {
  'openai-api-key': 'OPENAI_API_KEY',
  'gcp-api-key': 'GCP_API_KEY',
  'linkedin-client-secret': 'LINKEDIN_CLIENT_SECRET',
  jwt: 'JWT_TOKEN',
  'adobe-client-id': 'PUBLIC_CLIENT_IDENTIFIER',
};
const grouped = new Map();
for (const finding of findings) {
  const secretHash = createHash('sha256').update(String(finding.Secret ?? '')).digest('hex');
  const key = [finding.File, finding.Commit, secretHash].join('\u0000');
  const existing = grouped.get(key) ?? {
    path: finding.File,
    historyCommit: finding.Commit,
    secretSha256: secretHash,
    providerType: 'GENERIC_NAMED_CREDENTIAL',
    rules: new Set(),
    lines: new Set(),
  };
  existing.rules.add(finding.RuleID);
  existing.lines.add(Number(finding.StartLine));
  if (providerForRule[finding.RuleID]) existing.providerType = providerForRule[finding.RuleID];
  grouped.set(key, existing);
}

const records = [...grouped.values()]
  .map((record) => ({
    path: record.path,
    historyCommit: record.historyCommit,
    secretSha256: record.secretSha256,
    providerType: record.providerType,
    rules: [...record.rules].sort(),
    lines: [...record.lines].sort((a, b) => a - b),
    status:
      record.providerType === 'PUBLIC_CLIENT_IDENTIFIER'
        ? 'OWNER_VALIDATION_REQUIRED'
        : 'BLOCKED_ROTATION_REQUIRED',
  }))
  .sort((a, b) =>
    `${a.path}\u0000${a.historyCommit}\u0000${a.secretSha256}`.localeCompare(
      `${b.path}\u0000${b.historyCommit}\u0000${b.secretSha256}`
    )
  );

const output = {
  schemaVersion: 1,
  classification: 'BLOCKED_ROTATION_REQUIRED',
  rawFindingCount: findings.length,
  uniquePathCommitHashCount: records.length,
  guarantees: {
    secretValuesStored: false,
    secretValuesPrinted: false,
    historyRewritten: false,
    providerContacted: false,
  },
  requiredOwnerActions: [
    'Confirm revocation or rotation for every BLOCKED_ROTATION_REQUIRED hash.',
    'Decide whether to authorize a coordinated history rewrite after rotation.',
    'Re-run the full-history scanner and retain a zero-finding report before SEC-PRIV technical DONE.',
  ],
  records,
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(
  `sanitized ${findings.length} findings into ${records.length} path+commit+hash records; values stored=0\n`
);
