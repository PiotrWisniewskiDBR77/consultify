import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
const mockRun = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => mockGet(...args),
  run: (...args: unknown[]) => mockRun(...args),
}));

const { applyApprovedPresentationTeresaEdit, PresentationTeresaBridgeError } = await import(
  '../presentationTeresaBridgeService.js'
);

const deck = {
  deck_id: 'deck-1',
  title: 'Board deck',
  cards: [
    {
      card_id: 'slide-1',
      title: 'Summary',
      is_locked: false,
      blocks: [{ block_id: 'b1', content: { text: 'A'.repeat(240) } }],
    },
    {
      card_id: 'slide-2',
      title: 'Decision',
      is_locked: true,
      blocks: [{ block_id: 'b2', content: { text: 'B'.repeat(240) } }],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({
    id: 'deck-1',
    title: 'Board deck',
    version: 12,
    deck_json: JSON.stringify(deck),
  });
  mockRun.mockResolvedValue({ success: true, changes: 1 });
});

describe('presentationTeresaBridgeService', () => {
  it('atomically snapshots and applies an approved edit while preserving locked slides', async () => {
    const result = await applyApprovedPresentationTeresaEdit({
      deckId: 'deck-1',
      organizationId: 'org-1',
      userId: 'user-1',
      instruction: 'Make the whole deck concise',
      expectedVersion: 12,
      language: 'en',
    });

    expect(result).toMatchObject({
      deckId: 'deck-1',
      versionBefore: 12,
      versionAfter: 13,
      skippedLockedSlides: [2],
    });
    expect(mockRun.mock.calls[0][0]).toBe('BEGIN TRANSACTION');
    expect(mockRun.mock.calls.some((call) => String(call[0]).includes('presentation_deck_versions'))).toBe(true);
    expect(mockRun.mock.calls.some((call) => String(call[0]).includes('presentation_ai_operations'))).toBe(true);
    const update = mockRun.mock.calls.find((call) =>
      String(call[0]).includes('UPDATE presentation_decks')
    );
    expect(update?.[1]).toEqual(expect.arrayContaining(['deck-1', 'org-1', 12]));
    expect(mockRun.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('fails before writing when the attached version is stale', async () => {
    await expect(
      applyApprovedPresentationTeresaEdit({
        deckId: 'deck-1',
        organizationId: 'org-1',
        userId: 'user-1',
        instruction: 'Make the deck concise',
        expectedVersion: 11,
      })
    ).rejects.toMatchObject({ code: 'P08_PRESENTATION_VERSION_CONFLICT' });
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('rolls back when compare-and-swap loses a concurrent update', async () => {
    mockRun.mockImplementation(async (sql: string) => ({
      success: true,
      changes: sql.includes('UPDATE presentation_decks') ? 0 : 1,
    }));

    await expect(
      applyApprovedPresentationTeresaEdit({
        deckId: 'deck-1',
        organizationId: 'org-1',
        userId: 'user-1',
        instruction: 'Make the deck concise',
        expectedVersion: 12,
      })
    ).rejects.toBeInstanceOf(PresentationTeresaBridgeError);
    expect(mockRun.mock.calls.at(-1)?.[0]).toBe('ROLLBACK');
  });
});
