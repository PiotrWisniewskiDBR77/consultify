import React from 'react';

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';

/**
 * CommentPinBadge — shared comment-count indicator for whiteboard nodes.
 *
 * Renders a small circular badge showing how many comments a node has, and on
 * click opens the shared IdeaNodeDetailDrawer via the registered action
 * `idea.node.wb_open_detail` (N-inventory-c5, 2026-08-10 — was a raw
 * `idea-node-open-detail` CustomEvent dispatch bypassing the registry; the
 * action's handler dispatches the IDENTICAL event/detail shape, so this is a
 * pure routing change, zero behavior change). `ideaId: ''` matches the
 * established pattern for leaf components with no idea-id in scope (see e.g.
 * `WhiteboardToolbar.tsx`/`ProcessFlowToolbar.tsx` context-menu call sites) —
 * this action's real effect (dispatching the window event) never reads it.
 * The badge is intentionally invisible when there are no comments so it never
 * adds clutter to nodes without discussion.
 *
 * Visual treatment is copied verbatim from the original StickyNoteNode badge so
 * every node type reads identically.
 */
export interface CommentPinBadgeProps {
  /** The ReactFlow node id — used to target the detail drawer. */
  nodeId: string;
  /** Number of comments on the node. Badge only renders when > 0. */
  count: number;
  /**
   * Optional override for the absolute position classes. Defaults to the
   * sticky-note placement (`-top-2 -right-2`). ImageNode / LinkNode clip their
   * overflow, so they nudge the badge inward.
   */
  positionClassName?: string;
}

export const CommentPinBadge: React.FC<CommentPinBadgeProps> = ({
  nodeId,
  count,
  positionClassName = '-top-2 -right-2',
}) => {
  if (!count || count <= 0) return null;

  return (
    <div
      data-testid="comment-pin-badge"
      className={`absolute ${positionClassName} z-10 flex items-center justify-center w-5 h-5 rounded-full bg-c-info text-white text-[8px] font-bold shadow-sm cursor-pointer hover:brightness-110 transition-all`}
      onClick={(e) => {
        e.stopPropagation();
        const ctx: ActionContext = {
          ideaId: '',
          tool: 'whiteboard',
          selection: { type: 'node', count: 1, ids: [nodeId], primaryId: nodeId },
          surface: 'inline',
          source: 'ui',
          params: { nodeId },
        };
        void runIdeaAction('idea.node.wb_open_detail', ctx);
      }}
      title={`${count} comment${count !== 1 ? 's' : ''}`}
    >
      {count}
    </div>
  );
};

/** Shared helper: derive comment count from a node's data payload. */
export const commentCountOf = (data: unknown): number => {
  const comments = (data as { comments?: unknown })?.comments;
  return Array.isArray(comments) ? comments.length : 0;
};

export default CommentPinBadge;
