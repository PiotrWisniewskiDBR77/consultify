/**
 * whiteboardNodeComments — pure helpers for Whiteboard node comment threads.
 *
 * Mirrors Process Flow's `nodeComments.ts` (M07 F5b B3) 1:1 in persistence
 * contract: comments live in `node.data.comments[]` and ride the existing
 * whiteboard graph blob (setNodes → onGraphChange → PUT /map autosave). No new
 * server API surface, no changes to the map save layer.
 *
 * This is deliberately NOT Mind Map's `NodeCommentThread` contract (dedicated
 * `idea_node_comments` table via `Api.*NodeComment*`). The whiteboard already
 * autosaves its whole node graph on every mutation, so the blob route is the
 * cheapest identical-to-Process-Flow path — comments become just another field
 * on `node.data`, persisted and shared (canonical `my_idea_maps` row) for free.
 *
 * Kept DOM-free so append/remove/mention-extraction stays unit-testable.
 */

export interface WhiteboardNodeComment {
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
export function buildWhiteboardComment(author: string, text: string): WhiteboardNodeComment {
  const trimmed = text.trim();
  return {
    id: `wb-comment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    author,
    text: trimmed,
    createdAt: new Date().toISOString(),
    mentions: extractMentions(trimmed),
  };
}

/** Read a node's comments array defensively (blob may be undefined/legacy). */
export function readComments(data: unknown): WhiteboardNodeComment[] {
  const comments = (data as { comments?: unknown } | null | undefined)?.comments;
  return Array.isArray(comments) ? (comments as WhiteboardNodeComment[]) : [];
}

/** Append a comment to a node's existing comments array (immutable). */
export function appendComment(
  existing: WhiteboardNodeComment[] | undefined,
  comment: WhiteboardNodeComment
): WhiteboardNodeComment[] {
  return [...(existing || []), comment];
}

/** Remove a comment by id (immutable). */
export function removeComment(
  existing: WhiteboardNodeComment[] | undefined,
  commentId: string
): WhiteboardNodeComment[] {
  return (existing || []).filter((c) => c.id !== commentId);
}
