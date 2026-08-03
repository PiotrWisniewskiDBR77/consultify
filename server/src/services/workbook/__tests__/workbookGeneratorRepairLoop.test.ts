/**
 * WorkbookGeneratorService — deterministic (mock-LLM) tests for the Phase 5
 * DETERMINISTIC-CRITIC REPAIR LOOP and the A1 prompt contract.
 *
 * These tests do NOT touch a live LLM. The AIPipeline layer is fully mocked so the
 * whole pipeline (PLAN → CONFIRM → GENERATE → REVIEW → REPAIR → BUILD) runs
 * deterministically. This proves the repair loop MECHANISM is wired and bounded —
 * it is NOT a proof that a live LLM designs a correct model (that needs creds; out
 * of scope here). Truth over the appearance of autonomy.
 *
 * The mock branches on the system prompt each phase sends so we can inject:
 *   - a DEFECTIVE schema at GENERATE (magic-number in a summary/total row → the
 *     deterministic critic flags WQ-01 CRITICAL, passed=false), and
 *   - a CLEAN schema at REPAIR (formula total → critic passes, score 100).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the AIPipeline module BEFORE importing the service (service constructs
// AIPipeline.getInstance() in a field initializer). A module-level ref lets each
// test swap in its own per-call script.
// ---------------------------------------------------------------------------

let processImpl: (req: any) => Promise<{ success: boolean; content: string }>;

vi.mock('../../ai/AIPipeline.js', () => ({
  AIPipeline: {
    getInstance: () => ({
      process: (req: any) => processImpl(req),
    }),
  },
}));

// Silence the logger to keep test output clean and avoid any transport side effects.
vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Schema fixtures
// ---------------------------------------------------------------------------

/**
 * DEFECTIVE: the "Total" row is marked isSummary and carries a MAGIC NUMBER
 * (constant 300) in the `amount` column instead of a SUM formula. The
 * deterministic critic's WQ-01 rule flags a constant in a summary row as CRITICAL.
 */
const DEFECTIVE_SCHEMA = {
  title: 'Repair Loop Fixture',
  description: 'defective — magic number in summary total',
  sheets: [
    {
      name: 'Budget',
      columns: [
        { key: 'item', header: 'Item', type: 'text' },
        { key: 'amount', header: 'Amount', type: 'currency', numberFormat: '#,##0' },
      ],
      rows: [
        { cells: { item: { value: 'Alpha' }, amount: { value: 100 } } },
        { cells: { item: { value: 'Beta' }, amount: { value: 200 } } },
        // magic number 300 in a summary row → WQ-01 CRITICAL
        { cells: { item: { value: 'Total' }, amount: { value: 300 } }, isSummary: true },
      ],
    },
  ],
};

/**
 * CLEAN: identical, but the total is a SUM formula (no leading "=", per A1 prompt
 * contract) covering exactly the two data rows above. Critic passes, score 100.
 */
const CLEAN_SCHEMA = {
  title: 'Repair Loop Fixture',
  description: 'clean — summed total',
  sheets: [
    {
      name: 'Budget',
      columns: [
        { key: 'item', header: 'Item', type: 'text' },
        { key: 'amount', header: 'Amount', type: 'currency', numberFormat: '#,##0' },
      ],
      rows: [
        { cells: { item: { value: 'Alpha' }, amount: { value: 100 } } },
        { cells: { item: { value: 'Beta' }, amount: { value: 200 } } },
        { cells: { item: { value: 'Total' }, amount: { formula: 'SUM(B2:B3)' } }, isSummary: true },
      ],
    },
  ],
};

// Benign responses for the ancillary phases so only the deterministic critic loop
// is the thing under test.
const PLAN_JSON = JSON.stringify({ domain: 'finance', sheets: [], total_complexity: 'low' });
const CONFIRM_JSON = JSON.stringify({
  approved: true,
  confidence: 0.9,
  issues: [],
  missing_elements: [],
});
const REVIEW_JSON = JSON.stringify({
  scores: {},
  overall_score: 4.5,
  pass: true,
  issues: [],
  fixes_applied: null,
});

/** Route a mock response by the system prompt each phase sends. */
function routeByPrompt(sys: string, opts: { generate: string; repair: string }): string {
  if (sys.includes('PLAN the structure')) return PLAN_JSON;
  if (sys.includes('quality assurance reviewer for spreadsheet plans')) return CONFIRM_JSON;
  if (sys.includes('senior Excel quality reviewer')) return REVIEW_JSON;
  if (sys.includes('performing a targeted REPAIR')) return opts.repair;
  // GENERATION_SYSTEM_PROMPT
  if (sys.includes('You receive a PLAN and must produce')) return opts.generate;
  return '{}';
}

const baseParams = {
  prompt: 'Make a tiny budget',
  userId: 'u1',
  organizationId: 'org1',
};

// ---------------------------------------------------------------------------

describe('WorkbookGeneratorService — Phase 5 deterministic-critic repair loop', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('detects a CRITICAL defect, repairs it, and builds a clean qualityReport (100/passed)', async () => {
    const calls: string[] = [];
    processImpl = async (req: any) => {
      const sys: string = req?.options?.systemInstruction ?? '';
      calls.push(sys);
      const content = routeByPrompt(sys, {
        // GENERATE: generation returns the DEFECTIVE schema.
        generate: JSON.stringify(DEFECTIVE_SCHEMA),
        // REPAIR: returns the CLEAN schema → critic passes.
        repair: JSON.stringify(CLEAN_SCHEMA),
      });
      return { success: true, content };
    };

    const { default: service } = await import('../WorkbookGeneratorService.js');
    const result = await service.generate({ ...baseParams });

    // A repair pass must have run.
    const repairLog = result.pipelineLog.filter((p) => p.phase.startsWith('repair-'));
    expect(repairLog.length).toBeGreaterThanOrEqual(1);

    // The REPAIR system prompt must have been sent to the LLM at least once.
    expect(calls.some((c) => c.includes('performing a targeted REPAIR'))).toBe(true);

    // Final report is clean: no CRITICAL, score 100, passed.
    expect(result.qualityReport.passed).toBe(true);
    expect(result.qualityReport.score).toBe(100);
    expect(result.qualityReport.issues).toHaveLength(0);

    // Build still produced a real buffer.
    expect(result.buffer.length).toBeGreaterThan(0);

    // The clean schema (formula total) won.
    const total = result.schema.sheets[0].rows[2].cells.amount;
    expect(total.formula).toBeDefined();
    expect(total.value).toBeUndefined();
  });

  it('when repair never fixes the defect, it stops at the iteration cap and builds fail-soft (non-empty qualityReport, no infinite loop)', async () => {
    let repairCalls = 0;
    processImpl = async (req: any) => {
      const sys: string = req?.options?.systemInstruction ?? '';
      // Count ONLY genuine repair-phase calls (the eager object literal below must
      // not double-count — so we increment here, keyed on the actual prompt).
      if (sys.includes('performing a targeted REPAIR')) repairCalls++;
      const content = routeByPrompt(sys, {
        generate: JSON.stringify(DEFECTIVE_SCHEMA),
        // REPAIR always returns the SAME defective schema → never improves.
        repair: JSON.stringify(DEFECTIVE_SCHEMA),
      });
      return { success: true, content };
    };

    const { default: service } = await import('../WorkbookGeneratorService.js');
    const result = await service.generate({ ...baseParams });

    // Bounded: repair was attempted but stops — no runaway. The loop breaks early
    // on "no improvement", so at most 1 repair call is made here; the hard invariant
    // is simply that it is bounded (≤ cap) and non-zero.
    expect(repairCalls).toBeGreaterThanOrEqual(1);
    expect(repairCalls).toBeLessThanOrEqual(2);

    // Fail-soft: build STILL happened despite the unresolved CRITICAL.
    expect(result.buffer.length).toBeGreaterThan(0);

    // qualityReport is non-empty and honestly reports the remaining CRITICAL.
    expect(result.qualityReport.passed).toBe(false);
    expect(result.qualityReport.issues.length).toBeGreaterThan(0);
    expect(result.qualityReport.issues.some((i) => i.severity === 'CRITICAL')).toBe(true);
  });
});
