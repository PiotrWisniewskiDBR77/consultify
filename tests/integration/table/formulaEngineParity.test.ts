// @vitest-environment node
/**
 * R5 FT-1 (integration) — FE↔BE formula-engine PARITY.
 *
 * The whole point of `formulaEngineCore.ts` is to be a faithful port of the
 * server engine so a formula computed in the browser equals the value the
 * backend persists. This test imports BOTH engines and asserts identical
 * output across a battery of formulas. If parity breaks, fix one side until
 * green — do not weaken this test.
 *
 * Node environment: the server engine transitively imports DB/Logger modules
 * (lazy — no connection at import), which don't belong in jsdom.
 */
import { describe, expect, it } from 'vitest';

import * as core from '@/components/MyWork/table/formulaEngineCore';
import * as server from '../../../server/src/services/tablePlatform/formulaEngine';

const RECORD: Record<string, unknown> = {
  effort: 8,
  impact: 4,
  rating: 3,
  status: 'Done',
  label: 'Alpha',
  type: 'Task',
  cost: 100,
};

// fieldMap: name → id (identity here; both engines accept it)
const FIELD_MAP = new Map<string, string>();
for (const k of Object.keys(RECORD)) FIELD_MAP.set(k, k);

const FORMULAS = [
  'SUM(effort, impact, rating)',
  'AVG(effort, impact)',
  'IF(status = "Done", 10, 0)',
  'CONCAT(label, " - ", type)',
  'effort * 0.4 + impact * 0.3',
  'ROUND(cost / 3, 2)',
  'MAX(effort, impact, rating)',
  'IF(effort > impact, "big", "small")',
];

describe('formula engine FE↔BE parity', () => {
  it('produces identical results for 8 formulas (core vs server)', () => {
    for (const f of FORMULAS) {
      const coreAst = core.parseFormula(f);
      const serverAst = server.parseFormula(f);
      const coreVal = core.evaluateFormula(coreAst, RECORD, FIELD_MAP);
      const serverVal = server.evaluateFormula(serverAst, RECORD, FIELD_MAP);
      expect(coreVal, `mismatch on formula: ${f}`).toEqual(serverVal);
    }
  });

  it('produces identical ASTs for the same formula', () => {
    for (const f of FORMULAS) {
      expect(core.parseFormula(f), `AST mismatch on: ${f}`).toEqual(server.parseFormula(f));
    }
  });

  it('produces identical dependency extraction', () => {
    const f = 'SUM(effort, impact) + rating * cost';
    expect(core.extractFieldDependencies(core.parseFormula(f)).sort()).toEqual(
      server.extractFieldDependencies(server.parseFormula(f)).sort()
    );
  });
});
