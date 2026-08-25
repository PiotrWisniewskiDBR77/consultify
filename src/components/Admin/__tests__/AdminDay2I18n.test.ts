import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const PANELS = [
  'src/components/Admin/AdminTeamsPanel.tsx',
  'src/components/Admin/AdminRolesPermissionsPanel.tsx',
  'src/components/Admin/AdminGuestsPanel.tsx',
  'src/components/Admin/AdminAccessReviewsPanel.tsx',
  'src/components/Admin/AdminSeatsLicencesPanel.tsx',
  'src/components/Admin/AdminPlanHistoryPanel.tsx',
  'src/components/Admin/AI/PersonasPanel.tsx',
  'src/components/Admin/AdminAiIncidentsPanel.tsx',
  'src/components/Admin/AdminConfigurationVersionsPanel.tsx',
  'src/components/Admin/AdminSessionsPanel.tsx',
  'src/components/Admin/AdminServiceAccountsPanel.tsx',
  'src/components/Admin/AdminSecurityAlertsPanel.tsx',
  'src/components/Admin/AdminBreakGlassPanel.tsx',
  'src/components/Admin/AdminAuditExportHistoryPanel.tsx',
  'src/components/Admin/AdminAuditIntegrityPanel.tsx',
  'src/components/Admin/AdminComplianceEvidencePanel.tsx',
  'src/components/Admin/AdminLegalHoldPanel.tsx',
  'src/components/Admin/AdminCommandCenterPanel.tsx',
  'src/components/Admin/AdminOrganizationDefaultsPanel.tsx',
  'src/components/Admin/AdminJobsPanel.tsx',
  'src/components/Admin/AdminSlaSloPanel.tsx',
  'src/components/Admin/AdminDomainsPanel.tsx',
  'src/components/Admin/AdminAiQualityPanel.tsx',
  'src/components/Admin/AdminDependenciesPanel.tsx',
  'src/components/Admin/AdminIncidentHistoryPanel.tsx',
  'src/components/Admin/AdminAccessRequestsPanel.tsx',
] as const;

const locales = Object.fromEntries(
  ['pl', 'en'].map((locale) => [
    locale,
    JSON.parse(
      fs.readFileSync(path.join(ROOT, `public/locales/${locale}/translation.json`), 'utf8')
    ),
  ])
) as Record<'pl' | 'en', Record<string, unknown>>;

const lookupExact = (source: Record<string, unknown>, key: string) =>
  key
    .split('.')
    .reduce<unknown>(
      (value, part) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined,
      source
    );
const lookup = (source: Record<string, unknown>, key: string) =>
  lookupExact(source, key) ??
  lookupExact(source, `${key}_other`) ??
  lookupExact(source, `${key}_one`);
const variables = (value: unknown) =>
  [...String(value).matchAll(/{{\s*([^},\s]+)[^}]*}}/g)].map((match) => match[1]).sort();

describe('Admin day-2 i18n contract', () => {
  it('keeps the exact 26-panel denominator free of generated textN keys and Polish fallbacks', () => {
    for (const file of PANELS) {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      expect(source, file).not.toContain('day2Auto');
      expect(source, file).not.toMatch(/t\(\s*['"`][^'"`]+['"`]\s*,\s*['"`]/s);
    }
  });

  it('has complete PL and EN values with identical interpolation variables for every static key', () => {
    for (const file of PANELS) {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const keys = [...source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
      for (const key of keys) {
        const pl = lookup(locales.pl, key);
        const en = lookup(locales.en, key);
        expect(typeof pl, `${file}: missing PL ${key}`).toBe('string');
        expect(typeof en, `${file}: missing EN ${key}`).toBe('string');
        expect(variables(en), `${file}: interpolation mismatch ${key}`).toEqual(variables(pl));
        expect(String(en), `${file}: Polish text leaked into EN ${key}`).not.toMatch(
          /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/
        );
      }
    }
  });

  it('rejects raw user-facing JSX text and translated technical ids or routes', () => {
    const failures: string[] = [];
    for (const file of PANELS) {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const ast = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );
      const visit = (node: ts.Node) => {
        if (ts.isJsxText(node) && /[\p{L}]/u.test(node.text)) {
          const line = ast.getLineAndCharacterOfPosition(node.pos).line + 1;
          failures.push(`${file}:${line} raw JSX text ${JSON.stringify(node.text.trim())}`);
        }
        if (
          ts.isPropertyAssignment(node) &&
          ['id', 'href', 'to', 'persistKey'].includes(node.name.getText(ast)) &&
          ts.isCallExpression(node.initializer) &&
          node.initializer.expression.getText(ast) === 't'
        ) {
          const line = ast.getLineAndCharacterOfPosition(node.pos).line + 1;
          failures.push(`${file}:${line} translated technical identifier`);
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
    expect(failures).toEqual([]);
  });

  it.each([
    ['team', 'admin.team.teams.title'],
    ['billing', 'admin.billing.plan-history.title'],
    ['ai', 'admin.ai.personas.available'],
    ['security', 'admin.domains.title'],
    ['audit', 'admin.audit.integrity.title'],
    ['command', 'admin.command.organization-defaults.title'],
    ['health', 'admin.health.queues-jobs.title'],
  ])('provides distinct PL and EN copy for the %s domain', (_domain, key) => {
    expect(lookup(locales.pl, key)).not.toEqual(lookup(locales.en, key));
  });
});
