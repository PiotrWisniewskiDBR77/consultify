/**
 * canvasMaterialize — single materialization writer shared by both Canvas
 * promote paths (proposal-approval AND save-to-workspace).
 *
 * Why this exists (Canvas M-7):
 * The Canvas → workspace flow had TWO writers that produced the same entity
 * types: `createWorkspaceResource` (in routes/work-canvas.routes.ts, called
 * by /save-to-workspace) and `commitProposalToDomain` (in workCanvasService.ts,
 * called by proposal approval). Each branch had its own bugs (audit exports
 * report — see _CANVAS_EXPORTS_AUDIT.md §4 P1-4 "two writers, two divergent
 * behaviors"). After wave-2 W2-E1..E10 both writers were corrected, but the
 * structural duplication remained — every future bug would have two sites to
 * fix.
 *
 * This module is the single materialization core. Both writers reduce to:
 *   const result = await materializeWorkspaceTarget({...}, ctx)
 * Adding a new target type is a single-place change.
 */

import { randomUUID } from 'node:crypto';

import { getDatabase } from '../database/index.js';
import { insertDynamic } from '../utils/dbDynamic.js';
import { get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export type CanvasWorkspaceTarget = 'idea' | 'note' | 'initiative' | 'decision' | 'task';

export interface CanvasMaterializeInput {
  organizationId: string;
  actorUserId: string;
  target: CanvasWorkspaceTarget;
  title: string;
  /** Full markdown body (used by note + as fallback summary). */
  contentMd: string;
  /** Capped summary used by initiative.summary / decision.description / task.description. */
  summary: string;
  /** Optional UUID-validated projectId. Pass `null` when the source has a non-UUID id. */
  projectId: string | null;
  /** Source draft id — written into the materialized entity's provenance fields. */
  sourceDraftId: string;
  /** Source conversation id (idea provenance). May be empty for proposal-approval. */
  sourceConversationId?: string;
  /** Pre-tokenized section list — used to seed an idea's Mind Map. */
  sections?: Array<{ heading: string; body: string }>;
  /** Optional decision type override (canonical enum). Defaults to 'APPROVAL'. */
  decisionType?: 'GO_NO_GO' | 'APPROVAL' | 'RESOURCE_ALLOCATION' | 'OTHER';
  /** Optional task priority + due. */
  taskPriority?: 'low' | 'medium' | 'high' | 'critical';
  taskAssigneeId?: string;
  taskDueDate?: string;
  /** Optional initiative owner override (default actorUserId). */
  ownerId?: string;
}

export interface CanvasMaterializeResult {
  type: CanvasWorkspaceTarget;
  id: string;
  title: string;
  /** Entity-detail URL (not list URL — the W2-E2 fix). */
  url: string;
  readBack: Record<string, unknown>;
}

/**
 * C8 — org-scoping guard. The materializer only ever CREATES new rows, but the
 * input can carry references to EXISTING entities: `projectId` (from
 * draft.projectId on save-to-workspace, or proposal.payload.projectId on
 * proposal approval) and `ownerId` / `taskAssigneeId` (proposal payload).
 * Downstream canonical services do not all enforce org membership —
 * decisionService / notebookService / initiativeService persist project_id
 * verbatim, and decisionMakerId / owner_id / assignee_id are never checked —
 * so the validation lives here: the single shared site for both writers.
 */
function crossOrgReferenceError(field: string, value: string): Error {
  return Object.assign(
    new Error(`Referenced ${field} does not exist or belongs to another organization`),
    {
      statusCode: 403,
      code: 'CANVAS_CROSS_ORG_REFERENCE',
      field,
      value,
    }
  );
}

async function assertOrgScopedReferences(input: CanvasMaterializeInput): Promise<void> {
  const { organizationId, actorUserId, projectId, ownerId, taskAssigneeId } = input;

  if (projectId) {
    const project = await dbGet<{ id: string }>(
      'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
      [projectId, organizationId],
      { fallback: false }
    );
    if (!project) throw crossOrgReferenceError('projectId', projectId);
  }

  const userReferences: Array<{ field: string; userId: string }> = [];
  if (ownerId && ownerId !== actorUserId) {
    userReferences.push({ field: 'ownerId', userId: ownerId });
  }
  if (taskAssigneeId && taskAssigneeId !== actorUserId && taskAssigneeId !== ownerId) {
    userReferences.push({ field: 'taskAssigneeId', userId: taskAssigneeId });
  }
  for (const reference of userReferences) {
    const user = await dbGet<{ id: string }>(
      'SELECT id FROM users WHERE id = ? AND organization_id = ?',
      [reference.userId, organizationId],
      { fallback: false }
    );
    if (!user) throw crossOrgReferenceError(reference.field, reference.userId);
  }
}

/**
 * Materialize a Canvas promote into its canonical entity. Both
 * `createWorkspaceResource` and `commitProposalToDomain` reduce to this.
 */
export async function materializeWorkspaceTarget(
  input: CanvasMaterializeInput
): Promise<CanvasMaterializeResult> {
  const {
    organizationId,
    actorUserId,
    target,
    title,
    contentMd,
    summary,
    projectId,
    sourceDraftId,
    sourceConversationId,
    sections = [],
    decisionType = 'APPROVAL',
    taskPriority = 'medium',
    taskAssigneeId,
    taskDueDate,
    ownerId,
  } = input;
  // C8 — refuse to mutate when any referenced entity is missing or cross-org.
  await assertOrgScopedReferences(input);
  const now = new Date().toISOString();

  // ---- idea ----------------------------------------------------------------
  if (target === 'idea') {
    const ideaId = `idea-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await insertDynamic(
      'my_ideas',
      {
        id: ideaId,
        user_id: actorUserId,
        organization_id: organizationId,
        title,
        body: summary,
        seed_text: contentMd,
        stage: 'spark',
        source_type: 'work_canvas',
        source_conversation_id: sourceConversationId || null,
        source_message_id: sourceDraftId,
        created_at: now,
        updated_at: now,
      },
      ['id']
    );

    // Seed Mind Map (W2-E10): one node per H2, edges from synthetic root.
    const mapId = `map-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const cappedSections = sections.slice(0, 8);
    const nodes = [
      { id: 'root', label: title, x: 0, y: 0, kind: 'idea' },
      ...cappedSections.map((section, i) => ({
        id: `s${i}`,
        label: section.heading.slice(0, 80) || `Section ${i + 1}`,
        x: 280,
        y: (i - (cappedSections.length - 1) / 2) * 90,
        kind: 'thought',
        note: section.body.slice(0, 280),
      })),
    ];
    const edges = cappedSections.map((_, i) => ({
      id: `e${i}`,
      source: 'root',
      target: `s${i}`,
    }));
    await insertDynamic(
      'my_idea_maps',
      {
        id: mapId,
        idea_id: ideaId,
        user_id: actorUserId,
        organization_id: organizationId,
        nodes_json: JSON.stringify(nodes),
        edges_json: JSON.stringify(edges),
        schema_version: 3,
        extensions_json: JSON.stringify({
          source: 'work_canvas',
          draftId: sourceDraftId,
          seededFromSections: cappedSections.length,
        }),
        created_at: now,
        updated_at: now,
      },
      ['id']
    );

    return {
      type: 'idea',
      id: ideaId,
      title,
      url: `/my-work?ideaId=${encodeURIComponent(ideaId)}`,
      readBack: { target, ideaId, mapId, status: 'created', nodeCount: nodes.length },
    };
  }

  // ---- note ----------------------------------------------------------------
  if (target === 'note') {
    const { default: notebookService } = await import('./notebookService.js');
    const ingest = await notebookService.ingest(organizationId, actorUserId, {
      title,
      contentText: contentMd,
      source: 'api_import',
      tags: ['work-canvas'],
      projectId: projectId || undefined,
      metadata: {
        sourceType: 'work_canvas',
        sourceId: sourceDraftId,
        sourceConversationId,
      },
    });
    return {
      type: 'note',
      id: ingest.pageId,
      title: ingest.title,
      url: `/my-work/notebook/${ingest.pageId}`,
      readBack: { target, noteId: ingest.pageId, status: 'created' },
    };
  }

  // ---- decision ------------------------------------------------------------
  if (target === 'decision') {
    const { default: decisionService } = await import('./decisionService.js');
    const decision = await decisionService.createDecision({
      organizationId,
      projectId: projectId || undefined,
      title,
      description: summary,
      type: decisionType,
      decisionMakerId: ownerId || actorUserId,
      createdBy: actorUserId,
    });
    return {
      type: 'decision',
      id: decision.id,
      title: decision.title,
      url: `/my-work/decisions/${decision.id}`,
      readBack: { target, decisionId: decision.id, status: 'created' },
    };
  }

  // ---- task ----------------------------------------------------------------
  if (target === 'task') {
    const { TaskService } = await import('./TaskService.js');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taskService = new TaskService(getDatabase() as any);
    const task = await taskService.createTask(
      {
        projectId,
        title,
        description: summary,
        status: 'todo',
        priority: taskPriority,
        assigneeId: taskAssigneeId || undefined,
        dueDate: taskDueDate,
        tags: ['work-canvas', 'ai'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      actorUserId
    );
    return {
      type: 'task',
      id: task.id,
      title: task.title,
      url: `/my-work?taskId=${encodeURIComponent(task.id)}`,
      readBack: { target, taskId: task.id, status: 'created' },
    };
  }

  // ---- initiative ----------------------------------------------------------
  const { default: initiativeService } = await import('./initiativeService.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initiative = await initiativeService.createInitiative({
    organization_id: organizationId,
    project_id: projectId || undefined,
    title,
    summary,
    status: 'DRAFT',
    owner_id: ownerId || actorUserId,
    market_context: `Created from Work Canvas draft ${sourceDraftId}`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return {
    type: 'initiative',
    id: initiative.id,
    title: initiative.title || title,
    url: `/my-work?initiativeId=${encodeURIComponent(initiative.id)}`,
    readBack: { target, initiativeId: initiative.id, status: 'created' },
  };
}

/** Convenience: log + rethrow so caller-side error envelopes stay consistent. */
export async function materializeOrThrow(
  input: CanvasMaterializeInput,
  context: { writer: 'save_to_workspace' | 'proposal_approval' }
): Promise<CanvasMaterializeResult> {
  try {
    return await materializeWorkspaceTarget(input);
  } catch (error) {
    logger.error('[canvasMaterialize] failed', {
      writer: context.writer,
      target: input.target,
      sourceDraftId: input.sourceDraftId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
