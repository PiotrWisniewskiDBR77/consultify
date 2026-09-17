import { randomUUID } from 'node:crypto';

import { Document, Packer, Paragraph } from 'docx';
import ExcelJS from 'exceljs';
import PptxGenJSImport from 'pptxgenjs';

import { queryOne, withPgTransaction } from '../utils/queryHelpers.js';
import {
  approveTemplateProvenance,
  type DeliverableTemplate,
  type DeliverableTemplateType,
  getDeliverableTemplate,
} from './deliverableTemplateService.js';

export type TemplateBaseKind = 'archetype' | 'system' | 'own';
export type TemplateWorkflowStatus = 'draft' | 'submitted' | 'approved' | 'deprecated';
export type TemplateTestObjectType = 'initiative' | 'kpi' | 'decision' | 'artifact';

export class TemplateWorkflowError extends Error {
  constructor(
    readonly code:
      | 'WORKFLOW_NOT_FOUND'
      | 'INVALID_STATE'
      | 'BASE_REQUIRED'
      | 'BASE_FORBIDDEN'
      | 'LIVE_OBJECT_NOT_FOUND'
      | 'TEST_PASS_REQUIRED'
      | 'AUTHOR_CANNOT_APPROVE'
      | 'APPROVED_TEMPLATE_REQUIRES_REVISION',
    message: string,
    readonly statusCode = 409
  ) {
    super(message);
    this.name = 'TemplateWorkflowError';
  }
}

export interface TemplateWorkflowRecord {
  id: string;
  organizationId: string;
  templateType: DeliverableTemplateType;
  templateId: string;
  authorUserId: string;
  status: TemplateWorkflowStatus;
  version: string;
  baseKind: TemplateBaseKind;
  baseTemplateId: string | null;
  parentWorkflowId: string | null;
  language: 'en' | 'pl';
  documentType: string;
  audience: string | null;
  confidentiality: string;
  sourceBindings: Record<string, unknown>;
  lastTestRunId: string | null;
  lastTestPassedAt: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  isDefault: boolean;
}

type WorkflowRow = {
  id: string;
  organization_id: string;
  template_type: DeliverableTemplateType;
  template_id: string;
  author_user_id: string;
  status: TemplateWorkflowStatus;
  version: string;
  base_kind: TemplateBaseKind;
  base_template_id: string | null;
  parent_workflow_id: string | null;
  language: 'en' | 'pl';
  document_type: string;
  audience: string | null;
  confidentiality: string;
  source_bindings: Record<string, unknown> | string;
  last_test_run_id: string | null;
  last_test_passed_at: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  is_default: boolean;
};

function jsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function mapWorkflow(row: WorkflowRow): TemplateWorkflowRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    templateType: row.template_type,
    templateId: row.template_id,
    authorUserId: row.author_user_id,
    status: row.status,
    version: row.version,
    baseKind: row.base_kind,
    baseTemplateId: row.base_template_id,
    parentWorkflowId: row.parent_workflow_id,
    language: row.language,
    documentType: row.document_type,
    audience: row.audience,
    confidentiality: row.confidentiality,
    sourceBindings: jsonObject(row.source_bindings),
    lastTestRunId: row.last_test_run_id,
    lastTestPassedAt: row.last_test_passed_at,
    submittedAt: row.submitted_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    isDefault: Boolean(row.is_default),
  };
}

const WORKFLOW_COLUMNS = `id, organization_id, template_type, template_id, author_user_id,
  status, version, base_kind, base_template_id, parent_workflow_id, language, document_type, audience,
  confidentiality, source_bindings, last_test_run_id, last_test_passed_at,
  submitted_at, approved_by, approved_at, is_default`;

export async function getTemplateWorkflow(
  templateId: string,
  organizationId: string
): Promise<TemplateWorkflowRecord | null> {
  const row = await queryOne<WorkflowRow>(
    `SELECT ${WORKFLOW_COLUMNS} FROM deliverable_template_workflows
      WHERE template_id = ? AND organization_id = ?`,
    [templateId, organizationId]
  );
  return row ? mapWorkflow(row) : null;
}

export async function registerTemplateDraftWorkflow(input: {
  organizationId: string;
  authorUserId: string;
  template: DeliverableTemplate;
  baseKind: TemplateBaseKind;
  baseTemplateId?: string;
  language?: 'en' | 'pl';
  documentType?: string;
  audience?: string;
  confidentiality?: string;
  sourceBindings?: Record<string, unknown>;
  version?: string;
  parentWorkflowId?: string;
}): Promise<TemplateWorkflowRecord> {
  if (!['archetype', 'system', 'own'].includes(input.baseKind))
    throw new TemplateWorkflowError('BASE_REQUIRED', 'A template base is required', 400);
  if (input.baseKind !== 'archetype' && !input.baseTemplateId)
    throw new TemplateWorkflowError('BASE_REQUIRED', 'A source template is required', 400);
  const row = await queryOne<WorkflowRow>(
    `INSERT INTO deliverable_template_workflows
       (organization_id, template_type, template_id, author_user_id, base_kind,
        base_template_id, parent_workflow_id, version, language, document_type, audience,
        confidentiality, source_bindings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
     RETURNING ${WORKFLOW_COLUMNS}`,
    [
      input.organizationId,
      input.template.type,
      input.template.id,
      input.authorUserId,
      input.baseKind,
      input.baseTemplateId ?? null,
      input.parentWorkflowId ?? null,
      input.version ?? '0.1',
      input.language ?? 'en',
      input.documentType || 'custom',
      input.audience ?? null,
      input.confidentiality || 'internal',
      JSON.stringify(input.sourceBindings ?? {}),
    ]
  );
  if (!row) throw new Error('TEMPLATE_WORKFLOW_INSERT_FAILED');
  return mapWorkflow(row);
}

export async function assertTemplateWorkflowEditable(
  templateId: string,
  organizationId: string,
  actorUserId: string
): Promise<TemplateWorkflowRecord | null> {
  const workflow = await getTemplateWorkflow(templateId, organizationId);
  if (!workflow) return null;
  if (workflow.status === 'approved') {
    throw new TemplateWorkflowError(
      'APPROVED_TEMPLATE_REQUIRES_REVISION',
      'Approved templates are immutable. Create a new draft version.',
      409
    );
  }
  if (workflow.status !== 'draft' || workflow.authorUserId !== actorUserId) {
    throw new TemplateWorkflowError('INVALID_STATE', 'Only the author can edit a draft', 409);
  }
  return workflow;
}

export async function recordTemplateWorkflowEdit(input: {
  templateId: string;
  organizationId: string;
  sourceBindings?: Record<string, unknown>;
}): Promise<void> {
  await queryOne(
    `UPDATE deliverable_template_workflows
        SET source_bindings = COALESCE(?::jsonb, source_bindings),
            last_test_run_id = NULL, last_test_passed_at = NULL, updated_at = now()
      WHERE template_id = ? AND organization_id = ? AND status = 'draft'
      RETURNING id`,
    [
      input.sourceBindings ? JSON.stringify(input.sourceBindings) : null,
      input.templateId,
      input.organizationId,
    ]
  );
}

export function nextTemplateVersion(version: string): string {
  const [majorRaw, minorRaw] = version.split('.');
  const major = Number.parseInt(majorRaw || '1', 10);
  const minor = Number.parseInt(minorRaw || '0', 10);
  return `${Number.isFinite(major) ? major : 1}.${(Number.isFinite(minor) ? minor : 0) + 1}`;
}

export async function assertTemplateBase(input: {
  organizationId: string;
  baseKind: TemplateBaseKind;
  baseTemplateId?: string;
  type: DeliverableTemplateType;
}): Promise<DeliverableTemplate | null> {
  if (input.baseKind === 'archetype') return null;
  if (!input.baseTemplateId)
    throw new TemplateWorkflowError('BASE_REQUIRED', 'A source template is required', 400);
  const base = await getDeliverableTemplate(input.baseTemplateId, input.organizationId);
  if (!base || base.type !== input.type)
    throw new TemplateWorkflowError('BASE_FORBIDDEN', 'The selected base is unavailable', 404);
  if (input.baseKind === 'system' && !base.isSystem)
    throw new TemplateWorkflowError('BASE_FORBIDDEN', 'A system template base is required', 403);
  if (input.baseKind === 'own' && (base.isSystem || base.organizationId !== input.organizationId))
    throw new TemplateWorkflowError(
      'BASE_FORBIDDEN',
      'An organization-owned base is required',
      403
    );
  return base;
}

const LIVE_OBJECTS: Record<TemplateTestObjectType, { table: string; id: string }> = {
  initiative: { table: 'initiatives', id: 'id' },
  kpi: { table: 'kpis', id: 'id' },
  decision: { table: 'decisions', id: 'id' },
  artifact: { table: 'v8_output_artifacts', id: 'artifact_id' },
};

function structurePayload(template: DeliverableTemplate): unknown[] {
  const raw =
    template.type === 'doc'
      ? (template.meta.sections_json ?? template.meta.section_blueprint)
      : template.type === 'deck'
        ? template.meta.outline_json
        : (jsonObject(template.meta.schema_snapshot).sheets ?? []);
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function generateExportProbe(
  type: DeliverableTemplateType,
  title: string,
  structure: unknown[]
): Promise<{ format: 'docx' | 'pptx' | 'xlsx'; bytes: number }> {
  if (type === 'doc') {
    const document = new Document({
      sections: [
        {
          children: [
            new Paragraph(title),
            ...structure.map((_, i) => new Paragraph(`Section ${i + 1}`)),
          ],
        },
      ],
    });
    const buffer = await Packer.toBuffer(document);
    return { format: 'docx', bytes: buffer.byteLength };
  }
  if (type === 'deck') {
    const PptxGenJS = PptxGenJSImport as unknown as new () => any;
    const deck = new PptxGenJS();
    const slide = deck.addSlide();
    slide.addText(title, { x: 0.7, y: 0.7, w: 8.6, h: 0.6 });
    slide.addText(`${structure.length} blocks`, { x: 0.7, y: 1.6, w: 8.6, h: 0.4 });
    const buffer = await deck.write({ outputType: 'nodebuffer' });
    return { format: 'pptx', bytes: Buffer.from(buffer as any).byteLength };
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Preview');
  sheet.addRow([title]);
  sheet.addRow(['Structure items', structure.length]);
  const buffer = await workbook.xlsx.writeBuffer();
  return { format: 'xlsx', bytes: buffer.byteLength };
}

export function evaluateTemplateTestChecks(input: {
  type: DeliverableTemplateType;
  structure: unknown[];
  sourceBindings: Record<string, unknown>;
  language: string;
  exportByteSize: number;
}): Record<string, boolean> {
  const serialized = JSON.stringify({ structure: input.structure, sources: input.sourceBindings });
  const persistedBindings = Object.values(input.sourceBindings).filter(Boolean);
  const embeddedBindings = input.structure
    .map((item) =>
      item && typeof item === 'object' ? (item as Record<string, unknown>).source : null
    )
    .filter(Boolean);
  const sourceValues = persistedBindings.length > 0 ? persistedBindings : embeddedBindings;
  return {
    structure_nonempty: input.structure.length > 0,
    no_unresolved_fields: !/\{\{[^}]+\}\}/.test(serialized),
    sources_bound: input.structure.length > 0 && sourceValues.length >= input.structure.length,
    single_language: input.language === 'en' || input.language === 'pl',
    table_has_rows: input.type !== 'table' || input.structure.length > 0,
    live_object_scoped: true,
    export_generated: input.exportByteSize > 100,
  };
}

export async function runTemplateLiveTest(input: {
  organizationId: string;
  actorUserId: string;
  templateId: string;
  objectType: TemplateTestObjectType;
  objectId: string;
}): Promise<{
  workflow: TemplateWorkflowRecord;
  runId: string;
  status: 'pass' | 'fail';
  checks: Record<string, boolean>;
  exportFormat: string;
  exportByteSize: number;
}> {
  const target = LIVE_OBJECTS[input.objectType];
  if (!target)
    throw new TemplateWorkflowError('LIVE_OBJECT_NOT_FOUND', 'Unsupported live object type', 400);
  const object = await queryOne<Record<string, unknown>>(
    `SELECT * FROM ${target.table} WHERE ${target.id} = ? AND organization_id = ?`,
    [input.objectId, input.organizationId]
  );
  if (!object)
    throw new TemplateWorkflowError(
      'LIVE_OBJECT_NOT_FOUND',
      'Live organization object not found',
      404
    );
  const workflow = await getTemplateWorkflow(input.templateId, input.organizationId);
  if (!workflow)
    throw new TemplateWorkflowError('WORKFLOW_NOT_FOUND', 'Template workflow not found', 404);
  if (workflow.status !== 'draft')
    throw new TemplateWorkflowError('INVALID_STATE', 'Only a draft can be tested');
  const template = await getDeliverableTemplate(input.templateId, input.organizationId);
  if (!template) throw new TemplateWorkflowError('WORKFLOW_NOT_FOUND', 'Template not found', 404);
  const structure = structurePayload(template);
  let exportProbe = {
    format: (template.type === 'doc' ? 'docx' : template.type === 'deck' ? 'pptx' : 'xlsx') as
      'docx' | 'pptx' | 'xlsx',
    bytes: 0,
  };
  try {
    exportProbe = await generateExportProbe(template.type, template.name, structure);
  } catch {
    exportProbe.bytes = 0;
  }
  const checks = evaluateTemplateTestChecks({
    type: template.type,
    structure,
    sourceBindings: workflow.sourceBindings,
    language: workflow.language,
    exportByteSize: exportProbe.bytes,
  });
  const status = Object.values(checks).every(Boolean) ? 'pass' : 'fail';
  const runId = randomUUID();
  await withPgTransaction(async (client) => {
    await client.query(
      `INSERT INTO deliverable_template_test_runs
         (id, workflow_id, organization_id, template_id, template_version, object_type,
          object_id, status, checks, export_format, export_byte_size, run_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?)`,
      [
        runId,
        workflow.id,
        input.organizationId,
        input.templateId,
        workflow.version,
        input.objectType,
        input.objectId,
        status,
        JSON.stringify(checks),
        exportProbe.format,
        exportProbe.bytes,
        input.actorUserId,
      ]
    );
    await client.query(
      `UPDATE deliverable_template_workflows
          SET last_test_run_id = ?, last_test_passed_at = CASE WHEN ? = 'pass' THEN now() ELSE NULL END,
              updated_at = now()
        WHERE id = ? AND organization_id = ?`,
      [runId, status, workflow.id, input.organizationId]
    );
  });
  const refreshed = await getTemplateWorkflow(input.templateId, input.organizationId);
  if (!refreshed)
    throw new TemplateWorkflowError('WORKFLOW_NOT_FOUND', 'Template workflow not found', 404);
  return {
    workflow: refreshed,
    runId,
    status,
    checks,
    exportFormat: exportProbe.format,
    exportByteSize: exportProbe.bytes,
  };
}

export async function submitTemplateForApproval(input: {
  organizationId: string;
  actorUserId: string;
  templateId: string;
}): Promise<TemplateWorkflowRecord> {
  return withPgTransaction(async (client) => {
    const locked = await client.query<WorkflowRow>(
      `SELECT ${WORKFLOW_COLUMNS} FROM deliverable_template_workflows
        WHERE template_id = ? AND organization_id = ? FOR UPDATE`,
      [input.templateId, input.organizationId]
    );
    const row = locked.rows[0];
    if (!row)
      throw new TemplateWorkflowError('WORKFLOW_NOT_FOUND', 'Template workflow not found', 404);
    if (row.author_user_id !== input.actorUserId || row.status !== 'draft')
      throw new TemplateWorkflowError('INVALID_STATE', 'Only the author can submit a draft');
    if (!row.last_test_run_id || !row.last_test_passed_at)
      throw new TemplateWorkflowError('TEST_PASS_REQUIRED', 'A passing live-data test is required');
    const run = await client.query<{ status: string; template_version: string }>(
      `SELECT status, template_version FROM deliverable_template_test_runs
        WHERE id = ? AND workflow_id = ?`,
      [row.last_test_run_id, row.id]
    );
    if (run.rows[0]?.status !== 'pass' || run.rows[0]?.template_version !== row.version)
      throw new TemplateWorkflowError(
        'TEST_PASS_REQUIRED',
        'The latest template version needs a passing test'
      );
    const updated = await client.query<WorkflowRow>(
      `UPDATE deliverable_template_workflows SET status = 'submitted', submitted_at = now(), updated_at = now()
        WHERE id = ? RETURNING ${WORKFLOW_COLUMNS}`,
      [row.id]
    );
    return mapWorkflow(updated.rows[0]);
  });
}

const REGISTRY_BY_TYPE = {
  doc: 'document_studio_templates',
  deck: 'presentation_templates',
  table: 'tp_base_templates',
} as const;

export async function approveTemplateWorkflow(input: {
  organizationId: string;
  actorUserId: string;
  templateId: string;
  setAsDefault?: boolean;
}): Promise<TemplateWorkflowRecord> {
  return withPgTransaction(async (client) => {
    const locked = await client.query<WorkflowRow>(
      `SELECT ${WORKFLOW_COLUMNS} FROM deliverable_template_workflows
        WHERE template_id = ? AND organization_id = ? FOR UPDATE`,
      [input.templateId, input.organizationId]
    );
    const row = locked.rows[0];
    if (!row)
      throw new TemplateWorkflowError('WORKFLOW_NOT_FOUND', 'Template workflow not found', 404);
    if (row.status !== 'submitted')
      throw new TemplateWorkflowError('INVALID_STATE', 'Only a submitted template can be approved');
    if (row.author_user_id === input.actorUserId)
      throw new TemplateWorkflowError(
        'AUTHOR_CANNOT_APPROVE',
        'The approver must be different from the author',
        403
      );
    const approvedVersion = row.version === '0.1' ? '1.0' : row.version;
    await approveTemplateProvenance({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      idempotencyKey: `template-workflow:${row.id}:${approvedVersion}`,
      registry: REGISTRY_BY_TYPE[row.template_type],
      templateId: row.template_id,
      provenance: {
        source: 'organization-authored-template',
        licenseBasis: 'organization-owned-content',
        authority: input.actorUserId,
        version: approvedVersion,
        evidence: `deliverable_template_test_runs:${row.last_test_run_id}`,
      },
    });
    if (row.template_type === 'doc') {
      await client.query(
        `UPDATE document_studio_templates
            SET status = 'approved', approved_by = ?, approved_at = now(), updated_at = now()
          WHERE template_id = ? AND organization_id = ? AND status = 'draft'`,
        [input.actorUserId, row.template_id, input.organizationId]
      );
    }
    if (input.setAsDefault) {
      await client.query(
        `UPDATE deliverable_template_workflows SET is_default = FALSE, updated_at = now()
          WHERE organization_id = ? AND document_type = ? AND template_type = ? AND is_default = TRUE`,
        [input.organizationId, row.document_type, row.template_type]
      );
    }
    const updated = await client.query<WorkflowRow>(
      `UPDATE deliverable_template_workflows
          SET status = 'approved', version = CASE WHEN version = '0.1' THEN '1.0' ELSE version END,
              approved_by = ?, approved_at = now(),
              is_default = ?, updated_at = now()
        WHERE id = ? RETURNING ${WORKFLOW_COLUMNS}`,
      [input.actorUserId, Boolean(input.setAsDefault), row.id]
    );
    return mapWorkflow(updated.rows[0]);
  });
}
