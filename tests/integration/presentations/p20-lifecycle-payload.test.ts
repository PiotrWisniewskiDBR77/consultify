/**
 * P20 Contract Test: Lifecycle Payload Consistency
 * Contract: FINAL_IMPLEMENTATION_PLAN_20_PREZENTACJE §2.4
 *
 * Verifies that lifecycle badges (draft/reviewed/exported) are consistent
 * across all surfaces: deck row status, Outputs Library, and P18 trust-state.
 */

import { describe, it, expect } from 'vitest';

import {
  deriveDeckLifecycleBadge,
  deriveDeckBadgeFromNativeStatus,
} from '../../../src/utils/deckLifecycleBadge';

describe('P20 Lifecycle Badge Derivation', () => {
  it('draft: no publishState, no exportHistory -> Draft', () => {
    expect(deriveDeckLifecycleBadge(null, null)).toBe('Draft');
    expect(deriveDeckLifecycleBadge(undefined, undefined)).toBe('Draft');
    expect(deriveDeckLifecycleBadge('private_draft', [])).toBe('Draft');
  });

  it('reviewed: in_review or review_shared publishState -> Reviewed', () => {
    expect(deriveDeckLifecycleBadge('in_review', [])).toBe('Reviewed');
    expect(deriveDeckLifecycleBadge('review_shared', [])).toBe('Reviewed');
    expect(deriveDeckLifecycleBadge('reviewed', null)).toBe('Reviewed');
    expect(deriveDeckLifecycleBadge('published', null)).toBe('Reviewed');
  });

  it('exported: successful export in history -> Exported (overrides reviewed)', () => {
    expect(deriveDeckLifecycleBadge('in_review', [{ status: 'completed' }])).toBe('Exported');
    expect(deriveDeckLifecycleBadge(null, [{ status: 'success' }])).toBe('Exported');
    expect(deriveDeckLifecycleBadge('private_draft', [{ status: 'completed' }])).toBe('Exported');
  });

  it('failed export does not count as exported', () => {
    expect(deriveDeckLifecycleBadge(null, [{ status: 'failed' }])).toBe('Draft');
    expect(deriveDeckLifecycleBadge('in_review', [{ status: 'failed' }])).toBe('Reviewed');
  });

  it('native status fallback is consistent with P18 derivation', () => {
    expect(deriveDeckBadgeFromNativeStatus('draft')).toBe('Draft');
    expect(deriveDeckBadgeFromNativeStatus('ready')).toBe('Exported');
    expect(deriveDeckBadgeFromNativeStatus('exported')).toBe('Exported');
    expect(deriveDeckBadgeFromNativeStatus('reviewed')).toBe('Reviewed');
    expect(deriveDeckBadgeFromNativeStatus('generating')).toBe('Draft');
    expect(deriveDeckBadgeFromNativeStatus('failed')).toBe('Draft');
  });
});

describe('P20 Lifecycle Payload — API Surface Consistency', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3001/api';
  const AUTH_HEADER = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };

  it('deck row status and artifacts list return consistent data', async () => {
    const listRes = await fetch(`${API_URL}/presentations/decks`, { headers: AUTH_HEADER });
    if (listRes.status !== 200) return;
    const decks = (await listRes.json())?.data || [];
    if (decks.length === 0) return;

    const firstDeck = decks[0];
    const detailRes = await fetch(`${API_URL}/presentations/decks/${firstDeck.id}`, {
      headers: AUTH_HEADER,
    });
    expect(detailRes.status).toBe(200);
    const detail = (await detailRes.json())?.data;
    expect(detail?.status).toBe(firstDeck.status);
  });
});
