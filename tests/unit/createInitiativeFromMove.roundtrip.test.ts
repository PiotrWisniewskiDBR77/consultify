/**
 * Round-trip coverage for the generic Tools→Initiatives handoff (S6.2 / chain
 * gap #4). Every consulting tool that produces "strategic moves" can now promote
 * a move into the real Initiatives backbone via the SHARED helper
 * createInitiativeFromMove — the generalization of the R3 SWOT fix.
 *
 * Asserts the full round-trip:
 *   tool move  →  createInitiativeFromMove
 *              →  Api.createInitiative called with sourceType:'tool' + sourceId
 *              →  backend echoes source_type:'tool' back (provenance survives)
 *   plus the offline-safe local draft is appended to the tool session.
 */
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitiativeFromMove } from '../../src/components/DiscoveryTools/shared/createInitiativeFromMove';
import type { ToolSession } from '../../src/store/useToolStore';

// Backend stub: echo the provenance fields back, mirroring the real
// POST /api/initiatives response shape (source_type / source_id columns).
const createInitiativeMock = vi.fn(async (payload: Record<string, unknown>) => ({
  id: 'init-generated-1',
  title: payload.title,
  source_type: payload.sourceType,
  source_id: payload.sourceId,
}));

vi.mock('@/services/api', () => ({
  Api: {
    createInitiative: (p: Record<string, unknown>) => createInitiativeMock(p),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const makeSession = (): ToolSession =>
  ({
    id: 'tool-session-abc',
    toolType: 'growth-paths',
    name: 'Growth Paths session',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStep: 0,
    generatedInitiatives: [],
    inputData: {},
  }) as unknown as ToolSession;

describe('createInitiativeFromMove — generic tool→initiative round-trip', () => {
  beforeEach(() => {
    createInitiativeMock.mockClear();
    (toast.success as ReturnType<typeof vi.fn>).mockClear?.();
    (toast.error as ReturnType<typeof vi.fn>).mockClear?.();
  });

  it('persists a move with tool provenance and source_type:tool round-trips back', async () => {
    const session = makeSession();
    const addInitiative = vi.fn();
    const move = {
      id: 'move-1',
      title: 'Enter adjacent segment via channel partner',
      category: 'big-bet',
      rationale: 'Highest expected return given current strengths.',
      expectedImpact: 'high' as const,
      estimatedEffort: 'medium' as const,
      linkedQuadrants: ['q-market-dev'],
    };

    const ok = await createInitiativeFromMove({ session, move, t: (key) => key, addInitiative });

    expect(ok).toBe(true);

    // 1. Local offline-safe draft appended, carrying the tool source + lineage.
    expect(addInitiative).toHaveBeenCalledTimes(1);
    const draft = addInitiative.mock.calls[0][0];
    expect(draft.title).toBe(move.title);
    expect(draft.source).toBe('growth-paths');
    expect(draft.linkedItems).toContain('q-market-dev');
    expect(draft.estimatedImpact).toBe('high');

    // 2. Backend called with tool provenance (chain gap #4 back-reference).
    expect(createInitiativeMock).toHaveBeenCalledTimes(1);
    const payload = createInitiativeMock.mock.calls[0][0];
    expect(payload.sourceType).toBe('tool');
    expect(payload.sourceId).toBe('tool-session-abc');
    expect(payload.title).toBe(move.title);

    // 3. Provenance survives the round-trip (source_type:'tool' comes back).
    const result = await createInitiativeMock.mock.results[0].value;
    expect(result.source_type).toBe('tool');
    expect(result.source_id).toBe('tool-session-abc');
  });

  it('keeps the local draft and returns false when the backend fails', async () => {
    createInitiativeMock.mockRejectedValueOnce(new Error('boom'));
    const session = makeSession();
    const addInitiative = vi.fn();
    const move = { id: 'm', title: 'Fallback move', rationale: 'r' };

    const ok = await createInitiativeFromMove({ session, move, t: (key) => key, addInitiative });

    expect(ok).toBe(false);
    // Draft still captured locally so the tool flow is never broken.
    expect(addInitiative).toHaveBeenCalledTimes(1);
  });
});
