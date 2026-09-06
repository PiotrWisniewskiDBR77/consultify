/**
 * reports.routes — U5 — raporty (Deliverables)
 *
 * Montowane pod `/api/audits/reports`. `GET /:id/presentation` renderuje na
 * żywo widok prezentacyjny z Outputu powiązanego z raportem — nic nie
 * zapisuje, to czysty odczyt przez `reportRenderer`.
 */

import { Router } from 'express';

import { buildAuditReportDocumentSchema } from '../../services/audits/auditReportDocumentSchemaService.js';
import { auditGet, AuditDomainError } from '../../services/audits/auditsDb.js';
import type { AuditReportDocument } from '../../services/audits/reportRenderer.js';
import * as reportService from '../../services/audits/reportService.js';
import {
  buildAuditReportConclusion,
  safePersistAuditReportConclusion,
  type AuditReportDocumentLike,
} from '../../services/conclusions/auditReportConclusionBridge.js';
import type { ReportKind } from '../../services/audits/types.js';
import { requireCapability } from '../../services/audits/permissions.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { renderDocumentSchemaToDocxBuffer } from '../../services/documentStudio/documentDocxRenderer.js';
import { renderDocumentSchemaToPdfBuffer } from '../../services/documentStudio/documentPdfRenderer.js';

import { auditActor, assertActor, route } from './context.js';

const router = Router();

/**
 * FIX-4 (dyżur 41, naprawa): `export.docx` podstawiał `{programName: null,
 * organizationName: null}` na sztywno, co degradowało nagłówek DOCX zawsze
 * do samego tytułu raportu (`buildAuditReportDocumentSchema` używa
 * `organizationName ?? programName ?? report.title` jako treści nagłówka).
 * Realne nazwy — program z `audit_programs.name` (ten sam tenant, więc
 * `organization_id` w warunku), organizacja z `organizations.name`. Brak
 * wiersza (np. rekord usunięty) → `null`, placeholder w `AUDIT_REPORT_DOCUMENT_PLACEHOLDERS`
 * przejmuje degradację tak jak dotąd — nie jest to regres, tylko honest gap.
 */
async function resolveReportContext(
  organizationId: string,
  programId: string
): Promise<{ programName: string | null; organizationName: string | null }> {
  const [programRow, orgRow] = await Promise.all([
    auditGet<{ name: string }>(
      `SELECT name FROM audit_programs WHERE id = $1 AND organization_id = $2`,
      [programId, organizationId]
    ),
    auditGet<{ name: string }>(`SELECT name FROM organizations WHERE id = $1`, [organizationId]),
  ]);
  return {
    programName: programRow?.name ?? null,
    organizationName: orgRow?.name ?? null,
  };
}

/**
 * FIX-4 (dyżur 41, naprawa): `report.payload as unknown as AuditReportDocument`
 * nie miało straży — wiersz bez `sections` (np. uszkodzony/legacy zapis)
 * dawał `TypeError` w `document.sections.map(...)` głęboko w
 * `buildAuditReportDocumentSchema`, co `route()` łapał jako 500 zamiast
 * czytelnego kodu błędu. Sprawdzamy kształt na wejściu i zwracamy 422.
 */
function requireReportPayloadShape(payload: unknown): AuditReportDocument {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray((payload as { sections?: unknown }).sections)
  ) {
    throw new AuditDomainError(
      'Raport ma niepoprawny lub niekompletny zapis treści (brak sekcji) — eksport nie jest możliwy.',
      422,
      'AUDIT_REPORT_INVALID_PAYLOAD'
    );
  }
  return payload as AuditReportDocument;
}

router.get(
  '/',
  route('GET /reports', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const programId = typeof req.query.programId === 'string' ? req.query.programId : undefined;
    const reportKind = typeof req.query.reportKind === 'string' ? (req.query.reportKind as ReportKind) : undefined;
    const reports = await reportService.listReports(actor.organizationId, { programId, reportKind });
    res.json({ success: true, data: reports });
  }),
);

router.get(
  '/:id/export.docx',
  route('GET /reports/:id/export.docx', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const report = await reportService.getReport(actor.organizationId, req.params.id);
    if (!report) {
      res.status(404).json({ success: false, error: 'Raport nie został znaleziony', code: 'AUDIT_NOT_FOUND' });
      return;
    }
    const document = requireReportPayloadShape(report.payload);
    const context = await resolveReportContext(actor.organizationId, report.programId);
    const schema = buildAuditReportDocumentSchema(report, document, context);
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const safeTitle = report.title
      .normalize('NFC')
      .replace(/[^\p{L}\p{N}._-]+/gu, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
    const generatedAt = report.generatedAt ?? report.createdAt;
    const date = generatedAt.slice(0, 10).replaceAll('-', '');
    const filename = `Raport_audytu_${safeTitle || report.id}_v${report.version}_${date}.docx`;
    const asciiFilename = filename
      .replace(/[Łł]/g, (character) => (character === 'Ł' ? 'L' : 'l'))
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._-]/g, '_');
    res
      .status(200)
      .set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String(buffer.length),
      })
      .send(buffer);
  }),
);

router.get(
  '/:id/export.pdf',
  route('GET /reports/:id/export.pdf', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const report = await reportService.getReport(actor.organizationId, req.params.id);
    if (!report) {
      res.status(404).json({ success: false, error: 'Raport nie został znaleziony', code: 'AUDIT_NOT_FOUND' });
      return;
    }
    const document = requireReportPayloadShape(report.payload);
    const context = await resolveReportContext(actor.organizationId, report.programId);
    const schema = buildAuditReportDocumentSchema(report, document, context);
    const buffer = await renderDocumentSchemaToPdfBuffer(schema);
    const safeTitle = report.title
      .normalize('NFC')
      .replace(/[^\p{L}\p{N}._-]+/gu, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
    const generatedAt = report.generatedAt ?? report.createdAt;
    const date = generatedAt.slice(0, 10).replaceAll('-', '');
    const filename = `Raport_audytu_${safeTitle || report.id}_v${report.version}_${date}.pdf`;
    const asciiFilename = filename
      .replace(/[Łł]/g, (character) => (character === 'Ł' ? 'L' : 'l'))
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._-]/g, '_');
    res
      .status(200)
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': String(buffer.length),
      })
      .send(buffer);
  }),
);

router.get(
  '/:id',
  route('GET /reports/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const report = await reportService.getReport(actor.organizationId, req.params.id);
    if (!report) {
      res.status(404).json({ success: false, error: 'Raport nie został znaleziony', code: 'AUDIT_NOT_FOUND' });
      return;
    }
    res.json({ success: true, data: report });
  }),
);

router.get(
  '/:id/presentation',
  route('GET /reports/:id/presentation', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const document = await reportService.renderReportPresentation(actor.organizationId, req.params.id);
    res.json({ success: true, data: document });
  }),
);

router.post(
  '/',
  route('POST /reports', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const body = req.body || {};
    if (!body.programId || !body.outputId || !body.reportKind) {
      res.status(400).json({
        success: false,
        error: 'programId, outputId i reportKind są wymagane',
        code: 'AUDIT_REPORT_INPUT_INVALID',
      });
      return;
    }
    const report = await reportService.generateReport(actor.organizationId, actor, {
      programId: String(body.programId),
      outputId: String(body.outputId),
      reportKind: body.reportKind,
      title: body.title,
      language: body.language ?? null,
      audience: body.audience ?? null,
      confidentiality: body.confidentiality ?? null,
      templateKey: body.templateKey ?? null,
      asOfDate: body.asOfDate ?? null,
    });
    res.status(201).json({ success: true, data: report });
  }),
);

// =============================================================================
// WNIOSEK Z AUDYTU (DEC-417e, 1.1-A4) — przewód do ISTNIEJĄCEJ warstwy Wniosków.
//
// POMIAR 06.09: raport audytu miał już wszystko, z czego robi się wniosek
// (sekcje „Wniosek ogólny"/„Streszczenie zarządcze"/„Ograniczenia"/„Wnioski
// systemowe" — `reportRenderer.renderAuditReport`), ale warstwa Wniosków nie
// znała źródła audytu: `ConclusionService.syncAllSources()` obsługiwało tylko
// wywiad, ocenę i narzędzia. Ta trasa to CIENKI PRZEWÓD (analog
// `POST /assessment-reports/:reportId/conclusion` z DEC-416): żadnego nowego
// promptu, modelu ani tabeli — czyta zapisany dokument raportu i zapisuje z
// niego wniosek przez `conclusionService.createConclusion`.
//
// Strażnik ten sam, co przy powstaniu raportu: `report.draft` na programie
// raportu (`reportService.generateReport`). Brak rodowodu po zapisie = 500 z
// jawnym kodem, nigdy udawany sukces.
// =============================================================================
router.post(
  '/:id/conclusion',
  route('POST /reports/:id/conclusion', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const report = await reportService.getReport(actor.organizationId, req.params.id);
    if (!report) {
      res
        .status(404)
        .json({ success: false, error: 'Raport nie został znaleziony', code: 'AUDIT_NOT_FOUND' });
      return;
    }
    await requireCapability(actor, report.programId, 'report.draft');

    const document = requireReportPayloadShape(report.payload) as unknown as AuditReportDocumentLike;
    const context = await resolveReportContext(actor.organizationId, report.programId);
    const source = {
      reportId: String(report.id),
      reportTitle: report.title || null,
      reportStatus: report.status || null,
      reportVersion: report.version ?? null,
      programId: report.programId,
      programName: context.programName,
      projectId: null,
    };

    const candidate = buildAuditReportConclusion(document, source);
    if (!candidate) {
      res.status(422).json({
        success: false,
        error:
          'Ten raport nie ma wniosku ogólnego ani streszczenia zarządczego — nie ma z czego zbudować wniosku.',
        code: 'AUDIT_CONCLUSION_NO_SUMMARY',
      });
      return;
    }

    const persisted = await safePersistAuditReportConclusion({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      document,
      source,
    });
    if (!persisted) {
      res.status(500).json({
        success: false,
        error: 'Nie udało się zapisać wniosku',
        code: 'AUDIT_CONCLUSION_PERSIST_FAILED',
      });
      return;
    }

    // Odczyt po RODOWODZIE (nie po tytule): `upsertExternalConclusion`
    // deduplikuje po (organization_id, source_module, source_artifact_refs_json),
    // więc ten sam raport nigdy nie mnoży wniosków, a brak rodowodu = brak
    // trafienia.
    const row = await queryHelpers.queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM conclusions
       WHERE organization_id = ? AND source_module = ? AND source_artifact_refs_json = ?
       LIMIT 1`,
      [actor.organizationId, candidate.sourceModule, JSON.stringify(candidate.sourceRefs)]
    );
    if (!row?.id) {
      res.status(500).json({
        success: false,
        error: 'Wniosek zapisany bez rodowodu do raportu audytu — przerwane',
        code: 'AUDIT_CONCLUSION_LINEAGE_MISSING',
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: {
        conclusionId: String(row.id),
        title: candidate.title,
        status: String(row.status || candidate.status),
        sourceRefs: candidate.sourceRefs,
      },
    });
  }),
);

router.post(
  '/:id/approve',
  route('POST /reports/:id/approve', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const report = await reportService.approveReport(actor.organizationId, actor, req.params.id);
    res.json({ success: true, data: report });
  }),
);

router.post(
  '/:id/publish',
  route('POST /reports/:id/publish', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const report = await reportService.publishReport(actor.organizationId, actor, req.params.id);
    res.json({ success: true, data: report });
  }),
);

router.post(
  '/:id/link-material',
  route('POST /reports/:id/link-material', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const { materialId } = req.body || {};
    if (!materialId || typeof materialId !== 'string') {
      res.status(400).json({ success: false, error: 'materialId jest wymagany', code: 'AUDIT_MATERIAL_ID_REQUIRED' });
      return;
    }
    const report = await reportService.linkMaterial(actor.organizationId, actor, req.params.id, materialId);
    res.json({ success: true, data: report });
  }),
);

export default router;
