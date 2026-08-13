/**
 * normSourceService — rejestr źródeł normatywnych (`audit_norm_sources`).
 *
 * Org-scoped CRUD + weryfikacja. `organization_id IS NULL` oznacza źródło
 * systemowe/globalne — widoczne dla wszystkich organizacji przy odczycie, ale
 * nigdy nie tworzone/aktualizowane przez ten serwis (zapis zawsze niesie
 * `organization_id` aktora — patrz `createSource`).
 *
 * Bramka `verification_status = 'VERIFIED_NORMATIVE'` jest tu, nie tylko w
 * `packValidator`, bo źródło może zostać oznaczone jako zweryfikowane zanim
 * jakikolwiek pakiet je wykorzysta — nie chcemy dopuścić do stanu, w którym
 * rejestr twierdzi „zweryfikowane normatywnie", a nie ma za tym wersji,
 * wydawcy ani potwierdzonych praw.
 */

import {
  auditAll,
  auditGet,
  auditRun,
  AuditDomainError,
  AuditNotFoundError,
  AuditStateError,
  newId,
  recordAuditEvent,
  toIso,
} from './auditsDb.js';
import {
  AUDIT_SOURCE_TYPES,
  AUDIT_VERIFICATION_STATES,
  PACK_CLASSIFICATIONS,
  RIGHTS_STATUSES,
  SOURCE_KINDS,
} from './types.js';
import type {
  AuditActor,
  AuditNormSource,
  AuditSourceType,
  AuditVerificationState,
  PackClassification,
  RightsStatus,
  SourceKind,
} from './types.js';

interface NormSourceRow {
  source_type?: string | null;
  verification_state?: string | null;
  id: string;
  organization_id: string | null;
  source_key: string;
  title: string;
  publisher: string | null;
  source_version: string | null;
  source_kind: string;
  rights_status: string;
  rights_note: string | null;
  license_reference: string | null;
  source_uri: string | null;
  material_id: string | null;
  material_version: string | null;
  effective_from: string | null;
  effective_to: string | null;
  verification_status: string;
  verified_by: string | null;
  verified_at: string | null;
  verification_note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: NormSourceRow): AuditNormSource {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceKey: row.source_key,
    title: row.title,
    publisher: row.publisher,
    sourceVersion: row.source_version,
    sourceKind: row.source_kind as SourceKind,
    rightsStatus: row.rights_status as RightsStatus,
    rightsNote: row.rights_note,
    licenseReference: row.license_reference,
    sourceUri: row.source_uri,
    materialId: row.material_id,
    materialVersion: row.material_version,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    sourceType: (row.source_type as AuditSourceType) ?? 'INTERNAL_PROCEDURE',
    verificationStatus: (row.verification_state as AuditVerificationState) ?? 'EVIDENCE_MISSING',
    legacyClassification: (row.verification_status as PackClassification) ?? null,
    verifiedBy: row.verified_by,
    verifiedAt: toIso(row.verified_at),
    verificationNote: row.verification_note,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at) as string,
    updatedAt: toIso(row.updated_at) as string,
  };
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Walidacja pól
// ---------------------------------------------------------------------------

function assertValidEnums(input: {
  sourceKind?: string | null;
  sourceType?: string | null;
  rightsStatus?: string | null;
  verificationStatus?: string | null;
}): void {
  if (input.sourceKind !== undefined && input.sourceKind !== null && !SOURCE_KINDS.includes(input.sourceKind as SourceKind)) {
    throw new AuditDomainError(
      `Nieznany rodzaj źródła: „${input.sourceKind}". Dozwolone: ${SOURCE_KINDS.join(', ')}`,
      400,
      'AUDIT_SOURCE_KIND_INVALID',
    );
  }
  if (
    input.rightsStatus !== undefined &&
    input.rightsStatus !== null &&
    !RIGHTS_STATUSES.includes(input.rightsStatus as RightsStatus)
  ) {
    throw new AuditDomainError(
      `Nieznany status praw: „${input.rightsStatus}". Dozwolone: ${RIGHTS_STATUSES.join(', ')}`,
      400,
      'AUDIT_RIGHTS_STATUS_INVALID',
    );
  }
  if (
    input.sourceType !== undefined &&
    input.sourceType !== null &&
    !AUDIT_SOURCE_TYPES.includes(input.sourceType as AuditSourceType)
  ) {
    throw new AuditDomainError(
      `Nieznany typ źródła: „${input.sourceType}". Dozwolone: ${AUDIT_SOURCE_TYPES.join(', ')}`,
      400,
      'AUDIT_SOURCE_TYPE_INVALID',
    );
  }
  if (
    input.verificationStatus !== undefined &&
    input.verificationStatus !== null &&
    !AUDIT_VERIFICATION_STATES.includes(input.verificationStatus as AuditVerificationState)
  ) {
    throw new AuditDomainError(
      `Nieznany status weryfikacji: „${input.verificationStatus}". Dozwolone: ${AUDIT_VERIFICATION_STATES.join(', ')}`,
      400,
      'AUDIT_VERIFICATION_STATUS_INVALID',
    );
  }
}

const NORMATIVE_RIGHTS: RightsStatus[] = ['licensed', 'owned_internal', 'public_reference'];

/**
 * Ustawienie `verification_status = 'VERIFIED_NORMATIVE'` wymaga: niepustego
 * `source_version`, `rights_status` w zbiorze praw uprawniających do użycia
 * jako norma, i niepustego `publisher`. Bez tego etykieta „zweryfikowane
 * normatywnie" byłaby deklaracją bez pokrycia.
 */
function assertCanMarkVerifiedNormative(candidate: {
  sourceVersion: string | null;
  rightsStatus: RightsStatus;
  publisher: string | null;
}): void {
  const problems: string[] = [];
  if (!isNonEmpty(candidate.sourceVersion)) {
    problems.push('brak wersji/edycji źródła (source_version)');
  }
  if (!NORMATIVE_RIGHTS.includes(candidate.rightsStatus)) {
    problems.push(
      `status praw musi być jednym z: ${NORMATIVE_RIGHTS.join(', ')} (obecnie: ${candidate.rightsStatus})`,
    );
  }
  if (!isNonEmpty(candidate.publisher)) {
    problems.push('brak wydawcy (publisher)');
  }
  if (problems.length > 0) {
    throw new AuditDomainError(
      `Nie można oznaczyć źródła jako VERIFIED_NORMATIVE: ${problems.join('; ')}`,
      422,
      'AUDIT_SOURCE_NOT_VERIFIABLE',
    );
  }
}

// ---------------------------------------------------------------------------
// Odczyt
// ---------------------------------------------------------------------------

export interface ListSourcesParams {
  search?: string;
  sourceKind?: string;
  sourceType?: string;
  verificationStatus?: string;
  limit?: number;
  offset?: number;
}

export async function listSources(
  organizationId: string,
  params: ListSourcesParams = {},
): Promise<{ items: AuditNormSource[]; total: number }> {
  const conditions: string[] = ['(organization_id = $1 OR organization_id IS NULL)'];
  const values: unknown[] = [organizationId];

  if (isNonEmpty(params.search)) {
    values.push(`%${params.search.trim()}%`);
    conditions.push(`(title ILIKE $${values.length} OR source_key ILIKE $${values.length} OR publisher ILIKE $${values.length})`);
  }
  if (isNonEmpty(params.sourceKind)) {
    values.push(params.sourceKind);
    conditions.push(`source_kind = $${values.length}`);
  }
  // Filtrowanie po OBU osiach niezależnie — koordynator wymaga, żeby dały się
  // łączyć, a nie wykluczać.
  if (isNonEmpty(params.sourceType)) {
    values.push(params.sourceType);
    conditions.push(`source_type = $${values.length}`);
  }
  if (isNonEmpty(params.verificationStatus)) {
    values.push(params.verificationStatus);
    conditions.push(`verification_state = $${values.length}`);
  }

  const where = conditions.join(' AND ');
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const offset = Math.max(params.offset ?? 0, 0);

  const countRow = await auditGet<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM audit_norm_sources WHERE ${where}`,
    values,
  );
  const rows = await auditAll<NormSourceRow>(
    `SELECT * FROM audit_norm_sources WHERE ${where} ORDER BY updated_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );

  return {
    items: rows.map(mapRow),
    total: Number(countRow?.count ?? 0),
  };
}

export async function getSource(organizationId: string, id: string): Promise<AuditNormSource> {
  const row = await auditGet<NormSourceRow>(
    `SELECT * FROM audit_norm_sources WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)`,
    [id, organizationId],
  );
  if (!row) throw new AuditNotFoundError('Źródło normatywne');
  return mapRow(row);
}

// ---------------------------------------------------------------------------
// Zapis
// ---------------------------------------------------------------------------

export interface CreateSourceInput {
  sourceKey: string;
  title: string;
  publisher?: string | null;
  sourceVersion?: string | null;
  sourceKind?: SourceKind;
  sourceType?: AuditSourceType;
  rightsStatus?: RightsStatus;
  rightsNote?: string | null;
  licenseReference?: string | null;
  sourceUri?: string | null;
  materialId?: string | null;
  materialVersion?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export async function createSource(
  actor: AuditActor,
  input: CreateSourceInput,
): Promise<AuditNormSource> {
  if (!isNonEmpty(input.sourceKey)) {
    throw new AuditDomainError('Źródło musi mieć klucz (source_key)', 400, 'AUDIT_SOURCE_KEY_MISSING');
  }
  if (!isNonEmpty(input.title)) {
    throw new AuditDomainError('Źródło musi mieć tytuł', 400, 'AUDIT_SOURCE_TITLE_MISSING');
  }
  assertValidEnums({ sourceKind: input.sourceKind, rightsStatus: input.rightsStatus });

  const id = newId('ans');
  const sourceKind = input.sourceKind ?? 'internal_procedure';
  const rightsStatus = input.rightsStatus ?? 'not_verified';

  await auditRun(
    `INSERT INTO audit_norm_sources
       (id, organization_id, source_key, title, publisher, source_version, source_kind,
        rights_status, rights_note, license_reference, source_uri, material_id,
        material_version, effective_from, effective_to, verification_status,
        source_type, verification_state, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'EVIDENCE_MISSING',$16,$17,$18)`,
    [
      id,
      actor.organizationId,
      input.sourceKey.trim(),
      input.title.trim(),
      input.publisher ?? null,
      input.sourceVersion ?? null,
      sourceKind,
      rightsStatus,
      input.rightsNote ?? null,
      input.licenseReference ?? null,
      input.sourceUri ?? null,
      input.materialId ?? null,
      input.materialVersion ?? null,
      input.effectiveFrom ?? null,
      input.effectiveTo ?? null,
      // Nowe źródło startuje jako niezweryfikowane. Typ podaje autor — to
      // decyzja o naturze dokumentu, nie o zaufaniu do niego.
      input.sourceType ?? 'INTERNAL_PROCEDURE',
      'UNVERIFIED',
      actor.userId,
    ],
  );

  await recordAuditEvent({
    organizationId: actor.organizationId,
    entityType: 'audit_norm_source',
    entityId: id,
    eventType: 'source.created',
    actorId: actor.userId,
    summary: `Utworzono źródło normatywne „${input.title.trim()}"`,
  });

  return getSource(actor.organizationId, id);
}

export interface UpdateSourceInput {
  title?: string;
  publisher?: string | null;
  sourceVersion?: string | null;
  sourceKind?: SourceKind;
  sourceType?: AuditSourceType;
  rightsStatus?: RightsStatus;
  rightsNote?: string | null;
  licenseReference?: string | null;
  sourceUri?: string | null;
  materialId?: string | null;
  materialVersion?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export async function updateSource(
  actor: AuditActor,
  id: string,
  input: UpdateSourceInput,
): Promise<AuditNormSource> {
  const existing = await getSource(actor.organizationId, id);
  assertValidEnums({ sourceKind: input.sourceKind, rightsStatus: input.rightsStatus });

  if (input.title !== undefined && !isNonEmpty(input.title)) {
    throw new AuditDomainError('Tytuł źródła nie może być pusty', 400, 'AUDIT_SOURCE_TITLE_MISSING');
  }

  const rightsStatus = input.rightsStatus ?? existing.rightsStatus;
  // Zmiana statusu praw na coś innego niż uprawniające do normy, gdy źródło
  // jest już VERIFIED_NORMATIVE, nie jest tu blokowana — to `verifySource`
  // pilnuje spójności przy WEJŚCIU w ten status. Rozjazd wykryje walidator
  // pakietu przy kolejnej publikacji.

  await auditRun(
    `UPDATE audit_norm_sources SET
       title = $1, publisher = $2, source_version = $3, source_kind = $4,
       rights_status = $5, rights_note = $6, license_reference = $7, source_uri = $8,
       material_id = $9, material_version = $10, effective_from = $11, effective_to = $12,
       source_type = $13,
       updated_at = NOW()
     WHERE id = $14 AND (organization_id = $15 OR organization_id IS NULL)`,
    [
      input.title !== undefined ? input.title.trim() : existing.title,
      input.publisher !== undefined ? input.publisher : existing.publisher,
      input.sourceVersion !== undefined ? input.sourceVersion : existing.sourceVersion,
      input.sourceKind !== undefined ? input.sourceKind : existing.sourceKind,
      rightsStatus,
      input.rightsNote !== undefined ? input.rightsNote : existing.rightsNote,
      input.licenseReference !== undefined ? input.licenseReference : existing.licenseReference,
      input.sourceUri !== undefined ? input.sourceUri : existing.sourceUri,
      input.materialId !== undefined ? input.materialId : existing.materialId,
      input.materialVersion !== undefined ? input.materialVersion : existing.materialVersion,
      input.effectiveFrom !== undefined ? input.effectiveFrom : existing.effectiveFrom,
      input.effectiveTo !== undefined ? input.effectiveTo : existing.effectiveTo,
      // Typ źródła zmienia się TYLKO jawnie. `verifySource` go nie dotyka —
      // zmiana zaufania nie może przepisać natury dokumentu.
      input.sourceType !== undefined ? input.sourceType : existing.sourceType,
      id,
      actor.organizationId,
    ],
  );

  await recordAuditEvent({
    organizationId: actor.organizationId,
    entityType: 'audit_norm_source',
    entityId: id,
    eventType: 'source.updated',
    actorId: actor.userId,
    summary: `Zaktualizowano źródło normatywne „${existing.title}"`,
  });

  return getSource(actor.organizationId, id);
}

export interface VerifySourceInput {
  verificationStatus: AuditVerificationState;
  verificationNote?: string | null;
}

export async function verifySource(
  actor: AuditActor,
  id: string,
  input: VerifySourceInput,
): Promise<AuditNormSource> {
  const existing = await getSource(actor.organizationId, id);
  assertValidEnums({ verificationStatus: input.verificationStatus });

  if (input.verificationStatus === 'VERIFIED') {
    assertCanMarkVerifiedNormative({
      sourceVersion: existing.sourceVersion,
      rightsStatus: existing.rightsStatus,
      publisher: existing.publisher,
    });
  }

  await auditRun(
    `UPDATE audit_norm_sources SET
       verification_state = $1, verified_by = $2, verified_at = NOW(), verification_note = $3,
       updated_at = NOW()
     WHERE id = $4 AND (organization_id = $5 OR organization_id IS NULL)`,
    [input.verificationStatus, actor.userId, input.verificationNote ?? null, id, actor.organizationId],
  );

  await recordAuditEvent({
    organizationId: actor.organizationId,
    entityType: 'audit_norm_source',
    entityId: id,
    eventType: 'source.verified',
    actorId: actor.userId,
    summary: `Źródło „${existing.title}" oznaczone jako ${input.verificationStatus}`,
    payload: { verificationStatus: input.verificationStatus },
  });

  return getSource(actor.organizationId, id);
}

export async function deleteSource(actor: AuditActor, id: string): Promise<void> {
  const existing = await getSource(actor.organizationId, id);

  const usedByPublished = await auditGet<{ id: string; title: string }>(
    `SELECT id, title FROM audit_packs
      WHERE source_id = $1 AND publication_status = 'published'
      LIMIT 1`,
    [id],
  );
  if (usedByPublished) {
    throw new AuditStateError(
      `Nie można usunąć źródła „${existing.title}" — jest wykorzystywane przez opublikowany pakiet „${usedByPublished.title}"`,
    );
  }

  await auditRun(
    `DELETE FROM audit_norm_sources WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)`,
    [id, actor.organizationId],
  );

  await recordAuditEvent({
    organizationId: actor.organizationId,
    entityType: 'audit_norm_source',
    entityId: id,
    eventType: 'source.deleted',
    actorId: actor.userId,
    summary: `Usunięto źródło normatywne „${existing.title}"`,
  });
}
