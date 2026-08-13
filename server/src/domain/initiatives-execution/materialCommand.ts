import { createHash } from 'node:crypto';

export interface MaterialCommandEnvelope<TPayload> {
  organizationId: string;
  actorId: string;
  aggregateType: string;
  aggregateId: string;
  expectedVersion: number;
  clientRequestId: string;
  correlationId: string;
  policyId: string;
  policyVersion: number;
  commandType: string;
  createIfMissing?: boolean;
  payload: TPayload;
}

export interface MaterialCommandResult<TResponse> {
  status: 'APPLIED' | 'REPLAYED';
  aggregateVersion: number;
  response: TResponse;
  correlationId: string;
  receiptId: string;
  readBackState: 'PENDING';
  readBackUrl: string;
}

export interface StoredCommandReceipt<TResponse> {
  organizationId: string;
  clientRequestId: string;
  commandType: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  correlationId: string;
  requestFingerprint: string;
  response: TResponse;
}

export interface AuditAppend {
  organizationId: string;
  actorId: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  commandType: string;
  clientRequestId: string;
  correlationId: string;
  policyId: string;
  policyVersion: number;
  payload: unknown;
}

export interface OutboxAppend {
  organizationId: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  eventType: string;
  correlationId: string;
  causationId: string;
  payload: unknown;
}

export interface AggregateRelationClaim {
  organizationId: string;
  relationType: string;
  sourceType: string;
  sourceId: string;
  sourceVersion: number;
  targetType: string;
  targetId: string;
  payload: unknown;
}

export interface SourceProposalSnapshot {
  id: string;
  organizationId: string;
  version: number;
  sourceType: string;
  sourceId: string;
  sourceVersion: number;
  title: string;
  problem: string | null;
  proposedOutcome: string | null;
  projectId: string | null;
  initiativeOwnerId: string | null;
  visibility: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
  evidenceState: 'READY' | 'PARTIAL' | 'STALE' | 'UNKNOWN';
  duplicateState: 'CLEAR' | 'POSSIBLE' | 'UNKNOWN';
  status: string;
  registeredInitiativeId: string | null;
}

export interface InitiativeCardSnapshot {
  cardKey: string;
  cardVersion: number;
  applicability: 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';
  completion: 'EMPTY' | 'IN_PROGRESS' | 'COMPLETE';
  quality: 'UNKNOWN' | 'SUFFICIENT' | 'WARNING' | 'BLOCKER';
  freshness: 'CURRENT' | 'STALE' | 'SOURCE_UNAVAILABLE';
  reviewState: 'NOT_REQUESTED' | 'REQUESTED' | 'CHANGES_REQUESTED' | 'ACCEPTED';
  content: Record<string, unknown>;
  evidenceRefs: string[];
  waiverDecisionId: string | null;
  publishedBy: string;
}

export type SourceProposalDisposition =
  | 'REGISTER'
  | 'MERGE'
  | 'EXTEND'
  | 'RETURN'
  | 'DEFER'
  | 'DISMISS';

export interface MaterialCommandTransaction {
  findReceipt<TResponse>(
    organizationId: string,
    clientRequestId: string
  ): Promise<StoredCommandReceipt<TResponse> | null>;
  getAggregateVersion(
    organizationId: string,
    aggregateType: string,
    aggregateId: string
  ): Promise<number | null>;
  getAggregatePayload<TPayload>(
    organizationId: string,
    aggregateType: string,
    aggregateId: string
  ): Promise<TPayload | null>;
  persistAggregate<TMutation>(
    organizationId: string,
    aggregateType: string,
    aggregateId: string,
    fromVersion: number,
    toVersion: number,
    mutation: TMutation
  ): Promise<void>;
  getRelatedAggregateForUpdate<TPayload>(
    organizationId: string,
    aggregateType: string,
    aggregateId: string
  ): Promise<{ version: number; payload: TPayload } | null>;
  persistRelatedAggregate<TMutation>(
    organizationId: string,
    aggregateType: string,
    aggregateId: string,
    fromVersion: number,
    toVersion: number,
    mutation: TMutation
  ): Promise<void>;
  claimRelation(claim: AggregateRelationClaim): Promise<void>;
  getSourceProposalForUpdate(
    organizationId: string,
    proposalId: string
  ): Promise<SourceProposalSnapshot | null>;
  markSourceProposalRegistered(
    organizationId: string,
    proposalId: string,
    proposalVersion: number,
    initiativeId: string
  ): Promise<void>;
  markSourceProposalDisposition(
    organizationId: string,
    proposalId: string,
    proposalVersion: number,
    disposition: Exclude<SourceProposalDisposition, 'REGISTER'>,
    targetInitiativeId: string | null
  ): Promise<void>;
  reviseSourceProposal?(input: {
    organizationId: string;
    proposalId: string;
    expectedProposalVersion: number;
    sourceVersion: number;
    provenance: Record<string, unknown>;
  }): Promise<void>;
  isCanonicalInitiativeCard(cardKey: string): Promise<boolean>;
  listCanonicalInitiativeCardKeys(): Promise<string[]>;
  replaceInitiativeCardSelection(input: {
    organizationId: string;
    initiativeId: string;
    cards: Array<{
      cardKey: string;
      included: boolean;
      position: number;
      requiredness: 'REQUIRED' | 'OPTIONAL';
      waiverDecisionId: string | null;
    }>;
  }): Promise<void>;
  getInitiativeCardVersionForUpdate(
    organizationId: string,
    initiativeId: string,
    cardKey: string
  ): Promise<number>;
  getLatestInitiativeCardForUpdate(
    organizationId: string,
    initiativeId: string,
    cardKey: string
  ): Promise<InitiativeCardSnapshot | null>;
  publishInitiativeCardVersion(input: {
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
  }): Promise<void>;
  reviewInitiativeCardVersion(input: {
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
  }): Promise<void>;
  appendAudit(entry: AuditAppend): Promise<void>;
  appendOutbox(entry: OutboxAppend): Promise<void>;
  saveReceipt<TResponse>(receipt: StoredCommandReceipt<TResponse>): Promise<void>;
}

export interface MaterialCommandUnitOfWork {
  transaction<T>(work: (transaction: MaterialCommandTransaction) => Promise<T>): Promise<T>;
}

export interface PreparedMaterialChange<TMutation, TResponse> {
  mutation: TMutation;
  response: TResponse;
  eventType: string;
  eventPayload: unknown;
  auditPayload: unknown;
}

export class MaterialCommandValidationError extends Error {}
export class MaterialCommandConflictError extends Error {
  constructor(
    message: string,
    readonly expectedVersion: number,
    readonly currentVersion: number | null
  ) {
    super(message);
  }
}

function validateEnvelope<TPayload>(envelope: MaterialCommandEnvelope<TPayload>): void {
  const requiredStrings: Array<[string, string]> = [
    ['organizationId', envelope.organizationId],
    ['actorId', envelope.actorId],
    ['aggregateType', envelope.aggregateType],
    ['aggregateId', envelope.aggregateId],
    ['clientRequestId', envelope.clientRequestId],
    ['correlationId', envelope.correlationId],
    ['policyId', envelope.policyId],
    ['commandType', envelope.commandType],
  ];
  const missing = requiredStrings.filter(([, value]) => !value.trim()).map(([field]) => field);
  if (missing.length > 0) {
    throw new MaterialCommandValidationError(`Missing command metadata: ${missing.join(', ')}`);
  }
  if (!Number.isInteger(envelope.expectedVersion) || envelope.expectedVersion < 0) {
    throw new MaterialCommandValidationError('expectedVersion must be a non-negative integer');
  }
  if (!Number.isInteger(envelope.policyVersion) || envelope.policyVersion < 1) {
    throw new MaterialCommandValidationError('policyVersion must be a positive integer');
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

export function materialCommandFingerprint<TPayload>(
  envelope: MaterialCommandEnvelope<TPayload>
): string {
  return createHash('sha256')
    .update(
      canonicalJson({
        aggregateType: envelope.aggregateType,
        aggregateId: envelope.aggregateId,
        commandType: envelope.commandType,
        expectedVersion: envelope.expectedVersion,
        policyId: envelope.policyId,
        policyVersion: envelope.policyVersion,
        payload: envelope.payload,
      })
    )
    .digest('hex');
}

const ARCHIVE_COMMAND = 'initiative.archive';

interface AggregateReference {
  aggregateType: string;
  aggregateId: string;
}

function collectArchiveContext(
  value: unknown,
  initiativeIds: Set<string>,
  references: AggregateReference[]
): void {
  if (typeof value === 'string') {
    const initiativeRef = value.match(/^initiative[:/]([^:/]+)$/i);
    if (initiativeRef?.[1]) initiativeIds.add(initiativeRef[1]);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectArchiveContext(entry, initiativeIds, references));
    return;
  }
  const record = value as Record<string, unknown>;
  const initiativeId = record.initiativeId;
  if (typeof initiativeId === 'string' && initiativeId.trim()) initiativeIds.add(initiativeId);
  const initiativeIdsValue = record.initiativeIds;
  if (Array.isArray(initiativeIdsValue)) {
    initiativeIdsValue.forEach((id) => {
      if (typeof id === 'string' && id.trim()) initiativeIds.add(id);
    });
  }

  const typedReference = (aggregateType: string, id: unknown): void => {
    if (typeof id === 'string' && id.trim()) references.push({ aggregateType, aggregateId: id });
  };
  typedReference('execution_case', record.executionCaseId);
  typedReference('execution_task', record.taskId);
  typedReference('execution_decision', record.decisionId);
  typedReference('decision', record.decisionId);
  if (
    typeof record.sourceType === 'string' &&
    typeof record.sourceId === 'string' &&
    record.sourceType.trim() &&
    record.sourceId.trim()
  ) {
    references.push({ aggregateType: record.sourceType, aggregateId: record.sourceId });
  }
  if (
    typeof record.targetAggregateType === 'string' &&
    typeof record.targetAggregateId === 'string' &&
    record.targetAggregateType.trim() &&
    record.targetAggregateId.trim()
  ) {
    references.push({
      aggregateType: record.targetAggregateType,
      aggregateId: record.targetAggregateId,
    });
  }
  Object.values(record).forEach((entry) => collectArchiveContext(entry, initiativeIds, references));
}

async function assertArchivedInitiativeIsReadOnly<TPayload>(
  transaction: MaterialCommandTransaction,
  envelope: MaterialCommandEnvelope<TPayload>
): Promise<void> {
  // Archive is the final permitted material transition. All reads bypass this command bus.
  if (envelope.commandType === ARCHIVE_COMMAND) return;

  const initiativeIds = new Set<string>();
  const references: AggregateReference[] = [];
  if (envelope.aggregateType === 'initiative') initiativeIds.add(envelope.aggregateId);
  collectArchiveContext(envelope.payload, initiativeIds, references);

  const currentPayload = await transaction.getAggregatePayload<unknown>(
    envelope.organizationId,
    envelope.aggregateType,
    envelope.aggregateId
  );
  collectArchiveContext(currentPayload, initiativeIds, references);

  // Resolve canonical dependent objects (and explicit target references) so transitions whose
  // command payload only carries an action cannot evade the Initiative archive boundary.
  const seen = new Set<string>();
  for (let cursor = 0; cursor < references.length; cursor += 1) {
    const reference = references[cursor];
    const key = `${reference.aggregateType}:${reference.aggregateId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const referencedPayload = await transaction.getAggregatePayload<unknown>(
      envelope.organizationId,
      reference.aggregateType,
      reference.aggregateId
    );
    collectArchiveContext(referencedPayload, initiativeIds, references);
  }

  for (const initiativeId of initiativeIds) {
    const initiative = await transaction.getAggregatePayload<Record<string, unknown>>(
      envelope.organizationId,
      'initiative',
      initiativeId
    );
    if (initiative?.lifecycleState === 'ARCHIVED' || initiative?.status === 'ARCHIVED') {
      throw new MaterialCommandValidationError(
        'Archived Initiative is read-only; restore is not supported'
      );
    }
  }
}

export async function executeMaterialCommand<TPayload, TMutation, TResponse>(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<TPayload>,
  prepare: (
    transaction: MaterialCommandTransaction,
    envelope: MaterialCommandEnvelope<TPayload>
  ) => Promise<PreparedMaterialChange<TMutation, TResponse>>
): Promise<MaterialCommandResult<TResponse>> {
  validateEnvelope(envelope);
  const requestFingerprint = materialCommandFingerprint(envelope);

  return unitOfWork.transaction(async (transaction) => {
    const receipt = await transaction.findReceipt<TResponse>(
      envelope.organizationId,
      envelope.clientRequestId
    );
    if (receipt) {
      if (
        receipt.commandType !== envelope.commandType ||
        receipt.aggregateType !== envelope.aggregateType ||
        receipt.aggregateId !== envelope.aggregateId ||
        receipt.requestFingerprint !== requestFingerprint
      ) {
        throw new MaterialCommandConflictError(
          'clientRequestId was already used for a different command target',
          envelope.expectedVersion,
          receipt.aggregateVersion
        );
      }
      return {
        status: 'REPLAYED',
        aggregateVersion: receipt.aggregateVersion,
        response: receipt.response,
        correlationId: receipt.correlationId,
        receiptId: receipt.clientRequestId,
        readBackState: 'PENDING',
        readBackUrl: `/runtime-v1/command-receipts/${encodeURIComponent(receipt.clientRequestId)}/read-back`,
      };
    }

    await assertArchivedInitiativeIsReadOnly(transaction, envelope);

    const currentVersion = await transaction.getAggregateVersion(
      envelope.organizationId,
      envelope.aggregateType,
      envelope.aggregateId
    );
    const validCreate =
      envelope.createIfMissing === true &&
      currentVersion === null &&
      envelope.expectedVersion === 0;
    if (!validCreate && currentVersion !== envelope.expectedVersion) {
      throw new MaterialCommandConflictError(
        'aggregate version conflict',
        envelope.expectedVersion,
        currentVersion
      );
    }

    const change = await prepare(transaction, envelope);
    const nextVersion = envelope.expectedVersion + 1;
    await transaction.persistAggregate(
      envelope.organizationId,
      envelope.aggregateType,
      envelope.aggregateId,
      envelope.expectedVersion,
      nextVersion,
      change.mutation
    );
    await transaction.appendAudit({
      organizationId: envelope.organizationId,
      actorId: envelope.actorId,
      aggregateType: envelope.aggregateType,
      aggregateId: envelope.aggregateId,
      aggregateVersion: nextVersion,
      commandType: envelope.commandType,
      clientRequestId: envelope.clientRequestId,
      correlationId: envelope.correlationId,
      policyId: envelope.policyId,
      policyVersion: envelope.policyVersion,
      payload: change.auditPayload,
    });
    await transaction.appendOutbox({
      organizationId: envelope.organizationId,
      aggregateType: envelope.aggregateType,
      aggregateId: envelope.aggregateId,
      aggregateVersion: nextVersion,
      eventType: change.eventType,
      correlationId: envelope.correlationId,
      causationId: envelope.clientRequestId,
      payload: change.eventPayload,
    });
    const storedReceipt: StoredCommandReceipt<TResponse> = {
      organizationId: envelope.organizationId,
      clientRequestId: envelope.clientRequestId,
      commandType: envelope.commandType,
      aggregateType: envelope.aggregateType,
      aggregateId: envelope.aggregateId,
      aggregateVersion: nextVersion,
      correlationId: envelope.correlationId,
      requestFingerprint,
      response: change.response,
    };
    await transaction.saveReceipt(storedReceipt);

    return {
      status: 'APPLIED',
      aggregateVersion: nextVersion,
      response: change.response,
      correlationId: envelope.correlationId,
      receiptId: envelope.clientRequestId,
      readBackState: 'PENDING',
      readBackUrl: `/runtime-v1/command-receipts/${encodeURIComponent(envelope.clientRequestId)}/read-back`,
    };
  });
}
