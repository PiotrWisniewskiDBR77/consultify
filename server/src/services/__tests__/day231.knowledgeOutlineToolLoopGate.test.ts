import { describe, expect, it, vi } from 'vitest';

// FIX-5 (ODBIOR_231, P1): `ENABLE_DECK_FROM_KNOWLEDGE=true` alone used to
// reach AIPipeline, get no tools (AIPipeline.ts:466 also needs
// `ENABLE_TERESA_TOOL_LOOP`), fail the search-not-called guard, and surface a
// bare HTTP 500 to every caller. `generateKnowledgeOutline` must now fail
// fast with a clear, distinguishable error BEFORE calling the model.

const processMock = vi.fn();
vi.mock('../ai/AIPipeline.js', () => ({
  AIPipeline: { getInstance: () => ({ process: (...args: unknown[]) => processMock(...args) }) },
}));
vi.mock('../ai/toolDefinitions.js', () => ({ executeToolCall: vi.fn() }));
vi.mock('../../config/FeatureFlags.js', () => ({
  default: { ENABLE_TERESA_TOOL_LOOP: false },
}));

const { generateKnowledgeOutline } = await import('../presentationKnowledgeOutlineService.js');
const { AppError } = await import('../../utils/ErrorHandler.js');

describe('Day231 FIX-5 — clear error, not a bare 500, when ENABLE_TERESA_TOOL_LOOP is off', { retry: 0 }, () => {
  it('rejects with a distinguishable AppError before ever calling AIPipeline', async () => {
    await expect(
      generateKnowledgeOutline({
        organizationId: 'org-1',
        userId: 'user-1',
        title: 'T',
        audience: 'executive',
        goal: 'decide',
        language: 'pl',
      })
    ).rejects.toMatchObject({
      code: 'DECK_FROM_KNOWLEDGE_TOOL_LOOP_DISABLED',
      statusCode: 409,
    });
    expect(processMock).not.toHaveBeenCalled();
  });

  it('the rejected error is an operational AppError (4xx, not an unhandled 500)', async () => {
    try {
      await generateKnowledgeOutline({
        organizationId: 'org-1',
        userId: 'user-1',
        title: 'T',
        audience: 'executive',
        goal: 'decide',
        language: 'pl',
      });
      throw new Error('expected generateKnowledgeOutline to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as InstanceType<typeof AppError>).isOperational).toBe(true);
      expect((error as InstanceType<typeof AppError>).statusCode).toBeLessThan(500);
    }
  });
});
