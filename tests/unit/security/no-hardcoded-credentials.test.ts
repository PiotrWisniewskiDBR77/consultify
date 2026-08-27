import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

type Finding = { file: string; line: number; kind: string };

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../../..');
const SOURCE_ROOTS = [
  'src',
  'server/src',
  'server/scripts',
  'server/seed',
  'server/seeds',
  'scripts',
  'tests/e2e',
];
const PASSWORD_PATTERN = ['1234', '56'].join('');
const REAL_ACCOUNT_DOMAIN = /(?:dbr77\.com|plastmetcentrum\.pl|ateliertoys-demo\.com)/i;
const PASSWORD_CONTEXT = /password|has(?:ł|l)o/i;
const REMOTE_DEFAULT =
  /(?:\|\||\?\?|:-|\.get\([^,]+,)\s*["'`](?:https:\/\/demo\.consultify\.ai|https:\/\/[^"'`]*\.railway\.app)/i;

const ALLOWLIST: Record<string, string> = {
  'scripts/seed-m16-demo.py': 'KOLIZJA_38 — naprawiane w dyżurze 38; 2026-08-28',
  'server/scripts/seed-dbr77-data.js':
    'ZASTANE_POZA_INWENTARZEM_D39 — osobny pakiet naprawczy wymagany; 2026-08-28',
  'server/seed/seed_dbr77_full_demo.js':
    'ZASTANE_POZA_INWENTARZEM_D39 — osobny pakiet naprawczy wymagany; 2026-08-28',
  'scripts/testing/qa-chat-round.ts':
    'ZASTANY_ZDALNY_FALLBACK — poza zatwierdzonym zbiorem D.4; 2026-08-28',
  'tests/e2e/m13/m13-demo.spec.ts':
    'ZASTANY_ZDALNY_FALLBACK — nie zawiera badanego hasła; 2026-08-28',
  'tests/e2e/staging/ops-demo-002-public-entry.staging.spec.ts':
    'ZASTANY_ZDALNY_FALLBACK — nie zawiera badanego hasła; 2026-08-28',
};

const temporaryDirectories: string[] = [];

function filesBelow(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return filesBelow(target);
    return entry.isFile() ? [target] : [];
  });
}

export function scanCredentialFiles(baseDir: string, roots: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const relativeRoot of roots) {
    for (const absoluteFile of filesBelow(path.join(baseDir, relativeRoot))) {
      const relativeFile = path.relative(baseDir, absoluteFile).split(path.sep).join('/');
      if (ALLOWLIST[relativeFile]) continue;

      let content: string;
      try {
        content = fs.readFileSync(absoluteFile, 'utf8');
      } catch {
        continue;
      }
      const lines = content.split(/\r?\n/);
      const hasRealAccountPair =
        content.includes(PASSWORD_PATTERN) && REAL_ACCOUNT_DOMAIN.test(content);

      lines.forEach((line, index) => {
        const neighborhood = lines.slice(Math.max(0, index - 2), index + 3).join('\n');
        if (line.includes(PASSWORD_PATTERN) && PASSWORD_CONTEXT.test(neighborhood)) {
          findings.push({ file: relativeFile, line: index + 1, kind: 'password literal' });
        }
        if (hasRealAccountPair && line.includes(PASSWORD_PATTERN)) {
          findings.push({ file: relativeFile, line: index + 1, kind: 'real account pair' });
        }
        if (REMOTE_DEFAULT.test(line)) {
          findings.push({ file: relativeFile, line: index + 1, kind: 'remote URL default' });
        }
      });
    }
  }
  return findings.filter(
    (finding, index, all) =>
      all.findIndex(
        (candidate) => candidate.file === finding.file && candidate.line === finding.line
      ) === index
  );
}

function failureMessage(findings: Finding[]): string {
  const locations = findings.map(({ file, line, kind }) => `${file}:${line} (${kind})`).join(', ');
  return (
    `Znaleziono zaszyte poświadczenia lub zdalny URL domyślny: ${locations}. ` +
    'Przenieś poświadczenia do env; wzorzec: ' +
    'docs/program/waves/WAVE_03_ACCEPTANCE/codex/' +
    'CODEX_DAY39_HARDCODED_CREDENTIALS_INSTRUKCJA.md §D.4.'
  );
}

function fixture(contents: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'day39-credentials-'));
  temporaryDirectories.push(directory);
  fs.mkdirSync(path.join(directory, 'src'));
  fs.writeFileSync(path.join(directory, 'src', 'fixture.ts'), contents);
  return directory;
}

afterEach(() => {
  while (temporaryDirectories.length) {
    fs.rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe('hardcoded credential regression guard', () => {
  it('passes over the repository source roots', () => {
    const findings = scanCredentialFiles(REPOSITORY_ROOT, SOURCE_ROOTS);
    expect(findings, failureMessage(findings)).toEqual([]);
  });

  it('detects a credential fixture without echoing its value', () => {
    const secret = ['1234', '56'].join('');
    const baseDir = fixture(`const password = '${secret}';`);
    const findings = scanCredentialFiles(baseDir, ['src']);
    const message = failureMessage(findings);

    expect(findings).toHaveLength(1);
    expect(message).toContain('src/fixture.ts:1');
    expect(message).not.toContain(secret);
  });

  it('stays silent for a clean env-based fixture', () => {
    const baseDir = fixture('const password = process.env.TEST_USER_PASSWORD;');
    expect(scanCredentialFiles(baseDir, ['src'])).toEqual([]);
  });
});
