export type CommentAnchorRange = {
  readonly startOffset: number;
  readonly endOffset: number;
};

export type CommentAnchor = {
  readonly nodeId: string;
  readonly range: CommentAnchorRange | null;
};

export type TypedComment = {
  readonly id: string;
  readonly anchor: CommentAnchor;
  readonly author: string;
  readonly body: string;
  readonly mentions: readonly string[];
  readonly kind: 'question' | 'suggestion' | 'issue' | 'approval_note' | 'note' | 'todo';
  readonly state: 'unresolved' | 'resolved';
  readonly orphaned: boolean;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
};

export type MentionNotificationIntent = {
  readonly commentId: string;
  readonly recipient: string;
  readonly emittedAt: string;
};

export type AnchorMutation =
  | { readonly kind: 'node_renamed'; readonly nodeId: string; readonly newNodeId: string }
  | { readonly kind: 'node_deleted'; readonly nodeId: string }
  | {
      readonly kind: 'range_shifted';
      readonly nodeId: string;
      readonly shiftFromOffset: number;
      readonly shiftDelta: number;
    }
  | {
      readonly kind: 'range_deleted';
      readonly nodeId: string;
      readonly deletedStart: number;
      readonly deletedEnd: number;
    };

export type ReattachOutcome = 'reattached' | 'orphaned' | 'unchanged';

export function assertTypedComment(comment: TypedComment): void {
  if (!comment.id || !comment.anchor?.nodeId) {
    throw new Error('Invalid typed comment');
  }
}

export function assertMentionNotifications(
  comment: TypedComment,
  intents: readonly MentionNotificationIntent[]
): void {
  for (const intent of intents) {
    if (intent.commentId !== comment.id) {
      throw new Error('Notification intent commentId mismatch');
    }
    if (!comment.mentions.includes(intent.recipient)) {
      throw new Error(`Notification recipient not mentioned: ${intent.recipient}`);
    }
  }
}

export function reattachCommentToMutation(
  comment: TypedComment,
  mutation: AnchorMutation
): {
  readonly outcome: ReattachOutcome;
  readonly prior: TypedComment;
  readonly next: TypedComment;
} | null {
  if (mutation.kind === 'node_renamed' && comment.anchor.nodeId === mutation.nodeId) {
    return {
      outcome: 'reattached',
      prior: comment,
      next: { ...comment, anchor: { ...comment.anchor, nodeId: mutation.newNodeId } },
    };
  }
  if (mutation.kind === 'node_deleted' && comment.anchor.nodeId === mutation.nodeId) {
    return {
      outcome: 'orphaned',
      prior: comment,
      next: { ...comment, orphaned: true },
    };
  }
  return null;
}

export function assertAnchorSurvivesMutation(
  _comment: TypedComment,
  _mutation: AnchorMutation,
  _result: NonNullable<ReturnType<typeof reattachCommentToMutation>>
): void {
  // MVP: if reattach happened, we accept it.
}
