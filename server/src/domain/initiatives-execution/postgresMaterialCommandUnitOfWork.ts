import type { Pool, PoolClient } from 'pg';

import type {
  AggregateRelationClaim,
  AuditAppend,
  InitiativeCardSnapshot,
  MaterialCommandTransaction,
  MaterialCommandUnitOfWork,
  OutboxAppend,
  SourceProposalSnapshot,
  StoredCommandReceipt,
} from './materialCommand.js';
import { MaterialCommandConflictError, MaterialCommandValidationError } from './materialCommand.js';

interface QueryResultRowCount {
  rowCount: number | null;
}

function requireSingleRow(result: QueryResultRowCount, operation: string): void {
  if (result.rowCount !== 1) throw new Error(`${operation} affected ${result.rowCount ?? 0} rows`);
}

class PostgresMaterialCommandTransaction implements MaterialCommandTransaction {
  constructor(private readonly client: PoolClient) {}

  async adoptAcceptedClassicInitiative(input: {
    organizationId: string;
    candidateId: string;
    initiativeId: string;
    projectId: string;
    actorId: string;
    policyId: string;
    policyVersion: number;
    correlationId: string;
  }) {
    await this.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${input.organizationId}:accepted-classic:${input.candidateId}`,
    ]);
    const source = await this.client.query<{
      candidate_id: string;
      initiative_id: string;
      registered_initiative_id: string | null;
      title: string;
      rationale: string | null;
      handoff_id: string;
      source_revision: number;
      tool_output_id: string;
      tool_output_version: number;
      tool_output_content_hash: string;
    }>(
      `SELECT c.id candidate_id,c.initiative_id,c.registered_initiative_id,c.title,c.rationale,
              h.id handoff_id,h.source_revision,h.tool_output_id,h.tool_output_version,
              h.tool_output_content_hash
         FROM initiative_candidates c
         JOIN initiatives i ON i.organization_id=c.organization_id AND i.id=c.initiative_id
         JOIN swot_candidate_handoffs h ON h.organization_id=c.organization_id AND h.candidate_id=c.id
         JOIN tool_outputs o ON o.organization_id=h.organization_id AND o.id=h.tool_output_id
        WHERE c.organization_id=$1 AND c.id=$2 AND c.status='accepted'
          AND c.initiative_id=$3 AND i.project_id=$4 AND c.registered_initiative_id IS NULL
          AND o.status='approved' AND o.version=h.tool_output_version
          AND o.content_hash=h.tool_output_content_hash
        FOR UPDATE OF c`,
      [input.organizationId, input.candidateId, input.initiativeId, input.projectId]
    );
    const row = source.rows[0];
    if (!row)
      throw new MaterialCommandValidationError(
        'Accepted classic SWOT candidate not found or lineage is not immutable'
      );
    const existing = await this.client.query<{
      receipt_id: string;
      candidate_id: string;
      classic_initiative_id: string;
      runtime_initiative_id: string;
      project_id: string;
      swot_handoff_receipt_id: string;
      tool_output_id: string;
      tool_output_version: number;
      tool_output_content_hash: string;
    }>(
      `SELECT * FROM flow_accepted_classic_runtime_adoptions
          WHERE organization_id=$1 AND (candidate_id=$2 OR classic_initiative_id=$3) FOR UPDATE`,
      [input.organizationId, input.candidateId, input.initiativeId]
    );
    if (existing.rows.length > 1)
      throw new MaterialCommandConflictError('classic adoption identity conflict', 0, 1);
    const prior = existing.rows[0];
    if (prior) {
      if (
        prior.candidate_id !== input.candidateId ||
        prior.classic_initiative_id !== input.initiativeId ||
        prior.runtime_initiative_id !== input.initiativeId ||
        prior.swot_handoff_receipt_id !== row.handoff_id ||
        prior.project_id !== input.projectId ||
        prior.tool_output_id !== row.tool_output_id ||
        prior.tool_output_version !== row.tool_output_version ||
        prior.tool_output_content_hash !== row.tool_output_content_hash
      ) {
        throw new MaterialCommandConflictError('classic adoption identity conflict', 0, 1);
      }
      return {
        receiptId: prior.receipt_id,
        title: row.title,
        problem: row.rationale || row.title,
        sourceReceiptId: row.handoff_id,
        sourceVersion: row.source_revision,
        sourceContentHash: row.tool_output_content_hash,
        toolOutputId: row.tool_output_id,
        toolOutputVersion: row.tool_output_version,
      };
    }
    const inserted = await this.client.query<{ receipt_id: string }>(
      `INSERT INTO flow_accepted_classic_runtime_adoptions
       (organization_id,candidate_id,classic_initiative_id,runtime_initiative_id,
        project_id,swot_handoff_receipt_id,swot_source_revision,tool_output_id,tool_output_version,
        tool_output_content_hash,policy_id,policy_version,correlation_id,adopted_by)
       VALUES($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING receipt_id`,
      [
        input.organizationId,
        input.candidateId,
        input.initiativeId,
        input.projectId,
        row.handoff_id,
        row.source_revision,
        row.tool_output_id,
        row.tool_output_version,
        row.tool_output_content_hash,
        input.policyId,
        input.policyVersion,
        input.correlationId,
        input.actorId,
      ]
    );
    return {
      receiptId: inserted.rows[0].receipt_id,
      title: row.title,
      problem: row.rationale || row.title,
      sourceReceiptId: row.handoff_id,
      sourceVersion: row.source_revision,
      sourceContentHash: row.tool_output_content_hash,
      toolOutputId: row.tool_output_id,
      toolOutputVersion: row.tool_output_version,
    };
  }

  async findReceipt<TResponse>(
    organizationId: string,
    clientRequestId: string
  ): Promise<StoredCommandReceipt<TResponse> | null> {
    const result = await this.client.query<{
      organization_id: string;
      client_request_id: string;
      command_type: string;
      aggregate_type: string;
      aggregate_id: string;
      aggregate_version: number;
      correlation_id: string;
      request_fingerprint: string;
      response_json: TResponse;
    }>(
      `SELECT organization_id, client_request_id, command_type, aggregate_type,
              aggregate_id, aggregate_version, correlation_id, request_fingerprint, response_json
         FROM ie_command_receipts
        WHERE organization_id = $1 AND client_request_id = $2`,
      [organizationId, clientRequestId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      organizationId: row.organization_id,
      clientRequestId: row.client_request_id,
      commandType: row.command_type,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      aggregateVersion: row.aggregate_version,
      correlationId: row.correlation_id,
      requestFingerprint: row.request_fingerprint,
      response: row.response_json,
    };
  }

  async getAggregateVersion(
    organizationId: string,
    aggregateType: string,
    aggregateId: string
  ): Promise<number | null> {
    await this.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${organizationId}:${aggregateType}:${aggregateId}`,
    ]);
    const result = await this.client.query<{ version: number }>(
      `SELECT version
         FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = $2 AND aggregate_id = $3
        FOR UPDATE`,
      [organizationId, aggregateType, aggregateId]
    );
    return result.rows[0]?.version ?? null;
  }

  async getAggregatePayload<TPayload>(
    organizationId: string,
    aggregateType: string,
    aggregateId: string
  ): Promise<TPayload | null> {
    const result = await this.client.query<{ payload_json: TPayload }>(
      `SELECT payload_json
         FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = $2 AND aggregate_id = $3`,
      [organizationId, aggregateType, aggregateId]
    );
    return result.rows[0]?.payload_json ?? null;
  }

  async persistAggregate<TMutation>(
    organizationId: string,
    aggregateType: string,
    aggregateId: string,
    fromVersion: number,
    toVersion: number,
    mutation: TMutation
  ): Promise<void> {
    const result = await this.client.query(
      `UPDATE ie_aggregate_state
          SET version = $1, payload_json = $2::jsonb, updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = $3 AND aggregate_type = $4 AND aggregate_id = $5 AND version = $6`,
      [toVersion, JSON.stringify(mutation), organizationId, aggregateType, aggregateId, fromVersion]
    );
    if (result.rowCount === 1) return;
    if (fromVersion === 0) {
      const inserted = await this.client.query(
        `INSERT INTO ie_aggregate_state
          (organization_id, aggregate_type, aggregate_id, version, payload_json)
         VALUES ($1,$2,$3,$4,$5::jsonb)
         ON CONFLICT (organization_id, aggregate_type, aggregate_id) DO NOTHING`,
        [organizationId, aggregateType, aggregateId, toVersion, JSON.stringify(mutation)]
      );
      requireSingleRow(inserted, 'aggregate insert');
      return;
    }
    requireSingleRow(result, 'aggregate update');
  }

  async getRelatedAggregateForUpdate<TPayload>(
    organizationId: string,
    aggregateType: string,
    aggregateId: string
  ): Promise<{ version: number; payload: TPayload } | null> {
    const result = await this.client.query<{ version: number; payload_json: TPayload }>(
      `SELECT version, payload_json
         FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = $2 AND aggregate_id = $3
        FOR UPDATE`,
      [organizationId, aggregateType, aggregateId]
    );
    const row = result.rows[0];
    return row ? { version: row.version, payload: row.payload_json } : null;
  }

  async persistRelatedAggregate<TMutation>(
    organizationId: string,
    aggregateType: string,
    aggregateId: string,
    fromVersion: number,
    toVersion: number,
    mutation: TMutation
  ): Promise<void> {
    await this.persistAggregate(
      organizationId,
      aggregateType,
      aggregateId,
      fromVersion,
      toVersion,
      mutation
    );
  }

  async appendAudit(entry: AuditAppend): Promise<void> {
    const result = await this.client.query(
      `INSERT INTO ie_audit_events
        (organization_id, actor_id, aggregate_type, aggregate_id, aggregate_version,
         command_type, client_request_id, correlation_id, policy_id, policy_version, payload_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
      [
        entry.organizationId,
        entry.actorId,
        entry.aggregateType,
        entry.aggregateId,
        entry.aggregateVersion,
        entry.commandType,
        entry.clientRequestId,
        entry.correlationId,
        entry.policyId,
        entry.policyVersion,
        JSON.stringify(entry.payload),
      ]
    );
    requireSingleRow(result, 'audit append');
  }

  async claimRelation(claim: AggregateRelationClaim): Promise<void> {
    const result = await this.client.query(
      `INSERT INTO ie_aggregate_relations
        (organization_id, relation_type, source_type, source_id, source_version,
         target_type, target_id, payload_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        claim.organizationId,
        claim.relationType,
        claim.sourceType,
        claim.sourceId,
        claim.sourceVersion,
        claim.targetType,
        claim.targetId,
        JSON.stringify(claim.payload),
      ]
    );
    requireSingleRow(result, 'relation claim');
  }

  async getSourceProposalForUpdate(
    organizationId: string,
    proposalId: string
  ): Promise<SourceProposalSnapshot | null> {
    const result = await this.client.query<{
      id: string;
      organization_id: string;
      version: number;
      source_type: string;
      source_id: string | null;
      source_version: number;
      title: string;
      problem: string | null;
      proposed_outcome: string | null;
      project_id: string | null;
      initiative_owner_id: string | null;
      visibility: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
      evidence_state: 'READY' | 'PARTIAL' | 'STALE' | 'UNKNOWN';
      duplicate_state: 'CLEAR' | 'POSSIBLE' | 'UNKNOWN';
      status: string;
      registered_initiative_id: string | null;
    }>(
      `SELECT id, organization_id, version, source_type, source_id, source_version,
              title, problem, proposed_outcome, project_id, initiative_owner_id,
              visibility, evidence_state, duplicate_state, status, registered_initiative_id
         FROM initiative_candidates
        WHERE organization_id = $1 AND id = $2
        FOR UPDATE`,
      [organizationId, proposalId]
    );
    const row = result.rows[0];
    if (!row || !row.source_id) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      version: row.version,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceVersion: row.source_version,
      title: row.title,
      problem: row.problem,
      proposedOutcome: row.proposed_outcome,
      projectId: row.project_id,
      initiativeOwnerId: row.initiative_owner_id,
      visibility: row.visibility,
      evidenceState: row.evidence_state,
      duplicateState: row.duplicate_state,
      status: row.status,
      registeredInitiativeId: row.registered_initiative_id,
    };
  }

  async findProposalBySourceForUpdate(
    organizationId: string,
    sourceType: string,
    sourceId: string,
    sourceVersion: number
  ): Promise<{ id: string } | null> {
    await this.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${organizationId}:source-proposal:${sourceType}:${sourceId}:${sourceVersion}`,
    ]);
    const result = await this.client.query<{ id: string }>(
      `SELECT id FROM initiative_candidates
        WHERE organization_id=$1 AND source_type=$2 AND source_id=$3 AND source_version=$4
        FOR UPDATE`,
      [organizationId, sourceType, sourceId, sourceVersion]
    );
    return result.rows[0] ?? null;
  }

  async insertSourceProposal(
    organizationId: string,
    proposal: import('./submitSourceProposal.js').SubmittedSourceProposal
  ): Promise<void> {
    const result = await this.client.query(
      `INSERT INTO initiative_candidates
        (id,organization_id,source_type,source_id,source_version,title,problem,proposed_outcome,
         project_id,initiative_owner_id,visibility,evidence_state,duplicate_state,status,version,
         provenance_json,policy_id,policy_version,created_by,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',1,$14::jsonb,$15,$16,$17,$18,$18)`,
      [
        proposal.proposalId,
        organizationId,
        proposal.sourceType,
        proposal.sourceId,
        proposal.sourceVersion,
        proposal.title,
        proposal.problem,
        proposal.proposedOutcome,
        proposal.projectId,
        proposal.initiativeOwnerId,
        proposal.visibility,
        proposal.evidenceState,
        proposal.duplicateState,
        JSON.stringify(proposal.provenance),
        proposal.policy.policyId,
        proposal.policy.policyVersion,
        proposal.submittedBy,
        proposal.submittedAt,
      ]
    );
    requireSingleRow(result, 'source proposal insert');
  }

  async markSourceProposalRegistered(
    organizationId: string,
    proposalId: string,
    proposalVersion: number,
    initiativeId: string
  ): Promise<void> {
    // INI-BVP-001 — considered adding `AND initiative_id IS NULL` here for
    // symmetry with the classic funnel's guard (initiativeCandidateService.
    // acceptCandidate now checks `initiative_id IS NULL AND
    // registered_initiative_id IS NULL`), but deliberately did NOT: it is not
    // load-bearing (this row is locked via `SELECT ... FOR UPDATE` in
    // getSourceProposalForUpdate before this runs, so Postgres already
    // serializes against a concurrent classic-funnel UPDATE on the same row —
    // whichever side commits first, the other observes the committed
    // `status`/claim-column state), and `initiative_id` was added by a
    // DIFFERENT migration (932_initiative_candidate_acceptance_receipt.sql)
    // than this table's own runtime-v1 columns
    // (932_initiatives_execution_material_commands.sql). Unlike
    // initiativeCandidateService.ts, this query is not wrapped in a
    // catch-and-degrade around a missing column — referencing a column that
    // may not exist on a partially-migrated environment would turn a working
    // Register into an unhandled 5xx instead of the intended guard failure.
    // `status = 'pending'` already blocks the case that matters here (the
    // classic funnel sets status='accepted' on its own claim too).
    const result = await this.client.query(
      `UPDATE initiative_candidates
          SET status = 'accepted', disposition = 'REGISTER', registered_initiative_id = $1,
              version = version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = $2 AND id = $3 AND version = $4
          AND status = 'pending' AND registered_initiative_id IS NULL`,
      [initiativeId, organizationId, proposalId, proposalVersion]
    );
    requireSingleRow(result, 'source proposal read-back');
  }

  async markSourceProposalDisposition(
    organizationId: string,
    proposalId: string,
    proposalVersion: number,
    disposition: 'MERGE' | 'EXTEND' | 'RETURN' | 'DEFER' | 'DISMISS',
    targetInitiativeId: string | null
  ): Promise<void> {
    const statusByDisposition = {
      MERGE: 'accepted',
      EXTEND: 'accepted',
      RETURN: 'returned',
      DEFER: 'deferred',
      DISMISS: 'dismissed',
    } as const;
    const result = await this.client.query(
      `UPDATE initiative_candidates
          SET status = $1, disposition = $2, registered_initiative_id = $3,
              version = version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = $4 AND id = $5 AND version = $6
          AND status = 'pending' AND registered_initiative_id IS NULL`,
      [
        statusByDisposition[disposition],
        disposition,
        targetInitiativeId,
        organizationId,
        proposalId,
        proposalVersion,
      ]
    );
    requireSingleRow(result, 'source proposal disposition read-back');
  }

  async reviseSourceProposal(input: {
    organizationId: string;
    proposalId: string;
    expectedProposalVersion: number;
    sourceVersion: number;
    provenance: Record<string, unknown>;
  }): Promise<void> {
    const result = await this.client.query(
      `UPDATE initiative_candidates SET source_version=$1,version=version+1,
              provenance_json=$2::jsonb,evidence_state='READY',updated_at=CURRENT_TIMESTAMP
        WHERE organization_id=$3 AND id=$4 AND version=$5`,
      [
        input.sourceVersion,
        JSON.stringify(input.provenance),
        input.organizationId,
        input.proposalId,
        input.expectedProposalVersion,
      ]
    );
    requireSingleRow(result, 'source proposal revision');
  }

  async isCanonicalInitiativeCard(cardKey: string): Promise<boolean> {
    const result = await this.client.query(
      'SELECT 1 FROM ie_initiative_card_catalog WHERE card_key = $1 AND active = TRUE',
      [cardKey]
    );
    return result.rowCount === 1;
  }

  async listCanonicalInitiativeCardKeys(): Promise<string[]> {
    const result = await this.client.query<{ card_key: string }>(
      'SELECT card_key FROM ie_initiative_card_catalog WHERE active = TRUE ORDER BY card_key'
    );
    return result.rows.map((row) => row.card_key);
  }

  async replaceInitiativeCardSelection(input: {
    organizationId: string;
    initiativeId: string;
    cards: Array<{
      cardKey: string;
      included: boolean;
      position: number;
      requiredness: 'REQUIRED' | 'OPTIONAL';
      waiverDecisionId: string | null;
    }>;
  }): Promise<void> {
    await this.client.query(
      `DELETE FROM ie_initiative_card_selection
        WHERE organization_id = $1 AND initiative_id = $2`,
      [input.organizationId, input.initiativeId]
    );
    for (const card of input.cards) {
      const result = await this.client.query(
        `INSERT INTO ie_initiative_card_selection
          (organization_id, initiative_id, card_key, included, position,
           requiredness, waiver_decision_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          input.organizationId,
          input.initiativeId,
          card.cardKey,
          card.included,
          card.position,
          card.requiredness,
          card.waiverDecisionId,
        ]
      );
      requireSingleRow(result, 'Initiative card selection insert');
    }
  }

  async getInitiativeCardVersionForUpdate(
    organizationId: string,
    initiativeId: string,
    cardKey: string
  ): Promise<number> {
    const result = await this.client.query<{ card_version: number }>(
      `SELECT card_version
         FROM ie_initiative_card_versions
        WHERE organization_id = $1 AND initiative_id = $2 AND card_key = $3
        ORDER BY card_version DESC
        LIMIT 1
        FOR UPDATE`,
      [organizationId, initiativeId, cardKey]
    );
    return result.rows[0]?.card_version ?? 0;
  }

  async getLatestInitiativeCardForUpdate(
    organizationId: string,
    initiativeId: string,
    cardKey: string
  ): Promise<InitiativeCardSnapshot | null> {
    const result = await this.client.query<{
      card_key: string;
      card_version: number;
      applicability: InitiativeCardSnapshot['applicability'];
      completion: InitiativeCardSnapshot['completion'];
      quality: InitiativeCardSnapshot['quality'];
      freshness: InitiativeCardSnapshot['freshness'];
      review_state: InitiativeCardSnapshot['reviewState'];
      content_json: Record<string, unknown>;
      evidence_refs_json: string[];
      waiver_decision_id: string | null;
      published_by: string;
    }>(
      `SELECT card_key, card_version, applicability, completion, quality, freshness,
              review_state, content_json, evidence_refs_json, waiver_decision_id, published_by
         FROM ie_initiative_card_versions
        WHERE organization_id = $1 AND initiative_id = $2 AND card_key = $3
        ORDER BY card_version DESC
        LIMIT 1
        FOR UPDATE`,
      [organizationId, initiativeId, cardKey]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      cardKey: row.card_key,
      cardVersion: row.card_version,
      applicability: row.applicability,
      completion: row.completion,
      quality: row.quality,
      freshness: row.freshness,
      reviewState: row.review_state,
      content: row.content_json,
      evidenceRefs: row.evidence_refs_json,
      waiverDecisionId: row.waiver_decision_id,
      publishedBy: row.published_by,
    };
  }

  async publishInitiativeCardVersion(input: {
    organizationId: string;
    initiativeId: string;
    cardKey: string;
    cardVersion: number;
    aggregateVersion: number;
    applicability: 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';
    completion: 'EMPTY' | 'IN_PROGRESS' | 'COMPLETE';
    quality: 'UNKNOWN' | 'SUFFICIENT' | 'WARNING' | 'BLOCKER';
    freshness: 'CURRENT' | 'STALE' | 'SOURCE_UNAVAILABLE';
    reviewState: 'NOT_REQUESTED' | 'REQUESTED' | 'CHANGES_REQUESTED' | 'ACCEPTED';
    content: Record<string, unknown>;
    evidenceRefs: string[];
    waiverDecisionId: string | null;
    publishedBy: string;
  }): Promise<void> {
    const result = await this.client.query(
      `INSERT INTO ie_initiative_card_versions
        (organization_id, initiative_id, card_key, card_version, aggregate_version,
         applicability, completion, quality, freshness, review_state, content_json,
         evidence_refs_json, waiver_decision_id, published_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14)`,
      [
        input.organizationId,
        input.initiativeId,
        input.cardKey,
        input.cardVersion,
        input.aggregateVersion,
        input.applicability,
        input.completion,
        input.quality,
        input.freshness,
        input.reviewState,
        JSON.stringify(input.content),
        JSON.stringify(input.evidenceRefs),
        input.waiverDecisionId,
        input.publishedBy,
      ]
    );
    requireSingleRow(result, 'Initiative card publish');
  }

  async reviewInitiativeCardVersion(input: {
    organizationId: string;
    initiativeId: string;
    cardKey: string;
    fromCardVersion: number;
    toCardVersion: number;
    aggregateVersion: number;
    reviewState: 'CHANGES_REQUESTED' | 'ACCEPTED';
    decisionId: string;
    reviewedBy: string;
    rationale: string;
  }): Promise<void> {
    const result = await this.client.query(
      `INSERT INTO ie_initiative_card_versions
        (organization_id, initiative_id, card_key, card_version, aggregate_version,
         applicability, completion, quality, freshness, review_state, content_json,
         evidence_refs_json, waiver_decision_id, published_by, review_decision_id,
         reviewed_by, review_rationale)
       SELECT organization_id, initiative_id, card_key, $1, $2,
              applicability, completion, quality, freshness, $3, content_json,
              evidence_refs_json, waiver_decision_id, published_by, $4, $5, $6
         FROM ie_initiative_card_versions
        WHERE organization_id = $7 AND initiative_id = $8 AND card_key = $9
          AND card_version = $10`,
      [
        input.toCardVersion,
        input.aggregateVersion,
        input.reviewState,
        input.decisionId,
        input.reviewedBy,
        input.rationale,
        input.organizationId,
        input.initiativeId,
        input.cardKey,
        input.fromCardVersion,
      ]
    );
    requireSingleRow(result, 'Initiative card review');
  }

  async appendOutbox(entry: OutboxAppend): Promise<void> {
    const result = await this.client.query(
      `INSERT INTO ie_outbox_events
        (organization_id, aggregate_type, aggregate_id, aggregate_version, event_type,
         correlation_id, causation_id, payload_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        entry.organizationId,
        entry.aggregateType,
        entry.aggregateId,
        entry.aggregateVersion,
        entry.eventType,
        entry.correlationId,
        entry.causationId,
        JSON.stringify(entry.payload),
      ]
    );
    requireSingleRow(result, 'outbox append');
  }

  async saveReceipt<TResponse>(receipt: StoredCommandReceipt<TResponse>): Promise<void> {
    const result = await this.client.query(
      `INSERT INTO ie_command_receipts
        (organization_id, client_request_id, command_type, aggregate_type, aggregate_id,
         aggregate_version, correlation_id, request_fingerprint, response_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [
        receipt.organizationId,
        receipt.clientRequestId,
        receipt.commandType,
        receipt.aggregateType,
        receipt.aggregateId,
        receipt.aggregateVersion,
        receipt.correlationId,
        receipt.requestFingerprint,
        JSON.stringify(receipt.response),
      ]
    );
    requireSingleRow(result, 'receipt append');
  }
}

export class PostgresMaterialCommandUnitOfWork implements MaterialCommandUnitOfWork {
  constructor(private readonly pool: Pool) {}

  async transaction<T>(work: (transaction: MaterialCommandTransaction) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(new PostgresMaterialCommandTransaction(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original command failure. Connection disposal/recovery is Pool responsibility.
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
