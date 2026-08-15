/**
 * SPEC_01 (Tryb A) — kontrakt narzędzia generate_deliverable.
 *
 * Weryfikuje, że function-call Teresy:
 *  - mapuje typ (document/sheet/presentation) → format (doc/sheet/deck),
 *  - woła plan() + start() serwisu generacji z poprawnym setupem,
 *  - emituje onDeliverable (most do montażu canvasa) z generationId,
 *  - self-gate'uje na flagę ENABLE_DELIVERABLES_LIGHT i rolę (VIEWER → odmowa),
 *  - NIGDY nie zwraca ok:true bez realnego generationId (kontrakt prawdomówności).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (hoisted: vi.mock factories run above imports) ─────────────────────
const { planMock, startMock, flags } = vi.hoisted(() => ({
  planMock: vi.fn(),
  startMock: vi.fn(),
  flags: { ENABLE_DELIVERABLES_LIGHT: true },
}));

vi.mock('../../../../server/src/services/deliverables/deliverablesGenerationService.js', () => ({
  plan: (...args: unknown[]) => planMock(...args),
  start: (...args: unknown[]) => startMock(...args),
}));

vi.mock('../../../../server/src/config/FeatureFlags.js', () => ({
  featureFlags: flags,
}));

// presentation_create capability: ADMIN/EDITOR true, VIEWER false (parytet z route).
vi.mock('../../../../server/src/services/presentationAccessPolicyService.js', () => ({
  hasPresentationCapability: (role: string, _cap: string) =>
    ['ADMIN', 'OWNER', 'EDITOR', 'MEMBER', 'SUPERADMIN'].includes(String(role).toUpperCase()),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { generateDeliverable } from '../../../../server/src/services/ai/tools/generateDeliverable.js';

const baseCtx = {
  organizationId: 'org-1',
  userId: 'user-1',
  conversationId: 'conv-1',
  language: 'pl',
  role: 'ADMIN',
};

beforeEach(() => {
  planMock.mockReset();
  startMock.mockReset();
  flags.ENABLE_DELIVERABLES_LIGHT = true;
  planMock.mockResolvedValue({ generationId: 'gen-123', format: 'doc', state: 'plan_ready' });
  startMock.mockResolvedValue({ generationId: 'gen-123', format: 'doc', state: 'generating' });
});

describe('generate_deliverable tool (SPEC_01 Tryb A)', () => {
  it('maps document → doc, plans+starts, emits onDeliverable with generationId', async () => {
    const emitted: any[] = [];
    const res = await generateDeliverable(
      { type: 'document', intent: 'Plan wdrożenia AI dla Apatora', title: 'Plan AI' },
      { ...baseCtx, onDeliverable: (p) => emitted.push(p) }
    );

    expect(res.ok).toBe(true);
    expect(res.generationId).toBe('gen-123');
    expect(res.kind).toBe('doc');

    // plan() dostał format doc + intent + conversationId w setupie
    expect(planMock).toHaveBeenCalledTimes(1);
    const planArg = planMock.mock.calls[0][0];
    expect(planArg.format).toBe('doc');
    expect(planArg.organizationId).toBe('org-1');
    expect((planArg.setup as any).conversationId).toBe('conv-1');

    // start() odpalony (generacja w tle)
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(startMock.mock.calls[0][0].generationId).toBe('gen-123');

    // most do frontu
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ draftId: 'gen-123', kind: 'doc', format: 'doc' });
  });

  it('maps sheet → sheet and presentation → deck with a default deck setup', async () => {
    planMock.mockResolvedValue({ generationId: 'gen-s', format: 'sheet', state: 'plan_ready' });
    const sheet = await generateDeliverable({ type: 'sheet', intent: 'Tabela kosztów' }, baseCtx);
    expect(sheet.ok).toBe(true);
    expect(planMock.mock.calls[0][0].format).toBe('sheet');

    planMock.mockResolvedValue({ generationId: 'gen-d', format: 'deck', state: 'plan_ready' });
    const deck = await generateDeliverable(
      { type: 'presentation', intent: 'Deck dla zarządu' },
      baseCtx
    );
    expect(deck.ok).toBe(true);
    const deckSetup = planMock.mock.calls[1][0].setup as any;
    expect(planMock.mock.calls[1][0].format).toBe('deck');
    // DeckSetup wymaga enumów — domyślne muszą być obecne
    expect(deckSetup.title).toBeTruthy();
    expect(deckSetup.language).toBe('pl');
    expect(deckSetup.audience).toBe('executive');
    expect(deckSetup.goal).toBe('inform');
  });

  it('refuses when the deliverables-light flag is OFF (no fake success)', async () => {
    flags.ENABLE_DELIVERABLES_LIGHT = false;
    const res = await generateDeliverable({ type: 'document', intent: 'x' }, baseCtx);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('feature_disabled');
    expect(planMock).not.toHaveBeenCalled();
  });

  it('refuses for VIEWER role (capability gate parity with the route)', async () => {
    const res = await generateDeliverable(
      { type: 'document', intent: 'x' },
      { ...baseCtx, role: 'VIEWER' }
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe('permission_denied');
    expect(planMock).not.toHaveBeenCalled();
  });

  it('returns ok:false (never a fake confirmation) when planning throws', async () => {
    planMock.mockRejectedValue(new Error('LLM down'));
    const emitted: any[] = [];
    const res = await generateDeliverable(
      { type: 'document', intent: 'x' },
      { ...baseCtx, onDeliverable: (p) => emitted.push(p) }
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe('generation_failed');
    expect(emitted).toHaveLength(0);
  });

  it('still mounts the skeleton if background start fails (start error is non-fatal)', async () => {
    startMock.mockRejectedValue(new Error('start race'));
    const emitted: any[] = [];
    const res = await generateDeliverable(
      { type: 'document', intent: 'x' },
      { ...baseCtx, onDeliverable: (p) => emitted.push(p) }
    );
    expect(res.ok).toBe(true);
    expect(emitted).toHaveLength(1);
  });
});
