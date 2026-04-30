import type { ProposalStatus } from '@/store/useToolStore';

export type AiCardStatusCounts = Record<ProposalStatus, number>;

export const EMPTY_AI_CARD_STATUS_COUNTS: AiCardStatusCounts = {
  'ai-proposed': 0,
  accepted: 0,
  rejected: 0,
  rethinking: 0,
};

const PROPOSAL_STATUSES = new Set<ProposalStatus>([
  'ai-proposed',
  'accepted',
  'rejected',
  'rethinking',
]);

export function countAiCardStatuses(value: unknown): AiCardStatusCounts {
  const counts: AiCardStatusCounts = { ...EMPTY_AI_CARD_STATUS_COUNTS };
  const seen = new WeakSet<object>();

  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    const record = node as Record<string, unknown>;
    const status = record.proposalStatus;
    if (typeof status === 'string' && PROPOSAL_STATUSES.has(status as ProposalStatus)) {
      counts[status as ProposalStatus] += 1;
    }

    Object.values(record).forEach(visit);
  };

  visit(value);
  return counts;
}

export function getAiReviewTotal(counts: AiCardStatusCounts): number {
  return counts['ai-proposed'] + counts.rethinking;
}

export function scrollToAiCards() {
  const target = document.querySelector('[data-ai-proposal-card="true"]');
  if (target instanceof HTMLElement) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
