/**
 * reports.routes — U5 — raporty (Deliverables)
 *
 * Montowane pod `/api/audits/reports`. `GET /:id/presentation` renderuje na
 * żywo widok prezentacyjny z Outputu powiązanego z raportem — nic nie
 * zapisuje, to czysty odczyt przez `reportRenderer`.
 */

import { Router } from 'express';

import * as reportService from '../../services/audits/reportService.js';
import type { ReportKind } from '../../services/audits/types.js';

import { auditActor, assertActor, route } from './context.js';

const router = Router();

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
