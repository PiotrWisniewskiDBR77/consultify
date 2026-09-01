import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  REQUIRED_STATES,
  REQUIRED_TABS,
  verifyDay267Screenshots,
} from '../day267-materialy-zrzuty-werdykt.mjs';

const repo = process.cwd();
const outDir = '/private/tmp/cx-day267-materialy-zrzuty-artefakty';

describe('Day267 Materiały — komplet dowodu wizualnego', () => {
  it('wymienia pięć zakładek huba i oba wymagane stany', () => {
    expect(REQUIRED_TABS).toEqual([
      'outputs_all',
      'outputs_documents',
      'presentations',
      'outputs_sheets',
      'templates',
    ]);
    expect(REQUIRED_STATES).toEqual(['ready', 'empty']);
  });

  it('harness montuje realny ReportsAndPresentationsHub i obsługuje ready empty loading error', () => {
    const source = fs.readFileSync(
      path.join(repo, 'dev-render/screens/day267-materialy-hub-zrzuty.tsx'),
      'utf8'
    );
    expect(source).toContain('<ReportsAndPresentationsHub />');
    for (const state of ['ready', 'empty', 'loading', 'error']) expect(source).toContain(`'${state}'`);
  });

  it('rejestr szablonów arkuszy zawiera dziewięć identyfikatorów, w tym cashflow12m', () => {
    const source = fs.readFileSync(
      path.join(repo, 'server/src/services/workbook/templates/index.ts'),
      'utf8'
    );
    const block = source.slice(source.indexOf('export const WORKBOOK_TEMPLATES'));
    const ids = [...block.matchAll(/^  ([A-Za-z0-9_]+): \{/gm)].map((match) => match[1]);
    expect(ids).toHaveLength(9);
    expect(ids).toContain('cashflow12m');
  });

  it('każda para light dark i każdy podgląd po kliknięciu przechodzi strażnika', async () => {
    const result = await verifyDay267Screenshots(outDir);
    expect(result.errors).toEqual([]);
    expect(result.pairs).toHaveLength(10);
    expect(result.ok).toBe(true);
  });
});
