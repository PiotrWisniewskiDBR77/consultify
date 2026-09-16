/**
 * H1b — klient skrzynki recenzenta przejść cyklu życia inicjatywy.
 *
 * Przewód do ISTNIEJĄCEGO silnika, zero własnej logiki decyzyjnej:
 *  1. odczyt  → GET  /initiatives/lifecycle-transition-proposals (H1b),
 *  2. decyzja → POST /v8/agent-proposals/:id/scopes/:scopeKey/review (A05, istniał),
 *  3. wykonanie → POST /initiatives/:id/lifecycle-transition-executions (H1, istniał).
 *
 * Krok 2 i 3 są ROZDZIELONE celowo i w tej kolejności: `executeApproved…`
 * czyta wiersz `v8_agent_proposal_scope_reviews` i odmawia
 * (`initiative_lifecycle_approved_review_required`), dopóki recenzja nie
 * została zapisana. Prowenancję maszynową (sha-256 `sourceDigest`,
 * `a05ApprovalReceiptRef`, `baselineRefs`, `idempotencyKey`) wylicza SERWER
 * z zapisanej propozycji — interfejs nie zna i nie wysyła żadnej z tych
 * wartości, bo fabrykowanie dowodu byłoby dokładnie tym, przed czym broni
 * kanoniczna tabela `initiative_lifecycle_gate_decisions`.
 */
import { apiGet, apiPost } from './api/baseClient';

export interface TransitionProposal {
  proposalVersionId: string;
  proposalId: string;
  status: string;
  initiativeId: string;
  initiativeName: string | null;
  initiativeStatus: string | null;
  transformationCaseId: string;
  fromStatus: string;
  toStatus: string;
  pmoDomain: string;
  scopeKey: string;
  reason: string | null;
  proposerUserId: string;
  proposerName: string | null;
  createdAt: string;
  expiresAt: string;
  reviewDecision: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  viewerIsReviewer: boolean;
  executable: boolean;
}

export type TransitionProposalStatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

export interface LifecycleGateDecisionLogEntry {
  decisionId: string;
  pmoDomain: string;
  version: number;
  decisionStatus: 'approved' | 'rejected';
  rationale: string;
  decidedAt: string;
  humanActorName: string | null;
}

export async function listTransitionProposals(
  status: TransitionProposalStatusFilter = 'pending'
): Promise<TransitionProposal[]> {
  const res = await apiGet<{ proposals?: TransitionProposal[] }>(
    `/initiatives/lifecycle-transition-proposals?status=${encodeURIComponent(status)}`
  );
  return res?.proposals ?? [];
}

export async function listTransitionProposalsForInitiative(
  initiativeId: string,
  status: TransitionProposalStatusFilter = 'all'
): Promise<TransitionProposal[]> {
  const res = await apiGet<{ proposals?: TransitionProposal[] }>(
    `/initiatives/${encodeURIComponent(initiativeId)}/lifecycle-transition-proposals?status=${encodeURIComponent(status)}`
  );
  return res?.proposals ?? [];
}

export async function listLifecycleGateDecisions(
  initiativeId: string
): Promise<LifecycleGateDecisionLogEntry[]> {
  const res = await apiGet<{ decisions?: LifecycleGateDecisionLogEntry[] }>(
    `/initiatives/${encodeURIComponent(initiativeId)}/lifecycle-gate-decisions`
  );
  return res?.decisions ?? [];
}

export async function requestTransitionDecision(input: {
  initiativeId: string;
  reviewerUserId: string;
  targetStatus: 'PROMOTED' | 'PLANNING' | 'SCHEDULED' | 'EXECUTING' | 'DONE';
  reason: string;
}) {
  return apiPost(
    `/initiatives/${encodeURIComponent(input.initiativeId)}/lifecycle-transition-proposals`,
    {
      reviewerUserId: input.reviewerUserId,
      targetStatus: input.targetStatus,
      reason: input.reason,
    }
  );
}

/** Krok 2 — zapis recenzji A05 (jedyny właściciel zatwierdzenia). */
async function reviewProposalScope(
  proposal: TransitionProposal,
  decision: 'approved' | 'rejected',
  reason: string
) {
  return apiPost(
    `/v8/agent-proposals/${encodeURIComponent(proposal.proposalVersionId)}/scopes/${encodeURIComponent(proposal.scopeKey)}/review`,
    { decision, reason }
  );
}

/**
 * ZATWIERDŹ = recenzja A05 → wykonanie przejścia. Gdyby drugi krok padł,
 * recenzja ZOSTAJE zapisana (propozycja jest `approved`, wiersz wróci ze
 * znacznikiem `executable`) — powtórzenie akcji dokończy przejście, zamiast
 * zaczynać od zera. Wyjątek leci dalej: wołający ma pokazać powód, nie udawać
 * sukcesu.
 */
export async function approveTransitionProposal(proposal: TransitionProposal, reason: string) {
  if (!proposal.executable) {
    await reviewProposalScope(proposal, 'approved', reason);
  }
  return apiPost(
    `/initiatives/${encodeURIComponent(proposal.initiativeId)}/lifecycle-transition-executions`,
    { proposalVersionId: proposal.proposalVersionId, reason }
  );
}

/** ODRZUĆ — wyłącznie recenzja A05; żadne przejście się nie wykonuje. */
export async function rejectTransitionProposal(proposal: TransitionProposal, reason: string) {
  return reviewProposalScope(proposal, 'rejected', reason);
}
