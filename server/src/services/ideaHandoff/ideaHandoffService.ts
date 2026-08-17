/**
 * Idea → Document/Presentation/Workbook handoff (Lane C / IDEA-DOCUMENT-
 * HANDOFF-SUBPACKET-001) — the governed replacement for the ungoverned
 * `POST /api/my-work/my-ideas/:id/convert` path.
 *
 * ── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
 * `my-work.routes.ts` `/my-ideas/:id/convert` (NOT owned by this lane — see
 * the lease note below) has no idempotency key, no content hash, no approval
 * step, and no receipt: calling it twice creates TWO `reports` rows and TWO
 * `my_idea_conversions` rows. Its `target='presentation'` branch is also
 * DEAD — it calls `getTableColumns('presentations')` and returns 501,
 * because no table named `presentations` exists (confirmed against the live
 * database: `SELECT to_regclass('public.presentations')` → NULL; the real
 * entity is `presentation_decks`). There is no workbook convert target at
 * all.
 *
 * This service does NOT patch that route (out of lease — see
 * `server/src/routes/ideaBusinessCase.routes.ts` for why the endpoint lives
 * there instead). It builds a SEPARATE, governed path — propose → human
 * approve/reject → materialize exactly once — on top of the shared spine at
 * `../artifactHandoff/handoffSpineService.ts`, and supports all three target
 * kinds the closure brief calls out: `document`, `presentation`, `workbook`.
 *
 * ── WHY THIS WRAPS THE SPINE INSTEAD OF REINVENTING IT ─────────────────────
 * `handoffSpineService.ts` already gives every Lane C producer (idea, chat,
 * meeting, organization) the exact three guarantees `/convert` is missing:
 * a content hash pinned at proposal time (`createProposal`), a DB-enforced
 * human-approval invariant (`approveProposal`/`rejectProposal`), and an
 * exactly-one receipt per proposal (`materializeProposal`), all keyed by a
 * caller-supplied idempotency key. This file's only job is the idea-specific
 * plumbing around that spine: reading `my_ideas` tenant-scoped, building the
 * canonical payload a human approves, and scoping every decide/materialize
 * call to the SAME idea the caller asked about (not just the same org —
 * `requireIdeaScopedProposal` below also rejects a proposal id that belongs
 * to a different producer, e.g. `chat` or `meeting`).
 *
 * ── CROSS-LANE CONTRACT (read this before wiring a consumer) ───────────────
 * `materializeIdeaArtifact` records the approval as FINAL and creates exactly
 * one `artifact_handoff_receipts` row — but it deliberately does NOT insert
 * into `documents`, `presentation_decks`, or `generated_workbooks`. Those
 * tables, and the "create one from scratch" entry points for them
 * (`documentStudioService.materializeDocumentArtifact`, the presentation
 * generator, `workbookCommandService`), are owned by other lanes and pull in
 * template resolution / AI generation / export pipelines far outside this
 * worker's lease and this brief's scope — importing them "blind" to satisfy
 * a checklist item would be the same class of mistake the brief warns
 * against (never write a foreign owner table directly).
 *
 * Instead, `target_record_id` on the receipt is the deterministic string
 * `idea-artifact:<proposalId>` — a stable handle, not a real foreign key.
 * The owning lane for each `targetKind` is expected to:
 *   1. Poll or subscribe to `artifact_handoff_proposals` /
 *      `artifact_handoff_receipts` WHERE `producer_kind = 'idea'` AND
 *      `state = 'materialized'`.
 *   2. Create the real `document` / `presentation_decks` / workbook row from
 *      `payload_json` (schema: `IdeaArtifactPayload` below, `contractVersion
 *      'idea-artifact-v1'`).
 *   3. That lane owns whether it records its own id back onto the receipt
 *      (a future migration could add a nullable `owner_record_id` column) or
 *      treats the receipt's existence alone as sufficient provenance — this
 *      file does not decide that for them.
 * Until step 2 happens for a given proposal, `idea-artifact:<proposalId>` is
 * a valid, stable, reopenable answer to "was this approved and exactly-once
 * materialized" even though no downstream document/deck/workbook exists yet.
 */
import { getDatabase } from '../../database/Database.js';
import {
  approveProposal,
  canonicalSourceHash,
  createProposal,
  HandoffSpineError,
  materializeProposal,
  rejectProposal,
  type HandoffProposal,
  type HandoffReceipt,
} from '../artifactHandoff/handoffSpineService.js';
import {
  recordGovernedConsumerBinding,
  validateGovernedSnapshotRef,
  type GovernedConsumerBinding,
  type GovernedSnapshotRef,
} from '../organizationContext/governedSnapshotConsumerBindingService.js';

export { HandoffSpineError } from '../artifactHandoff/handoffSpineService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Subset of the spine's generic `TargetKind` this lane's idea flow supports.
 * `material` is deliberately excluded — no idea-authored "material" concept
 * exists in the product today, and the brief scopes this to document/PPT/XLSX. */
export const IDEA_ARTIFACT_TARGET_KINDS = ['document', 'presentation', 'workbook'] as const;
export type IdeaArtifactTargetKind = (typeof IDEA_ARTIFACT_TARGET_KINDS)[number];

export function isIdeaArtifactTargetKind(value: unknown): value is IdeaArtifactTargetKind {
  return (
    typeof value === 'string' && (IDEA_ARTIFACT_TARGET_KINDS as readonly string[]).includes(value)
  );
}

export class IdeaHandoffError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'IdeaHandoffError';
  }
}

/** Payload schema pinned into `source_content_hash` — see the cross-lane
 * contract above. Bump `IDEA_ARTIFACT_CONTRACT_VERSION` on any breaking shape
 * change so a downstream consumer can refuse an unknown version rather than
 * mis-parse it (same idiom as `handoffSpineService.ts`'s `contractVersion`). */
export interface IdeaArtifactPayload {
  ideaId: string;
  title: string;
  body: string;
  tags: unknown;
  stage: string | null;
  potential: string | null;
  complexity: string | null;
  area: string | null;
  aiExpansion: string | null;
  summary: unknown;
  actionContract: unknown;
  sourcePack: unknown;
  evidenceRefs: unknown;
  governedSnapshotRef?: GovernedSnapshotRef;
}

export const IDEA_ARTIFACT_CONTRACT_VERSION = 'idea-artifact-v1';

interface MyIdeaRow {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  body: string | null;
  tags: string | null;
  stage: string | null;
  potential: string | null;
  complexity: string | null;
  area: string | null;
  ai_expansion: string | null;
  summary_data: string | null;
  action_contract_json: string | null;
  source_pack_json: string | null;
  evidence_refs_json: string | null;
}

// ---------------------------------------------------------------------------
// my_ideas read helpers (tenant-scoped — same idiom as ideaBusinessCaseService.ts)
// ---------------------------------------------------------------------------

async function loadTenantScopedIdea(ideaId: string, organizationId: string): Promise<MyIdeaRow> {
  const db = await getDatabase();
  const result = await db.query<MyIdeaRow>(
    `SELECT id, organization_id, user_id, title, body, tags, stage, potential, complexity, area,
            ai_expansion, summary_data, action_contract_json, source_pack_json, evidence_refs_json
       FROM my_ideas WHERE id = ? AND organization_id = ? LIMIT 1`,
    [ideaId, organizationId]
  );
  const row = result.rows?.[0];
  if (!row) {
    throw new IdeaHandoffError('Idea not found', 'IDEA_NOT_FOUND');
  }
  return row;
}

function parseJsonField(raw: string | null | undefined, fallback: unknown): unknown {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Builds the canonical payload a human approves. This is exactly what gets
 * fed into `canonicalSourceHash` by `createProposal` — so calling this
 * function again later (e.g. after the idea was edited) and comparing the
 * hash is how "editing the idea after approval does not change what was
 * approved" is verified (the proposal keeps its ORIGINAL hash; only a NEW
 * proposal would pin the edited content).
 */
export function buildIdeaArtifactPayload(
  idea: MyIdeaRow,
  governedSnapshotRef?: GovernedSnapshotRef
): IdeaArtifactPayload {
  return {
    ideaId: idea.id,
    title: idea.title,
    body: idea.body ?? '',
    tags: parseJsonField(idea.tags, []),
    stage: idea.stage ?? null,
    potential: idea.potential ?? null,
    complexity: idea.complexity ?? null,
    area: idea.area ?? null,
    aiExpansion: idea.ai_expansion ?? null,
    summary: parseJsonField(idea.summary_data, null),
    actionContract: parseJsonField(idea.action_contract_json, {}),
    sourcePack: parseJsonField(idea.source_pack_json, {}),
    evidenceRefs: parseJsonField(idea.evidence_refs_json, []),
    ...(governedSnapshotRef ? { governedSnapshotRef } : {}),
  };
}

// ---------------------------------------------------------------------------
// Idea-scoped proposal guard — every decide/materialize/read call goes
// through this so a caller cannot act on a proposal that belongs to a
// DIFFERENT idea (or a different producer entirely, e.g. `chat`/`meeting`)
// just because it happens to sit in the same organization.
// ---------------------------------------------------------------------------

interface ProposalScopeRow {
  producer_kind: string;
  producer_record_id: string;
}

async function requireIdeaScopedProposal(
  organizationId: string,
  ideaId: string,
  proposalId: string
): Promise<void> {
  const db = await getDatabase();
  const result = await db.query<ProposalScopeRow>(
    `SELECT producer_kind, producer_record_id FROM artifact_handoff_proposals
      WHERE proposal_id = ? AND organization_id = ? LIMIT 1`,
    [proposalId, organizationId]
  );
  const row = result.rows?.[0];
  // Cross-tenant, cross-idea, and cross-producer callers are all folded into
  // the same "not found" — same reasoning `handoffSpineService.ts` documents
  // for its own tenant-isolation check: a real idea-scoped proposal id from
  // ANOTHER organization/idea must be indistinguishable from one that never
  // existed, or its existence itself leaks information.
  if (!row || row.producer_kind !== 'idea' || row.producer_record_id !== ideaId) {
    throw new IdeaHandoffError('Artifact proposal not found', 'PROPOSAL_NOT_FOUND');
  }
}

// ---------------------------------------------------------------------------
// (1) proposeIdeaArtifact
// ---------------------------------------------------------------------------

export interface ProposeIdeaArtifactInput {
  organizationId: string;
  ideaId: string;
  targetKind: IdeaArtifactTargetKind;
  createdBy: string;
  idempotencyKey?: string | null;
  governedSnapshotRef?: GovernedSnapshotRef;
}

export interface ProposeIdeaArtifactResult {
  proposal: HandoffProposal;
  replayed: boolean;
}

/**
 * Reads the idea tenant-scoped from `my_ideas`, builds the canonical
 * payload, and creates a spine proposal with `producerKind: 'idea'` and
 * `producerRecordId = ideaId` — the stable source id the cross-lane contract
 * above is keyed on. `targetKind` supports `document`, `presentation`, AND
 * `workbook` (closing both gaps in `/my-ideas/:id/convert`: presentation was
 * a dead 501, workbook did not exist at all).
 */
export async function proposeIdeaArtifact(
  input: ProposeIdeaArtifactInput
): Promise<ProposeIdeaArtifactResult> {
  if (!isIdeaArtifactTargetKind(input.targetKind)) {
    throw new IdeaHandoffError(
      `targetKind must be one of ${IDEA_ARTIFACT_TARGET_KINDS.join(', ')}`,
      'INVALID_TARGET_KIND'
    );
  }
  const idea = await loadTenantScopedIdea(input.ideaId, input.organizationId);
  if (input.governedSnapshotRef) {
    await validateGovernedSnapshotRef(input.organizationId, input.governedSnapshotRef);
  }
  const payload = buildIdeaArtifactPayload(idea, input.governedSnapshotRef);

  const { proposal, replayed } = await createProposal({
    organizationId: input.organizationId,
    producerKind: 'idea',
    producerRecordId: idea.id,
    targetKind: input.targetKind,
    payload,
    createdBy: input.createdBy,
    idempotencyKey: input.idempotencyKey ?? null,
    contractVersion: IDEA_ARTIFACT_CONTRACT_VERSION,
  });
  return { proposal, replayed };
}

export async function proposeGovernedIdeaArtifact(
  input: ProposeIdeaArtifactInput & { governedSnapshotRef: GovernedSnapshotRef }
): Promise<ProposeIdeaArtifactResult & { binding: GovernedConsumerBinding }> {
  await validateGovernedSnapshotRef(input.organizationId, input.governedSnapshotRef);
  const result = await proposeIdeaArtifact(input);
  const bound = await recordGovernedConsumerBinding({
    organizationId: input.organizationId,
    consumerKind: 'idea',
    consumerRecordId: input.ideaId,
    proposalId: result.proposal.proposalId,
    snapshotRef: input.governedSnapshotRef,
    boundBy: input.createdBy,
  });
  return { ...result, binding: bound.binding };
}

// ---------------------------------------------------------------------------
// (2) decideIdeaArtifact — human approve/reject
// ---------------------------------------------------------------------------

export interface DecideIdeaArtifactInput {
  organizationId: string;
  ideaId: string;
  proposalId: string;
  decidedBy: string;
  action: 'approve' | 'reject';
  reason?: string | null;
}

/**
 * Thin, idea-scoped wrapper over `approveProposal`/`rejectProposal`.
 * `decidedBy` MUST be a real human actor id — enforced by the spine's
 * `requireHumanActor` (rejects '', 'system', 'SYSTEM', 'undefined', 'null')
 * — and by this router always being called with the AUTHENTICATED caller's
 * own user id (see `ideaBusinessCase.routes.ts`), never a service/system id.
 */
export async function decideIdeaArtifact(input: DecideIdeaArtifactInput): Promise<HandoffProposal> {
  await requireIdeaScopedProposal(input.organizationId, input.ideaId, input.proposalId);
  const decide = input.action === 'approve' ? approveProposal : rejectProposal;
  return decide({
    organizationId: input.organizationId,
    proposalId: input.proposalId,
    decidedBy: input.decidedBy,
    reason: input.reason ?? null,
  });
}

// ---------------------------------------------------------------------------
// (3) materializeIdeaArtifact
// ---------------------------------------------------------------------------

export interface MaterializeIdeaArtifactInput {
  organizationId: string;
  ideaId: string;
  proposalId: string;
  materializedBy: string;
}

export interface MaterializeIdeaArtifactResult {
  receipt: HandoffReceipt;
  replayed: boolean;
}

/**
 * On an APPROVED proposal, records EXACTLY ONE receipt via the spine's
 * `materializeProposal` (unique index on `proposal_id` — a DB guarantee, not
 * just application logic). Per the CROSS-LANE CONTRACT at the top of this
 * file, `target_record_id` is the deterministic placeholder
 * `idea-artifact:<proposalId>` — this function never writes to `documents`,
 * `presentation_decks`, or any generated-workbook table, because those are
 * owned by other lanes.
 */
export async function materializeIdeaArtifact(
  input: MaterializeIdeaArtifactInput
): Promise<MaterializeIdeaArtifactResult> {
  await requireIdeaScopedProposal(input.organizationId, input.ideaId, input.proposalId);
  const targetRecordId = `idea-artifact:${input.proposalId}`;
  const { receipt, replayed } = await materializeProposal({
    organizationId: input.organizationId,
    proposalId: input.proposalId,
    targetRecordId,
    materializedBy: input.materializedBy,
  });
  return { receipt, replayed };
}

// ---------------------------------------------------------------------------
// (4) getIdeaArtifactProposal — cold reopen (fresh read, no cached state)
// ---------------------------------------------------------------------------

export interface GetIdeaArtifactProposalResult {
  proposal: HandoffProposal;
  receipt: HandoffReceipt | null;
}

interface RawProposalRow {
  proposal_id: string;
  organization_id: string;
  producer_kind: string;
  producer_record_id: string;
  source_content_hash: string;
  source_version: number;
  contract_version: string;
  target_kind: string;
  payload_json: string;
  state: string;
  created_by: string;
  created_at: Date | string;
  decided_by: string | null;
  decided_at: Date | string | null;
  decision_reason: string | null;
  self_approved: boolean;
  idempotency_key: string | null;
  updated_at: Date | string;
}

interface RawReceiptRow {
  receipt_id: string;
  organization_id: string;
  proposal_id: string;
  target_kind: string;
  target_record_id: string;
  output_content_hash: string | null;
  materialized_by: string;
  materialized_at: Date | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Row mapping duplicated (not imported) from `handoffSpineService.ts`
 * on purpose: that file sits outside this lane's lease
 * (`server/src/services/artifactHandoff/**`), and it exports no
 * `getProposal`/`getReceipt` read helper today. Re-implementing the mapping
 * here — reading the SAME two spine tables the service already owns — is a
 * read-only convenience for this lane's own route, not a second writer.
 */
export async function getIdeaArtifactProposal(
  organizationId: string,
  ideaId: string,
  proposalId: string
): Promise<GetIdeaArtifactProposalResult> {
  const db = await getDatabase();
  const proposalResult = await db.query<RawProposalRow>(
    `SELECT * FROM artifact_handoff_proposals WHERE proposal_id = ? AND organization_id = ? LIMIT 1`,
    [proposalId, organizationId]
  );
  const row = proposalResult.rows?.[0];
  if (!row || row.producer_kind !== 'idea' || row.producer_record_id !== ideaId) {
    throw new IdeaHandoffError('Artifact proposal not found', 'PROPOSAL_NOT_FOUND');
  }

  const proposal: HandoffProposal = {
    proposalId: row.proposal_id,
    organizationId: row.organization_id,
    producerKind: row.producer_kind as HandoffProposal['producerKind'],
    producerRecordId: row.producer_record_id,
    sourceContentHash: row.source_content_hash,
    sourceVersion: Number(row.source_version),
    contractVersion: row.contract_version,
    targetKind: row.target_kind as HandoffProposal['targetKind'],
    payload: typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json,
    state: row.state as HandoffProposal['state'],
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    decidedBy: row.decided_by,
    decidedAt: row.decided_at === null ? null : toIso(row.decided_at),
    decisionReason: row.decision_reason,
    selfApproved: Boolean(row.self_approved),
    idempotencyKey: row.idempotency_key,
    updatedAt: toIso(row.updated_at),
  };

  let receipt: HandoffReceipt | null = null;
  if (row.state === 'materialized') {
    const receiptResult = await db.query<RawReceiptRow>(
      `SELECT * FROM artifact_handoff_receipts WHERE proposal_id = ? AND organization_id = ? LIMIT 1`,
      [proposalId, organizationId]
    );
    const receiptRow = receiptResult.rows?.[0];
    if (receiptRow) {
      receipt = {
        receiptId: receiptRow.receipt_id,
        organizationId: receiptRow.organization_id,
        proposalId: receiptRow.proposal_id,
        targetKind: receiptRow.target_kind as HandoffReceipt['targetKind'],
        targetRecordId: receiptRow.target_record_id,
        outputContentHash: receiptRow.output_content_hash,
        materializedBy: receiptRow.materialized_by,
        materializedAt: toIso(receiptRow.materialized_at),
      };
    }
  }

  return { proposal, receipt };
}

// Re-exported for callers/tests that want to compute a payload hash without
// going through `proposeIdeaArtifact` (e.g. asserting the pinned-content
// invariant against a freshly-fetched idea row).
export { canonicalSourceHash };
