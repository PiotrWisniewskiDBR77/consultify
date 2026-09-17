import { createHash } from 'node:crypto';

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
  templateVersion: string;
  snapshotHash: string;
}

export interface CustomWorkbookTemplateSummary {
  id: string;
  name: string;
  description: string | null;
}

export interface WorkbookTemplateQueryReader {
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>;
  queryAll<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export async function listCustomWorkbookTemplates(
  organizationId: string,
  userId: string,
  reader: WorkbookTemplateQueryReader = queryHelpers
): Promise<CustomWorkbookTemplateSummary[]> {
  return reader.queryAll<CustomWorkbookTemplateSummary>(
    `SELECT CAST(id AS TEXT) AS id, name, description
       FROM tp_base_templates
      WHERE (status IS NULL OR status <> 'deprecated')
        AND (
          (status IN ('approved', 'published') AND (
            created_by IS NULL OR
            (organization_id = ? AND (
              COALESCE(visibility, 'organization') <> 'private'
              OR COALESCE(owner_user_id, created_by) = ?
            ))
          ))
          OR (status = 'draft' AND organization_id = ? AND COALESCE(owner_user_id, created_by) = ?)
          OR (status IS NULL AND (
            created_by IS NULL OR
            (organization_id = ? AND (
              COALESCE(visibility, 'organization') <> 'private'
              OR COALESCE(owner_user_id, created_by) = ?
            ))
          ))
        )
      ORDER BY created_at DESC, name ASC`,
    [organizationId, userId, organizationId, userId, organizationId, userId]
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
  const table = Array.isArray(snapshot.tables) ? snapshot.tables[0] : null;
  const columns = Array.isArray(snapshot.columns)
    ? snapshot.columns
    : Array.isArray(snapshot.fields)
      ? snapshot.fields
      : table &&
          typeof table === 'object' &&
          Array.isArray((table as Record<string, unknown>).fields)
        ? ((table as Record<string, unknown>).fields as unknown[])
        : [];
  if (columns.length === 0) {
    throw new CustomWorkbookTemplateInvalidError(
      'Template schema_snapshot must contain WorkbookSchema.sheets, columns, fields, or tables[0].fields'
    );
  }
  const normalizedColumns = columns.map((raw, index) => {
    const col = (raw ?? {}) as Record<string, unknown>;
    const key = String(col.key ?? col.id ?? String.fromCharCode(65 + index));
    const rawType =
      typeof col.type === 'string'
        ? col.type
        : typeof col.fieldType === 'string'
          ? col.fieldType
          : undefined;
    const workbookType = (() => {
      if (rawType === 'number' || rawType === 'currency' || rawType === 'percent') return rawType;
      if (rawType === 'formula') return 'number';
      if (rawType === 'date') return 'date';
      if (rawType === 'checkbox' || rawType === 'boolean') return 'boolean';
      if (rawType === 'rating') return 'rating';
      return 'text';
    })();
    const choices = Array.isArray((col.options as any)?.choices)
      ? (col.options as any).choices
          .map((choice: unknown) =>
            typeof choice === 'string'
              ? choice
              : choice && typeof choice === 'object'
                ? String((choice as Record<string, unknown>).name ?? '')
                : ''
          )
          .filter(Boolean)
      : Array.isArray((col as any).options)
        ? (col as any).options.map(String)
        : [];
    return {
      key,
      header: String(col.header ?? col.name ?? key),
      ...(typeof col.width === 'number' ? { width: col.width } : {}),
      type: workbookType as any,
      ...(typeof col.numberFormat === 'string' ? { numberFormat: col.numberFormat } : {}),
      ...(col.style && typeof col.style === 'object' ? { style: col.style as any } : {}),
      ...(choices.length > 0
        ? { validation: { type: 'list' as const, values: choices, allowBlank: true } }
        : col.validation && typeof col.validation === 'object'
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
        name:
          table && typeof table === 'object'
            ? String((table as Record<string, unknown>).name || 'Sheet1')
            : 'Sheet1',
        columns: normalizedColumns.map(({ legacyFormula: _legacyFormula, ...column }) => column),
        rows: Object.keys(starterCells).length > 0 ? [{ cells: starterCells }] : [],
      },
    ],
  };
}

function spreadsheetColumnKey(index: number): string {
  let value = index + 1;
  let key = '';
  while (value > 0) {
    value -= 1;
    key = String.fromCharCode(65 + (value % 26)) + key;
    value = Math.floor(value / 26);
  }
  return key;
}

/**
 * TEMPLATE-1 stores the accepted SHEET-BASE as an export-oriented snapshot:
 * headers/rows/formulas use A1 coordinates rather than WorkbookSchema cells.
 * Convert that persisted shape at the boundary instead of rejecting a template
 * which the library advertises as duplicable.
 */
function visualSheetsToSchema(
  snapshot: Record<string, unknown>,
  name: string,
  description: string | null
): WorkbookSchema {
  const sourceSheets = Array.isArray(snapshot.sheets) ? snapshot.sheets : [];
  const sheets: WorkbookSchema['sheets'] = sourceSheets.map((rawSheet, sheetIndex) => {
    const sheet = (rawSheet ?? {}) as Record<string, unknown>;
    const sourceRows = Array.isArray(sheet.rows) ? sheet.rows : [];
    const explicitHeaders = Array.isArray(sheet.headers) ? sheet.headers : null;
    const tabularRows = sourceRows.filter(Array.isArray) as unknown[][];
    const headers = explicitHeaders ?? (tabularRows.length > 0 ? tabularRows[0] : []);
    const dataRows = explicitHeaders ? tabularRows : tabularRows.slice(1);
    const widths =
      sheet.dimensions && typeof sheet.dimensions === 'object'
        ? ((sheet.dimensions as Record<string, unknown>).columns as Record<string, unknown>)
        : undefined;
    const formulaEntries =
      sheet.formulas && typeof sheet.formulas === 'object'
        ? Object.entries(sheet.formulas as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string'
          )
        : [];
    const formulaColumns = formulaEntries
      .map(([address]) => /^([A-Z]+)\d+$/.exec(address)?.[1])
      .filter((value): value is string => Boolean(value));
    const widthColumns = widths ? Object.keys(widths) : [];
    const columnCount = Math.max(headers.length, dataRows[0]?.length ?? 0, widthColumns.length, 1);
    const columns = Array.from({ length: columnCount }, (_, index) => {
      const key = spreadsheetColumnKey(index);
      return {
        key,
        header: String(headers[index] ?? key),
        ...(typeof widths?.[key] === 'number' ? { width: widths[key] as number } : {}),
        type: 'text' as const,
      };
    });

    const rows: WorkbookSchema['sheets'][number]['rows'] = dataRows.map((values) => ({
      cells: Object.fromEntries(
        values.map((value, index) => {
          const normalized: string | number | boolean | null =
            value === null ||
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
              ? value
              : JSON.stringify(value);
          return [spreadsheetColumnKey(index), { value: normalized }];
        })
      ),
    }));
    const maxFormulaRow = formulaEntries.reduce((max, [address]) => {
      const row = Number(/^[A-Z]+(\d+)$/.exec(address)?.[1] ?? 0);
      return Math.max(max, row);
    }, 0);
    while (rows.length < Math.max(0, maxFormulaRow - 1)) rows.push({ cells: {} });
    for (const [address, formula] of formulaEntries) {
      const match = /^([A-Z]+)(\d+)$/.exec(address);
      if (!match) continue;
      const [, key, rawRow] = match;
      if (!formulaColumns.includes(key)) continue;
      const rowIndex = Number(rawRow) - 2;
      if (rowIndex < 0) continue;
      rows[rowIndex].cells[key] = { formula: formula.replace(/^=/, '') };
    }

    const freeze =
      sheet.freeze && typeof sheet.freeze === 'object'
        ? (sheet.freeze as Record<string, unknown>)
        : undefined;
    return {
      name: String(sheet.name ?? sheet.title ?? `Sheet${sheetIndex + 1}`),
      columns,
      rows,
      ...(typeof freeze?.ySplit === 'number' ? { freezeRow: freeze.ySplit } : {}),
      ...(typeof freeze?.xSplit === 'number' ? { freezeCol: freeze.xSplit } : {}),
      ...(typeof sheet.autoFilter === 'string' ? { autoFilter: true } : {}),
    };
  });

  return {
    title: typeof snapshot.title === 'string' && snapshot.title.trim() ? snapshot.title : name,
    ...(description ? { description } : {}),
    sheets,
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
  const hasCanonicalSheets =
    Array.isArray(snapshot.sheets) &&
    snapshot.sheets.every(
      (sheet) =>
        sheet &&
        typeof sheet === 'object' &&
        Array.isArray((sheet as Record<string, unknown>).columns) &&
        Array.isArray((sheet as Record<string, unknown>).rows) &&
        (sheet as Record<string, unknown>).rows instanceof Array &&
        ((sheet as Record<string, unknown>).rows as unknown[]).every(
          (row) => row && typeof row === 'object' && !Array.isArray(row) && 'cells' in row
        )
    );
  const candidate = hasCanonicalSheets
    ? {
        ...snapshot,
        title:
          typeof snapshot.title === 'string' && snapshot.title.trim()
            ? snapshot.title.trim()
            : name,
        ...(snapshot.description === undefined && description ? { description } : {}),
      }
    : Array.isArray(snapshot.sheets)
      ? visualSheetsToSchema(snapshot, name, description)
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
  organizationId: string,
  userId: string,
  reader: WorkbookTemplateQueryReader = queryHelpers
): Promise<CustomWorkbookTemplate | null> {
  const row = await reader.queryOne<{
    id: string;
    name: string;
    description: string | null;
    schema_snapshot: unknown;
    version: string;
  }>(
    `SELECT CAST(id AS TEXT) AS id, name, description, schema_snapshot,
            COALESCE(version, '1.0.0') AS version
      FROM tp_base_templates
      WHERE CAST(id AS TEXT) = ?
        AND (status IS NULL OR status <> 'deprecated')
        AND (
          (status IN ('approved', 'published') AND (
            organization_id = '__system__' OR
            created_by IS NULL OR
            (organization_id = ? AND (
              COALESCE(visibility, 'organization') <> 'private'
              OR COALESCE(owner_user_id, created_by) = ?
            ))
          ))
          OR (status = 'draft' AND organization_id = ? AND COALESCE(owner_user_id, created_by) = ?)
          OR (status IS NULL AND (
            organization_id = '__system__' OR
            created_by IS NULL OR
            (organization_id = ? AND (
              COALESCE(visibility, 'organization') <> 'private'
              OR COALESCE(owner_user_id, created_by) = ?
            ))
          ))
        )`,
    [templateId, organizationId, userId, organizationId, userId, organizationId, userId]
  );
  if (!row) return null;
  const canonicalize = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonicalize)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, nested]) => [key, canonicalize(nested)])
          )
        : value;
  const parsedSnapshot = parseSnapshot(row.schema_snapshot);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    schema: convertCustomTemplateSnapshot(parsedSnapshot, row.name, row.description),
    templateVersion: row.version,
    snapshotHash: createHash('sha256')
      .update(JSON.stringify(canonicalize(parsedSnapshot)))
      .digest('hex'),
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
      customTemplateVersion: template.templateVersion,
      customTemplateSnapshotHash: template.snapshotHash,
      materializationId: uuidv4(),
    },
  };
}
