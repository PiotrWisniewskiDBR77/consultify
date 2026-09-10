// CZERWONY Z ZAŁOŻENIA — E1, nie regresja tego bloku.
// Kontrakty opisują wymagane zachowanie CODEX3; `it.fails` jest celowe do czasu
// domknięcia odpowiadającego mu etapu E2–E5.
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('CODEX3 Finance MINIMUM contracts', () => {
  it.fails('KONTRAKT CODEX3 — statement pack approval is exposed under the statements route', () => {
    expect(read('server/src/routes/v8/finance-v2/models.routes.ts')).toContain(
      "'/statements/:artifactId/approve'"
    );
  });

  it('KONTRAKT CODEX3 — bulk lineage route accepts many business version ids', () => {
    expect(read('server/src/routes/v8/finance-v2/crosscutting.routes.ts')).toContain(
      "'/versions/lineage-edges/bulk-read'"
    );
  });

  it('KONTRAKT CODEX3 — lineage service provides an organization-scoped bulk reader', () => {
    expect(read('server/src/services/finance/canonical/lineageService.ts')).toContain(
      'getLineageForBusinessVersions'
    );
  });

  it.fails('KONTRAKT CODEX3 — Finance list has a source statement column behind the minimum flag', () => {
    const source = read('src/components/Economics/FinanceHub.tsx');
    expect(source).toContain('VITE_FINANCE_MINIMUM');
    expect(source).toContain('sourceStatement');
  });

  it.fails('KONTRAKT CODEX3 — statement derivation returns P&L, balance sheet and cash flow', () => {
    const source = read('src/components/Finance/statementPackWorkspaceV2/deriveStatementTable.ts');
    expect(source).toContain('profitAndLoss');
    expect(source).toContain('balanceSheet');
    expect(source).toContain('cashFlow');
  });

  it.fails('KONTRAKT CODEX3 — empty statement derivation carries an honest emptyReason', () => {
    expect(read('src/components/Finance/statementPackWorkspaceV2/deriveStatementTable.ts')).toContain(
      'emptyReason'
    );
  });

  it.fails('KONTRAKT CODEX3 — Finance module contains no non-test primary classes', () => {
    const files = listTsx('src/components/Finance').concat(listTsx('src/components/Economics'));
    const offenders = files.filter((file) => /primary-/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it.fails('KONTRAKT CODEX3 — every raw Finance table is explicitly classified', () => {
    const files = listTsx('src/components/Finance').concat(listTsx('src/components/Economics'));
    const offenders = files.filter((file) => /<table(?![^>]*§27-exempt)/s.test(read(file)));
    expect(offenders).toEqual([]);
  });
});

function listTsx(relativeDir: string): string[] {
  const absoluteDir = path.join(repoRoot, relativeDir);
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : listTsx(relativePath);
    }
    return entry.isFile() && entry.name.endsWith('.tsx') ? [relativePath] : [];
  });
}
