export interface PresentationApprovalVersion {
  deck_id: string;
  version: number | string;
}

/**
 * Approval belongs to an immutable presentation version, not to the mutable
 * deck identity. The presentation API and export policy both use the numeric
 * `presentation_decks.version`; using `updated_at` here would create a second,
 * incompatible approval identity on the client.
 */
export function presentationVersionApprovalId(deck: PresentationApprovalVersion): string {
  return `${deck.deck_id}@${deck.version}`;
}
