export const REVIEW_EVENTS = [
  'submit_for_review',
  'reject',
  'approve',
  'publish',
  'archive',
] as const;

export type ReviewEvent = (typeof REVIEW_EVENTS)[number];

export type ReviewState = 'draft' | 'ready_for_review' | 'rejected' | 'approved' | 'published' | 'archived';

export function nextReviewState(current: ReviewState, event: ReviewEvent): ReviewState {
  switch (event) {
    case 'submit_for_review':
      return current === 'draft' ? 'ready_for_review' : current;
    case 'reject':
      return 'rejected';
    case 'approve':
      return 'approved';
    case 'publish':
      return 'published';
    case 'archive':
      return 'archived';
  }
}

