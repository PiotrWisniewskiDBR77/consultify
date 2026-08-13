/**
 * ToolOutputsController — READ / LIST / REOPEN surface for the canonical
 * `tool_outputs` snapshot (migrations 946/947/948) and its derived documents
 * (`tool_reports`, `tool_report_sources`, `tool_output_initiative_proposals`).
 *
 * WHY A SEPARATE FILE: `ToolController.promoteToOutput` already WRITES the
 * canonical snapshot (server/src/services/tools/toolOutputSnapshotService.ts)
 * — that write path, its idempotency ledger, and its 53 passing tests are
 * NOT touched here. This controller only ever SELECTs from those tables (plus
 * one additive POST for `reopen`, which delegates to the already-exported,
 * already-tested `correctToolOutput` — see that function's own header in
 * toolOutputSnapshotService.ts). Kept out of ToolController.ts (already ~130KB)
 * so this gap-closing surface has an obviously separate, auditable blast radius.
 *
 * ORG ISOLATION (non-negotiable, per every query below): every SELECT filters
 * on `organization_id = <req.user.organizationId>` directly in SQL — never
 * "fetch then filter in JS" — so a foreign-org id 404s instead of leaking a
 * single field. Verified by tests/integration/tool-outputs-read-routes.realdb.test.ts.
 */
import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { correctToolOutput } from '../services/tools/toolOutputSnapshotService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as queryHelpers from '../utils/queryHelpers.js';

/** Row shapes, snake_case as they come back from Postgres — never re-exported. */
interface ToolOutputRow {
  id: string;
  organization_id: string;
  project_id: string | null;
  tool_session_id: string;
  tool_type: string;
  method_pack_version: string;
  version: number;
  supersedes_id: string | null;
  title: string;
  payload_json: unknown;
  content_hash: string;
  status: string;
  created_by: string | null;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  frozen_at: string | null;
}

interface ToolReportRow {
  id: string;
  organization_id: string;
  project_id: string | null;
  kind: string;
  title: string;
  renderer_version: string;
  theme: string;
  payload_json: unknown;
  content_hash: string;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface InitiativeProposalRow {
  id: string;
  organization_id: string;
  tool_output_id: string;
  source_conclusion_id: string;
  proposed_title: string;
  rationale: string | null;
  status: string;
  initiative_id: string | null;
  created_by: string | null;
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
}

const parseJsonMaybe = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

/** Summary shape for list views — omits the (potentially large) payload. */
const toOutputSummary = (row: ToolOutputRow) => ({
  id: row.id,
  toolSessionId: row.tool_session_id,
  projectId: row.project_id,
  toolType: row.tool_type,
  methodPackVersion: row.method_pack_version,
  version: row.version,
  supersedesId: row.supersedes_id,
  title: row.title,
  status: row.status,
  contentHash: row.content_hash,
  createdBy: row.created_by,
  createdAt: row.created_at,
  approvedBy: row.approved_by,
  approvedAt: row.approved_at,
  frozenAt: row.frozen_at,
  isCurrent: row.status !== 'superseded',
});

/** Full shape for detail views — includes items/tensions/conclusions from payload_json. */
const toOutputDetail = (row: ToolOutputRow) => {
  const payload = (parseJsonMaybe(row.payload_json) ?? {}) as {
    items?: unknown[];
    tensions?: unknown[];
    conclusions?: unknown[];
    sourceRevision?: number;
    engineVersion?: string;
  };
  return {
    ...toOutputSummary(row),
    items: payload.items ?? [],
    tensions: payload.tensions ?? [],
    conclusions: payload.conclusions ?? [],
    sourceRevision: payload.sourceRevision,
    engineVersion: payload.engineVersion,
  };
};

const toReportSummary = (row: ToolReportRow) => ({
  id: row.id,
  projectId: row.project_id,
  kind: row.kind,
  title: row.title,
  rendererVersion: row.renderer_version,
  theme: row.theme,
  contentHash: row.content_hash,
  status: row.status,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toReportDetail = (row: ToolReportRow) => ({
  ...toReportSummary(row),
  // The full ToolReportDocument (src/toolOutputs/types.ts) as persisted by
  // persistCanonicalReport — this is exactly the shape ToolReportView expects
  // as its `doc` prop.
  doc: parseJsonMaybe(row.payload_json),
});

const toProposalSummary = (row: InitiativeProposalRow) => ({
  id: row.id,
  toolOutputId: row.tool_output_id,
  sourceConclusionId: row.source_conclusion_id,
  proposedTitle: row.proposed_title,
  rationale: row.rationale,
  status: row.status,
  initiativeId: row.initiative_id,
  createdBy: row.created_by,
  createdAt: row.created_at,
  decidedBy: row.decided_by,
  decidedAt: row.decided_at,
});

const auditLog = async (
  orgId: string,
  userId: string,
  action: string,
  resourceId: string,
  details?: Record<string, unknown>
): Promise<void> => {
  try {
    await queryHelpers.queryRun(
      `INSERT INTO audit_log (id, organization_id, user_id, action, resource_type, resource_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        orgId,
        userId,
        action,
        'tool_output',
        resourceId,
        JSON.stringify(details || {}),
        new Date().toISOString(),
      ]
    );
  } catch {
    // audit_log table may not exist in every environment — never block the read/reopen on it.
  }
};

export default class ToolOutputsController {
  /**
   * GET /api/tool-outputs?toolSessionId=<id>
   * Lists Outputs for the caller's org, optionally scoped to one session.
   * Includes superseded revisions (ordered version DESC) so the UI can show
   * current vs superseded — this is a deliberate design choice: hiding
   * history here would defeat the "show current vs superseded" requirement.
   * A foreign-org `toolSessionId` yields an empty list, never another org's rows.
   */
  static listOutputs = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const toolSessionId =
      typeof req.query.toolSessionId === 'string' ? req.query.toolSessionId : undefined;

    const rows = toolSessionId
      ? await queryHelpers.queryAll<ToolOutputRow>(
          `SELECT * FROM tool_outputs WHERE organization_id = ? AND tool_session_id = ?
            ORDER BY version DESC`,
          [user.organizationId, toolSessionId]
        )
      : await queryHelpers.queryAll<ToolOutputRow>(
          `SELECT * FROM tool_outputs WHERE organization_id = ?
            ORDER BY created_at DESC LIMIT 200`,
          [user.organizationId]
        );

    res.json({ outputs: rows.map(toOutputSummary) });
  });

  /** GET /api/tool-outputs/:outputId — org-scoped, full detail (items/tensions/conclusions). */
  static getOutput = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { outputId } = req.params;
    const row = await queryHelpers.queryOne<ToolOutputRow>(
      `SELECT * FROM tool_outputs WHERE id = ? AND organization_id = ?`,
      [outputId, user.organizationId]
    );
    if (!row) {
      res.status(404).json({ error: 'Tool output not found' });
      return;
    }
    res.json({ output: toOutputDetail(row) });
  });

  /**
   * GET /api/tool-outputs/:outputId/reports
   * Lists Reports/Presentations traced to this Output via `tool_report_sources`
   * (946) — the lineage-accurate join, not a guess by title/session.
   */
  static listReportsForOutput = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { outputId } = req.params;
      const output = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM tool_outputs WHERE id = ? AND organization_id = ?`,
        [outputId, user.organizationId]
      );
      if (!output) {
        res.status(404).json({ error: 'Tool output not found' });
        return;
      }
      const rows = await queryHelpers.queryAll<ToolReportRow>(
        `SELECT r.* FROM tool_reports r
           JOIN tool_report_sources s ON s.tool_report_id = r.id
          WHERE s.tool_output_id = ? AND s.organization_id = ? AND r.organization_id = ?
          ORDER BY r.created_at DESC`,
        [outputId, user.organizationId, user.organizationId]
      );
      res.json({ reports: rows.map(toReportSummary) });
    }
  );

  /** GET /api/tool-outputs/reports/:reportId — org-scoped, full document payload for ToolReportView. */
  static getReport = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { reportId } = req.params;
    const row = await queryHelpers.queryOne<ToolReportRow>(
      `SELECT * FROM tool_reports WHERE id = ? AND organization_id = ?`,
      [reportId, user.organizationId]
    );
    if (!row) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json({ report: toReportDetail(row) });
  });

  /**
   * GET /api/tool-outputs/:outputId/initiative-proposals
   * Lists proposals traced to this Output's K1-K4 conclusions (946's
   * `tool_output_initiative_proposals`). `recordInitiativeProposal` only ever
   * writes a row from an APPROVED Output with a conclusion (see that
   * function's own doc), so every row returned here already carries valid
   * lineage — this endpoint does not need to re-derive that.
   */
  static listInitiativeProposalsForOutput = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { outputId } = req.params;
      const output = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM tool_outputs WHERE id = ? AND organization_id = ?`,
        [outputId, user.organizationId]
      );
      if (!output) {
        res.status(404).json({ error: 'Tool output not found' });
        return;
      }
      const rows = await queryHelpers.queryAll<InitiativeProposalRow>(
        `SELECT * FROM tool_output_initiative_proposals
          WHERE tool_output_id = ? AND organization_id = ?
          ORDER BY created_at DESC`,
        [outputId, user.organizationId]
      );
      res.json({ proposals: rows.map(toProposalSummary) });
    }
  );

  /**
   * POST /api/tool-outputs/:outputId/reopen
   * Correction flow: opens an APPROVED Output into a NEW revision via the
   * existing `correctToolOutput` (previously exported but unwired to any
   * route — see that function's header). The ORIGINAL row is only ever
   * flipped to `superseded`; its `payload_json`/`content_hash` are never
   * rewritten — never a mutation.
   *
   * Body: `{ conclusions?: OutputConclusion[] }`. Omitted/empty → the new
   * revision carries the SAME conclusions as the current one (a plain
   * "reopen for review" with no edits yet), which is also the proof that
   * reopening without edits reproduces an identical content hash on the new
   * revision — the edited-content case (different hash) is exercised by
   * passing a modified `conclusions` array.
   */
  static reopenOutput = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { outputId } = req.params;
    const current = await queryHelpers.queryOne<ToolOutputRow>(
      `SELECT * FROM tool_outputs WHERE id = ? AND organization_id = ?`,
      [outputId, user.organizationId]
    );
    if (!current) {
      res.status(404).json({ error: 'Tool output not found' });
      return;
    }
    if (current.status !== 'approved') {
      res.status(409).json({ error: `Only an approved output can be reopened (status is "${current.status}")` });
      return;
    }

    const currentPayload = (parseJsonMaybe(current.payload_json) ?? {}) as { conclusions?: unknown[] };
    const bodyConclusions = Array.isArray((req.body as { conclusions?: unknown[] } | undefined)?.conclusions)
      ? (req.body as { conclusions: unknown[] }).conclusions
      : undefined;
    const nextConclusions = (bodyConclusions ?? currentPayload.conclusions ?? []) as never[];

    const now = new Date().toISOString();
    const { superseded, revision } = await correctToolOutput({
      approvedOutputId: outputId,
      organizationId: user.organizationId,
      actor: { id: user.id },
      now,
      nextConclusions,
    });

    await auditLog(user.organizationId, user.id, 'tool_output_reopened', outputId, {
      supersededId: superseded.id,
      revisionId: revision.id,
      revisionVersion: revision.version,
    });

    res.json({
      superseded: { id: superseded.id, status: superseded.status },
      revision: {
        id: revision.id,
        version: revision.version,
        supersedesId: revision.supersedesId,
        status: revision.status,
        contentHash: revision.contentHash,
        approvedBy: revision.approvedBy,
        approvedAt: revision.approvedAt,
      },
    });
  });
}
