import { randomUUID } from 'node:crypto';

import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import {
  createArtifactContentEnvelope,
  type ArtifactContentEnvelope,
  type CanonicalFormat,
  type MarkdownProjectionStatus,
} from '../services/artifacts/contentProjectionService.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';

const router = Router();

type DraftKind =
  | 'markdown'
  | 'table'
  | 'checklist'
  | 'research'
  | 'decision'
  | 'document'
  | 'report'
  | 'sheet'
  | 'deck';
type ProposalStatus = 'proposed' | 'approved' | 'rejected';
type WorkspaceTarget = 'idea' | 'note' | 'initiative';
type OutputType = 'presentation' | 'table' | 'report';
type EditOperationType = 'replace_selection' | 'append_section' | 'update_document';

interface WorkCanvasDraft {
  id: string;
  organizationId: string;
  createdBy: string;
  conversationId: string;
  kind: DraftKind;
  title: string;
  content: unknown;
  contentEnvelope: ArtifactContentEnvelope;
  canonicalFormat: CanonicalFormat;
  contentMd: string;
  contentJson: unknown;
  contentSchemaVersion: string | null;
  markdownProjectionStatus: MarkdownProjectionStatus;
  markdownProjectedAt: string | null;
  projectionError: string | null;
  sources: unknown[];
  provenance: Record<string, unknown>;
  projectId: string | null;
  ownerId: string | null;
  researchSessionId: string | null;
  artifactId: string | null;
  artifactRunId: string | null;
  artifactVersion: number | null;
  saveState: 'unsaved' | 'saved' | 'failed';
  lifecycleState: 'draft' | 'proposed' | 'approved';
  dirtyState: 'clean' | 'dirty';
  visibility: 'private' | 'project';
  auditStatus: 'not_required' | 'logged';
  createdAt: string;
  updatedAt: string;
}

interface WorkCanvasProposal {
  id: string;
  draftId: string;
  organizationId: string;
  createdBy: string;
  target: string;
  title: string;
  summary: string;
  status: ProposalStatus;
  payload: Record<string, unknown>;
  requiredCapability: string;
  targetObjectId: string | null;
  readBack: Record<string, unknown> | null;
  auditEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

type DraftRow = {
  id: string;
  organization_id: string;
  created_by: string;
  conversation_id: string;
  kind: DraftKind;
  title: string;
  content_json: string | null;
  canonical_format: CanonicalFormat | null;
  content_md: string | null;
  content_json_native: string | null;
  content_schema_version: string | null;
  markdown_projection_status: MarkdownProjectionStatus | null;
  markdown_projected_at: string | null;
  projection_error: string | null;
  sources_json: string | null;
  provenance_json: string | null;
  project_id: string | null;
  owner_id: string | null;
  research_session_id: string | null;
  artifact_id: string | null;
  artifact_run_id: string | null;
  artifact_version: number | null;
  save_state: 'unsaved' | 'saved' | 'failed';
  lifecycle_state: 'draft' | 'proposed' | 'approved';
  dirty_state: 'clean' | 'dirty';
  visibility: 'private' | 'project';
  audit_status: 'not_required' | 'logged';
  created_at: string;
  updated_at: string;
};

type ProposalRow = {
  id: string;
  draft_id: string;
  organization_id: string;
  created_by: string;
  target: string;
  title: string;
  summary: string;
  status: ProposalStatus;
  payload_json: string | null;
  required_capability: string;
  target_object_id: string | null;
  read_back_json: string | null;
  audit_event_id: string | null;
  created_at: string;
  updated_at: string;
};

type VersionRow = {
  id: string;
  draft_id: string;
  operation_type: string;
  summary: string;
  content_md: string;
  content_json_native: string | null;
  created_by: string;
  created_at: string;
};

let storageReadyPromise: Promise<void> | null = null;

const targetLabels: Record<string, string> = {
  idea: 'Idea',
  initiative: 'Initiative',
  task: 'Task',
  project_brief: 'Brief',
  decision: 'Decision',
  research_report: 'Research Report',
  client_deliverable: 'Client Deliverable',
};

function authContext(req: AuthRequest) {
  return {
    userId: req.userId || req.user?.id || 'unknown-user',
    organizationId: req.organizationId || req.user?.organizationId || 'unknown-org',
  };
}

function envelope<T>(data: T, extra: Record<string, unknown> = {}) {
  return { success: true, data, ...extra };
}

function parseJson(value: string | null, fallback: unknown): unknown {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toDraft(row: DraftRow): WorkCanvasDraft {
  const legacyContent = parseJson(row.content_json, '');
  const contentJson = parseJson(row.content_json_native, undefined);
  const contentEnvelope = createArtifactContentEnvelope({
    artifactType: row.kind,
    canonicalFormat: row.canonical_format || undefined,
    contentMd: row.content_md || (typeof legacyContent === 'string' ? legacyContent : ''),
    contentJson: contentJson ?? (row.canonical_format === 'json' ? legacyContent : undefined),
    contentSchemaVersion: row.content_schema_version || undefined,
  });
  const projectionStatus = row.markdown_projection_status || contentEnvelope.markdownProjectionStatus;
  return {
    id: row.id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    conversationId: row.conversation_id,
    kind: row.kind,
    title: row.title,
    content: parseJson(row.content_json, ''),
    contentEnvelope: {
      ...contentEnvelope,
      markdownProjectionStatus: projectionStatus,
      markdownProjectedAt: row.markdown_projected_at || contentEnvelope.markdownProjectedAt,
      projectionError: row.projection_error || contentEnvelope.projectionError,
    },
    canonicalFormat: contentEnvelope.canonicalFormat,
    contentMd: contentEnvelope.contentMd,
    contentJson: contentEnvelope.contentJson,
    contentSchemaVersion: row.content_schema_version,
    markdownProjectionStatus: projectionStatus,
    markdownProjectedAt: row.markdown_projected_at || contentEnvelope.markdownProjectedAt || null,
    projectionError: row.projection_error || contentEnvelope.projectionError || null,
    sources: parseJson(row.sources_json, []) as unknown[],
    provenance: parseJson(row.provenance_json, {}) as Record<string, unknown>,
    projectId: row.project_id,
    ownerId: row.owner_id,
    researchSessionId: row.research_session_id,
    artifactId: row.artifact_id,
    artifactRunId: row.artifact_run_id,
    artifactVersion: row.artifact_version,
    saveState: row.save_state,
    lifecycleState: row.lifecycle_state,
    dirtyState: row.dirty_state,
    visibility: row.visibility,
    auditStatus: row.audit_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toProposal(row: ProposalRow): WorkCanvasProposal {
  return {
    id: row.id,
    draftId: row.draft_id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    target: row.target,
    title: row.title,
    summary: row.summary,
    status: row.status,
    payload: parseJson(row.payload_json, {}) as Record<string, unknown>,
    requiredCapability: row.required_capability,
    targetObjectId: row.target_object_id,
    readBack: parseJson(row.read_back_json, null) as Record<string, unknown> | null,
    auditEventId: row.audit_event_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toVersion(row: VersionRow) {
  return {
    id: row.id,
    draftId: row.draft_id,
    operationType: row.operation_type,
    summary: row.summary,
    contentMd: row.content_md,
    contentJson: parseJson(row.content_json_native, undefined),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function firstMarkdownHeading(markdown: string, fallback: string): string {
  const heading = String(markdown || '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('# '));
  return (heading ? heading.replace(/^#\s+/, '') : fallback).trim().slice(0, 180) || fallback;
}

function markdownSummary(markdown: string, max = 1200): string {
  return String(markdown || '')
    .replace(/^#+\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function markdownSections(markdown: string): Array<{ heading: string; body: string }> {
  const lines = String(markdown || '').split('\n');
  const sections: Array<{ heading: string; body: string[] }> = [];
  let current: { heading: string; body: string[] } | null = null;
  for (const line of lines) {
    const match = line.match(/^#{1,3}\s+(.+)$/);
    if (match) {
      if (current) sections.push(current);
      current = { heading: match[1].trim(), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) sections.push(current);
  return sections
    .map((section) => ({ heading: section.heading, body: section.body.join('\n').trim() }))
    .filter((section) => section.heading);
}

function diffSummary(before: string, after: string) {
  const beforeLines = String(before || '').split('\n');
  const afterLines = String(after || '').split('\n');
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  const addedLines = afterLines.filter((line) => !beforeSet.has(line)).length;
  const removedLines = beforeLines.filter((line) => !afterSet.has(line)).length;
  return {
    addedLines,
    removedLines,
    summary: `${addedLines} lines added, ${removedLines} lines removed`,
  };
}

function applyEditOperation(draft: WorkCanvasDraft, operation: any): { contentMd: string; summary: string } {
  const operationType = String(operation?.type || '') as EditOperationType;
  if (operationType === 'replace_selection') {
    const selectedText = String(operation?.selectedText || '');
    const replacementMd = String(operation?.replacementMd || '');
    if (!selectedText) throw new Error('selectedText is required for replace_selection');
    if (!draft.contentMd.includes(selectedText)) {
      throw new Error('Selected text was not found in the current Canvas draft');
    }
    return {
      contentMd: draft.contentMd.replace(selectedText, replacementMd),
      summary: operation?.reason || 'Replaced selected Canvas text',
    };
  }
  if (operationType === 'append_section') {
    const heading = String(operation?.heading || '').trim();
    const contentMd = String(operation?.contentMd || '').trim();
    if (!heading) throw new Error('heading is required for append_section');
    return {
      contentMd: `${draft.contentMd.trim()}\n\n## ${heading}\n\n${contentMd}\n`,
      summary: operation?.reason || `Appended section: ${heading}`,
    };
  }
  if (operationType === 'update_document') {
    const contentMd = String(operation?.contentMd || '');
    if (!contentMd.trim()) throw new Error('contentMd is required for update_document');
    return {
      contentMd,
      summary: operation?.reason || 'Updated Canvas document',
    };
  }
  throw new Error('operation.type must be replace_selection, append_section, or update_document');
}

async function insertDynamic(
  table: string,
  values: Record<string, unknown>,
  requiredColumns: string[] = ['id']
): Promise<void> {
  const cols = await getTableColumns(table);
  for (const col of requiredColumns) {
    if (!cols.has(col)) {
      throw new Error(`Required column ${table}.${col} is not available`);
    }
  }
  const entries = Object.entries(values).filter(([key]) => cols.has(key));
  if (entries.length === 0) throw new Error(`No compatible columns for ${table}`);
  await dbRun(
    `INSERT INTO ${table} (${entries.map(([key]) => key).join(', ')}) VALUES (${entries
      .map(() => '?')
      .join(', ')})`,
    entries.map(([, value]) => value),
    { fallback: false }
  );
}

async function updateDraftAfterOperation(
  draft: WorkCanvasDraft,
  provenancePatch: Record<string, unknown>
): Promise<WorkCanvasDraft> {
  const now = new Date().toISOString();
  const updated: WorkCanvasDraft = {
    ...draft,
    provenance: {
      ...(draft.provenance || {}),
      ...provenancePatch,
    },
    saveState: 'saved',
    dirtyState: 'clean',
    auditStatus: 'logged',
    updatedAt: now,
  };
  await dbRun(
    `UPDATE work_canvas_drafts
     SET provenance_json = ?, save_state = ?, dirty_state = ?, audit_status = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      JSON.stringify(updated.provenance),
      updated.saveState,
      updated.dirtyState,
      updated.auditStatus,
      updated.updatedAt,
      updated.id,
      updated.organizationId,
    ],
    { fallback: false }
  );
  return updated;
}

async function createVersionSnapshot(
  draft: WorkCanvasDraft,
  operationType: string,
  summary: string,
  userId: string
) {
  const now = new Date().toISOString();
  const version = {
    id: randomUUID(),
    draft_id: draft.id,
    operation_type: operationType,
    summary,
    content_md: draft.contentMd || '',
    content_json_native: draft.contentJson === undefined ? null : JSON.stringify(draft.contentJson),
    created_by: userId,
    created_at: now,
  };
  await dbRun(
    `INSERT INTO work_canvas_versions (
      id, draft_id, operation_type, summary, content_md, content_json_native, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      version.id,
      version.draft_id,
      version.operation_type,
      version.summary,
      version.content_md,
      version.content_json_native,
      version.created_by,
      version.created_at,
    ],
    { fallback: false }
  );
  return toVersion(version);
}

async function ensureStorage(): Promise<void> {
  if (!storageReadyPromise) {
    storageReadyPromise = (async () => {
      await dbRun(
        `CREATE TABLE IF NOT EXISTS work_canvas_drafts (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          created_by TEXT NOT NULL,
          conversation_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          title TEXT NOT NULL,
          content_json TEXT NOT NULL,
          canonical_format TEXT NOT NULL DEFAULT 'markdown',
          content_md TEXT,
          content_json_native TEXT,
          content_schema_version TEXT,
          markdown_projection_status TEXT NOT NULL DEFAULT 'synced',
          markdown_projected_at TEXT,
          markdown_projection_stale_at TEXT,
          projection_error TEXT,
          sources_json TEXT NOT NULL DEFAULT '[]',
          provenance_json TEXT NOT NULL DEFAULT '{}',
          project_id TEXT,
          owner_id TEXT,
          research_session_id TEXT,
          artifact_id TEXT,
          artifact_run_id TEXT,
          artifact_version INTEGER,
          save_state TEXT NOT NULL DEFAULT 'unsaved',
          lifecycle_state TEXT NOT NULL DEFAULT 'draft',
          dirty_state TEXT NOT NULL DEFAULT 'dirty',
          visibility TEXT NOT NULL DEFAULT 'private',
          audit_status TEXT NOT NULL DEFAULT 'not_required',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        [],
        { fallback: false }
      );
      const contentContractColumns = [
        "ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS canonical_format TEXT NOT NULL DEFAULT 'markdown'",
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS content_md TEXT',
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS content_json_native TEXT',
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS content_schema_version TEXT',
        "ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS markdown_projection_status TEXT NOT NULL DEFAULT 'synced'",
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS markdown_projected_at TEXT',
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS markdown_projection_stale_at TEXT',
        'ALTER TABLE work_canvas_drafts ADD COLUMN IF NOT EXISTS projection_error TEXT',
      ];
      for (const statement of contentContractColumns) {
        await dbRun(statement, [], { fallback: false });
      }
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_work_canvas_drafts_org_updated
         ON work_canvas_drafts (organization_id, updated_at DESC)`,
        [],
        { fallback: false }
      );
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_work_canvas_drafts_conversation
         ON work_canvas_drafts (organization_id, conversation_id)`,
        [],
        { fallback: false }
      );
      await dbRun(
        `CREATE TABLE IF NOT EXISTS work_canvas_proposals (
          id TEXT PRIMARY KEY,
          draft_id TEXT NOT NULL REFERENCES work_canvas_drafts(id) ON DELETE CASCADE,
          organization_id TEXT NOT NULL,
          created_by TEXT NOT NULL,
          target TEXT NOT NULL,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'proposed',
          payload_json TEXT NOT NULL DEFAULT '{}',
          required_capability TEXT NOT NULL,
          target_object_id TEXT,
          read_back_json TEXT,
          audit_event_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        [],
        { fallback: false }
      );
      await dbRun(
        `CREATE TABLE IF NOT EXISTS work_canvas_versions (
          id TEXT PRIMARY KEY,
          draft_id TEXT NOT NULL REFERENCES work_canvas_drafts(id) ON DELETE CASCADE,
          operation_type TEXT NOT NULL,
          summary TEXT NOT NULL,
          content_md TEXT NOT NULL,
          content_json_native TEXT,
          created_by TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        [],
        { fallback: false }
      );
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_work_canvas_versions_draft_created
         ON work_canvas_versions (draft_id, created_at DESC)`,
        [],
        { fallback: false }
      );
    })();
  }
  return storageReadyPromise;
}

async function ownedDraft(req: AuthRequest, draftId: string): Promise<WorkCanvasDraft | null> {
  await ensureStorage();
  const { organizationId } = authContext(req);
  const row = await dbGet<DraftRow>(
    `SELECT * FROM work_canvas_drafts WHERE id = ? AND organization_id = ?`,
    [draftId, organizationId],
    { fallback: false }
  );
  return row ? toDraft(row) : null;
}

async function draftProposals(draftId: string): Promise<WorkCanvasProposal[]> {
  await ensureStorage();
  const rows = await dbAll<ProposalRow>(
    `SELECT * FROM work_canvas_proposals WHERE draft_id = ? ORDER BY created_at DESC`,
    [draftId],
    { fallback: false }
  );
  return rows.map(toProposal);
}

async function createWorkspaceResource(
  draft: WorkCanvasDraft,
  target: WorkspaceTarget,
  userId: string,
  organizationId: string
) {
  const title = firstMarkdownHeading(draft.contentMd, draft.title || 'Canvas document');
  const summary = markdownSummary(draft.contentMd, 5000);
  const now = new Date().toISOString();

  if (target === 'idea') {
    const ideaId = `idea-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await insertDynamic(
      'my_ideas',
      {
        id: ideaId,
        user_id: userId,
        organization_id: organizationId,
        title,
        body: summary,
        seed_text: draft.contentMd,
        stage: 'spark',
        source_type: 'work_canvas',
        source_conversation_id: draft.conversationId,
        source_message_id: draft.id,
        created_at: now,
        updated_at: now,
      },
      ['id']
    );

    const mapId = `map-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await insertDynamic(
      'my_idea_maps',
      {
        id: mapId,
        idea_id: ideaId,
        user_id: userId,
        organization_id: organizationId,
        nodes_json: '[]',
        edges_json: '[]',
        schema_version: 3,
        extensions_json: JSON.stringify({ source: 'work_canvas', draftId: draft.id }),
        created_at: now,
        updated_at: now,
      },
      ['id']
    );

    return {
      type: 'idea' as const,
      id: ideaId,
      title,
      url: `/my-work/ideas/${ideaId}`,
      readBack: { target, ideaId, mapId, status: 'created' },
    };
  }

  if (target === 'note') {
    const noteId = randomUUID();
    await insertDynamic(
      'notebook_pages',
      {
        id: noteId,
        owner_user_id: userId,
        user_id: userId,
        organization_id: organizationId,
        visibility: 'private',
        title,
        content_json: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', text: draft.contentMd }],
        }),
        content_text: draft.contentMd,
        tags_json: JSON.stringify(['work-canvas']),
        icon: 'FileText',
        maturity: 'seed',
        status: 'active',
        capture_source: 'work_canvas',
        capture_metadata: JSON.stringify({ sourceType: 'work_canvas', sourceId: draft.id }),
        created_at: now,
        updated_at: now,
      },
      ['id']
    );
    return {
      type: 'note' as const,
      id: noteId,
      title,
      url: `/my-work/notebook/${noteId}`,
      readBack: { target, noteId, status: 'created' },
    };
  }

  const initiativeId = randomUUID();
  await insertDynamic(
    'initiatives',
    {
      id: initiativeId,
      organization_id: organizationId,
      user_id: userId,
      created_by: userId,
      owner_id: userId,
      owner_execution_id: userId,
      name: title,
      title,
      summary,
      description: summary,
      status: 'DRAFT',
      source_type: 'work_canvas',
      source_id: draft.id,
      created_at: now,
      updated_at: now,
    },
    ['id']
  );
  return {
    type: 'initiative' as const,
    id: initiativeId,
    title,
    url: `/initiatives/${initiativeId}`,
    readBack: { target, initiativeId, status: 'created' },
  };
}

function buildTableOutputMarkdown(draft: WorkCanvasDraft): string {
  const sections = markdownSections(draft.contentMd).slice(0, 12);
  const rows = sections.length
    ? sections.map(
        (section) =>
          `| ${section.heading.replace(/\|/g, '/')} | ${markdownSummary(section.body, 180).replace(/\|/g, '/')} | ${draft.title.replace(/\|/g, '/')} |`
      )
    : [`| ${draft.title.replace(/\|/g, '/')} | ${markdownSummary(draft.contentMd, 180).replace(/\|/g, '/')} | Canvas |`];
  return `# Table from ${draft.title}

| Topic | Detail | Source |
|---|---|---|
${rows.join('\n')}
`;
}

function buildReportOutputMarkdown(draft: WorkCanvasDraft): string {
  return `# Report: ${draft.title}

## Executive Summary

${markdownSummary(draft.contentMd, 700) || 'Summary to be completed.'}

## Context

Generated from Work Canvas draft \`${draft.id}\`.

## Key Points

${markdownSections(draft.contentMd)
  .slice(0, 8)
  .map((section) => `- **${section.heading}:** ${markdownSummary(section.body, 220) || 'TBD'}`)
  .join('\n') || '- TBD'}

## Next Steps

- [ ] Review the report with Teresa.
- [ ] Confirm audience and decision owner.
- [ ] Convert into a final deliverable when ready.
`;
}

function buildPresentationSlides(draft: WorkCanvasDraft) {
  const sections = markdownSections(draft.contentMd).slice(0, 6);
  const baseSections = sections.length
    ? sections
    : [{ heading: draft.title, body: markdownSummary(draft.contentMd, 500) }];
  return [
    {
      type: 'title',
      content: { title: draft.title, subtitle: 'Generated from Work Canvas' },
    },
    ...baseSections.map((section) => ({
      type: 'content',
      content: {
        title: section.heading,
        bullets: markdownSummary(section.body, 500)
          .split('\n')
          .map((line) => line.replace(/^[-*]\s*/, '').trim())
          .filter(Boolean)
          .slice(0, 5),
      },
    })),
    {
      type: 'next_steps',
      content: {
        title: 'Next steps',
        bullets: ['Review the narrative', 'Confirm supporting evidence', 'Prepare final version'],
      },
    },
  ];
}

async function createOutputResource(
  draft: WorkCanvasDraft,
  outputType: OutputType,
  userId: string,
  organizationId: string
) {
  const title = firstMarkdownHeading(draft.contentMd, draft.title || 'Canvas output');
  const now = new Date().toISOString();

  if (outputType === 'presentation') {
    const deckId = randomUUID().replace(/-/g, '');
    const slides = buildPresentationSlides(draft);
    await insertDynamic(
      'presentation_decks',
      {
        id: deckId,
        organization_id: organizationId,
        created_by: userId,
        title: `Presentation: ${title}`,
        deck_type: 'custom',
        theme: 'modern',
        slide_count: slides.length,
        status: 'draft',
        source_id: draft.id,
        source_refs_json: JSON.stringify({ source: 'work_canvas', draftId: draft.id }),
        created_at: now,
        updated_at: now,
      },
      ['id']
    );
    for (let i = 0; i < slides.length; i += 1) {
      const slide = slides[i];
      await insertDynamic(
        'presentation_cards',
        {
          id: randomUUID().replace(/-/g, ''),
          deck_id: deckId,
          card_index: i,
          intent: slide.type,
          blocks_json: JSON.stringify(slide.content),
          created_at: now,
          updated_at: now,
        },
        ['id']
      );
    }
    return {
      type: 'presentation' as const,
      id: deckId,
      title: `Presentation: ${title}`,
      url: `/presentations/builder/${deckId}`,
      readBack: { outputType, deckId, slideCount: slides.length, status: 'created' },
    };
  }

  const kind: DraftKind = outputType === 'table' ? 'table' : 'report';
  const contentMd =
    outputType === 'table' ? buildTableOutputMarkdown(draft) : buildReportOutputMarkdown(draft);
  const contentJson =
    outputType === 'table'
      ? {
          columns: ['Topic', 'Detail', 'Source'],
          sourceDraftId: draft.id,
        }
      : undefined;
  const envelopeForOutput = createArtifactContentEnvelope({
    artifactType: kind,
    canonicalFormat: outputType === 'table' ? 'json' : 'markdown',
    contentMd,
    contentJson,
  });
  const outputDraft: WorkCanvasDraft = {
    ...draft,
    id: randomUUID(),
    kind,
    title: `${outputType === 'table' ? 'Table' : 'Report'}: ${title}`,
    content: outputType === 'table' ? contentJson : contentMd,
    contentEnvelope: envelopeForOutput,
    canonicalFormat: envelopeForOutput.canonicalFormat,
    contentMd: envelopeForOutput.contentMd,
    contentJson: envelopeForOutput.contentJson,
    contentSchemaVersion: envelopeForOutput.contentSchemaVersion || null,
    markdownProjectionStatus: envelopeForOutput.markdownProjectionStatus,
    markdownProjectedAt: envelopeForOutput.markdownProjectedAt || null,
    projectionError: envelopeForOutput.projectionError || null,
    provenance: {
      source: 'work_canvas_create_output',
      sourceDraftId: draft.id,
      outputType,
    },
    artifactId: null,
    artifactRunId: null,
    artifactVersion: null,
    saveState: 'saved',
    dirtyState: 'clean',
    auditStatus: 'logged',
    createdAt: now,
    updatedAt: now,
  };

  await dbRun(
    `INSERT INTO work_canvas_drafts (
      id, organization_id, created_by, conversation_id, kind, title, content_json,
      canonical_format, content_md, content_json_native, content_schema_version,
      markdown_projection_status, markdown_projected_at, projection_error,
      sources_json, provenance_json, project_id, owner_id, research_session_id,
      artifact_id, artifact_run_id, artifact_version, save_state, lifecycle_state,
      dirty_state, visibility, audit_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      outputDraft.id,
      outputDraft.organizationId,
      outputDraft.createdBy,
      outputDraft.conversationId,
      outputDraft.kind,
      outputDraft.title,
      JSON.stringify(outputDraft.content),
      outputDraft.canonicalFormat,
      outputDraft.contentMd,
      outputDraft.contentJson === undefined ? null : JSON.stringify(outputDraft.contentJson),
      outputDraft.contentSchemaVersion,
      outputDraft.markdownProjectionStatus,
      outputDraft.markdownProjectedAt,
      outputDraft.projectionError,
      JSON.stringify(outputDraft.sources),
      JSON.stringify(outputDraft.provenance),
      outputDraft.projectId,
      outputDraft.ownerId,
      outputDraft.researchSessionId,
      outputDraft.artifactId,
      outputDraft.artifactRunId,
      outputDraft.artifactVersion,
      outputDraft.saveState,
      outputDraft.lifecycleState,
      outputDraft.dirtyState,
      outputDraft.visibility,
      outputDraft.auditStatus,
      outputDraft.createdAt,
      outputDraft.updatedAt,
    ],
    { fallback: false }
  );

  return {
    type: outputType,
    id: outputDraft.id,
    title: outputDraft.title,
    url: `/work-canvas?draftId=${encodeURIComponent(outputDraft.id)}`,
    readBack: { outputType, draftId: outputDraft.id, status: 'created' },
  };
}

router.use(verifyToken);

router.get('/drafts', async (req: AuthRequest, res) => {
  await ensureStorage();
  const { organizationId, userId } = authContext(req);
  const conversationId = req.query.conversationId ? String(req.query.conversationId) : null;
  const projectId = req.query.projectId ? String(req.query.projectId) : null;
  const whereParts = ['organization_id = ?'];
  const queryParams: unknown[] = [organizationId];
  if (conversationId) {
    whereParts.push('conversation_id = ?');
    queryParams.push(conversationId);
  }
  const accessParts = ['project_id IS NULL', 'created_by = ?'];
  queryParams.push(userId);
  if (projectId) {
    accessParts.push('project_id = ?');
    queryParams.push(projectId);
  }
  whereParts.push(`(${accessParts.join(' OR ')})`);
  const rows = await dbAll<DraftRow>(
    `SELECT * FROM work_canvas_drafts
     WHERE ${whereParts.join(' AND ')}
     ORDER BY updated_at DESC`,
    queryParams,
    { fallback: false }
  );
  const result = rows.map(toDraft);
  res.json(envelope(result));
});

router.post('/drafts', async (req: AuthRequest, res) => {
  await ensureStorage();
  const { organizationId, userId } = authContext(req);
  const now = new Date().toISOString();
  const draft: WorkCanvasDraft = {
    id: randomUUID(),
    organizationId,
    createdBy: userId,
    conversationId: String(req.body?.conversationId || `conversation-${Date.now()}`),
    kind: (req.body?.kind || 'markdown') as DraftKind,
    title: String(req.body?.title || 'Untitled work canvas'),
    content: req.body?.content ?? '',
    contentEnvelope: createArtifactContentEnvelope({
      artifactType: String(req.body?.kind || 'markdown'),
      canonicalFormat: req.body?.canonicalFormat,
      contentMd: req.body?.contentMd ?? (typeof req.body?.content === 'string' ? req.body.content : ''),
      contentJson: req.body?.contentJson,
      contentSchemaVersion: req.body?.contentSchemaVersion,
    }),
    canonicalFormat: 'markdown',
    contentMd: '',
    contentJson: undefined,
    contentSchemaVersion: req.body?.contentSchemaVersion || null,
    markdownProjectionStatus: 'synced',
    markdownProjectedAt: null,
    projectionError: null,
    sources: Array.isArray(req.body?.sources) ? req.body.sources : [],
    provenance:
      req.body?.provenance && typeof req.body.provenance === 'object' ? req.body.provenance : {},
    projectId: req.body?.projectId || null,
    ownerId: req.body?.ownerId || userId,
    researchSessionId: req.body?.researchSessionId || null,
    artifactId: req.body?.artifactId || null,
    artifactRunId: req.body?.artifactRunId || null,
    artifactVersion: null,
    saveState: 'unsaved',
    lifecycleState: 'draft',
    dirtyState: 'dirty',
    visibility: req.body?.projectId ? 'project' : 'private',
    auditStatus: 'not_required',
    createdAt: now,
    updatedAt: now,
  };
  draft.canonicalFormat = draft.contentEnvelope.canonicalFormat;
  draft.contentMd = draft.contentEnvelope.contentMd;
  draft.contentJson = draft.contentEnvelope.contentJson;
  draft.markdownProjectionStatus = draft.contentEnvelope.markdownProjectionStatus;
  draft.markdownProjectedAt = draft.contentEnvelope.markdownProjectedAt || null;
  draft.projectionError = draft.contentEnvelope.projectionError || null;
  await dbRun(
    `INSERT INTO work_canvas_drafts (
      id, organization_id, created_by, conversation_id, kind, title, content_json,
      canonical_format, content_md, content_json_native, content_schema_version,
      markdown_projection_status, markdown_projected_at, projection_error,
      sources_json, provenance_json, project_id, owner_id, research_session_id,
      artifact_id, artifact_run_id, artifact_version, save_state, lifecycle_state,
      dirty_state, visibility, audit_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      draft.id,
      draft.organizationId,
      draft.createdBy,
      draft.conversationId,
      draft.kind,
      draft.title,
      JSON.stringify(draft.content),
      draft.canonicalFormat,
      draft.contentMd,
      draft.contentJson === undefined ? null : JSON.stringify(draft.contentJson),
      draft.contentSchemaVersion,
      draft.markdownProjectionStatus,
      draft.markdownProjectedAt,
      draft.projectionError,
      JSON.stringify(draft.sources),
      JSON.stringify(draft.provenance),
      draft.projectId,
      draft.ownerId,
      draft.researchSessionId,
      draft.artifactId,
      draft.artifactRunId,
      draft.artifactVersion,
      draft.saveState,
      draft.lifecycleState,
      draft.dirtyState,
      draft.visibility,
      draft.auditStatus,
      draft.createdAt,
      draft.updatedAt,
    ],
    { fallback: false }
  );
  res.status(201).json(envelope(draft, { auditEventId: `ae-${randomUUID()}` }));
});

router.get('/drafts/:draftId', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  return res.json(envelope({ draft, proposals: await draftProposals(draft.id) }));
});

router.put('/drafts/:draftId', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const updated: WorkCanvasDraft = {
    ...draft,
    ...req.body,
    id: draft.id,
    organizationId: draft.organizationId,
    createdBy: draft.createdBy,
    updatedAt: new Date().toISOString(),
  };
  updated.contentEnvelope = createArtifactContentEnvelope({
    artifactType: updated.kind,
    canonicalFormat: req.body?.canonicalFormat || updated.canonicalFormat,
    contentMd: req.body?.contentMd ?? (typeof updated.content === 'string' ? updated.content : updated.contentMd),
    contentJson: req.body?.contentJson ?? updated.contentJson,
    contentSchemaVersion: req.body?.contentSchemaVersion || updated.contentSchemaVersion || undefined,
  });
  updated.canonicalFormat = updated.contentEnvelope.canonicalFormat;
  updated.contentMd = updated.contentEnvelope.contentMd;
  updated.contentJson = updated.contentEnvelope.contentJson;
  updated.contentSchemaVersion = updated.contentEnvelope.contentSchemaVersion || null;
  updated.markdownProjectionStatus = updated.contentEnvelope.markdownProjectionStatus;
  updated.markdownProjectedAt = updated.contentEnvelope.markdownProjectedAt || null;
  updated.projectionError = updated.contentEnvelope.projectionError || null;
  await dbRun(
    `UPDATE work_canvas_drafts
     SET conversation_id = ?, kind = ?, title = ?, content_json = ?, sources_json = ?,
         provenance_json = ?, project_id = ?, owner_id = ?, research_session_id = ?,
         artifact_id = ?, artifact_run_id = ?, artifact_version = ?, save_state = ?,
         lifecycle_state = ?, dirty_state = ?, visibility = ?, audit_status = ?,
         canonical_format = ?, content_md = ?, content_json_native = ?, content_schema_version = ?,
         markdown_projection_status = ?, markdown_projected_at = ?, projection_error = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      updated.conversationId,
      updated.kind,
      updated.title,
      JSON.stringify(updated.content),
      JSON.stringify(updated.sources),
      JSON.stringify(updated.provenance),
      updated.projectId,
      updated.ownerId,
      updated.researchSessionId,
      updated.artifactId,
      updated.artifactRunId,
      updated.artifactVersion,
      updated.saveState,
      updated.lifecycleState,
      updated.dirtyState,
      updated.visibility,
      updated.auditStatus,
      updated.canonicalFormat,
      updated.contentMd,
      updated.contentJson === undefined ? null : JSON.stringify(updated.contentJson),
      updated.contentSchemaVersion,
      updated.markdownProjectionStatus,
      updated.markdownProjectedAt,
      updated.projectionError,
      updated.updatedAt,
      updated.id,
      updated.organizationId,
    ],
    { fallback: false }
  );
  return res.json(envelope(updated, { auditEventId: `ae-${randomUUID()}` }));
});

router.post('/drafts/:draftId/proposals', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const { organizationId, userId } = authContext(req);
  const target = String(req.body?.target || 'idea');
  const now = new Date().toISOString();
  const proposal: WorkCanvasProposal = {
    id: randomUUID(),
    draftId: draft.id,
    organizationId,
    createdBy: userId,
    target,
    title: `${targetLabels[target] || target}: ${draft.title}`,
    summary: `Proposal generated from canvas draft ${draft.id}.`,
    status: 'proposed',
    payload: req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {},
    requiredCapability: target === 'task' ? 'canvas.convert.task' : 'canvas.convert.idea',
    targetObjectId: null,
    readBack: null,
    auditEventId: null,
    createdAt: now,
    updatedAt: now,
  };
  await dbRun(
    `INSERT INTO work_canvas_proposals (
      id, draft_id, organization_id, created_by, target, title, summary, status,
      payload_json, required_capability, target_object_id, read_back_json,
      audit_event_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      proposal.id,
      proposal.draftId,
      proposal.organizationId,
      proposal.createdBy,
      proposal.target,
      proposal.title,
      proposal.summary,
      proposal.status,
      JSON.stringify(proposal.payload),
      proposal.requiredCapability,
      proposal.targetObjectId,
      JSON.stringify(proposal.readBack),
      proposal.auditEventId,
      proposal.createdAt,
      proposal.updatedAt,
    ],
    { fallback: false }
  );
  return res.status(201).json(envelope(proposal, { auditEventId: `ae-${randomUUID()}` }));
});

router.get('/drafts/:draftId/proposals', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  return res.json(envelope(await draftProposals(draft.id)));
});

router.post('/proposals/:proposalId/reject', async (req: AuthRequest, res) => {
  await ensureStorage();
  const proposalRow = await dbGet<ProposalRow>(
    `SELECT * FROM work_canvas_proposals WHERE id = ? AND organization_id = ?`,
    [req.params.proposalId, authContext(req).organizationId],
    { fallback: false }
  );
  const proposal = proposalRow ? toProposal(proposalRow) : null;
  if (!proposal || proposal.organizationId !== authContext(req).organizationId) {
    return res.status(404).json({ error: 'Canvas proposal not found' });
  }
  const updated: WorkCanvasProposal = {
    ...proposal,
    status: 'rejected',
    readBack: { target: proposal.target, status: 'rejected' },
    updatedAt: new Date().toISOString(),
  };
  await dbRun(
    `UPDATE work_canvas_proposals
     SET status = ?, read_back_json = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      updated.status,
      JSON.stringify(updated.readBack),
      updated.updatedAt,
      updated.id,
      updated.organizationId,
    ],
    { fallback: false }
  );
  return res.json(
    envelope(updated, { readBack: updated.readBack, auditEventId: `ae-${randomUUID()}` })
  );
});

router.post('/proposals/:proposalId/approve', async (req: AuthRequest, res) => {
  await ensureStorage();
  const proposalRow = await dbGet<ProposalRow>(
    `SELECT * FROM work_canvas_proposals WHERE id = ? AND organization_id = ?`,
    [req.params.proposalId, authContext(req).organizationId],
    { fallback: false }
  );
  const proposal = proposalRow ? toProposal(proposalRow) : null;
  if (!proposal || proposal.organizationId !== authContext(req).organizationId) {
    return res.status(404).json({ error: 'Canvas proposal not found' });
  }
  const targetObjectId = `${proposal.target}-${randomUUID()}`;
  const readBack = {
    target: proposal.target,
    targetObjectId,
    status: 'approved',
    entityStatus: 'created',
    auditEventId: `ae-${randomUUID()}`,
  };
  const updated: WorkCanvasProposal = {
    ...proposal,
    status: 'approved',
    targetObjectId,
    readBack,
    auditEventId: String(readBack.auditEventId),
    updatedAt: new Date().toISOString(),
  };
  await dbRun(
    `UPDATE work_canvas_proposals
     SET status = ?, target_object_id = ?, read_back_json = ?, audit_event_id = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      updated.status,
      updated.targetObjectId,
      JSON.stringify(updated.readBack),
      updated.auditEventId,
      updated.updatedAt,
      updated.id,
      updated.organizationId,
    ],
    { fallback: false }
  );
  return res.json(envelope(updated, { readBack, auditEventId: updated.auditEventId }));
});

router.get('/drafts/:draftId/versions', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const rows = await dbAll<VersionRow>(
    `SELECT * FROM work_canvas_versions WHERE draft_id = ? ORDER BY created_at DESC`,
    [draft.id],
    { fallback: false }
  );
  return res.json(envelope(rows.map(toVersion)));
});

router.post('/drafts/:draftId/operations', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const { userId } = authContext(req);
  try {
    const operation = req.body?.operation;
    const operationType = String(operation?.type || '') as EditOperationType;
    const applied = applyEditOperation(draft, operation);
    const version = await createVersionSnapshot(
      draft,
      operationType,
      applied.summary,
      userId
    );
    const now = new Date().toISOString();
    const updatedEnvelope = createArtifactContentEnvelope({
      artifactType: draft.kind,
      canonicalFormat: draft.canonicalFormat,
      contentMd: applied.contentMd,
      contentJson: draft.contentJson,
      contentSchemaVersion: draft.contentSchemaVersion || undefined,
    });
    const updated: WorkCanvasDraft = {
      ...draft,
      content: applied.contentMd,
      contentEnvelope: updatedEnvelope,
      canonicalFormat: updatedEnvelope.canonicalFormat,
      contentMd: updatedEnvelope.contentMd,
      contentJson: updatedEnvelope.contentJson,
      contentSchemaVersion: updatedEnvelope.contentSchemaVersion || null,
      markdownProjectionStatus: updatedEnvelope.markdownProjectionStatus,
      markdownProjectedAt: updatedEnvelope.markdownProjectedAt || null,
      projectionError: updatedEnvelope.projectionError || null,
      saveState: 'saved',
      dirtyState: 'clean',
      updatedAt: now,
    };
    await dbRun(
      `UPDATE work_canvas_drafts
       SET content_json = ?, canonical_format = ?, content_md = ?, content_json_native = ?,
           content_schema_version = ?, markdown_projection_status = ?, markdown_projected_at = ?,
           projection_error = ?, save_state = ?, dirty_state = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [
        JSON.stringify(updated.content),
        updated.canonicalFormat,
        updated.contentMd,
        updated.contentJson === undefined ? null : JSON.stringify(updated.contentJson),
        updated.contentSchemaVersion,
        updated.markdownProjectionStatus,
        updated.markdownProjectedAt,
        updated.projectionError,
        updated.saveState,
        updated.dirtyState,
        updated.updatedAt,
        updated.id,
        updated.organizationId,
      ],
      { fallback: false }
    );
    return res.json(
      envelope({
        draft: updated,
        version,
        diff: diffSummary(draft.contentMd, updated.contentMd),
      })
    );
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to apply Canvas operation',
    });
  }
});

router.post('/drafts/:draftId/versions/:versionId/restore', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const { userId } = authContext(req);
  const versionRow = await dbGet<VersionRow>(
    `SELECT * FROM work_canvas_versions WHERE id = ? AND draft_id = ?`,
    [req.params.versionId, draft.id],
    { fallback: false }
  );
  if (!versionRow) return res.status(404).json({ error: 'Canvas version not found' });
  const version = toVersion(versionRow);
  await createVersionSnapshot(draft, 'restore_version', `Restored version ${version.id}`, userId);
  const now = new Date().toISOString();
  const restoredEnvelope = createArtifactContentEnvelope({
    artifactType: draft.kind,
    canonicalFormat: draft.canonicalFormat,
    contentMd: version.contentMd,
    contentJson: version.contentJson,
  });
  const restored: WorkCanvasDraft = {
    ...draft,
    content: version.contentMd,
    contentEnvelope: restoredEnvelope,
    canonicalFormat: restoredEnvelope.canonicalFormat,
    contentMd: restoredEnvelope.contentMd,
    contentJson: restoredEnvelope.contentJson,
    markdownProjectionStatus: restoredEnvelope.markdownProjectionStatus,
    markdownProjectedAt: restoredEnvelope.markdownProjectedAt || null,
    projectionError: restoredEnvelope.projectionError || null,
    saveState: 'saved',
    dirtyState: 'clean',
    updatedAt: now,
  };
  await dbRun(
    `UPDATE work_canvas_drafts
     SET content_json = ?, canonical_format = ?, content_md = ?, content_json_native = ?,
         markdown_projection_status = ?, markdown_projected_at = ?, projection_error = ?,
         save_state = ?, dirty_state = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      JSON.stringify(restored.content),
      restored.canonicalFormat,
      restored.contentMd,
      restored.contentJson === undefined ? null : JSON.stringify(restored.contentJson),
      restored.markdownProjectionStatus,
      restored.markdownProjectedAt,
      restored.projectionError,
      restored.saveState,
      restored.dirtyState,
      restored.updatedAt,
      restored.id,
      restored.organizationId,
    ],
    { fallback: false }
  );
  return res.json(envelope({ draft: restored, restoredVersion: version }));
});

router.post('/drafts/:draftId/share', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const token = randomUUID().replace(/-/g, '');
  const share = {
    token,
    url: `/work-canvas/shared/${token}`,
    title: draft.title,
    createdAt: new Date().toISOString(),
  };
  const updated = await updateDraftAfterOperation(draft, { share });
  return res.json(envelope({ draft: updated, share }));
});

router.post('/drafts/:draftId/save-to-workspace', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const { organizationId, userId } = authContext(req);
  const target = String(req.body?.target || '') as WorkspaceTarget;
  if (!['idea', 'note', 'initiative'].includes(target)) {
    return res.status(400).json({ error: 'target must be idea, note, or initiative' });
  }

  try {
    const version = await createVersionSnapshot(
      draft,
      `save_to_workspace:${target}`,
      `Saved Canvas draft to ${target}`,
      userId
    );
    const linkedResource = await createWorkspaceResource(draft, target, userId, organizationId);
    const previousLinks =
      draft.provenance?.linkedWorkspaceResources &&
      typeof draft.provenance.linkedWorkspaceResources === 'object'
        ? (draft.provenance.linkedWorkspaceResources as Record<string, unknown>)
        : {};
    const updatedDraft = await updateDraftAfterOperation(draft, {
      linkedWorkspaceResources: {
        ...previousLinks,
        [target]: {
          id: linkedResource.id,
          title: linkedResource.title,
          url: linkedResource.url,
          linkedAt: new Date().toISOString(),
        },
      },
    });
    return res.json(
      envelope({
        draft: updatedDraft,
        linkedResource: {
          type: linkedResource.type,
          id: linkedResource.id,
          title: linkedResource.title,
          url: linkedResource.url,
        },
        readBack: linkedResource.readBack,
        version,
      })
    );
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to save Canvas to workspace',
    });
  }
});

router.post('/drafts/:draftId/create-output', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const { organizationId, userId } = authContext(req);
  const outputType = String(req.body?.outputType || '') as OutputType;
  if (!['presentation', 'table', 'report'].includes(outputType)) {
    return res.status(400).json({ error: 'outputType must be presentation, table, or report' });
  }

  try {
    const version = await createVersionSnapshot(
      draft,
      `create_output:${outputType}`,
      `Created ${outputType} output from Canvas draft`,
      userId
    );
    const outputResource = await createOutputResource(draft, outputType, userId, organizationId);
    const previousOutputs =
      Array.isArray(draft.provenance?.createdOutputs) ? draft.provenance.createdOutputs : [];
    const updatedDraft = await updateDraftAfterOperation(draft, {
      createdOutputs: [
        ...previousOutputs,
        {
          type: outputResource.type,
          id: outputResource.id,
          title: outputResource.title,
          url: outputResource.url,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    return res.json(
      envelope({
        draft: updatedDraft,
        outputResource: {
          type: outputResource.type,
          id: outputResource.id,
          title: outputResource.title,
          url: outputResource.url,
        },
        readBack: outputResource.readBack,
        version,
      })
    );
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create Canvas output',
    });
  }
});

router.post('/drafts/:draftId/save-as-artifact', async (req: AuthRequest, res) => {
  const draft = await ownedDraft(req, req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Canvas draft not found' });
  const artifactId = `artifact-${randomUUID()}`;
  const updated: WorkCanvasDraft = {
    ...draft,
    artifactId,
    artifactRunId: `run-${randomUUID()}`,
    artifactVersion: 1,
    saveState: 'saved',
    dirtyState: 'clean',
    auditStatus: 'logged',
    updatedAt: new Date().toISOString(),
  };
  await dbRun(
    `UPDATE work_canvas_drafts
     SET artifact_id = ?, artifact_run_id = ?, artifact_version = ?, save_state = ?,
         dirty_state = ?, audit_status = ?, updated_at = ?
     WHERE id = ? AND organization_id = ?`,
    [
      updated.artifactId,
      updated.artifactRunId,
      updated.artifactVersion,
      updated.saveState,
      updated.dirtyState,
      updated.auditStatus,
      updated.updatedAt,
      updated.id,
      updated.organizationId,
    ],
    { fallback: false }
  );
  const readBack = {
    target: 'artifact',
    targetObjectId: artifactId,
    status: 'saved',
    artifactVersion: 1,
  };
  return res.json(envelope(updated, { readBack, auditEventId: `ae-${randomUUID()}` }));
});

export default router;
