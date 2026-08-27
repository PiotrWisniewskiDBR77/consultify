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
  // Copied verbatim into `dist/`, so anything here ships to every visitor
  // exactly as written. Day-39 acceptance FIX-3.
  'public',
];
const PASSWORD_PATTERN = ['1234', '56'].join('');
const REAL_ACCOUNT_DOMAIN =
  /(?:dbr77\.com|plastmetcentrum\.pl|ateliertoys-demo\.com|consultify\.ai|consultify\.com)/i;
const PASSWORD_CONTEXT = /password|has(?:ł|l)o/i;

/**
 * A corporate-domain address written as a string literal.
 *
 * Rebuilt per call — `g` regexes carry `lastIndex` across calls and would skip
 * every other match if shared.
 */
function corporateEmailLiteralPattern(): RegExp {
  return /["'`]\s*([^"'`\s@]+@[^"'`\s]+?)\s*["'`]/g;
}

/**
 * A password-shaped key assigned a STRING LITERAL, whatever the value is.
 *
 * This is the day-39 FIX-3 change. The guard previously only knew one specific
 * password (`PASSWORD_PATTERN`), so acceptance planted real accounts with a
 * different password — `Consultify!2026`, `Zaq12wsx` — and all three assertions
 * passed without a flicker. The value is now irrelevant; the SHAPE is the
 * finding. Interpolations and `process.env` reads are not literals and do not
 * match, which is exactly the migration this guard is meant to push people to.
 */
function passwordLiteralPattern(): RegExp {
  return /["'`]?\b(?:password|passwd|pwd|has(?:ł|l)o)\b["'`]?\s*[:=]\s*["'`]([^"'`\n]{1,256})["'`]/gi;
}

function hasCorporateEmailLiteral(line: string): boolean {
  for (const match of line.matchAll(corporateEmailLiteralPattern())) {
    if (REAL_ACCOUNT_DOMAIN.test(match[1])) return true;
  }
  return false;
}

/**
 * A whole value that is only a variable reference — `${X}`, `$HASH`, `$1` — is
 * a READ, not a literal, and reads are the migration this guard exists to
 * push people towards. `<HASLO>`-style placeholders are documentation.
 * Deliberately anchored to the whole value, so a real password that merely
 * happens to contain a dollar sign (`Pa$$w0rd`) is still a finding.
 */
const VALUE_IS_REFERENCE = /^(?:\$\{[^}]*\}|\$[A-Za-z_0-9]+|<[^>]*>)$/;

function hasPasswordLiteral(line: string): boolean {
  for (const match of line.matchAll(passwordLiteralPattern())) {
    const value = match[1].trim();
    if (value.length === 0) continue;
    if (value.includes('${')) continue;
    if (VALUE_IS_REFERENCE.test(value)) continue;
    return true;
  }
  return false;
}
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

      // File-scope, not line-adjacent: a constant declared at the top and used
      // two hundred lines down is the same credential pair, and pairing by
      // proximity would be trivially evaded by moving one of the two.
      const fileHasCorporateEmail = lines.some(hasCorporateEmailLiteral);

      lines.forEach((line, index) => {
        const neighborhood = lines.slice(Math.max(0, index - 2), index + 3).join('\n');
        if (line.includes(PASSWORD_PATTERN) && PASSWORD_CONTEXT.test(neighborhood)) {
          findings.push({ file: relativeFile, line: index + 1, kind: 'password literal' });
        }
        if (hasRealAccountPair && line.includes(PASSWORD_PATTERN)) {
          findings.push({ file: relativeFile, line: index + 1, kind: 'real account pair' });
        }
        if (fileHasCorporateEmail && hasPasswordLiteral(line)) {
          findings.push({
            file: relativeFile,
            line: index + 1,
            kind: 'structural credential pair',
          });
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

  /**
   * The exact mutant day-39 acceptance planted. Real corporate accounts, a
   * password the guard had never heard of, and 3/3 green. The value must not
   * matter any more — only the shape.
   */
  it.each(['Consultify!2026', 'Zaq12wsx', 'correct horse battery staple'])(
    'detects a corporate account paired with the unknown password %s',
    (unknownPassword) => {
      const baseDir = fixture(
        `const LOGIN = { email: 'piotr.wisniewski@dbr77.com', password: '${unknownPassword}' };`
      );
      const findings = scanCredentialFiles(baseDir, ['src']);

      expect(findings).toEqual([
        { file: 'src/fixture.ts', line: 1, kind: 'structural credential pair' },
      ]);
      expect(failureMessage(findings)).not.toContain(unknownPassword);
    }
  );

  it('detects the pair when the two literals are far apart in the file', () => {
    const baseDir = fixture(
      [
        "const ACCOUNT = 'ops@plastmetcentrum.pl';",
        ...Array.from({ length: 40 }, (_, i) => `// filler ${i}`),
        "const SECRET = { password: 'Zaq12wsx' };",
      ].join('\n')
    );

    const findings = scanCredentialFiles(baseDir, ['src']);
    expect(findings).toEqual([
      { file: 'src/fixture.ts', line: 42, kind: 'structural credential pair' },
    ]);
  });

  it('accepts env reads and variable references next to a corporate account', () => {
    const baseDir = fixture(
      [
        "const ACCOUNT = 'piotr.wisniewski@dbr77.com';",
        'const password = process.env.DEMO_PASSWORD;',
        'const alt = { password: `${process.env.DEMO_PASSWORD}` };',
        // The shape `server/scripts/fix-dbr77-credentials.sh` actually uses.
        "const sql = \"UPDATE users SET password='$HASH' WHERE email='x'\";",
      ].join('\n')
    );
    expect(scanCredentialFiles(baseDir, ['src'])).toEqual([]);
  });

  it('still flags a password that merely contains a dollar sign', () => {
    const baseDir = fixture(
      "const LOGIN = { email: 'piotr.wisniewski@dbr77.com', password: 'Pa$$w0rd' };"
    );
    expect(scanCredentialFiles(baseDir, ['src'])).toEqual([
      { file: 'src/fixture.ts', line: 1, kind: 'structural credential pair' },
    ]);
  });

  it('scans public/, which ships to dist verbatim', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'day39-credentials-public-'));
    temporaryDirectories.push(directory);
    fs.mkdirSync(path.join(directory, 'public'));
    fs.writeFileSync(
      path.join(directory, 'public', 'config.js'),
      "window.SEED = { email: 'piotr.wisniewski@dbr77.com', password: 'Consultify!2026' };"
    );

    expect(scanCredentialFiles(directory, ['public'])).toEqual([
      { file: 'public/config.js', line: 1, kind: 'structural credential pair' },
    ]);
  });
});
