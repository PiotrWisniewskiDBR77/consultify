import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../../utils/queryHelpers.js';
import { type WorkbookSchema, WorkbookSchemaValidator } from './WorkbookSchema.js';

export class CustomWorkbookTemplateInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomWorkbookTemplateInvalidError';
  }
}

export interface CustomWorkbookTemplate {
  id: string;
  name: string;
  description: string | null;
  schema: WorkbookSchema;
}

export interface CustomWorkbookTemplateSummary {
  id: string;
  name: string;
  description: string | null;
}

export async function listCustomWorkbookTemplates(
  organizationId: string
): Promise<CustomWorkbookTemplateSummary[]> {
  return queryHelpers.queryAll<CustomWorkbookTemplateSummary>(
    `SELECT CAST(id AS TEXT) AS id, name, description
       FROM tp_base_templates
      WHERE organization_id = ? AND created_by IS NOT NULL
      ORDER BY created_at DESC, name ASC`,
    [organizationId]
  );
}

function parseSnapshot(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    throw new CustomWorkbookTemplateInvalidError('Template schema_snapshot is not valid JSON');
  }
}

function legacyColumnsToSchema(
  snapshot: Record<string, unknown>,
  name: string,
  description: string | null
): WorkbookSchema {
  const columns = Array.isArray(snapshot.columns) ? snapshot.columns : [];
  if (columns.length === 0) {
    throw new CustomWorkbookTemplateInvalidError(
      'Template schema_snapshot must contain WorkbookSchema.sheets or a non-empty columns array'
    );
  }
  const normalizedColumns = columns.map((raw, index) => {
    const col = (raw ?? {}) as Record<string, unknown>;
    const key = String(col.key ?? col.id ?? String.fromCharCode(65 + index));
    const rawType = typeof col.type === 'string' ? col.type : undefined;
    return {
      key,
      header: String(col.header ?? col.name ?? key),
      ...(typeof col.width === 'number' ? { width: col.width } : {}),
      ...(rawType ? { type: (rawType === 'formula' ? 'number' : rawType) as any } : {}),
      ...(typeof col.numberFormat === 'string' ? { numberFormat: col.numberFormat } : {}),
      ...(col.style && typeof col.style === 'object' ? { style: col.style as any } : {}),
      ...(col.validation && typeof col.validation === 'object'
        ? { validation: col.validation as any }
        : {}),
      legacyFormula:
        rawType === 'formula' && typeof col.formula === 'string' && col.formula.trim()
          ? col.formula.trim().replace(/^=/, '')
          : null,
    };
  });
  const starterCells = Object.fromEntries(
    normalizedColumns
      .filter((column) => column.legacyFormula)
      .map((column) => [column.key, { formula: column.legacyFormula! }])
  );
  return {
    title: name,
    ...(description ? { description } : {}),
    sheets: [
      {
        name: 'Sheet1',
        columns: normalizedColumns.map(({ legacyFormula: _legacyFormula, ...column }) => column),
        rows: Object.keys(starterCells).length > 0 ? [{ cells: starterCells }] : [],
      },
    ],
  };
}

export function convertCustomTemplateSnapshot(
  rawSnapshot: unknown,
  name: string,
  description: string | null
): WorkbookSchema {
  const parsed = parseSnapshot(rawSnapshot);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CustomWorkbookTemplateInvalidError('Template schema_snapshot must be an object');
  }
  const snapshot = parsed as Record<string, unknown>;
  const candidate = Array.isArray(snapshot.sheets)
    ? {
        ...snapshot,
        title:
          typeof snapshot.title === 'string' && snapshot.title.trim()
            ? snapshot.title.trim()
            : name,
        ...(snapshot.description === undefined && description ? { description } : {}),
      }
    : legacyColumnsToSchema(snapshot, name, description);
  const validated = WorkbookSchemaValidator.safeParse(candidate);
  if (!validated.success) {
    const detail = validated.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join('.') || 'schema'}: ${issue.message}`)
      .join('; ');
    throw new CustomWorkbookTemplateInvalidError(`Incompatible workbook template: ${detail}`);
  }
  return validated.data;
}

export async function resolveCustomWorkbookTemplate(
  templateId: string,
  organizationId: string
): Promise<CustomWorkbookTemplate | null> {
  const row = await queryHelpers.queryOne<{
    id: string;
    name: string;
    description: string | null;
    schema_snapshot: unknown;
  }>(
    `SELECT CAST(id AS TEXT) AS id, name, description, schema_snapshot
      FROM tp_base_templates
      WHERE CAST(id AS TEXT) = ? AND organization_id = ? AND created_by IS NOT NULL`,
    [templateId, organizationId]
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    schema: convertCustomTemplateSnapshot(row.schema_snapshot, row.name, row.description),
  };
}

export function materializeCustomWorkbookSchema(
  template: CustomWorkbookTemplate,
  params: Record<string, unknown>
): WorkbookSchema {
  const requestedTitle = typeof params.title === 'string' ? params.title.trim() : '';
  return {
    ...structuredClone(template.schema),
    title: requestedTitle || template.schema.title || template.name,
    metadata: {
      ...(template.schema.metadata ?? {}),
      customTemplateId: template.id,
      materializationId: uuidv4(),
    },
  };
}
