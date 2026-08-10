/**
 * Case Workspace HTTP routes — caseHistoryService
 * (server/src/services/caseWorkspace/caseHistoryService.ts).
 *
 * Mounted at /api/v8/case-workspace (see caseWorkspace/index.ts). Excludes
 * classifyHistoryEventProjections/computeMetricValueOutcomeState (pure,
 * no-DB helpers per the task brief).
 *
 * RE-WIRE AFTER STREAM A MERGES: appendCaseHistoryEvent's
 * AppendCaseHistoryEventInput has its OWN `organizationId`/`actorId` fields
 * (no separate `actor: CaseActor` wrapper, unlike most sibling services) —
 * both are forced to the authenticated actor's values below
 * (`organizationId: actor.organizationId`, `actorId: actor.actorUserId`),
 * never taken from the request body, so no structural change is expected
 * once Stream A retrofits this service to also verify them internally.
 * recordValueMeasurement is similar (`measuredByActorId` forced to
 * `actor.actorUserId`).
 */

import { Router } from 'express';
import { z } from 'zod';

import * as svc from '../../services/caseWorkspace/caseHistoryService.js';
import { requireCaseAccessForActor } from './_shared/access.js';
import { caseWorkspaceHandler, readIdempotencyKeyHeader } from './_shared/handler.js';
import { toCaseWorkspaceAppError } from './_shared/errors.js';
import { parseBody, parseParams, parseQuery } from './_shared/validate.js';

const router = Router();

const valueMeasurementStatusEnum = z.enum([
  'UNMEASURED',
  'PARTIAL',
  'CONFIRMED',
  'NOT_ACHIEVED',
  'EVIDENCE_MISSING',
]);
const valueMeasurementConfidenceEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);

const caseIdParams = z.object({ caseId: z.string().trim().min(1) });

// POST /cases/:caseId/history-events — appendCaseHistoryEvent
const appendEventBody = z.object({
  projectId: z.string().trim().min(1).nullable().optional(),
  eventType: z.string().trim().min(1),
  occurredAt: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
  sourceTable: z.string().trim().min(1).nullable().optional(),
  sourceId: z.string().trim().min(1).nullable().optional(),
  correlationId: z.string().trim().min(1).nullable().optional(),
  dedupeKey: z.string().trim().min(1).nullable().optional(),
});

router.post(
  '/cases/:caseId/history-events',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    const body = parseBody(appendEventBody, req.body);
    await requireCaseAccessForActor(actor, params.caseId);
    const dedupeKey = body.dedupeKey ?? readIdempotencyKeyHeader(req) ?? null;
    const created = await svc.appendCaseHistoryEvent({
      ...body,
      dedupeKey,
      caseId: params.caseId,
      organizationId: actor.organizationId,
      actorId: actor.actorUserId,
      correlationId: body.correlationId ?? actor.correlationId,
    });
    res.status(201).json({ data: created });
  })
);

// GET /cases/:caseId/history-events — listCaseHistoryEventsForCase
const listHistoryQuery = z.object({
  eventType: z.string().trim().min(1).optional(),
  sourceTable: z.string().trim().min(1).optional(),
  occurredSince: z.string().trim().min(1).optional(),
  occurredUntil: z.string().trim().min(1).optional(),
  afterSeq: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

router.get(
  '/cases/:caseId/history-events',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    const query = parseQuery(listHistoryQuery, req.query);
    await requireCaseAccessForActor(actor, params.caseId);
    const items = await svc.listCaseHistoryEventsForCase(
      params.caseId,
      {
        eventType: query.eventType,
        sourceTable: query.sourceTable,
        occurredSince: query.occurredSince,
        occurredUntil: query.occurredUntil,
      },
      { afterSeq: query.afterSeq, limit: query.limit },
      actor.actorUserId
    );
    res.status(200).json({ data: items });
  })
);

// GET /history-events/:eventId — getCaseHistoryEvent
router.get(
  '/history-events/:eventId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ eventId: z.string().trim().min(1) }), req.params);
    const found = await svc.getCaseHistoryEvent(params.eventId, actor.actorUserId);
    if (!found) {
      throw toCaseWorkspaceAppError(new Error('history_event_not_found'), actor.correlationId);
    }
    await requireCaseAccessForActor(actor, found.caseId);
    res.status(200).json({ data: found });
  })
);

// POST /cases/:caseId/value-measurements — recordValueMeasurement
const recordMeasurementBody = z.object({
  metricKey: z.string().trim().min(1),
  metricName: z.string().trim().min(1),
  kpiRef: z.string().trim().min(1).nullable().optional(),
  baselineValue: z.number().nullable().optional(),
  baselineUnit: z.string().trim().min(1).nullable().optional(),
  targetValue: z.number().nullable().optional(),
  targetUnit: z.string().trim().min(1).nullable().optional(),
  actualValue: z.number().nullable().optional(),
  actualUnit: z.string().trim().min(1).nullable().optional(),
  measurementStatus: valueMeasurementStatusEnum,
  measurementDate: z.string().trim().min(1),
  measurementWindowStart: z.string().trim().min(1).nullable().optional(),
  measurementWindowEnd: z.string().trim().min(1).nullable().optional(),
  confidence: valueMeasurementConfidenceEnum,
  attribution: z.string().trim().min(1),
  benefitOwnerActorId: z.string().trim().min(1).nullable().optional(),
  nextMeasurementDueAt: z.string().trim().min(1).nullable().optional(),
  evidenceRef: z.string().trim().min(1).nullable().optional(),
  dedupeKey: z.string().trim().min(1).nullable().optional(),
});

router.post(
  '/cases/:caseId/value-measurements',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    const body = parseBody(recordMeasurementBody, req.body);
    await requireCaseAccessForActor(actor, params.caseId);
    const dedupeKey = body.dedupeKey ?? readIdempotencyKeyHeader(req) ?? null;
    const created = await svc.recordValueMeasurement({
      ...body,
      dedupeKey,
      caseId: params.caseId,
      measuredByActorId: actor.actorUserId,
    });
    res.status(201).json({ data: created });
  })
);

// GET /cases/:caseId/value-measurements — listValueMeasurementsForCase
router.get(
  '/cases/:caseId/value-measurements',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams, req.params);
    const query = parseQuery(
      z.object({ metricKey: z.string().trim().min(1).optional(), status: valueMeasurementStatusEnum.optional() }),
      req.query
    );
    await requireCaseAccessForActor(actor, params.caseId);
    const items = await svc.listValueMeasurementsForCase(params.caseId, query, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

// GET /cases/:caseId/value-measurements/metric/:metricKey — listValueMeasurementsForMetric
router.get(
  '/cases/:caseId/value-measurements/metric/:metricKey',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(caseIdParams.merge(z.object({ metricKey: z.string().trim().min(1) })), req.params);
    await requireCaseAccessForActor(actor, params.caseId);
    const items = await svc.listValueMeasurementsForMetric(params.caseId, params.metricKey, actor.actorUserId);
    res.status(200).json({ data: items });
  })
);

// GET /value-measurements/:measurementId — getValueMeasurement
router.get(
  '/value-measurements/:measurementId',
  caseWorkspaceHandler(async (req, res, actor) => {
    const params = parseParams(z.object({ measurementId: z.string().trim().min(1) }), req.params);
    const found = await svc.getValueMeasurement(params.measurementId, actor.actorUserId);
    if (!found) {
      throw toCaseWorkspaceAppError(new Error('value_measurement_not_found'), actor.correlationId);
    }
    await requireCaseAccessForActor(actor, found.caseId);
    res.status(200).json({ data: found });
  })
);

export default router;
