import { v4 as uuidv4 } from 'uuid';

import { getTableColumns } from '../utils/dbSchema.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import { createInitiative as funnelCreateInitiative } from './initiative/createInitiativeService.js';
import { resolveInitiativeProjectId } from './initiativeProjectPolicyService.js';
import { generateOutline } from './presentationGeneratorService.js';
import { createReport } from './reportBuilderService.js';

export type NotebookConvertTarget =
  | 'task'
  | 'decision'
  | 'initiative'
  | 'report'
  | 'presentation'
  | 'assessment';

export interface NotebookConvertResult {
  id: string;
  type: string;
  title: string;
  sourceSessionId?: string;
}

export class NotebookConversionError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type LinkGraphRelation = 'ref';

async function requireTableColumns(tableName: string): Promise<Map<string, unknown>> {
  const cols = await getTableColumns(tableName);
  if (!cols || cols.size === 0) {
    throw new NotebookConversionError(
      503,
      `Database table missing: ${tableName}. Run migrations before using notebook convert.`,
      'TABLE_NOT_CONFIGURED'
    );
  }
  return cols as unknown as Map<string, unknown>;
}

async function createMyWorkToolSession(params: {
  userId: string;
  orgId: string;
  sourceType: 'idea' | 'notebook';
  sourceId: string;
  title: string;
  summary?: string;
}): Promise<string> {
  const { userId, orgId, sourceType, sourceId, title, summary } = params;
  const cols = await requireTableColumns('tool_sessions');
  const toolSessionId = uuidv4();
  const now = new Date().toISOString();
  const insertCols: string[] = ['id'];
  const insertVals: string[] = ['?'];
  const insertParams: any[] = [toolSessionId];

  const add = (col: string, val: any) => {
    if (!cols.has(col)) return;
    insertCols.push(col);
    insertVals.push('?');
    insertParams.push(val);
  };

  const safeTitle = String(title || 'MyWork Session')
    .trim()
    .slice(0, 255);
  const normalizedSummary = String(summary || '')
    .trim()
    .slice(0, 4000);
  const myWorkPayload = {
    origin: 'MYWORK',
    source: { type: sourceType, id: sourceId },
    summary: normalizedSummary || null,
  };

  add('organization_id', orgId);
  add('project_id', null);
  add('tool_type', 'MYWORK');
  // Z139 (data-integrity): safeTitle may already carry entities escaped by the
  // global sanitizer on a prior save of the source idea/notebook. Decode before
  // composing tool_sessions.name (mirrors the notebook/canvas decode-before-store fix).
  add('name', decodeHtmlEntities(`MyWork ${sourceType}: ${safeTitle}`.slice(0, 255)));
  add('status', 'APPROVED');
  add('completion_percent', 100);
  add('confidence_avg', 1);
  add('answers_json', JSON.stringify(myWorkPayload));
  add('context_snapshot', JSON.stringify({ myWork: true, ...myWorkPayload }));
  add('approved_at', now);
  add('created_by', userId);
  add('updated_by', userId);
  add('created_at', now);
  add('updated_at', now);

  await queryHelpers.queryRun(
    `INSERT INTO tool_sessions (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
    insertParams
  );

  return toolSessionId;
}

async function linkGraphAddEdge(params: {
  orgId: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relation?: LinkGraphRelation;
  containerType?: string | null;
  containerId?: string | null;
  blockId?: string | null;
  nodeId?: string | null;
}): Promise<{ id: string } | null> {
  const cols = await getTableColumns('link_graph_edges');
  if (!cols || cols.size === 0) return null;

  const id = uuidv4();
  const now = new Date().toISOString();
  const relation = params.relation || 'ref';
  const insertCols: string[] = ['id'];
  const insertVals: string[] = ['?'];
  const insertParams: any[] = [id];

  const add = (col: string, val: any) => {
    if (!cols.has(col)) return;
    insertCols.push(col);
    insertVals.push('?');
    insertParams.push(val);
  };

  add('organization_id', params.orgId);
  add('created_by', params.userId);
  add('source_type', params.sourceType);
  add('source_id', params.sourceId);
  add('target_type', params.targetType);
  add('target_id', params.targetId);
  add('relation', relation);
  add('container_type', params.containerType ?? null);
  add('container_id', params.containerId ?? null);
  add('block_id', params.blockId ?? params.nodeId ?? null);
  add('created_at', now);

  try {
    await queryHelpers.queryRun(
      `INSERT INTO link_graph_edges (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
      insertParams
    );
    return { id };
  } catch (error: any) {
    const message = String(error?.message || '');
    if (message.toLowerCase().includes('unique') || message.toLowerCase().includes('duplicate')) {
      return null;
    }
    throw error;
  }
}

export async function convertNotebookPage(params: {
  pageId: string;
  orgId: string;
  userId: string;
  target: NotebookConvertTarget;
  title?: string;
  description?: string;
  assessmentType?: 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';
}): Promise<NotebookConvertResult> {
  const { pageId, orgId, userId, target } = params;
  await requireTableColumns('notebook_pages');

  const page = await queryHelpers.queryOne<any>(
    `SELECT id, owner_user_id, organization_id, project_id, title, content_text, tags_json, converted_to_json
     FROM notebook_pages WHERE id = ? LIMIT 1`,
    [pageId]
  );

  if (!page) {
    throw new NotebookConversionError(404, 'Not found', 'NOTEBOOK_PAGE_NOT_FOUND');
  }
  if (String(page.organization_id || '') !== String(orgId)) {
    throw new NotebookConversionError(403, 'Forbidden', 'NOTEBOOK_PAGE_FORBIDDEN');
  }
  if (String(page.owner_user_id || '') !== String(userId)) {
    throw new NotebookConversionError(403, 'Owner-only', 'NOTEBOOK_PAGE_OWNER_ONLY');
  }

  const overrideTitle = typeof params.title === 'string' ? params.title.trim() : '';
  const overrideDesc = typeof params.description === 'string' ? params.description : '';
  const entityTitle = overrideTitle || page.title || 'Untitled';
  const entityDesc = overrideDesc || String(page.content_text || '').slice(0, 2000);
  const newId = uuidv4();
  let createdEntity: NotebookConvertResult | null = null;

  if (target === 'task') {
    const cols = await requireTableColumns('tasks');
    const insertCols: string[] = ['id'];
    const insertVals: string[] = ['?'];
    const insertParams: any[] = [newId];
    const add = (col: string, val: any) => {
      if (!cols.has(col)) return;
      insertCols.push(col);
      insertVals.push('?');
      insertParams.push(val);
    };
    add('organization_id', orgId);
    add('title', entityTitle);
    add('description', entityDesc);
    add('status', 'todo');
    add('priority', 'medium');
    add('assignee_id', userId);
    add('reporter_id', userId);
    add('tags', page.tags_json || '[]');
    add('task_type', 'personal');
    add('source_type', 'notebook');
    add('source_id', pageId);
    await queryHelpers.queryRun(
      `INSERT INTO tasks (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
      insertParams
    );
    createdEntity = { id: newId, type: 'task', title: entityTitle };

    await linkGraphAddEdge({
      orgId,
      userId,
      sourceType: 'task',
      sourceId: newId,
      targetType: 'notebook',
      targetId: pageId,
      relation: 'ref',
      containerType: 'mywork_convert',
      containerId: pageId,
    });
  } else if (target === 'decision') {
    const cols = await requireTableColumns('decisions');
    const insertCols: string[] = ['id'];
    const insertVals: string[] = ['?'];
    const insertParams: any[] = [newId];
    const add = (col: string, val: any) => {
      if (!cols.has(col)) return;
      insertCols.push(col);
      insertVals.push('?');
      insertParams.push(val);
    };
    add('organization_id', orgId);
    add('title', entityTitle);
    add('description', entityDesc);
    add('status', 'pending');
    add('decision_maker_id', userId);
    add('created_by', userId);
    add('priority', 'medium');
    add('source_type', 'notebook');
    add('source_id', pageId);
    await queryHelpers.queryRun(
      `INSERT INTO decisions (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
      insertParams
    );
    createdEntity = { id: newId, type: 'decision', title: entityTitle };

    await linkGraphAddEdge({
      orgId,
      userId,
      sourceType: 'decision',
      sourceId: newId,
      targetType: 'notebook',
      targetId: pageId,
      relation: 'ref',
      containerType: 'mywork_convert',
      containerId: pageId,
    });
  } else if (target === 'initiative') {
    const cols = await requireTableColumns('initiatives');
    // F15 (data-integrity, continuation of Z139): decode HTML entities the
    // global sanitizer escaped on the title before it feeds initiatives.title/name
    // — funnel branch AND raw-insert fallback (INITIATIVE_FUNNEL_ENABLED default OFF).
    const decodedTitle = decodeHtmlEntities(entityTitle);
    const toolSessionId = await createMyWorkToolSession({
      userId,
      orgId,
      sourceType: 'notebook',
      sourceId: pageId,
      title: entityTitle,
      summary: entityDesc,
    });

    // Uspójnienie F1.9 — przez kanoniczny lejek (DRAFT + name/title + lineage).
    let initiativeId = newId;
    if (process.env.INITIATIVE_FUNNEL_ENABLED === 'true') {
      const __r = await funnelCreateInitiative(
        orgId,
        {
          title: decodedTitle.slice(0, 255),
          summary: entityDesc.slice(0, 5000),
          description: entityDesc.slice(0, 5000),
          ownerExecutionId: userId,
          ownerBusinessId: userId,
          sourceType: 'tool',
          sourceId: toolSessionId,
        },
        { validate: false, actor: { id: userId } }
      );
      initiativeId = __r.id;
      // Funnel nie zna sponsor_id — dośpiewujemy, jeśli kolumna istnieje.
      if (cols.has('sponsor_id')) {
        await queryHelpers.queryRun(
          `UPDATE initiatives SET sponsor_id = ? WHERE id = ? AND organization_id = ?`,
          [userId, initiativeId, orgId]
        );
      }
    } else {
      const anchoredProjectId = await resolveInitiativeProjectId(orgId, null, {
        createdBy: userId ?? null,
      });
      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [newId];
      const add = (col: string, val: any) => {
        if (!cols.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };

      add('organization_id', orgId);
      add('project_id', anchoredProjectId);
      add('name', decodedTitle.slice(0, 255));
      add('title', decodedTitle.slice(0, 255));
      add('summary', entityDesc.slice(0, 5000));
      add('description', entityDesc.slice(0, 5000));
      add('status', 'DRAFT');
      add('owner_execution_id', userId);
      add('owner_business_id', userId);
      add('sponsor_id', userId);
      add('source_type', 'tool');
      add('source_id', toolSessionId);

      await queryHelpers.queryRun(
        `INSERT INTO initiatives (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );
    }
    createdEntity = {
      id: initiativeId,
      type: 'initiative',
      title: decodedTitle,
      sourceSessionId: toolSessionId,
    };

    await linkGraphAddEdge({
      orgId,
      userId,
      sourceType: 'initiative',
      sourceId: initiativeId,
      targetType: 'notebook',
      targetId: pageId,
      relation: 'ref',
      containerType: 'mywork_convert',
      containerId: toolSessionId,
    });
    await linkGraphAddEdge({
      orgId,
      userId,
      sourceType: 'initiative',
      sourceId: initiativeId,
      targetType: 'tool_session',
      targetId: toolSessionId,
      relation: 'ref',
      containerType: 'mywork_convert',
      containerId: toolSessionId,
    });
  } else if (target === 'assessment') {
    const cols = await requireTableColumns('assessments');
    const insertCols: string[] = ['id'];
    const insertVals: string[] = ['?'];
    const insertParams: any[] = [newId];
    const add = (col: string, val: any) => {
      if (!cols.has(col)) return;
      insertCols.push(col);
      insertVals.push('?');
      insertParams.push(val);
    };

    add('organization_id', orgId);
    add('project_id', page.project_id || null);
    add('assessment_type', String(params.assessmentType || 'DRD').toUpperCase());
    add('name', entityTitle.slice(0, 255));
    add('description', entityDesc.slice(0, 5000));
    add('status', 'DRAFT');
    add('created_by', userId);
    add('updated_by', userId);
    add('source_type', 'notebook');
    add('source_id', pageId);

    await queryHelpers.queryRun(
      `INSERT INTO assessments (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
      insertParams
    );

    createdEntity = { id: newId, type: 'assessment', title: entityTitle };

    await linkGraphAddEdge({
      orgId,
      userId,
      sourceType: 'assessment',
      sourceId: newId,
      targetType: 'notebook',
      targetId: pageId,
      relation: 'ref',
      containerType: 'mywork_convert',
      containerId: pageId,
    });
  } else if (target === 'report') {
    const toolSessionId = await createMyWorkToolSession({
      userId,
      orgId,
      sourceType: 'notebook',
      sourceId: pageId,
      title: entityTitle,
      summary: entityDesc,
    });

    const created = await createReport({
      organizationId: orgId,
      sourceType: 'TOOL',
      sourceId: toolSessionId,
      title: entityTitle.slice(0, 255),
      description: entityDesc.slice(0, 2000),
      createdBy: userId,
    });
    createdEntity = {
      id: String(created.report.id),
      type: 'report',
      title: String(created.report.title || entityTitle),
      sourceSessionId: toolSessionId,
    };

    await linkGraphAddEdge({
      orgId,
      userId,
      sourceType: 'report',
      sourceId: String(created.report.id),
      targetType: 'notebook',
      targetId: pageId,
      relation: 'ref',
      containerType: 'mywork_convert',
      containerId: toolSessionId,
    });
    await linkGraphAddEdge({
      orgId,
      userId,
      sourceType: 'report',
      sourceId: String(created.report.id),
      targetType: 'tool_session',
      targetId: toolSessionId,
      relation: 'ref',
      containerType: 'mywork_convert',
      containerId: toolSessionId,
    });
  } else {
    const toolSessionId = await createMyWorkToolSession({
      userId,
      orgId,
      sourceType: 'notebook',
      sourceId: pageId,
      title: entityTitle,
      summary: entityDesc,
    });

    const outline = await generateOutline(
      {
        title: entityTitle.slice(0, 255),
        audience: 'internal',
        goal: 'inform',
        language: 'en',
        theme: 'corporate',
        confidentiality: 'internal',
        sourceType: 'tool',
        sourceId: toolSessionId,
        sourceArtifacts: [
          {
            type: 'tool_session',
            id: toolSessionId,
            label: `MyWork session: ${entityTitle.slice(0, 120)}`,
            data: {
              sourceType: 'notebook',
              sourceId: pageId,
            },
          },
        ],
      },
      orgId
    );
    createdEntity = {
      id: String(outline.deckId),
      type: 'presentation',
      title: entityTitle,
      sourceSessionId: toolSessionId,
    };

    await linkGraphAddEdge({
      orgId,
      userId,
      sourceType: 'presentation',
      sourceId: String(outline.deckId),
      targetType: 'notebook',
      targetId: pageId,
      relation: 'ref',
      containerType: 'mywork_convert',
      containerId: toolSessionId,
    });
    await linkGraphAddEdge({
      orgId,
      userId,
      sourceType: 'presentation',
      sourceId: String(outline.deckId),
      targetType: 'tool_session',
      targetId: toolSessionId,
      relation: 'ref',
      containerType: 'mywork_convert',
      containerId: toolSessionId,
    });
  }

  let existingConverted: any[] = [];
  try {
    existingConverted = JSON.parse(page.converted_to_json || '[]');
  } catch {
    existingConverted = [];
  }
  if (!Array.isArray(existingConverted)) existingConverted = [];
  if (createdEntity?.id) {
    existingConverted.push({ type: target, id: createdEntity.id });
  }

  await queryHelpers.queryRun(
    `UPDATE notebook_pages SET status = 'converted', converted_to_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [JSON.stringify(existingConverted), pageId]
  );

  return createdEntity!;
}
