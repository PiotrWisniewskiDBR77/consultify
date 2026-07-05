/**
 * nodeComments — pure helpers for Process Flow node comment threads
 * (M07 F5b B3).
 *
 * Mind Map's `NodeCommentThread` persists via a dedicated server API
 * (`Api.getNodeComments`/`addNodeComment`/`deleteNodeComment`), which is a
 * different persistence contract than what this spec requires for Process
 * Flow: comments live in `node.data.comments[]` and ride the existing graph
 * blob (F4's externalRuntime / legacy sync) — no new API surface, no changes
 * to the F3/F4 save layer. That contract mismatch (not a missing prop or
 * a file-edit need) is why B3 uses a local copy instead of importing
 * NodeCommentThread directly (see spec decision in IdeaProcessFlowTool.tsx).
 *
 * Kept DOM-free so the append/remove/mention-extraction logic is unit
 * testable (tests/unit/mywork/processFlowNodeComments.test.ts).
 */

export interface ProcessFlowNodeComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  mentions?: string[];
}

/** Extract `@name` mentions from raw comment text. */
export function extractMentions(text: string): string[] {
  const matches = text.match(/@(\w+)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}

/** Build a new comment record (client-generated id — blob storage has no
 * server round-trip to assign one). */
export function buildProcessFlowComment(author: string, text: string): ProcessFlowNodeComment {
  const trimmed = text.trim();
  return {
    id: `pf-comment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    author,
    text: trimmed,
    createdAt: new Date().toISOString(),
    mentions: extractMentions(trimmed),
  };
}

/** Append a comment to a node's existing comments array (immutable). */
export function appendComment(
  existing: ProcessFlowNodeComment[] | undefined,
  comment: ProcessFlowNodeComment
): ProcessFlowNodeComment[] {
  return [...(existing || []), comment];
}

/** Remove a comment by id (immutable). */
export function removeComment(
  existing: ProcessFlowNodeComment[] | undefined,
  commentId: string
): ProcessFlowNodeComment[] {
  return (existing || []).filter((c) => c.id !== commentId);
}
