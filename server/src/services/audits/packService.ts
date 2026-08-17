/**
 * packService — CRUD Audit Packów (`audit_packs`) i ich kryteriów
 * (`audit_pack_criteria`).
 *
 * TWARDA REGUŁA (nie do obejścia z tego pliku): `publishPack` zawsze
 * przechodzi przez `packValidator.assertPublishable` — niezależnie od
 * docelowej klasyfikacji. Żadna ścieżka w tym serwisie nie ustawia
 * `publication_status = 'published'` inaczej.
 *
 * `replaceCriteria` używa PRAWDZIWEJ transakcji Postgres przez
 * `acquirePgClient()` (jeden przypięty `PoolClient`, `BEGIN`/.../`COMMIT`).
 * `DbPromise.run()`/`.transaction()` NIE dają atomiczności na Postgresie —
 * każde wywołanie idzie przez `pool.query()`, które może trafić na inne
 * fizyczne połączenie (patrz komentarz `acquirePgClient` w
 * `PostgresDatabase.ts`, MW-DEC-001). Usuwanie i wstawianie kilkunastu
 * kryteriów jako osobne `pool.query()` mogłoby zostawić pakiet z połową
 * starego, połową nowego drzewa po awarii w środku.
 */

import type { PoolClient } from 'pg';

import { acquirePgClient } from '../../database/PostgresDatabase.js';

import {
  auditAll,
  auditGet,
  auditRun,
  AuditDomainError,
  AuditNotFoundError,
  AuditStateError,
  newId,
  parseJson,
  recordAuditEvent,
  toBool,
  toIso,
  toNum,
} from './auditsDb.js';
import { assertPublishable, validatePack } from './packValidator.js';
import type { PackValidationResult } from './packValidator.js';
import { PACK_CLASSIFICATIONS, PUBLICATION_STATUSES } from './types.js';
import type {
  AuditSourceType,
  AuditVerificationState,
  AuditActor,
  AuditNormSource,
  AuditPack,
  AuditPackCriterion,
  CriterionNodeKind,
  ExpectedEvidenceSpec,
  FindingTaxonomyEntry,
  PackClassification,
  PackDecisionRules,
  PublicationStatus,
  SeverityRule,
} from './types.js';

// ---------------------------------------------------------------------------
// Mapowanie wierszy
// ---------------------------------------------------------------------------

interface PackRow {
  /** Kolumny dodane migracją rozdzielenia osi; stare wiersze ich nie mają. */
  source_type?: string | null;
  verification_state?: string | null;
  id: string;
  organization_id: string | null;
  pack_key: string;
  version: number;
  title: string;
  summary: string | null;
  purpose: string | null;
  source_id: string | null;
  source_version: string | null;
  classification: string;
  publication_status: string;
  scope: string | null;
  objectives: string | null;
  audit_type: string | null;
  required_roles: unknown;
  required_competencies: unknown;
  workflow: unknown;
  finding_taxonomy: unknown;
  severity_rules: unknown;
  decision_rules: unknown;
  sampling_guidance: string | null;
  output_schema: unknown;
  report_schema: unknown;
  corrective_action_schema: unknown;
  verification_schema: unknown;
  estimated_duration_days: number | null;
  recurrence_default: string | null;
  effective_from: string | null;
  effective_to: string | null;
  provenance: unknown;
  expert_approved_by: string | null;
  expert_approved_at: string | null;
  expert_approval_note: string | null;
  published_by: string | null;
  published_at: string | null;
  deprecated_at: string | null;
  supersedes_pack_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface CriterionRow {
  id: string;
  pack_id: string;
  parent_id: string | null;
  ordinal: number;
  ref_code: string | null;
  node_kind: string;
  title: string;
  requirement_text: string | null;
  source_reference: string | null;
  audit_question: string | null;
  expected_evidence: unknown;
  audit_procedure: string | null;
  sampling_guidance: string | null;
  applicability_rule: unknown;
  mandatory: boolean;
  weight: string | number | null;
  suggested_owner_role: string | null;
  created_at: string;
  updated_at: string;
}

function mapPackRow(row: PackRow): AuditPack {
  return {
    id: row.id,
    organizationId: row.organization_id,
    packKey: row.pack_key,
    version: Number(row.version),
    title: row.title,
    summary: row.summary,
    purpose: row.purpose,
    sourceId: row.source_id,
    sourceVersion: row.source_version,
    // Dwie niezależne osie. Fallback dla wierszy sprzed rozdzielenia jest
    // zachowawczy: nic nie awansuje na normę, bo stara kolumna nie niosła
    // informacji o tym, czym dokument JEST — tylko o tym, czy mu ufano.
    sourceType: (row.source_type as AuditSourceType) ?? 'INTERNAL_PROCEDURE',
    verificationStatus:
      (row.verification_state as AuditVerificationState) ?? 'EVIDENCE_MISSING',
    classification: row.classification as PackClassification,
    publicationStatus: row.publication_status as PublicationStatus,
    scope: row.scope,
    objectives: row.objectives,
    auditType: row.audit_type,
    requiredRoles: parseJson(row.required_roles, []),
    requiredCompetencies: parseJson(row.required_competencies, []),
    workflow: parseJson(row.workflow, {}),
    findingTaxonomy: parseJson<FindingTaxonomyEntry[]>(row.finding_taxonomy, []),
    severityRules: parseJson<SeverityRule[]>(row.severity_rules, []),
    decisionRules: parseJson<PackDecisionRules>(row.decision_rules, {}),
    samplingGuidance: row.sampling_guidance,
    outputSchema: parseJson(row.output_schema, {}),
    reportSchema: parseJson(row.report_schema, {}),
    correctiveActionSchema: parseJson(row.corrective_action_schema, {}),
    verificationSchema: parseJson(row.verification_schema, {}),
    estimatedDurationDays: row.estimated_duration_days,
    recurrenceDefault: row.recurrence_default,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    provenance: parseJson(row.provenance, {}),
    expertApprovedBy: row.expert_approved_by,
    expertApprovedAt: toIso(row.expert_approved_at),
    expertApprovalNote: row.expert_approval_note,
    publishedBy: row.published_by,
    publishedAt: toIso(row.published_at),
    deprecatedAt: toIso(row.deprecated_at),
    supersedesPackId: row.supersedes_pack_id,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at) as string,
    updatedAt: toIso(row.updated_at) as string,
  };
}

function mapCriterionRow(row: CriterionRow): AuditPackCriterion {
  return {
    id: row.id,
    packId: row.pack_id,
    parentId: row.parent_id,
    ordinal: Number(row.ordinal),
    refCode: row.ref_code,
    nodeKind: row.node_kind as CriterionNodeKind,
    title: row.title,
    requirementText: row.requirement_text,
    sourceReference: row.source_reference,
    auditQuestion: row.audit_question,
    expectedEvidence: parseJson<ExpectedEvidenceSpec[]>(row.expected_evidence, []),
    auditProcedure: row.audit_procedure,
    samplingGuidance: row.sampling_guidance,
    applicabilityRule: parseJson(row.applicability_rule, {}),
    mandatory: toBool(row.mandatory),
    weight: toNum(row.weight),
    suggestedOwnerRole: row.suggested_owner_role,
    createdAt: toIso(row.created_at) as string,
    updatedAt: toIso(row.updated_at) as string,
  };
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export interface PackCriterionNode extends AuditPackCriterion {
  children: PackCriterionNode[];
}

/** Buduje drzewo z listy płaskiej posortowanej po ordinal. Sieroty (rodzic spoza zbioru) trafiają na najwyższy poziom, żeby nic nie zniknęło z odczytu. */
export function buildCriteriaTree(flat: AuditPackCriterion[]): PackCriterionNode[] {
  const nodes = new Map<string, PackCriterionNode>();
  for (const c of flat) nodes.set(c.id, { ...c, children: [] });

  const roots: PackCriterionNode[] = [];
  for (const c of flat) {
    const node = nodes.get(c.id) as PackCriterionNode;
    const parent = c.parentId ? nodes.get(c.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const byOrdinal = (a: PackCriterionNode, b: PackCriterionNode) => a.ordinal - b.ordinal;
  const sortRec = (list: PackCriterionNode[]) => {
    list.sort(byOrdinal);
    for (const n of list) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

// ---------------------------------------------------------------------------
// Odczyt
// ---------------------------------------------------------------------------

/**
 * Non-admin read scoping (AUD-MVP-RIGHTS-001 / AMD-AUD-RIGHTS-001): an org
 * member who is not a platform admin may only read PUBLISHED packs, plus
 * their OWN draft/in-review packs (they authored them, so seeing their own
 * unpublished work is not a rights leak). Platform admins are unrestricted —
 * pass no `readScope` for admin or internal callers (e.g. packSeed.ts).
 */
export interface PackReadScope {
  actorUserId: string;
}

export interface ListPacksParams {
  search?: string;
  status?: PublicationStatus;
  classification?: PackClassification;
  limit?: number;
  offset?: number;
  readScope?: PackReadScope;
}

export async function listPacks(
  organizationId: string,
  params: ListPacksParams = {},
): Promise<{ items: AuditPack[]; total: number }> {
  assertValidStatus(params.status);
  assertValidClassification(params.classification);
  const conditions: string[] = ['(organization_id = $1 OR organization_id IS NULL)'];
  const values: unknown[] = [organizationId];

  if (isNonEmpty(params.search)) {
    values.push(`%${params.search.trim()}%`);
    conditions.push(`(title ILIKE $${values.length} OR pack_key ILIKE $${values.length} OR summary ILIKE $${values.length})`);
  }
  if (params.readScope) {
    values.push(params.readScope.actorUserId);
    const ownRowClause = `created_by = $${values.length}`;
    if (isNonEmpty(params.status)) {
      // An explicit status ask from a scoped (non-admin) caller is honored only
      // for 'published'; anything else narrows to their own rows. A scoped
      // caller can therefore never widen their own visibility via ?status=.
      values.push(params.status);
      conditions.push(`((publication_status = $${values.length} AND publication_status = 'published') OR ${ownRowClause})`);
    } else {
      conditions.push(`(publication_status = 'published' OR ${ownRowClause})`);
    }
  } else if (isNonEmpty(params.status)) {
    values.push(params.status);
    conditions.push(`publication_status = $${values.length}`);
  }
  if (isNonEmpty(params.classification)) {
    values.push(params.classification);
    conditions.push(`classification = $${values.length}`);
  }

  const where = conditions.join(' AND ');
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const offset = Math.max(params.offset ?? 0, 0);

  const countRow = await auditGet<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM audit_packs WHERE ${where}`,
    values,
  );
  const rows = await auditAll<PackRow>(
    `SELECT * FROM audit_packs WHERE ${where}
       ORDER BY pack_key ASC, version DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );

  return { items: rows.map(mapPackRow), total: Number(countRow?.count ?? 0) };
}

async function getPackRow(organizationId: string, id: string): Promise<PackRow> {
  const row = await auditGet<PackRow>(
    `SELECT * FROM audit_packs WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)`,
    [id, organizationId],
  );
  if (!row) throw new AuditNotFoundError('Pakiet audytowy');
  return row;
}

export async function getCriteriaFlat(packId: string): Promise<AuditPackCriterion[]> {
  const rows = await auditAll<CriterionRow>(
    `SELECT * FROM audit_pack_criteria WHERE pack_id = $1 ORDER BY ordinal ASC`,
    [packId],
  );
  return rows.map(mapCriterionRow);
}

export async function getPack(
  organizationId: string,
  id: string,
  readScope?: PackReadScope,
): Promise<AuditPack & { criteria: PackCriterionNode[] }> {
  const row = await getPackRow(organizationId, id);
  if (readScope && row.publication_status !== 'published' && row.created_by !== readScope.actorUserId) {
    // AUD-MVP-RIGHTS-001 / AMD-AUD-RIGHTS-001: a scoped (non-admin) caller
    // cannot fetch a draft/in-review pack by id unless they authored it —
    // this closes the direct-id path around the listPacks default above.
    // 404, not 403, so the existence of a foreign draft is not disclosed.
    throw new AuditNotFoundError('Pakiet audytowy');
  }
  const flat = await getCriteriaFlat(id);
  return { ...mapPackRow(row), criteria: buildCriteriaTree(flat) };
}

async function getSourceForPack(sourceId: string | null): Promise<AuditNormSource | null> {
  if (!sourceId) return null;
  const row = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_norm_sources WHERE id = $1`,
    [sourceId],
  );
  if (!row) return null;
  return {
    id: row.id as string,
    organizationId: (row.organization_id as string) ?? null,
    sourceKey: row.source_key as string,
    title: row.title as string,
    publisher: (row.publisher as string) ?? null,
    sourceVersion: (row.source_version as string) ?? null,
    sourceKind: row.source_kind as AuditNormSource['sourceKind'],
    rightsStatus: row.rights_status as AuditNormSource['rightsStatus'],
    rightsNote: (row.rights_note as string) ?? null,
    licenseReference: (row.license_reference as string) ?? null,
    sourceUri: (row.source_uri as string) ?? null,
    materialId: (row.material_id as string) ?? null,
    materialVersion: (row.material_version as string) ?? null,
    effectiveFrom: (row.effective_from as string) ?? null,
    effectiveTo: (row.effective_to as string) ?? null,
    sourceType: (row.source_type as AuditSourceType) ?? 'INTERNAL_PROCEDURE',
    verificationStatus: (row.verification_state as AuditVerificationState) ?? 'EVIDENCE_MISSING',
    legacyClassification: (row.verification_status as PackClassification) ?? null,
    verifiedBy: (row.verified_by as string) ?? null,
    verifiedAt: toIso(row.verified_at),
    verificationNote: (row.verification_note as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    createdAt: toIso(row.created_at) as string,
    updatedAt: toIso(row.updated_at) as string,
  };
}

// ---------------------------------------------------------------------------
// Zapis — pakiet
// ---------------------------------------------------------------------------

export interface CreatePackInput {
  packKey: string;
  title: string;
  summary?: string | null;
  purpose?: string | null;
  sourceId?: string | null;
  sourceVersion?: string | null;
  /** CZYM jest źródło pakietu. Domyślnie dziedziczone ze wskazanego źródła. */
  sourceType?: AuditSourceType;
  classification?: PackClassification;
  scope?: string | null;
  objectives?: string | null;
  auditType?: string | null;
  requiredRoles?: AuditPack['requiredRoles'];
  requiredCompetencies?: string[];
  workflow?: Record<string, unknown>;
  findingTaxonomy?: FindingTaxonomyEntry[];
  severityRules?: SeverityRule[];
  decisionRules?: PackDecisionRules;
  samplingGuidance?: string | null;
  outputSchema?: Record<string, unknown>;
  reportSchema?: Record<string, unknown>;
  correctiveActionSchema?: Record<string, unknown>;
  verificationSchema?: Record<string, unknown>;
  estimatedDurationDays?: number | null;
  recurrenceDefault?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  provenance?: Record<string, unknown>;
}

function assertValidClassification(value: string | undefined | null): void {
  if (value !== undefined && value !== null && !PACK_CLASSIFICATIONS.includes(value as PackClassification)) {
    throw new AuditDomainError(
      `Nieznana klasyfikacja pakietu: „${value}". Dozwolone: ${PACK_CLASSIFICATIONS.join(', ')}`,
      400,
      'AUDIT_PACK_CLASSIFICATION_INVALID',
    );
  }
}

function assertValidStatus(value: string | undefined | null): void {
  if (value !== undefined && value !== null && !PUBLICATION_STATUSES.includes(value as PublicationStatus)) {
    throw new AuditDomainError(
      `Nieznany status publikacji: „${value}". Dozwolone: ${PUBLICATION_STATUSES.join(', ')}`,
      400,
      'AUDIT_PACK_STATUS_INVALID',
    );
  }
}

export async function createPack(actor: AuditActor, input: CreatePackInput): Promise<AuditPack> {
  if (!isNonEmpty(input.packKey)) {
    throw new AuditDomainError('Pakiet musi mieć stabilny klucz (pack_key)', 400, 'AUDIT_PACK_KEY_MISSING');
  }
  if (!isNonEmpty(input.title)) {
    throw new AuditDomainError('Pakiet musi mieć tytuł', 400, 'AUDIT_PACK_TITLE_MISSING');
  }
  assertValidClassification(input.classification);

  const existing = await auditGet<{ id: string }>(
    `SELECT id FROM audit_packs WHERE (organization_id = $1 OR organization_id IS NULL) AND pack_key = $2 AND version = 1`,
    [actor.organizationId, input.packKey.trim()],
  );
  if (existing) {
    throw new AuditStateError(`Pakiet o kluczu „${input.packKey.trim()}" (wersja 1) już istnieje`);
  }

  const id = newId('apk');

  // Gdy pakiet wskazuje źródło, jego typ jest domyślną naturą pakietu — pakiet
  // nie może mieć innej natury niż dokument, na którym stoi. Autor może podać
  // typ jawnie, ale walidator sprawdzi zgodność ze źródłem przy publikacji.
  let inheritedSourceType: AuditSourceType | null = null;
  if (isNonEmpty(input.sourceId)) {
    const srcRow = await auditGet<{ source_type: string | null }>(
      `SELECT source_type FROM audit_norm_sources
        WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)`,
      [input.sourceId, actor.organizationId],
    );
    inheritedSourceType = (srcRow?.source_type as AuditSourceType) ?? null;
  }

  await auditRun(
    `INSERT INTO audit_packs
       (id, organization_id, pack_key, version, title, summary, purpose, source_id, source_version,
        classification, publication_status, scope, objectives, audit_type, required_roles,
        required_competencies, workflow, finding_taxonomy, severity_rules, decision_rules,
        sampling_guidance, output_schema, report_schema, corrective_action_schema, verification_schema,
        estimated_duration_days, recurrence_default, effective_from, effective_to, provenance,
        source_type, verification_state, created_by)
     VALUES ($1,$2,$3,1,$4,$5,$6,$7,$8,$9,'draft',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)`,
    [
      id,
      actor.organizationId,
      input.packKey.trim(),
      input.title.trim(),
      input.summary ?? null,
      input.purpose ?? null,
      input.sourceId ?? null,
      input.sourceVersion ?? null,
      input.classification ?? 'EVIDENCE_MISSING',
      input.scope ?? null,
      input.objectives ?? null,
      input.auditType ?? null,
      JSON.stringify(input.requiredRoles ?? []),
      JSON.stringify(input.requiredCompetencies ?? []),
      JSON.stringify(input.workflow ?? {}),
      JSON.stringify(input.findingTaxonomy ?? []),
      JSON.stringify(input.severityRules ?? []),
      JSON.stringify(input.decisionRules ?? {}),
      input.samplingGuidance ?? null,
      JSON.stringify(input.outputSchema ?? {}),
      JSON.stringify(input.reportSchema ?? {}),
      JSON.stringify(input.correctiveActionSchema ?? {}),
      JSON.stringify(input.verificationSchema ?? {}),
      input.estimatedDurationDays ?? null,
      input.recurrenceDefault ?? null,
      input.effectiveFrom ?? null,
      input.effectiveTo ?? null,
      JSON.stringify(input.provenance ?? {}),
      // Typ dziedziczony ze wskazanego źródła, gdy autor go nie podał —
      // pakiet nie może mieć innej natury niż dokument, na którym stoi.
      input.sourceType ?? inheritedSourceType ?? 'INTERNAL_PROCEDURE',
      'UNVERIFIED',
      actor.userId,
    ],
  );

  await recordAuditEvent({
    organizationId: actor.organizationId,
    entityType: 'audit_pack',
    entityId: id,
    eventType: 'pack.created',
    actorId: actor.userId,
    summary: `Utworzono pakiet „${input.title.trim()}" (${input.packKey.trim()} v1)`,
  });

  const row = await getPackRow(actor.organizationId, id);
  return mapPackRow(row);
}

export type UpdatePackInput = Partial<CreatePackInput>;

export async function updatePack(
  actor: AuditActor,
  id: string,
  input: UpdatePackInput,
): Promise<AuditPack> {
  const existing = await getPackRow(actor.organizationId, id);
  if (existing.publication_status === 'published') {
    throw new AuditStateError(
      'Opublikowanego pakietu nie można edytować w miejscu — utwórz nową wersję (createNewVersion)',
    );
  }
  assertValidClassification(input.classification);
  if (input.title !== undefined && !isNonEmpty(input.title)) {
    throw new AuditDomainError('Tytuł pakietu nie może być pusty', 400, 'AUDIT_PACK_TITLE_MISSING');
  }

  const merged = mapPackRow(existing);
  await auditRun(
    `UPDATE audit_packs SET
       title = $1, summary = $2, purpose = $3, source_id = $4, source_version = $5,
       classification = $6, scope = $7, objectives = $8, audit_type = $9, required_roles = $10,
       required_competencies = $11, workflow = $12, finding_taxonomy = $13, severity_rules = $14,
       decision_rules = $15, sampling_guidance = $16, output_schema = $17, report_schema = $18,
       corrective_action_schema = $19, verification_schema = $20, estimated_duration_days = $21,
       recurrence_default = $22, effective_from = $23, effective_to = $24, provenance = $25,
       updated_at = NOW()
     WHERE id = $26 AND (organization_id = $27 OR organization_id IS NULL)`,
    [
      input.title !== undefined ? input.title.trim() : merged.title,
      input.summary !== undefined ? input.summary : merged.summary,
      input.purpose !== undefined ? input.purpose : merged.purpose,
      input.sourceId !== undefined ? input.sourceId : merged.sourceId,
      input.sourceVersion !== undefined ? input.sourceVersion : merged.sourceVersion,
      input.classification !== undefined ? input.classification : merged.classification,
      input.scope !== undefined ? input.scope : merged.scope,
      input.objectives !== undefined ? input.objectives : merged.objectives,
      input.auditType !== undefined ? input.auditType : merged.auditType,
      JSON.stringify(input.requiredRoles !== undefined ? input.requiredRoles : merged.requiredRoles),
      JSON.stringify(
        input.requiredCompetencies !== undefined ? input.requiredCompetencies : merged.requiredCompetencies,
      ),
      JSON.stringify(input.workflow !== undefined ? input.workflow : merged.workflow),
      JSON.stringify(input.findingTaxonomy !== undefined ? input.findingTaxonomy : merged.findingTaxonomy),
      JSON.stringify(input.severityRules !== undefined ? input.severityRules : merged.severityRules),
      JSON.stringify(input.decisionRules !== undefined ? input.decisionRules : merged.decisionRules),
      input.samplingGuidance !== undefined ? input.samplingGuidance : merged.samplingGuidance,
      JSON.stringify(input.outputSchema !== undefined ? input.outputSchema : merged.outputSchema),
      JSON.stringify(input.reportSchema !== undefined ? input.reportSchema : merged.reportSchema),
      JSON.stringify(
        input.correctiveActionSchema !== undefined ? input.correctiveActionSchema : merged.correctiveActionSchema,
      ),
      JSON.stringify(input.verificationSchema !== undefined ? input.verificationSchema : merged.verificationSchema),
      input.estimatedDurationDays !== undefined ? input.estimatedDurationDays : merged.estimatedDurationDays,
      input.recurrenceDefault !== undefined ? input.recurrenceDefault : merged.recurrenceDefault,
      input.effectiveFrom !== undefined ? input.effectiveFrom : merged.effectiveFrom,
      input.effectiveTo !== undefined ? input.effectiveTo : merged.effectiveTo,
      JSON.stringify(input.provenance !== undefined ? input.provenance : merged.provenance),
      id,
      actor.organizationId,
    ],
  );

  await recordAuditEvent({
    organizationId: actor.organizationId,
    entityType: 'audit_pack',
    entityId: id,
    eventType: 'pack.updated',
    actorId: actor.userId,
    summary: `Zaktualizowano pakiet „${merged.title}"`,
  });

  const row = await getPackRow(actor.organizationId, id);
  return mapPackRow(row);
}

export async function deletePack(actor: AuditActor, id: string): Promise<void> {
  const existing = await getPackRow(actor.organizationId, id);
  if (existing.publication_status !== 'draft') {
    throw new AuditStateError(
      `Można usunąć wyłącznie pakiet w statusie „draft" (obecny status: ${existing.publication_status})`,
    );
  }

  await auditRun(
    `DELETE FROM audit_packs WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)`,
    [id, actor.organizationId],
  );

  await recordAuditEvent({
    organizationId: actor.organizationId,
    entityType: 'audit_pack',
    entityId: id,
    eventType: 'pack.deleted',
    actorId: actor.userId,
    summary: `Usunięto pakiet „${existing.title}" (draft)`,
  });
}

// ---------------------------------------------------------------------------
// Kryteria — zamiana całego drzewa w jednej transakcji
// ---------------------------------------------------------------------------

export interface ReplaceCriterionInput {
  /** Klucz tymczasowy z payloadu (może być stare id z bazy albo dowolny unikalny string) — służy WYŁĄCZNIE do powiązania parent/child w tym samym wywołaniu. Nie jest zapisywany. */
  id?: string;
  parentId?: string | null;
  ordinal?: number;
  refCode?: string | null;
  nodeKind?: CriterionNodeKind;
  title: string;
  requirementText?: string | null;
  sourceReference?: string | null;
  auditQuestion?: string | null;
  expectedEvidence?: ExpectedEvidenceSpec[];
  auditProcedure?: string | null;
  samplingGuidance?: string | null;
  applicabilityRule?: Record<string, unknown>;
  mandatory?: boolean;
  weight?: number | null;
  suggestedOwnerRole?: string | null;
}

/**
 * Usuwa całe drzewo kryteriów pakietu i wstawia nowe — w JEDNEJ transakcji na
 * przypiętym połączeniu (patrz nagłówek pliku). `parentId` w wejściu odnosi
 * się do `id` INNEGO elementu z TEGO SAMEGO wywołania (może to być stare id z
 * bazy albo świeżo nadany przez klienta tymczasowy identyfikator) — nowe id
 * bazodanowe jest nadawane tutaj i nie jest zależne od kolejności elementów w
 * tablicy wejściowej.
 */
export async function replaceCriteria(
  actor: AuditActor,
  packId: string,
  criteria: ReplaceCriterionInput[],
): Promise<AuditPackCriterion[]> {
  const packRow = await getPackRow(actor.organizationId, packId);
  if (packRow.publication_status === 'published') {
    throw new AuditStateError(
      'Kryteriów opublikowanego pakietu nie można podmienić — utwórz nową wersję (createNewVersion)',
    );
  }

  criteria.forEach((c, index) => {
    if (!isNonEmpty(c.title)) {
      throw new AuditDomainError(`Kryterium #${index} nie ma tytułu`, 400, 'AUDIT_CRITERION_TITLE_MISSING');
    }
  });

  const idMap = new Map<string, string>();
  const prepared = criteria.map((c, index) => {
    const providedKey = c.id ?? `__idx_${index}`;
    const generatedId = newId('apc');
    idMap.set(providedKey, generatedId);
    return { ...c, __newId: generatedId, __ordinal: c.ordinal ?? index };
  });

  const client: PoolClient = await acquirePgClient();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM audit_pack_criteria WHERE pack_id = $1`, [packId]);

    for (const c of prepared) {
      let parentNewId: string | null = null;
      if (c.parentId) {
        parentNewId = idMap.get(c.parentId) ?? null;
        if (!parentNewId) {
          throw new AuditDomainError(
            `Kryterium „${c.title}" wskazuje rodzica spoza tej listy (${c.parentId})`,
            400,
            'AUDIT_CRITERION_PARENT_MISSING',
          );
        }
      }
      await client.query(
        `INSERT INTO audit_pack_criteria
           (id, pack_id, parent_id, ordinal, ref_code, node_kind, title, requirement_text,
            source_reference, audit_question, expected_evidence, audit_procedure,
            sampling_guidance, applicability_rule, mandatory, weight, suggested_owner_role)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          c.__newId,
          packId,
          parentNewId,
          c.__ordinal,
          c.refCode ?? null,
          c.nodeKind ?? 'criterion',
          c.title.trim(),
          c.requirementText ?? null,
          c.sourceReference ?? null,
          c.auditQuestion ?? null,
          JSON.stringify(c.expectedEvidence ?? []),
          c.auditProcedure ?? null,
          c.samplingGuidance ?? null,
          JSON.stringify(c.applicabilityRule ?? {}),
          c.mandatory ?? true,
          c.weight ?? null,
          c.suggestedOwnerRole ?? null,
        ],
      );
    }

    await client.query(`UPDATE audit_packs SET updated_at = NOW() WHERE id = $1`, [packId]);
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // no-op — priorytetem jest zgłoszenie błędu pierwotnego
    }
    throw error;
  } finally {
    client.release();
  }

  await recordAuditEvent({
    organizationId: actor.organizationId,
    entityType: 'audit_pack',
    entityId: packId,
    eventType: 'pack.criteria_replaced',
    actorId: actor.userId,
    summary: `Podmieniono drzewo kryteriów pakietu (${criteria.length} pozycji)`,
  });

  return getCriteriaFlat(packId);
}

// ---------------------------------------------------------------------------
// Walidacja i publikacja
// ---------------------------------------------------------------------------

export async function validatePackById(organizationId: string, id: string): Promise<PackValidationResult> {
  const row = await getPackRow(organizationId, id);
  const pack = mapPackRow(row);
  const criteria = await getCriteriaFlat(id);
  const source = await getSourceForPack(pack.sourceId);
  return validatePack({ pack, criteria, source, targetPublicationStatus: 'published' });
}

export async function publishPack(actor: AuditActor, id: string): Promise<AuditPack> {
  const row = await getPackRow(actor.organizationId, id);
  if (row.publication_status === 'published') {
    throw new AuditStateError('Pakiet jest już opublikowany');
  }
  if (row.publication_status === 'deprecated') {
    throw new AuditStateError('Nie można opublikować wycofanego pakietu');
  }

  const pack = mapPackRow(row);
  const criteria = await getCriteriaFlat(id);
  const source = await getSourceForPack(pack.sourceId);

  // Bramka publikacji — NIE OMIJAĆ. `assertPublishable` rzuca zwykły Error z
  // listą powodów; tutaj zamieniamy go na AuditDomainError 422, żeby trasa
  // zwróciła czytelną odpowiedź zamiast 500.
  try {
    assertPublishable({ pack, criteria, source, targetPublicationStatus: 'published' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AuditDomainError(message, 422, 'AUDIT_PACK_NOT_PUBLISHABLE');
  }

  await auditRun(
    `UPDATE audit_packs SET publication_status = 'published', published_by = $1, published_at = NOW(), updated_at = NOW()
     WHERE id = $2 AND (organization_id = $3 OR organization_id IS NULL)`,
    [actor.userId, id, actor.organizationId],
  );

  await recordAuditEvent({
    organizationId: actor.organizationId,
    entityType: 'audit_pack',
    entityId: id,
    eventType: 'pack.published',
    actorId: actor.userId,
    summary: `Opublikowano pakiet „${pack.title}" (${pack.packKey} v${pack.version}) jako ${pack.classification}`,
  });

  const updated = await getPackRow(actor.organizationId, id);
  return mapPackRow(updated);
}

export async function approveByExpert(
  actor: AuditActor,
  id: string,
  note?: string | null,
): Promise<AuditPack> {
  const row = await getPackRow(actor.organizationId, id);
  if (row.publication_status === 'published' || row.publication_status === 'deprecated') {
    throw new AuditStateError(
      `Zatwierdzenie eksperckie dotyczy pakietu przed publikacją (obecny status: ${row.publication_status})`,
    );
  }

  await auditRun(
    `UPDATE audit_packs SET expert_approved_by = $1, expert_approved_at = NOW(), expert_approval_note = $2, updated_at = NOW()
     WHERE id = $3 AND (organization_id = $4 OR organization_id IS NULL)`,
    [actor.userId, note ?? null, id, actor.organizationId],
  );

  await recordAuditEvent({
    organizationId: actor.organizationId,
    entityType: 'audit_pack',
    entityId: id,
    eventType: 'pack.expert_approved',
    actorId: actor.userId,
    summary: `Ekspert zatwierdził pakiet „${row.title}"`,
  });

  const updated = await getPackRow(actor.organizationId, id);
  return mapPackRow(updated);
}

// ---------------------------------------------------------------------------
// Wersjonowanie
// ---------------------------------------------------------------------------

export async function createNewVersion(actor: AuditActor, packKey: string): Promise<AuditPack> {
  const latestRow = await auditGet<PackRow>(
    `SELECT * FROM audit_packs
      WHERE (organization_id = $1 OR organization_id IS NULL) AND pack_key = $2
      ORDER BY version DESC LIMIT 1`,
    [actor.organizationId, packKey],
  );
  if (!latestRow) {
    throw new AuditNotFoundError(`Pakiet o kluczu „${packKey}"`);
  }
  const latest = mapPackRow(latestRow);
  const newVersion = latest.version + 1;
  const newPackId = newId('apk');

  await auditRun(
    `INSERT INTO audit_packs
       (id, organization_id, pack_key, version, title, summary, purpose, source_id, source_version,
        classification, publication_status, scope, objectives, audit_type, required_roles,
        required_competencies, workflow, finding_taxonomy, severity_rules, decision_rules,
        sampling_guidance, output_schema, report_schema, corrective_action_schema, verification_schema,
        estimated_duration_days, recurrence_default, effective_from, effective_to, provenance,
        supersedes_pack_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)`,
    [
      newPackId,
      actor.organizationId,
      latest.packKey,
      newVersion,
      latest.title,
      latest.summary,
      latest.purpose,
      latest.sourceId,
      latest.sourceVersion,
      latest.classification,
      latest.scope,
      latest.objectives,
      latest.auditType,
      JSON.stringify(latest.requiredRoles),
      JSON.stringify(latest.requiredCompetencies),
      JSON.stringify(latest.workflow),
      JSON.stringify(latest.findingTaxonomy),
      JSON.stringify(latest.severityRules),
      JSON.stringify(latest.decisionRules),
      latest.samplingGuidance,
      JSON.stringify(latest.outputSchema),
      JSON.stringify(latest.reportSchema),
      JSON.stringify(latest.correctiveActionSchema),
      JSON.stringify(latest.verificationSchema),
      latest.estimatedDurationDays,
      latest.recurrenceDefault,
      latest.effectiveFrom,
      latest.effectiveTo,
      JSON.stringify(latest.provenance),
      latest.id,
      actor.userId,
    ],
  );

  const previousCriteria = await getCriteriaFlat(latest.id);
  if (previousCriteria.length > 0) {
    const criteriaInput: ReplaceCriterionInput[] = previousCriteria.map((c) => ({
      id: c.id,
      parentId: c.parentId,
      ordinal: c.ordinal,
      refCode: c.refCode,
      nodeKind: c.nodeKind,
      title: c.title,
      requirementText: c.requirementText,
      sourceReference: c.sourceReference,
      auditQuestion: c.auditQuestion,
      expectedEvidence: c.expectedEvidence,
      auditProcedure: c.auditProcedure,
      samplingGuidance: c.samplingGuidance,
      applicabilityRule: c.applicabilityRule,
      mandatory: c.mandatory,
      weight: c.weight,
      suggestedOwnerRole: c.suggestedOwnerRole,
    }));
    await replaceCriteria(actor, newPackId, criteriaInput);
  }

  await recordAuditEvent({
    organizationId: actor.organizationId,
    entityType: 'audit_pack',
    entityId: newPackId,
    eventType: 'pack.new_version',
    actorId: actor.userId,
    summary: `Utworzono wersję ${newVersion} pakietu „${latest.packKey}" na bazie wersji ${latest.version}`,
    payload: { supersedesPackId: latest.id },
  });

  const row = await getPackRow(actor.organizationId, newPackId);
  return mapPackRow(row);
}

// ---------------------------------------------------------------------------
// Porównanie wersji
// ---------------------------------------------------------------------------

export interface CriterionDiffEntry {
  key: string;
  refCode: string | null;
  title: string;
}

export interface CriterionChangeEntry {
  key: string;
  refCode: string | null;
  titleA: string;
  titleB: string;
  changedFields: string[];
}

export interface PackVersionComparison {
  packKey: string;
  versionA: number;
  versionB: number;
  packIdA: string;
  packIdB: string;
  added: CriterionDiffEntry[];
  removed: CriterionDiffEntry[];
  changed: CriterionChangeEntry[];
  unchangedCount: number;
}

function criterionKey(c: AuditPackCriterion): string {
  return isNonEmpty(c.refCode) ? `ref:${c.refCode}` : `title:${c.title.trim().toLowerCase()}`;
}

const COMPARED_FIELDS: Array<keyof AuditPackCriterion> = [
  'title',
  'requirementText',
  'auditQuestion',
  'auditProcedure',
  'sourceReference',
  'mandatory',
  'weight',
  'nodeKind',
];

export async function comparePackVersions(
  organizationId: string,
  packKey: string,
  versionA: number,
  versionB: number,
): Promise<PackVersionComparison> {
  const rowA = await auditGet<PackRow>(
    `SELECT * FROM audit_packs WHERE (organization_id = $1 OR organization_id IS NULL) AND pack_key = $2 AND version = $3`,
    [organizationId, packKey, versionA],
  );
  const rowB = await auditGet<PackRow>(
    `SELECT * FROM audit_packs WHERE (organization_id = $1 OR organization_id IS NULL) AND pack_key = $2 AND version = $3`,
    [organizationId, packKey, versionB],
  );
  if (!rowA) throw new AuditNotFoundError(`Pakiet „${packKey}" w wersji ${versionA}`);
  if (!rowB) throw new AuditNotFoundError(`Pakiet „${packKey}" w wersji ${versionB}`);

  const criteriaA = await getCriteriaFlat(rowA.id);
  const criteriaB = await getCriteriaFlat(rowB.id);

  const mapA = new Map(criteriaA.map((c) => [criterionKey(c), c]));
  const mapB = new Map(criteriaB.map((c) => [criterionKey(c), c]));

  const added: CriterionDiffEntry[] = [];
  const removed: CriterionDiffEntry[] = [];
  const changed: CriterionChangeEntry[] = [];
  let unchangedCount = 0;

  for (const [key, b] of mapB) {
    const a = mapA.get(key);
    if (!a) {
      added.push({ key, refCode: b.refCode, title: b.title });
      continue;
    }
    const changedFields = COMPARED_FIELDS.filter((field) => a[field] !== b[field]);
    if (changedFields.length > 0) {
      changed.push({ key, refCode: b.refCode, titleA: a.title, titleB: b.title, changedFields });
    } else {
      unchangedCount += 1;
    }
  }
  for (const [key, a] of mapA) {
    if (!mapB.has(key)) removed.push({ key, refCode: a.refCode, title: a.title });
  }

  return {
    packKey,
    versionA,
    versionB,
    packIdA: rowA.id,
    packIdB: rowB.id,
    added,
    removed,
    changed,
    unchangedCount,
  };
}
