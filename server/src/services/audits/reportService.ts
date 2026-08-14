/**
 * reportService — raporty poaudytowe i realizacji (audit_reports).
 *
 * Raport jest zawsze RENDEREM istniejącego Outputu (patrz `reportRenderer.ts`)
 * — ten plik nigdy nie buduje treści raportu samodzielnie, tylko: (1) pobiera
 * Output, (2) dobiera dane pomocnicze (działania/weryfikacje dla raportu
 * realizacji), (3) woła czysty renderer, (4) zapisuje wynik z hashem i nową
 * wersją. Opublikowany raport jest niezmienny — korekta to nowa wersja
 * (`supersedeReport`), nigdy edycja istniejącego wiersza.
 */

import {
  AuditDomainError,
  AuditNotFoundError,
  AuditStateError,
  auditAll,
  auditGet,
  auditRun,
  newId,
  parseJson,
  recordAuditEvent,
  toIso,
} from './auditsDb.js';
import * as outputService from './outputService.js';
import { requireCapability } from './permissions.js';
import type {
  AuditOutputPayload,
  AuditReportDocument,
  RemediationActionInput,
  RemediationVerificationInput,
} from './reportRenderer.js';
import {
  renderAuditReport,
  renderPresentationView,
  renderRemediationProgressReport,
} from './reportRenderer.js';
import type { AuditActor, AuditReport, ReportKind } from './types.js';

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Mapowanie / helpers
// ---------------------------------------------------------------------------

function mapReportRow(row: Row): AuditReport {
  return {
    id: String(row.id),
    programId: String(row.program_id),
    organizationId: String(row.organization_id),
    outputId: (row.output_id as string) ?? null,
    version: Number(row.version),
    reportKind: String(row.report_kind) as ReportKind,
    title: String(row.title),
    status: String(row.status) as AuditReport['status'],
    payload: parseJson(row.payload, {}),
    contentHash: (row.content_hash as string) ?? null,
    templateKey: (row.template_key as string) ?? null,
    language: (row.language as string) ?? null,
    audience: (row.audience as string) ?? null,
    confidentiality: (row.confidentiality as string) ?? null,
    materialId: (row.material_id as string) ?? null,
    generatedAt: toIso(row.generated_at),
    approvedBy: (row.approved_by as string) ?? null,
    approvedAt: toIso(row.approved_at),
    publishedAt: toIso(row.published_at),
    supersededBy: (row.superseded_by as string) ?? null,
    snapshotDate: (row.snapshot_date as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    createdAt: toIso(row.created_at) ?? String(row.created_at),
    updatedAt: toIso(row.updated_at) ?? String(row.updated_at),
  };
}

async function loadCorrectiveActions(
  orgId: string,
  programId: string
): Promise<RemediationActionInput[]> {
  const rows = await auditAll<Row>(
    `SELECT * FROM audit_corrective_actions WHERE organization_id=$1 AND program_id=$2`,
    [orgId, programId]
  );
  return rows.map((r) => ({
    id: String(r.id),
    findingId: String(r.finding_id),
    title: String(r.title),
    actionKind: String(r.action_kind),
    ownerUserId: (r.owner_user_id as string) ?? null,
    dueDate: r.due_date ? toIso(r.due_date) : null,
    status: String(r.status),
    implementationEvidenceId: (r.implementation_evidence_id as string) ?? null,
    implementedAt: toIso(r.implemented_at),
  }));
}

async function loadVerifications(
  orgId: string,
  programId: string
): Promise<RemediationVerificationInput[]> {
  const rows = await auditAll<Row>(
    `SELECT * FROM audit_verifications WHERE organization_id=$1 AND program_id=$2`,
    [orgId, programId]
  );
  return rows.map((r) => ({
    id: String(r.id),
    correctiveActionId: (r.corrective_action_id as string) ?? null,
    findingId: String(r.finding_id),
    verificationKind: String(r.verification_kind),
    result: (r.result as string) ?? null,
    performedAt: toIso(r.performed_at),
    plannedDate: r.planned_date ? toIso(r.planned_date) : null,
  }));
}

function defaultReportTitle(reportKind: ReportKind, outputTitle: string): string {
  if (reportKind === 'remediation_progress') return `Raport realizacji — ${outputTitle}`;
  return `Raport poaudytowy — ${outputTitle}`;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export interface GenerateReportInput {
  programId: string;
  outputId: string;
  reportKind: ReportKind;
  title?: string;
  language?: string | null;
  audience?: string | null;
  confidentiality?: string | null;
  templateKey?: string | null;
  /** Wymagane sensownie dla `remediation_progress` — snapshot na tę datę. Domyślnie dzień wywołania. */
  asOfDate?: string | null;
}

export async function generateReport(
  orgId: string,
  actor: AuditActor,
  input: GenerateReportInput
): Promise<AuditReport> {
  await requireCapability(actor, input.programId, 'report.draft');

  const output = await outputService.getOutput(orgId, input.outputId);
  if (!output) throw new AuditNotFoundError('Output źródłowy raportu');
  if (output.programId !== input.programId) {
    throw new AuditStateError('Output nie należy do wskazanego programu audytowego');
  }

  const payload = output.payload as unknown as AuditOutputPayload;
  let document: AuditReportDocument;
  let snapshotDate: string | null = null;

  if (input.reportKind === 'audit_report') {
    document = renderAuditReport(payload, {
      generatedAt: new Date().toISOString(),
      title: input.title,
    });
  } else if (input.reportKind === 'remediation_progress') {
    const asOfDate = (input.asOfDate || '').trim() || new Date().toISOString().slice(0, 10);
    const [actions, verifications] = await Promise.all([
      loadCorrectiveActions(orgId, input.programId),
      loadVerifications(orgId, input.programId),
    ]);
    document = renderRemediationProgressReport(payload, actions, verifications, asOfDate);
    snapshotDate = asOfDate;
  } else {
    throw new AuditDomainError(
      `Nieobsługiwany rodzaj raportu: ${input.reportKind}`,
      400,
      'AUDIT_REPORT_KIND_UNSUPPORTED'
    );
  }

  const contentHash = outputService.computeOutputHash(document);
  const id = newId('arep');
  const title = (input.title || '').trim() || defaultReportTitle(input.reportKind, output.title);

  try {
    await auditRun(
      `INSERT INTO audit_reports
         (id, program_id, organization_id, output_id, version, report_kind, title, status,
          payload, content_hash, template_key, language, audience, confidentiality,
          generated_at, snapshot_date, created_by)
       SELECT $1, $2, $3, $4, COALESCE(MAX(version), 0) + 1, $5, $6, 'draft',
              $7, $8, $9, $10, $11, $12, NOW(), $13, $14
         FROM audit_reports WHERE program_id = $2 AND report_kind = $5`,
      [
        id,
        input.programId,
        orgId,
        input.outputId,
        input.reportKind,
        title,
        JSON.stringify(document),
        contentHash,
        input.templateKey ?? null,
        input.language ?? null,
        input.audience ?? null,
        input.confidentiality ?? null,
        snapshotDate,
        actor.userId,
      ]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/uq_audit_reports_program_kind_version|duplicate key/i.test(message)) {
      throw new AuditStateError(
        'Wykryto równoległe generowanie raportu tego samego rodzaju dla programu — spróbuj ponownie'
      );
    }
    throw error;
  }

  await recordAuditEvent({
    organizationId: orgId,
    programId: input.programId,
    entityType: 'audit_report',
    entityId: id,
    eventType: 'report.generated',
    actorId: actor.userId,
    summary: `Wygenerowano raport „${title}" (${input.reportKind})`,
    payload: { contentHash, outputId: input.outputId },
  });

  const created = await getReport(orgId, id);
  if (!created)
    throw new AuditDomainError(
      'Raport nie został poprawnie zapisany',
      500,
      'AUDIT_REPORT_WRITE_FAILED'
    );
  return created;
}

export async function listReports(
  orgId: string,
  filters: { programId?: string; reportKind?: ReportKind } = {}
): Promise<AuditReport[]> {
  const params: unknown[] = [orgId];
  let sql = `SELECT * FROM audit_reports WHERE organization_id = $1`;
  if (filters.programId) {
    params.push(filters.programId);
    sql += ` AND program_id = $${params.length}`;
  }
  if (filters.reportKind) {
    params.push(filters.reportKind);
    sql += ` AND report_kind = $${params.length}`;
  }
  const rows = await auditAll<Row>(sql, params);
  return rows.map(mapReportRow).sort((a, b) => a.version - b.version);
}

export async function getReport(orgId: string, id: string): Promise<AuditReport | null> {
  const row = await auditGet<Row>(
    `SELECT * FROM audit_reports WHERE organization_id=$1 AND id=$2`,
    [orgId, id]
  );
  return row ? mapReportRow(row) : null;
}

export async function approveReport(
  orgId: string,
  actor: AuditActor,
  id: string
): Promise<AuditReport> {
  const report = await getReport(orgId, id);
  if (!report) throw new AuditNotFoundError('Raport');
  await requireCapability(actor, report.programId, 'report.approve');

  if (report.status !== 'draft' && report.status !== 'in_review') {
    throw new AuditStateError(
      `Raport w statusie „${report.status}" nie może zostać zatwierdzony (wymagany draft/in_review)`
    );
  }

  await auditRun(
    `UPDATE audit_reports SET status='approved', approved_by=$1, approved_at=NOW(), updated_at=NOW()
      WHERE organization_id=$2 AND id=$3`,
    [actor.userId, orgId, id]
  );

  await recordAuditEvent({
    organizationId: orgId,
    programId: report.programId,
    entityType: 'audit_report',
    entityId: id,
    eventType: 'report.approved',
    actorId: actor.userId,
    summary: `Zatwierdzono raport ${id}`,
  });

  const updated = await getReport(orgId, id);
  if (!updated) throw new AuditNotFoundError('Raport');
  return updated;
}

export async function publishReport(
  orgId: string,
  actor: AuditActor,
  id: string
): Promise<AuditReport> {
  const report = await getReport(orgId, id);
  if (!report) throw new AuditNotFoundError('Raport');
  await requireCapability(actor, report.programId, 'report.publish');

  if (report.status !== 'approved') {
    throw new AuditStateError(
      `Raport w statusie „${report.status}" nie może zostać opublikowany (wymagany status approved)`
    );
  }

  if (report.outputId) {
    const output = await outputService.getOutput(orgId, report.outputId);
    if (output?.supersededBy) {
      throw new AuditStateError(
        'Nie można opublikować raportu opartego na Outputcie, który został zastąpiony nowszą wersją'
      );
    }
  }

  await auditRun(
    `UPDATE audit_reports SET status='published', published_at=NOW(), updated_at=NOW()
      WHERE organization_id=$1 AND id=$2`,
    [orgId, id]
  );

  await recordAuditEvent({
    organizationId: orgId,
    programId: report.programId,
    entityType: 'audit_report',
    entityId: id,
    eventType: 'report.published',
    actorId: actor.userId,
    summary: `Opublikowano raport ${id}`,
  });

  const updated = await getReport(orgId, id);
  if (!updated) throw new AuditNotFoundError('Raport');
  return updated;
}

/** Brak funkcji edycji opublikowanego raportu — korekta tworzy nową wersję i oznacza tę jako zastąpioną. */
export async function supersedeReport(
  orgId: string,
  actor: AuditActor,
  id: string,
  newReportId: string
): Promise<AuditReport> {
  const report = await getReport(orgId, id);
  if (!report) throw new AuditNotFoundError('Raport');
  await requireCapability(actor, report.programId, 'report.draft');

  if (newReportId === id) {
    throw new AuditStateError('Raport nie może zastąpić samego siebie');
  }
  const replacement = await getReport(orgId, newReportId);
  if (!replacement) throw new AuditNotFoundError('Raport zastępujący');
  if (replacement.programId !== report.programId || replacement.reportKind !== report.reportKind) {
    throw new AuditStateError('Raport zastępujący musi być tego samego programu i rodzaju');
  }

  await auditRun(
    `UPDATE audit_reports SET status='superseded', superseded_by=$1, updated_at=NOW()
      WHERE organization_id=$2 AND id=$3`,
    [newReportId, orgId, id]
  );

  await recordAuditEvent({
    organizationId: orgId,
    programId: report.programId,
    entityType: 'audit_report',
    entityId: id,
    eventType: 'report.superseded',
    actorId: actor.userId,
    summary: `Raport ${id} zastąpiony przez ${newReportId}`,
  });

  const updated = await getReport(orgId, id);
  if (!updated) throw new AuditNotFoundError('Raport');
  return updated;
}

/** Zapisuje TYLKO referencję eksportu w Materials — nie generuje żadnego pliku. */
export async function linkMaterial(
  orgId: string,
  actor: AuditActor,
  id: string,
  materialId: string
): Promise<AuditReport> {
  const report = await getReport(orgId, id);
  if (!report) throw new AuditNotFoundError('Raport');
  await requireCapability(actor, report.programId, 'report.draft');

  if (!materialId || !materialId.trim()) {
    throw new AuditDomainError('materialId jest wymagany', 400, 'AUDIT_MATERIAL_ID_REQUIRED');
  }

  await auditRun(
    `UPDATE audit_reports SET material_id=$1, updated_at=NOW() WHERE organization_id=$2 AND id=$3`,
    [materialId, orgId, id]
  );

  await recordAuditEvent({
    organizationId: orgId,
    programId: report.programId,
    entityType: 'audit_report',
    entityId: id,
    eventType: 'report.material_linked',
    actorId: actor.userId,
    summary: `Raport ${id} powiązany z materiałem ${materialId}`,
  });

  const updated = await getReport(orgId, id);
  if (!updated) throw new AuditNotFoundError('Raport');
  return updated;
}

/** Renderuje widok prezentacyjny live z Outputu powiązanego z istniejącym raportem — nic nie zapisuje. */
export async function renderReportPresentation(
  orgId: string,
  id: string
): Promise<AuditReportDocument> {
  const report = await getReport(orgId, id);
  if (!report) throw new AuditNotFoundError('Raport');
  if (!report.outputId) {
    throw new AuditStateError(
      'Raport nie ma powiązanego Outputu — brak danych do widoku prezentacyjnego'
    );
  }
  const output = await outputService.getOutput(orgId, report.outputId);
  if (!output) throw new AuditNotFoundError('Output powiązany z raportem');
  return renderPresentationView(output.payload as unknown as AuditOutputPayload);
}
