/**
 * V8 / Wave A6 — Unified proposal lifecycle cache.
 *
 * Caches the *current* lifecycle state of chat proposals keyed by
 * `proposalId`, so the `ExecutionProposalMessage` bubble can render the
 * freshest state regardless of which message snapshot was persisted at
 * write time.
 *
 * Source of truth: the unified read endpoint
 *   GET /api/ai/conversations/:id/proposals
 *
 * Callers:
 *   - `UnifiedChatPanel` seeds the cache when a conversation loads / switches.
 *   - `handleProposalApprove/Reject` patches the cache on optimistic success.
 *   - `ExecutionProposalMessage` consumes the cache as the primary lifecycle
 *     state, falling back to the metadata snapshot when absent.
 *
 * Design notes:
 *   - Tiny footprint: only what the chat surface needs at render time.
 *   - Never used as a write authority — all mutations still flow through the
 *     approve/reject/execute API endpoints.
 */

import { create } from 'zustand';

import Api from '../services/api';
import type { ChatProposalView, V8LifecycleState } from '../types/domain/ai';

interface CachedProposal {
  proposalId: string;
  conversationId: string;
  lifecycleState: V8LifecycleState;
  actionType?: string;
  planSummary?: string;
  risk?: string;
  rejectionReason?: string | null;
  reviewer?: { userId?: string; name?: string } | null;
  latestMessageType?: ChatProposalView['latestMessageType'];
  updatedAt: string;
}

interface ProposalLifecycleStoreState {
  byProposalId: Record<string, CachedProposal>;
  loadingByConversationId: Record<string, boolean>;
  lastLoadedAtByConversationId: Record<string, number>;

  /**
   * Fetch the unified proposals list for a conversation and seed the cache.
   * Safe to call repeatedly — the previous in-flight promise is reused when
   * one already exists within the dedup window.
   */
  loadForConversation: (conversationId: string, opts?: { force?: boolean }) => Promise<void>;

  /**
   * Patch a single proposal's lifecycle state in place. Used by the chat UI
   * after a successful approve/reject so the bubble reflects the new state
   * immediately, without waiting for a reload round-trip.
   */
  patchLifecycle: (
    proposalId: string,
    patch: Partial<CachedProposal> & { lifecycleState: V8LifecycleState }
  ) => void;

  /**
   * Clear cached entries for a given conversation (e.g. on delete).
   */
  clearConversation: (conversationId: string) => void;
}

const LOAD_DEDUP_WINDOW_MS = 2000;

const inflight = new Map<string, Promise<void>>();

export const useProposalLifecycleStore = create<ProposalLifecycleStoreState>((set, get) => ({
  byProposalId: {},
  loadingByConversationId: {},
  lastLoadedAtByConversationId: {},

  loadForConversation: async (conversationId, opts) => {
    if (!conversationId) return;
    const now = Date.now();
    const lastLoadedAt = get().lastLoadedAtByConversationId[conversationId] || 0;
    if (!opts?.force && now - lastLoadedAt < LOAD_DEDUP_WINDOW_MS) {
      return;
    }
    const existing = inflight.get(conversationId);
    if (existing) return existing;

    const promise = (async () => {
      set((state) => ({
        loadingByConversationId: {
          ...state.loadingByConversationId,
          [conversationId]: true,
        },
      }));
      try {
        const res: any = await Api.getConversationProposals(conversationId);
        const proposals: ChatProposalView[] = Array.isArray(res?.proposals) ? res.proposals : [];
        set((state) => {
          const next = { ...state.byProposalId };
          for (const p of proposals) {
            next[p.proposalId] = {
              proposalId: p.proposalId,
              conversationId: p.conversationId,
              lifecycleState: p.lifecycleState,
              actionType: p.actionType,
              planSummary: p.planSummary,
              risk: p.risk,
              rejectionReason: p.rejectionReason ?? null,
              reviewer: p.reviewer ?? null,
              latestMessageType: p.latestMessageType,
              updatedAt: p.updatedAt || p.createdAt,
            };
          }
          return {
            byProposalId: next,
            lastLoadedAtByConversationId: {
              ...state.lastLoadedAtByConversationId,
              [conversationId]: Date.now(),
            },
            loadingByConversationId: {
              ...state.loadingByConversationId,
              [conversationId]: false,
            },
          };
        });
      } catch (err) {
        console.error('[useProposalLifecycleStore] loadForConversation failed', err);
        set((state) => ({
          loadingByConversationId: {
            ...state.loadingByConversationId,
            [conversationId]: false,
          },
        }));
      } finally {
        inflight.delete(conversationId);
      }
    })();

    inflight.set(conversationId, promise);
    return promise;
  },

  patchLifecycle: (proposalId, patch) => {
    if (!proposalId) return;
    set((state) => {
      const existing = state.byProposalId[proposalId];
      const updated: CachedProposal = {
        proposalId,
        conversationId: existing?.conversationId || patch.conversationId || '',
        lifecycleState: patch.lifecycleState,
        actionType: patch.actionType ?? existing?.actionType,
        planSummary: patch.planSummary ?? existing?.planSummary,
        risk: patch.risk ?? existing?.risk,
        rejectionReason: patch.rejectionReason ?? existing?.rejectionReason ?? null,
        reviewer: patch.reviewer ?? existing?.reviewer ?? null,
        latestMessageType: patch.latestMessageType ?? existing?.latestMessageType,
        updatedAt: new Date().toISOString(),
      };
      return {
        byProposalId: {
          ...state.byProposalId,
          [proposalId]: updated,
        },
      };
    });
  },

  clearConversation: (conversationId) => {
    if (!conversationId) return;
    set((state) => {
      const next: Record<string, CachedProposal> = {};
      for (const [id, entry] of Object.entries(state.byProposalId)) {
        if (entry.conversationId !== conversationId) next[id] = entry;
      }
      const nextLoading = { ...state.loadingByConversationId };
      delete nextLoading[conversationId];
      const nextLoaded = { ...state.lastLoadedAtByConversationId };
      delete nextLoaded[conversationId];
      return {
        byProposalId: next,
        loadingByConversationId: nextLoading,
        lastLoadedAtByConversationId: nextLoaded,
      };
    });
  },
}));

/**
 * Convenience selector for a single proposal's fresh lifecycle state.
 */
export function useProposalLifecycle(proposalId: string | null | undefined) {
  return useProposalLifecycleStore((s) => (proposalId ? s.byProposalId[proposalId] : undefined));
}
