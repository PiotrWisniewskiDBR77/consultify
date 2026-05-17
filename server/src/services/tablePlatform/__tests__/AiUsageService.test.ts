/**
 * Unit tests for AiUsageService (Block C · Sprint C-S1).
 *
 * Covers:
 *   1. consume() success path → soft + audit row.
 *   2. consume() trips soft warn at 70%.
 *   3. consume() blocks hard cap → AiBudgetExhaustedError + hard_cap_429 audit.
 *   4. consume() validates positive integer inputs.
 *   5. consume() persists 'error' audit row on DB error.
 *   6. getSnapshot() returns BudgetSnapshot.
 *   7. getSnapshot() reflects soft-warn threshold.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery, mockLoggerError } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));
vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

import aiUsageService, { AiBudgetExhaustedError } from '../AiUsageService.js';

const WS = 'ws-A';
const ACTOR = 'user-1';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AiUsageService.consume', () => {
  it('1) success: returns success status, writes one audit row', async () => {
    // First call = atomic upsert+update; second call = audit insert.
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ tokens_used_today: 1500, ai_daily_token_budget: 2000000, previous_used: 0 }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const out = await aiUsageService.consume({
      workspaceId: WS,
      surface: 'ai_editor',
      level: 'cell',
      actorUserId: ACTOR,
      tokensInput: 500,
      tokensOutput: 1000,
      model: 'gpt-test',
    });

    expect(out.status).toBe('success');
    expect(out.softWarn).toBe(false);
    expect(out.tokensUsedToday).toBe(1500);
    expect(out.budget).toBe(2_000_000);

    const insertCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO tp_ai_usage')
    );
    expect(insertCall).toBeTruthy();
    const params = insertCall![1] as unknown[];
    // status param at position 9 (1-indexed), arr index 8
    expect(params[8]).toBe('success');
    // tokens_input at index 5, tokens_output at index 6
    expect(params[5]).toBe(500);
    expect(params[6]).toBe(1000);
  });

  it('2) soft_warn: when usage crosses 70% threshold', async () => {
    // budget 1000, previous_used 600, total 200 → 800 / 1000 = 80% (>= 70%)
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ tokens_used_today: 800, ai_daily_token_budget: 1000, previous_used: 600 }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const out = await aiUsageService.consume({
      workspaceId: WS,
      surface: 'ai_editor',
      level: 'cell',
      actorUserId: ACTOR,
      tokensInput: 100,
      tokensOutput: 100,
      model: 'gpt-test',
    });

    expect(out.softWarn).toBe(true);
    expect(out.status).toBe('soft_warn');

    const insertCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO tp_ai_usage')
    );
    const params = insertCall![1] as unknown[];
    expect(params[8]).toBe('soft_warn');
  });

  it('2b) does NOT trip soft_warn when previous_used was already above threshold', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ tokens_used_today: 900, ai_daily_token_budget: 1000, previous_used: 800 }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const out = await aiUsageService.consume({
      workspaceId: WS,
      surface: 'ai_editor',
      level: 'record',
      actorUserId: ACTOR,
      tokensInput: 50,
      tokensOutput: 50,
      model: 'gpt-test',
    });

    expect(out.softWarn).toBe(false);
    expect(out.status).toBe('success');
  });

  it('3) hard cap: throws AiBudgetExhaustedError + writes hard_cap_429 audit', async () => {
    // Empty rows from atomic update = budget would be exceeded.
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    await expect(
      aiUsageService.consume({
        workspaceId: WS,
        surface: 'ai_editor',
        level: 'column',
        actorUserId: ACTOR,
        tokensInput: 999_999,
        tokensOutput: 999_999,
        model: 'gpt-test',
      })
    ).rejects.toBeInstanceOf(AiBudgetExhaustedError);

    const insertCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO tp_ai_usage')
    );
    expect(insertCall).toBeTruthy();
    const params = insertCall![1] as unknown[];
    expect(params[5]).toBe(0); // tokens_input zeroed
    expect(params[6]).toBe(0); // tokens_output zeroed
    expect(params[8]).toBe('hard_cap_429');
    expect(params[9]).toBe('AI_BUDGET_EXHAUSTED');
  });

  it('3b) hard cap error has retryAfterSeconds <= 24h', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    try {
      await aiUsageService.consume({
        workspaceId: WS,
        surface: 'ai_editor',
        level: 'cell',
        actorUserId: ACTOR,
        tokensInput: 9_999_999,
        tokensOutput: 0,
        model: 'gpt-test',
      });
      throw new Error('expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(AiBudgetExhaustedError);
      const err = e as AiBudgetExhaustedError;
      expect(err.code).toBe('AI_BUDGET_EXHAUSTED');
      expect(err.status).toBe(429);
      expect(err.retryAfterSeconds).toBeGreaterThan(0);
      expect(err.retryAfterSeconds).toBeLessThanOrEqual(86400);
    }
  });

  it('4) rejects negative or non-integer tokens', async () => {
    await expect(
      aiUsageService.consume({
        workspaceId: WS,
        surface: 'ai_editor',
        actorUserId: ACTOR,
        tokensInput: -1,
        tokensOutput: 0,
        model: 'gpt-test',
      })
    ).rejects.toThrow(/non-negative integer/);

    await expect(
      aiUsageService.consume({
        workspaceId: WS,
        surface: 'ai_editor',
        actorUserId: ACTOR,
        tokensInput: 0.5,
        tokensOutput: 0,
        model: 'gpt-test',
      })
    ).rejects.toThrow(/non-negative integer/);
  });

  it('4b) rejects empty workspaceId / actorUserId / model', async () => {
    await expect(
      aiUsageService.consume({
        workspaceId: '',
        surface: 'ai_editor',
        actorUserId: ACTOR,
        tokensInput: 0,
        tokensOutput: 0,
        model: 'gpt-test',
      })
    ).rejects.toThrow(/workspaceId/);

    await expect(
      aiUsageService.consume({
        workspaceId: WS,
        surface: 'ai_editor',
        actorUserId: '',
        tokensInput: 0,
        tokensOutput: 0,
        model: 'gpt-test',
      })
    ).rejects.toThrow(/actorUserId/);

    await expect(
      aiUsageService.consume({
        workspaceId: WS,
        surface: 'ai_editor',
        actorUserId: ACTOR,
        tokensInput: 0,
        tokensOutput: 0,
        model: '',
      })
    ).rejects.toThrow(/model/);
  });

  it('5) on DB error: writes "error" audit and re-throws', async () => {
    mockQuery
      // Atomic upsert throws.
      .mockRejectedValueOnce(new Error('connection lost'))
      // The error-audit insert succeeds.
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      aiUsageService.consume({
        workspaceId: WS,
        surface: 'ai_editor',
        actorUserId: ACTOR,
        tokensInput: 100,
        tokensOutput: 100,
        model: 'gpt-test',
      })
    ).rejects.toThrow(/connection lost/);

    const insertCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO tp_ai_usage')
    );
    expect(insertCall).toBeTruthy();
    const params = insertCall![1] as unknown[];
    expect(params[8]).toBe('error');
    expect(params[9]).toBe('DB_ERROR');
  });
});

describe('AiUsageService.getSnapshot', () => {
  it('6) returns BudgetSnapshot fields', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          ai_daily_token_budget: 1000,
          tokens_used_today: 250,
          last_reset_at: '2026-05-08T00:00:00Z',
        },
      ],
    });

    const snap = await aiUsageService.getSnapshot(WS);
    expect(snap.workspaceId).toBe(WS);
    expect(snap.budget).toBe(1000);
    expect(snap.tokensUsedToday).toBe(250);
    expect(snap.remaining).toBe(750);
    expect(snap.softWarnThreshold).toBe(700);
    expect(snap.softWarnTripped).toBe(false);
  });

  it('7) flags softWarnTripped when used >= 70%', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          ai_daily_token_budget: 1000,
          tokens_used_today: 700,
          last_reset_at: '2026-05-08T00:00:00Z',
        },
      ],
    });

    const snap = await aiUsageService.getSnapshot(WS);
    expect(snap.softWarnTripped).toBe(true);
    expect(snap.remaining).toBe(300);
  });

  it('7b) rejects empty workspaceId', async () => {
    await expect(aiUsageService.getSnapshot('')).rejects.toThrow(/workspaceId/);
  });
});
