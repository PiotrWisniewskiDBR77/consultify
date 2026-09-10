// CZERWONY Z ZAŁOŻENIA — E1, nie regresja tego bloku.
// Kontrakty opisują wymagane zachowanie CODEX3; `it.fails` jest celowe do czasu
// domknięcia odpowiadającego mu etapu E2–E5.
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('CODEX3 Finance MINIMUM contracts', () => {
  // FIX-3 (odbiór W1/W2, 97_ODBIOR_W1_W2.md §6 STOP 2 i §8): ten kontrakt zamawiał
  // alias trasy '/statements/:artifactId/approve' jako "naprawę". Zmierzone przez
  // odbiorcę na realnym ApiGateway: trasa POST /models/:artifactId/approve DZIAŁA
  // (401 bez tokenu, 409 z tokenem OWNER-a) — nazwa trasy nie jest blokadą.
  // Prawdziwa przyczyna to pusta część wspólna dwóch zbiorów ról, wyliczona
  // statycznie z trzech plików TYLKO-DO-ODCZYTU (Z12/licencja):
  //   (a) role, które przechodzą betaGate.middleware.ts (createModuleGate),
  //   (b) rola domenowa, na którą _shared.ts mapuje każdą z ról (a),
  //   (c) role uprawnione przez lifecycleService.ts do wykonania submit_for_review.
  // Dopóki (b) ∩ (c) jest puste, żadna rola nie wyprowadzi wersji z DRAFT przez API.
  it.fails(
    'KONTRAKT CODEX3 — some role that passes the MODULE_ECONOMICS BetaGate can run submit_for_review on a DRAFT STATEMENT_PACK version',
    () => {
      const betaGateSource = read('server/src/middleware/betaGate.middleware.ts');
      const sharedSource = read('server/src/routes/v8/finance-v2/_shared.ts');
      const lifecycleSource = read('server/src/services/finance/canonical/lifecycleService.ts');

      const orgRolesPassingBetaGate = extractOrgRolesPassingBetaGate(betaGateSource);
      expect(orgRolesPassingBetaGate.length).toBeGreaterThan(0);

      const mapOrgRoleToFinanceRole = buildFinanceRoleMapper(sharedSource);
      const financeRolesReachingApi = [...new Set(orgRolesPassingBetaGate.map(mapOrgRoleToFinanceRole))];

      const submitForReviewAllowedRoles = extractAllowedRolesForAction(lifecycleSource, 'submit_for_review');
      expect(submitForReviewAllowedRoles.length).toBeGreaterThan(0);

      const rolesThatCanDriveDraftOutOfDraft = financeRolesReachingApi.filter((financeRole) =>
        submitForReviewAllowedRoles.includes(financeRole)
      );

      expect(rolesThatCanDriveDraftOutOfDraft.length).toBeGreaterThan(0);
    }
  );

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

  it('KONTRAKT CODEX3 — statement derivation returns P&L, balance sheet and cash flow', () => {
    const source = read('src/components/Finance/statementPackWorkspaceV2/deriveStatementTable.ts');
    expect(source).toContain('profitAndLoss');
    expect(source).toContain('balanceSheet');
    expect(source).toContain('cashFlow');
  });

  it('KONTRAKT CODEX3 — empty statement derivation carries an honest emptyReason', () => {
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

// --- Statyczne wyodrębnianie logiki ról dla kontraktu FIX-3 -----------------
// Wszystkie trzy pliki źródłowe czytane poniżej są TYLKO-DO-ODCZYTU wg tabeli
// licencji (Z12) — te funkcje NIGDY ich nie modyfikują, tylko wyliczają z ich
// treści, czy istnieje rola pokonująca oba bramki (BetaGate i lifecycle).

function sourceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end === -1) throw new Error(`end marker not found after ${startMarker}: ${endMarker}`);
  return source.slice(start, end);
}

function extractOrgRolesPassingBetaGate(betaGateSource: string): string[] {
  const gateBody = sourceBetween(betaGateSource, 'export function createModuleGate', '\n}');
  return [...gateBody.matchAll(/role === '([A-Z_]+)'/g)].map((m) => m[1]);
}

function buildFinanceRoleMapper(sharedSource: string): (orgRole: string) => string {
  const mapBody = sourceBetween(sharedSource, 'export function mapOrgRoleToFinanceRole', '\n}');
  const rules = [...mapBody.matchAll(/if \(([^)]+)\) return '([a-z_]+)';/g)].map((m) => ({
    matches: [...m[1].matchAll(/role === '([a-z_]+)'/g)].map((mm) => mm[1]),
    result: m[2],
  }));
  const defaultMatch = mapBody.match(/return '([a-z_]+)';\s*$/);
  const defaultRole = defaultMatch ? defaultMatch[1] : 'viewer';
  return (orgRole: string) => {
    const role = orgRole.toLowerCase();
    const rule = rules.find((r) => r.matches.includes(role));
    return rule ? rule.result : defaultRole;
  };
}

function extractAllowedRolesForAction(lifecycleSource: string, action: string): string[] {
  const actionIndex = lifecycleSource.indexOf(`action: '${action}'`);
  if (actionIndex === -1) throw new Error(`action not found in lifecycleService.ts: ${action}`);
  const objectEnd = lifecycleSource.indexOf('},', actionIndex);
  const objectSource = lifecycleSource.slice(actionIndex, objectEnd === -1 ? undefined : objectEnd);
  const allowedRolesMatch = objectSource.match(/allowedRoles: \[([^\]]*)\]/);
  if (!allowedRolesMatch) return [];
  return [...allowedRolesMatch[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}
