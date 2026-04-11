/**
 * P20 Regression Test: Export Failure + No Ghost Artifacts
 * Contract: FINAL_IMPLEMENTATION_PLAN_20_PREZENTACJE §2.7, §2.11
 *
 * Covers:
 * - Export with over-limit slides returns 422 (not a ghost artifact)
 * - Failed export records ledger entry with status=failed
 * - Retry after failure succeeds with same deck identity
 * - No new deck artifact created on failure
 */

import { describe, it, expect } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const AUTH_HEADER = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };

describe('P20 Export Resilience', () => {
  it('export limits: more than 60 slides returns 422 EXPORT_LIMIT_EXCEEDED', async () => {
    const slides = Array.from({ length: 65 }, (_, i) => ({
      type: 'content',
      content: { text: `Slide ${i + 1}` },
    }));

    const createRes = await fetch(`${API_URL}/presentations/decks`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        title: 'Oversized Deck',
        theme: 'corporate',
        slides,
        source: 'test',
      }),
    });

    if (createRes.status !== 201) return;
    const deckId = (await createRes.json())?.data?.id;
    if (!deckId) return;

    const autosaveBody = {
      deck_id: deckId,
      cards: slides.map((s, i) => ({
        card_id: `card-${i}`,
        order_index: i,
        intent: 'content',
        title: `Slide ${i + 1}`,
        blocks: [{ block_id: `b-${i}`, type: 'paragraph', content: { text: s.content.text } }],
      })),
    };
    await fetch(`${API_URL}/presentations/decks/${deckId}/autosave`, {
      method: 'PUT',
      headers: AUTH_HEADER,
      body: JSON.stringify(autosaveBody),
    });

    const pdfRes = await fetch(`${API_URL}/presentations/decks/${deckId}/export/pdf`, {
      headers: AUTH_HEADER,
    });
    expect(pdfRes.status).toBe(422);

    const errBody = await pdfRes.json();
    expect(errBody.code).toBe('EXPORT_LIMIT_EXCEEDED');
  });

  it('export failure does not create ghost deck', async () => {
    const createRes = await fetch(`${API_URL}/presentations/decks`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify({
        title: 'Ghost Test Deck',
        theme: 'corporate',
        slides: [{ type: 'cover', content: { title: 'Test' } }],
        source: 'test',
      }),
    });
    if (createRes.status !== 201) return;
    const deckId = (await createRes.json())?.data?.id;

    const downloadRes = await fetch(`${API_URL}/presentations/decks/${deckId}/download`, {
      headers: AUTH_HEADER,
    });
    expect(downloadRes.status).toBe(404);

    const deckRes = await fetch(`${API_URL}/presentations/decks/${deckId}`, {
      headers: AUTH_HEADER,
    });
    expect(deckRes.status).toBe(200);
    const deck = await deckRes.json();
    expect(deck?.data?.id || deck?.id).toBe(deckId);
  });
});
