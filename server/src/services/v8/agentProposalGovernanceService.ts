import { AsyncLocalStorage } from 'node:async_hooks';
import { v4 as uuidv4 } from 'uuid';
import { type PgTransactionClient, withPgTransaction } from '../../utils/queryHelpers.js';

type ProposalDecision = 'approved' | 'rejected' | 'revision_requested';
type ProposalRevisionKind = 'initial' | 'revision' | 'rebaseline';
type ReviewerAuthority = Record<string, string[]>;

interface ProposalRow {
  proposal_version_id: string;
  proposal_id: string;
  organization_id: string;
  canonical_run_id: string;
  proposal_version: number;
  plan_version: number;
  context_digest: string;
  before_json: unknown;
  after_json: unknown;
  approval_scopes_json: unknown;
  reviewer_authority_json: unknown;
  expires_at: string;
  status: string;
}

interface RegisterProposalInput {
  proposalId: string;
  organizationId: string;
  canonicalRunId: string;
  planVersion: number;
  contextDigest: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  approvalScopes: string[];
  reviewerAuthorityByScope: ReviewerAuthority;
  expiresAt: string;
  actorUserId: string;
  supersedesProposalVersionId?: string;
  revisionKind?: ProposalRevisionKind;
  changeReason?: string;
}

const governanceTransaction = new AsyncLocalStorage<PgTransactionClient>();

/**
 * Bind proposal governance to a transaction already owned by the caller.
 * The caller remains responsible for BEGIN/COMMIT/ROLLBACK; every nested
 * governance operation reuses this exact pinned client and never opens a
 * second transaction.
 */
export function withProposalGovernanceClient<T>(
  client: PgTransactionClient,
  fn: () => Promise<T>
): Promise<T> {
  const existing = governanceTransaction.getStore();
  if (existing && existing !== client)
    throw new Error('proposal_governance_transaction_client_conflict');
  if (existing) return fn();
  return governanceTransaction.run(client, fn);
}

export function registerGovernedProposal(input: RegisterProposalInput) {
  return withGovernanceTransaction(() => registerGovernedProposalWithinTransaction(input));
}

export function reviewProposalScope(
  input: Parameters<typeof reviewProposalScopeWithinTransaction>[0]
) {
  return withGovernanceTransaction(() => reviewProposalScopeWithinTransaction(input));
}

export function reviseGovernedProposal(
  input: Parameters<typeof reviseGovernedProposalWithinTransaction>[0]
) {
  return withGovernanceTransaction(() => reviseGovernedProposalWithinTransaction(input));
}

export function rebaselineGovernedProposal(
  input: Parameters<typeof rebaselineGovernedProposalWithinTransaction>[0]
) {
  return withGovernanceTransaction(() => rebaselineGovernedProposalWithinTransaction(input));
}

export function assertProposalExecutable(
  input: Parameters<typeof assertProposalExecutableWithinTransaction>[0]
) {
  return withGovernanceTransaction(() => assertProposalExecutableWithinTransaction(input));
}

/**
 * Tenant-scoped governance read model for reviewer and audit surfaces.
 * A tenant mismatch is deliberately indistinguishable from a missing proposal.
 */
export function getGovernedProposalProjection(input: {
  proposalVersionId: string;
  organizationId: string;
}) {
  return withGovernanceTransaction(() => getGovernedProposalProjectionWithinTransaction(input));
}

async function getGovernedProposalProjectionWithinTransaction(input: {
  proposalVersionId: string;
  organizationId: string;
}) {
  const row = await loadProposal(input.proposalVersionId, input.organizationId);
  const reviews = await dbAll<{
    review_id: string;
    scope_key: string;
    decision: ProposalDecision;
    reason: string;
    reviewed_by_user_id: string;
    reviewed_at: string;
  }>(
    `SELECT r.review_id,r.scope_key,r.decision,r.reason,r.reviewed_by_user_id,r.reviewed_at
       FROM v8_agent_proposal_scope_reviews r
       JOIN v8_agent_proposal_versions p ON p.proposal_version_id=r.proposal_version_id
      WHERE r.proposal_version_id=? AND p.organization_id=?
      ORDER BY r.reviewed_at ASC,r.review_id ASC`,
    [input.proposalVersionId, input.organizationId]
  );
  const events = await dbAll<{
    event_id: string;
    event_type: string;
    scope_key: string | null;
    actor_user_id: string;
    reason: string;
    detail_json: unknown;
    created_at: string;
  }>(
    `SELECT event_id,event_type,scope_key,actor_user_id,reason,detail_json,created_at
       FROM v8_agent_proposal_governance_events
      WHERE proposal_version_id=? AND organization_id=?
      ORDER BY created_at ASC,event_id ASC`,
    [input.proposalVersionId, input.organizationId]
  );
  return {
    proposalVersionId: row.proposal_version_id,
    proposalId: row.proposal_id,
    canonicalRunId: row.canonical_run_id,
    proposalVersion: Number(row.proposal_version),
    planVersion: Number(row.plan_version),
    contextDigest: row.context_digest,
    before: jsonObject(row.before_json),
    after: jsonObject(row.after_json),
    approvalScopes: jsonArray(row.approval_scopes_json),
    reviewerAuthorityByScope: jsonAuthority(row.reviewer_authority_json),
    expiresAt: row.expires_at,
    status: row.status,
    reviews: reviews.map((review) => ({
      reviewId: review.review_id,
      scopeKey: review.scope_key,
      decision: review.decision,
      reason: review.reason,
      reviewedByUserId: review.reviewed_by_user_id,
      reviewedAt: review.reviewed_at,
    })),
    events: events.map((event) => ({
      eventId: event.event_id,
      eventType: event.event_type,
      scopeKey: event.scope_key,
      actorUserId: event.actor_user_id,
      reason: event.reason,
      detail: jsonObject(event.detail_json),
      createdAt: event.created_at,
    })),
  };
}

async function registerGovernedProposalWithinTransaction(input: RegisterProposalInput) {
  validateProposalInput(input);
  await dbGet(`SELECT pg_advisory_xact_lock(hashtext(?),hashtext(?)) AS locked`, [
    input.organizationId,
    input.proposalId,
  ]);
  const previous = await dbGet<{ max_version: number }>(
    `SELECT COALESCE(MAX(proposal_version),0) AS max_version FROM v8_agent_proposal_versions WHERE proposal_id=? AND organization_id=?`,
    [input.proposalId, input.organizationId]
  );
  const proposalVersion = Number(previous?.max_version || 0) + 1;
  const proposalVersionId = uuidv4();
  const revisionKind = input.revisionKind ?? 'initial';
  const reason = requiredReason(input.changeReason ?? 'Initial governed proposal');
  await executeTransaction([
    {
      sql: `INSERT INTO v8_agent_proposal_versions
        (proposal_version_id,proposal_id,organization_id,canonical_run_id,proposal_version,plan_version,
         context_digest,before_json,after_json,approval_scopes_json,reviewer_authority_json,expires_at,status,
         created_by_user_id,supersedes_proposal_version_id,revision_kind,change_reason)
       VALUES (?,?,?,?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?,'pending_review',?,?,?,?)`,
      params: [
        proposalVersionId,
        input.proposalId,
        input.organizationId,
        input.canonicalRunId,
        proposalVersion,
        input.planVersion,
        input.contextDigest,
        JSON.stringify(input.before),
        JSON.stringify(input.after),
        JSON.stringify(input.approvalScopes),
        JSON.stringify(input.reviewerAuthorityByScope),
        input.expiresAt,
        input.actorUserId,
        input.supersedesProposalVersionId ?? null,
        revisionKind,
        reason,
      ],
    },
    governanceEvent({
      proposalVersionId,
      organizationId: input.organizationId,
      eventType:
        revisionKind === 'revision'
          ? 'revised'
          : revisionKind === 'rebaseline'
            ? 'rebaselined'
            : 'registered',
      actorUserId: input.actorUserId,
      reason,
      detail: {
        proposalVersion,
        planVersion: input.planVersion,
        contextDigest: input.contextDigest,
        supersedesProposalVersionId: input.supersedesProposalVersionId ?? null,
      },
    }),
  ]);
  return { proposalVersionId, proposalVersion, status: 'pending_review' as const };
}

async function reviewProposalScopeWithinTransaction(input: {
  proposalVersionId: string;
  organizationId: string;
  scopeKey: string;
  decision: ProposalDecision;
  reason: string;
  actorUserId: string;
}) {
  const reason = requiredReason(input.reason);
  const row = await loadProposal(input.proposalVersionId, input.organizationId);
  if (!['pending_review', 'partially_approved'].includes(row.status))
    throw new Error('governed_proposal_not_reviewable');
  const scopes = jsonArray(row.approval_scopes_json);
  if (!scopes.includes(input.scopeKey)) throw new Error('proposal_scope_not_found');
  assertReviewerAuthority(row.reviewer_authority_json, input.scopeKey, input.actorUserId);
  const now = new Date().toISOString();
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await persistTerminalState(row, 'expired', 'expired', input.actorUserId, reason, now);
    throw new Error('governed_proposal_expired');
  }
  await executeTransaction([
    {
      sql: `INSERT INTO v8_agent_proposal_scope_reviews (review_id,proposal_version_id,scope_key,decision,reason,reviewed_by_user_id,reviewed_at)
            VALUES (?,?,?,?,?,?,?) ON CONFLICT (proposal_version_id,scope_key) DO UPDATE SET decision=excluded.decision,reason=excluded.reason,reviewed_by_user_id=excluded.reviewed_by_user_id,reviewed_at=excluded.reviewed_at`,
      params: [
        uuidv4(),
        input.proposalVersionId,
        input.scopeKey,
        input.decision,
        reason,
        input.actorUserId,
        now,
      ],
    },
    governanceEvent({
      proposalVersionId: input.proposalVersionId,
      organizationId: input.organizationId,
      eventType:
        input.decision === 'approved'
          ? 'scope_approved'
          : input.decision === 'rejected'
            ? 'scope_rejected'
            : 'revision_requested',
      scopeKey: input.scopeKey,
      actorUserId: input.actorUserId,
      reason,
      detail: { decision: input.decision },
    }),
  ]);
  const reviews = await dbGet<{ approved: number; rejected: number; revision_requested: number }>(
    `SELECT COUNT(*) FILTER (WHERE decision='approved')::int AS approved,
            COUNT(*) FILTER (WHERE decision='rejected')::int AS rejected,
            COUNT(*) FILTER (WHERE decision='revision_requested')::int AS revision_requested
       FROM v8_agent_proposal_scope_reviews WHERE proposal_version_id=?`,
    [input.proposalVersionId]
  );
  const status =
    Number(reviews?.rejected || 0) > 0
      ? 'rejected'
      : Number(reviews?.revision_requested || 0) > 0
        ? 'revision_requested'
        : Number(reviews?.approved || 0) === scopes.length
          ? 'approved'
          : 'partially_approved';
  await dbRun(
    `UPDATE v8_agent_proposal_versions SET status=?,updated_at=? WHERE proposal_version_id=? AND organization_id=?`,
    [status, now, input.proposalVersionId, input.organizationId]
  );
  return {
    proposalVersionId: input.proposalVersionId,
    status,
    approvedScopes: Number(reviews?.approved || 0),
    totalScopes: scopes.length,
  };
}

export async function rejectProposalScope(
  input: Omit<Parameters<typeof reviewProposalScope>[0], 'decision'>
) {
  return reviewProposalScope({ ...input, decision: 'rejected' });
}

export async function requestProposalRevision(
  input: Omit<Parameters<typeof reviewProposalScope>[0], 'decision'>
) {
  return reviewProposalScope({ ...input, decision: 'revision_requested' });
}

async function reviseGovernedProposalWithinTransaction(input: {
  proposalVersionId: string;
  organizationId: string;
  after: Record<string, unknown>;
  expiresAt: string;
  actorUserId: string;
  reason: string;
}) {
  const previous = await loadProposal(input.proposalVersionId, input.organizationId);
  if (previous.status !== 'revision_requested') throw new Error('proposal_revision_not_requested');
  const created = await registerGovernedProposal({
    proposalId: previous.proposal_id,
    organizationId: previous.organization_id,
    canonicalRunId: previous.canonical_run_id,
    planVersion: Number(previous.plan_version),
    contextDigest: previous.context_digest,
    before: jsonObject(previous.before_json),
    after: input.after,
    approvalScopes: jsonArray(previous.approval_scopes_json),
    reviewerAuthorityByScope: jsonAuthority(previous.reviewer_authority_json),
    expiresAt: input.expiresAt,
    actorUserId: input.actorUserId,
    supersedesProposalVersionId: previous.proposal_version_id,
    revisionKind: 'revision',
    changeReason: input.reason,
  });
  await markSuperseded(previous, created.proposalVersionId);
  return created;
}

async function rebaselineGovernedProposalWithinTransaction(input: {
  proposalVersionId: string;
  organizationId: string;
  planVersion: number;
  contextDigest: string;
  expiresAt: string;
  actorUserId: string;
  reason: string;
}) {
  const previous = await loadProposal(input.proposalVersionId, input.organizationId);
  if (!['invalidated', 'expired'].includes(previous.status))
    throw new Error('proposal_rebaseline_not_allowed');
  if (
    Number(previous.plan_version) === input.planVersion &&
    previous.context_digest === input.contextDigest
  )
    throw new Error('proposal_rebaseline_unchanged');
  const created = await registerGovernedProposal({
    proposalId: previous.proposal_id,
    organizationId: previous.organization_id,
    canonicalRunId: previous.canonical_run_id,
    planVersion: input.planVersion,
    contextDigest: input.contextDigest,
    before: jsonObject(previous.before_json),
    after: jsonObject(previous.after_json),
    approvalScopes: jsonArray(previous.approval_scopes_json),
    reviewerAuthorityByScope: jsonAuthority(previous.reviewer_authority_json),
    expiresAt: input.expiresAt,
    actorUserId: input.actorUserId,
    supersedesProposalVersionId: previous.proposal_version_id,
    revisionKind: 'rebaseline',
    changeReason: input.reason,
  });
  await markSuperseded(previous, created.proposalVersionId);
  return created;
}

async function assertProposalExecutableWithinTransaction(input: {
  proposalVersionId: string;
  organizationId: string;
  planVersion: number;
  contextDigest: string;
}) {
  const row = await loadProposal(input.proposalVersionId, input.organizationId);
  let invalidationReason: string | null = null;
  if (new Date(row.expires_at).getTime() <= Date.now()) invalidationReason = 'expired';
  else if (Number(row.plan_version) !== input.planVersion)
    invalidationReason = 'plan_version_changed';
  else if (row.context_digest !== input.contextDigest) invalidationReason = 'context_changed';
  if (invalidationReason) {
    const status = invalidationReason === 'expired' ? 'expired' : 'invalidated';
    await persistTerminalState(
      row,
      status,
      invalidationReason,
      'system:proposal-execution-gate',
      invalidationReason,
      new Date().toISOString()
    );
    return { executable: false, status, reason: invalidationReason };
  }
  return {
    executable: row.status === 'approved',
    status: row.status,
    reason: row.status === 'approved' ? null : `proposal_${row.status}`,
  };
}

async function loadProposal(proposalVersionId: string, organizationId: string) {
  const row = await dbGet<ProposalRow>(
    `SELECT * FROM v8_agent_proposal_versions WHERE proposal_version_id=? AND organization_id=?`,
    [proposalVersionId, organizationId]
  );
  if (!row) throw new Error('governed_proposal_not_found');
  return row;
}

function validateProposalInput(input: RegisterProposalInput) {
  if (
    !input.approvalScopes.length ||
    new Set(input.approvalScopes).size !== input.approvalScopes.length
  )
    throw new Error('proposal_approval_scopes_invalid');
  if (new Date(input.expiresAt).getTime() <= Date.now())
    throw new Error('proposal_expiry_must_be_future');
  if (!Number.isInteger(input.planVersion) || input.planVersion < 1)
    throw new Error('proposal_plan_version_invalid');
  if (!input.contextDigest.trim()) throw new Error('proposal_context_digest_required');
  for (const scope of input.approvalScopes) {
    const reviewers = input.reviewerAuthorityByScope[scope];
    if (
      !Array.isArray(reviewers) ||
      !reviewers.length ||
      new Set(reviewers).size !== reviewers.length
    )
      throw new Error('proposal_reviewer_authority_invalid');
  }
  const authorityScopes = Object.keys(input.reviewerAuthorityByScope);
  if (
    authorityScopes.length !== input.approvalScopes.length ||
    authorityScopes.some((scope) => !input.approvalScopes.includes(scope))
  )
    throw new Error('proposal_reviewer_authority_invalid');
}

function assertReviewerAuthority(raw: unknown, scopeKey: string, actorUserId: string) {
  const reviewers = jsonAuthority(raw)[scopeKey] ?? [];
  if (!reviewers.includes(actorUserId)) throw new Error('proposal_reviewer_not_authorized');
}

async function persistTerminalState(
  row: ProposalRow,
  status: string,
  reasonCode: string,
  actorUserId: string,
  reason: string,
  now: string
) {
  await executeTransaction([
    {
      sql: `UPDATE v8_agent_proposal_versions SET status=?,invalidation_reason=?,updated_at=? WHERE proposal_version_id=? AND organization_id=?`,
      params: [status, reasonCode, now, row.proposal_version_id, row.organization_id],
    },
    governanceEvent({
      proposalVersionId: row.proposal_version_id,
      organizationId: row.organization_id,
      eventType: status === 'expired' ? 'expired' : 'invalidated',
      actorUserId,
      reason,
      detail: { reasonCode },
    }),
  ]);
}

async function markSuperseded(previous: ProposalRow, successorProposalVersionId: string) {
  const result = await dbRun(
    `UPDATE v8_agent_proposal_versions SET status='superseded',invalidation_reason='superseded_by_new_version',updated_at=?
      WHERE proposal_version_id=? AND organization_id=? AND status IN ('revision_requested','invalidated','expired')`,
    [new Date().toISOString(), previous.proposal_version_id, previous.organization_id]
  );
  if (!result || Number((result as { changes?: number }).changes ?? 0) !== 1)
    throw new Error(`proposal_supersession_failed:${successorProposalVersionId}`);
}

function governanceEvent(input: {
  proposalVersionId: string;
  organizationId: string;
  eventType: string;
  scopeKey?: string;
  actorUserId: string;
  reason: string;
  detail: Record<string, unknown>;
}) {
  return {
    sql: `INSERT INTO v8_agent_proposal_governance_events
      (event_id,proposal_version_id,organization_id,event_type,scope_key,actor_user_id,reason,detail_json)
      VALUES (?,?,?,?,?,?,?,?::jsonb)`,
    params: [
      uuidv4(),
      input.proposalVersionId,
      input.organizationId,
      input.eventType,
      input.scopeKey ?? null,
      input.actorUserId,
      input.reason,
      JSON.stringify(input.detail),
    ],
  };
}

async function executeTransaction(
  statements: Array<{ sql: string; params: unknown[] }>
): Promise<void> {
  const client = requiredTransactionClient();
  for (const statement of statements) await client.query(statement.sql, statement.params);
}

async function dbGet<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const result = await requiredTransactionClient().query<T>(sql, params);
  return result.rows[0] ?? null;
}

async function dbAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await requiredTransactionClient().query<T>(sql, params);
  return result.rows;
}

async function dbRun(sql: string, params: unknown[] = []) {
  const result = await requiredTransactionClient().query(sql, params);
  return { success: true, changes: result.rowCount };
}

function requiredTransactionClient(): PgTransactionClient {
  const client = governanceTransaction.getStore();
  if (!client) throw new Error('proposal_governance_transaction_context_missing');
  return client;
}

async function withGovernanceTransaction<T>(fn: () => Promise<T>): Promise<T> {
  if (governanceTransaction.getStore()) return fn();
  return withPgTransaction((client) => governanceTransaction.run(client, fn));
}

function requiredReason(value: string) {
  const reason = value.trim();
  if (!reason) throw new Error('proposal_review_reason_required');
  return reason;
}

function jsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  try {
    const value = JSON.parse(String(raw ?? '[]'));
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function jsonObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  try {
    const value = JSON.parse(String(raw ?? '{}'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function jsonAuthority(raw: unknown): ReviewerAuthority {
  const value = jsonObject(raw);
  return Object.fromEntries(
    Object.entries(value).map(([scope, reviewers]) => [
      scope,
      Array.isArray(reviewers) ? reviewers.map(String) : [],
    ])
  );
}
