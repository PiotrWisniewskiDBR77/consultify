/**
 * suggestedChanges — client contract for the additive "suggested changes" slice
 * (Formula §5 / Faza 4). When the Initiative Generator proposes a CHANGE to an
 * EXISTING initiative, it must NOT edit it directly: the change becomes a *suggested
 * change* that the owner accepts/rejects (mini-gate).
 *
 * NOTE: the backend endpoints below are TBD / guarded — they may not exist yet.
 * Every call is therefore graceful: on ANY error it degrades to a non-persisted
 * result instead of throwing, so the UI can still surface the suggestion locally.
 * This file is the client-side contract the backend should fulfill.
 */
import { Api } from '@/services/api';

export type SuggestedChangeKind = 'extend' | 'evidence' | 'conflict' | 're_prioritize';

export interface SuggestedChange {
  id?: string;
  initiativeId: string;
  kind: SuggestedChangeKind;
  title: string;
  rationale: string;
  sourceType?: string;
  sourceId?: string;
  status?: 'pending' | 'accepted' | 'rejected';
  createdAt?: string;
}

/**
 * Submit a proposed change against an existing initiative. Tries to persist via the
 * (TBD) backend endpoint; on any failure returns the change unpersisted. Never throws.
 */
export async function submitSuggestedChange(
  change: SuggestedChange
): Promise<{ persisted: boolean; change: SuggestedChange }> {
  try {
    const response = await Api.post(
      `/initiatives/${change.initiativeId}/suggested-changes`,
      change
    );
    const persistedChange =
      response && typeof response === 'object'
        ? ((response.change ?? response) as SuggestedChange)
        : change;
    return { persisted: true, change: { ...change, ...persistedChange } };
  } catch {
    return { persisted: false, change };
  }
}

/**
 * List pending/resolved suggested changes for an initiative. Accepts either a raw
 * array or an envelope of the shape { items } / { changes }. On error returns [].
 */
export async function listSuggestedChanges(initiativeId: string): Promise<SuggestedChange[]> {
  try {
    const response = await Api.get(`/initiatives/${initiativeId}/suggested-changes`);
    if (Array.isArray(response)) return response as SuggestedChange[];
    if (response && typeof response === 'object') {
      const envelope = response as { items?: unknown; changes?: unknown };
      if (Array.isArray(envelope.items)) return envelope.items as SuggestedChange[];
      if (Array.isArray(envelope.changes)) return envelope.changes as SuggestedChange[];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Resolve a suggested change (the mini-gate): accept → 'accepted', reject → 'rejected'.
 * Graceful: on any failure returns { persisted: false }. Never throws.
 */
export async function resolveSuggestedChange(
  id: string,
  accept: boolean
): Promise<{ persisted: boolean }> {
  try {
    await Api.patch(`/initiatives/suggested-changes/${id}`, {
      status: accept ? 'accepted' : 'rejected',
    });
    return { persisted: true };
  } catch {
    return { persisted: false };
  }
}
