/**
 * CsvImportService - CSV parsing, type inference, and import for Table Platform
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import MetadataService from './MetadataService.js';
import RecordsService from './RecordsService.js';
import SchemaValidationService from './SchemaValidationService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportResult {
  recordsCreated: number;
  recordsSkipped: number;
  errors: Array<{ row: number; error: string }>;
  totalRows: number;
}

export interface InferredField {
  name: string;
  fieldType: string;
  options?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 10;
const SAMPLE_SIZE = 100;
const SINGLE_SELECT_MAX_OPTIONS = 20;
const SINGLE_SELECT_MAX_RATIO = 0.5;

const BOOLEAN_TRUE = new Set(['true', '1', 'yes', 'y', 't']);
const BOOLEAN_FALSE = new Set(['false', '0', 'no', 'n', 'f', '']);

// ISO date, DD/MM/YYYY, MM/DD/YYYY
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
const DATE_DMY = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
const DATE_MDY = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;

const URL_REGEX = /^https?:\/\/[^\s]+$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CURRENCY_PREFIX = /^[$€£¥]|^(PLN|USD|EUR|GBP)\s/i;
const CURRENCY_SUFFIX = /\s?(PLN|USD|EUR|GBP|zł|zl)$/i;

// ---------------------------------------------------------------------------
// parseCSV
// ---------------------------------------------------------------------------

export function parseCSV(csvContent: string): {
  headers: string[];
  rows: string[][];
  totalRows: number;
} {
  if (!csvContent || typeof csvContent !== 'string') {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const trimmed = csvContent.trim();
  if (!trimmed) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const rows: string[][] = [];
  let i = 0;
  const len = trimmed.length;

  while (i < len) {
    const row: string[] = [];
    while (i < len) {
      if (trimmed[i] === '"') {
        i++;
        let cell = '';
        while (i < len) {
          if (trimmed[i] === '"') {
            i++;
            if (trimmed[i] === '"') {
              cell += '"';
              i++;
            } else {
              break;
            }
          } else {
            cell += trimmed[i];
            i++;
          }
        }
        row.push(cell);
        if (i < len && trimmed[i] === ',') i++;
        continue;
      }

      let cell = '';
      while (i < len && trimmed[i] !== ',' && trimmed[i] !== '\n' && trimmed[i] !== '\r') {
        cell += trimmed[i];
        i++;
      }
      row.push(cell.trim());
      if (i < len) {
        if (trimmed[i] === ',') {
          i++;
        } else if (trimmed[i] === '\n') {
          i++;
          if (trimmed[i] === '\r') i++;
          break;
        } else if (trimmed[i] === '\r') {
          i++;
          if (trimmed[i] === '\n') i++;
          break;
        }
      }
    }
    if (row.some((c) => c.length > 0)) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);
  return { headers, rows: dataRows, totalRows: dataRows.length };
}

// ---------------------------------------------------------------------------
// inferFieldTypes
// ---------------------------------------------------------------------------

function isNumeric(val: string): boolean {
  if (!val || val.trim() === '') return true;
  const s = val.trim().replace(/,/g, '');
  return /^-?\d+(\.\d+)?%?$/.test(s) || /^-?\d+\.\d+[eE][+-]?\d+$/.test(s);
}

function isDate(val: string): boolean {
  if (!val || val.trim() === '') return true;
  const s = val.trim();
  return DATE_REGEX.test(s) || DATE_DMY.test(s) || DATE_MDY.test(s);
}

function isBoolean(val: string): boolean {
  if (val === '') return true;
  const s = val.trim().toLowerCase();
  return BOOLEAN_TRUE.has(s) || BOOLEAN_FALSE.has(s);
}

function isUrl(val: string): boolean {
  if (!val || val.trim() === '') return true;
  return URL_REGEX.test(val.trim());
}

function isEmail(val: string): boolean {
  if (!val || val.trim() === '') return true;
  return EMAIL_REGEX.test(val.trim());
}

function hasCurrencyHint(val: string): boolean {
  if (!val || val.trim() === '') return true;
  const s = val.trim();
  return CURRENCY_PREFIX.test(s) || CURRENCY_SUFFIX.test(s);
}

export function inferFieldTypes(
  headers: string[],
  sampleRows: string[][]
): Array<{ name: string; fieldType: string; options?: Record<string, unknown> }> {
  const result: InferredField[] = [];
  const colCount = Math.max(headers.length, ...sampleRows.map((r) => r.length));

  for (let c = 0; c < colCount; c++) {
    const header = (headers[c] ?? `Column ${c + 1}`).trim() || `Column ${c + 1}`;
    const values = sampleRows.map((r) => (r[c] ?? '').trim()).filter((v) => v !== '');

    let fieldType = 'singleLineText';
    let options: Record<string, unknown> | undefined;

    if (values.length === 0) {
      result.push({ name: header, fieldType: 'singleLineText' });
      continue;
    }

    const allNumeric = values.every(isNumeric);
    const allDate = values.every(isDate);
    const allBoolean = values.every(isBoolean);
    const allUrl = values.every(isUrl);
    const allEmail = values.every(isEmail);
    const anyCurrency = values.some(hasCurrencyHint);

    if (allBoolean) {
      fieldType = 'checkbox';
    } else if (allNumeric && anyCurrency) {
      fieldType = 'currency';
    } else if (allNumeric) {
      fieldType = 'number';
    } else if (allDate) {
      fieldType = 'date';
    } else if (allUrl) {
      fieldType = 'url';
    } else if (allEmail) {
      fieldType = 'email';
    } else {
      const unique = new Set(values);
      const ratio = unique.size / values.length;
      if (unique.size <= SINGLE_SELECT_MAX_OPTIONS && ratio <= SINGLE_SELECT_MAX_RATIO) {
        fieldType = 'singleSelect';
        options = {
          options: Array.from(unique)
            .slice(0, SINGLE_SELECT_MAX_OPTIONS)
            .sort()
            .map((v) => ({ name: v })),
        };
      }
    }

    result.push({ name: header, fieldType, options });
  }

  return result;
}

// ---------------------------------------------------------------------------
// importToTable
// ---------------------------------------------------------------------------

function buildCsvToFieldMapping(
  headers: string[],
  tableFields: Array<{ id: string; name: string }>,
  mapping?: Record<string, string>
): Map<string, string> {
  const map = new Map<string, string>();

  if (mapping && Object.keys(mapping).length > 0) {
    for (const [csvHeader, target] of Object.entries(mapping)) {
      const field = tableFields.find((f) => f.id === target || f.name === target);
      if (field) {
        map.set(csvHeader, field.id);
      }
    }
  } else {
    for (const h of headers) {
      const field = tableFields.find((f) => f.name.toLowerCase() === h.toLowerCase().trim());
      if (field) {
        map.set(h, field.id);
      }
    }
  }

  return map;
}

function coerceValue(raw: string, fieldType: string, options?: Record<string, unknown>): unknown {
  const s = (raw ?? '').trim();
  if (s === '') return null;

  switch (fieldType) {
    case 'number':
    case 'currency':
    case 'percent': {
      const cleaned = s.replace(/,/g, '').replace(/[^\d.-eE]/g, '');
      const n = parseFloat(cleaned);
      return isNaN(n) ? s : n;
    }
    case 'date':
      return s;
    case 'checkbox':
      return BOOLEAN_TRUE.has(s.toLowerCase());
    case 'singleSelect':
    case 'multiSelect':
      return s;
    default:
      return s;
  }
}

export async function importToTable(
  tableId: string,
  csvContent: string,
  mapping?: Record<string, string>,
  createdBy?: string
): Promise<ImportResult> {
  const result: ImportResult = {
    recordsCreated: 0,
    recordsSkipped: 0,
    errors: [],
    totalRows: 0,
  };

  const { headers, rows, totalRows } = parseCSV(csvContent);
  result.totalRows = totalRows;

  if (headers.length === 0) {
    result.errors.push({ row: 0, error: 'No headers found in CSV' });
    return result;
  }

  const db = getDatabase();
  const tableResult = await db.query('SELECT id, name FROM tp_fields WHERE table_id = $1', [
    tableId,
  ]);
  const tableFields = tableResult.rows as Array<{ id: string; name: string }>;
  const fieldTypesResult = await db.query(
    'SELECT id, field_type, options FROM tp_fields WHERE table_id = $1',
    [tableId]
  );
  const fieldTypes = new Map<string, { type: string; options?: Record<string, unknown> }>();
  for (const row of fieldTypesResult.rows as Array<{
    id: string;
    field_type: string;
    options?: Record<string, unknown>;
  }>) {
    fieldTypes.set(row.id, {
      type: row.field_type,
      options: row.options ?? {},
    });
  }

  const csvToFieldId = buildCsvToFieldMapping(headers, tableFields, mapping);
  if (csvToFieldId.size === 0) {
    result.errors.push({ row: 0, error: 'No column mapping to table fields' });
    return result;
  }

  const batches: string[][][] = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE));
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const records: Array<{ data: Record<string, unknown> }> = [];

    for (let j = 0; j < batch.length; j++) {
      const row = batch[j];
      const rowNum = batchIdx * BATCH_SIZE + j + 2;
      const data: Record<string, unknown> = {};
      let skip = false;

      for (let c = 0; c < headers.length; c++) {
        const header = headers[c];
        const fieldId = csvToFieldId.get(header);
        if (!fieldId) continue;

        const meta = fieldTypes.get(fieldId);
        const fieldType = meta?.type ?? 'singleLineText';
        const options = meta?.options;

        try {
          const value = coerceValue(row[c] ?? '', fieldType, options);
          data[fieldId] = value;
        } catch (e) {
          result.errors.push({
            row: rowNum,
            error: (e as Error).message,
          });
          skip = true;
          break;
        }
      }

      if (!skip) {
        records.push({ data });
      } else {
        result.recordsSkipped++;
      }
    }

    if (records.length > 0) {
      try {
        await RecordsService.batchCreate(tableId, records, createdBy);
        result.recordsCreated += records.length;
      } catch (e) {
        logger.error('[CsvImportService] batchCreate failed', {
          tableId,
          error: (e as Error).message,
        });
        for (let j = 0; j < records.length; j++) {
          result.errors.push({
            row: batchIdx * BATCH_SIZE + j + 2,
            error: (e as Error).message,
          });
        }
        result.recordsSkipped += records.length;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// importToNewTable
// ---------------------------------------------------------------------------

export async function importToNewTable(
  baseId: string,
  tableName: string,
  csvContent: string,
  createdBy?: string
): Promise<{ tableId: string; result: ImportResult }> {
  const { headers, rows, totalRows } = parseCSV(csvContent);
  const result: ImportResult = {
    recordsCreated: 0,
    recordsSkipped: 0,
    errors: [],
    totalRows,
  };

  if (headers.length === 0) {
    result.errors.push({ row: 0, error: 'No headers found in CSV' });
    return { tableId: '', result };
  }

  const inferred = inferFieldTypes(headers, rows.slice(0, SAMPLE_SIZE));
  const table = await MetadataService.createTable(
    baseId,
    tableName || 'Imported table',
    undefined,
    createdBy
  );
  if (!table) {
    result.errors.push({ row: 0, error: 'Failed to create table' });
    return { tableId: '', result };
  }

  const tableId = (table as { id: string }).id;
  const db = getDatabase();
  const mapping: Record<string, string> = {};
  const existingFieldsResult = await db.query(
    'SELECT id, name FROM tp_fields WHERE table_id = $1',
    [tableId]
  );
  const existingByName = new Map<string, string>();
  for (const row of existingFieldsResult.rows) {
    existingByName.set((row as { name: string }).name.toLowerCase(), (row as { id: string }).id);
  }

  for (let i = 0; i < inferred.length; i++) {
    const inf = inferred[i];
    if (!inf.name) continue;
    const typeValid = SchemaValidationService.validateFieldType(inf.fieldType);
    if (!typeValid.valid) {
      result.errors.push({
        row: 0,
        error: `Invalid inferred type for '${inf.name}': ${typeValid.error}`,
      });
      continue;
    }
    const optsValid = SchemaValidationService.validateFieldOptions(
      inf.fieldType,
      inf.options ?? {}
    );
    if (!optsValid.valid) continue;

    const existingId = existingByName.get(inf.name.toLowerCase());
    if (existingId) {
      mapping[headers[i]] = existingId;
    } else {
      const field = await MetadataService.createField(
        tableId,
        inf.name,
        inf.fieldType,
        inf.options,
        createdBy
      );
      if (field) {
        mapping[headers[i]] = (field as { id: string }).id;
      }
    }
  }

  const importResult = await importToTable(tableId, csvContent, mapping, createdBy);
  return { tableId, result: importResult };
}

// ---------------------------------------------------------------------------
// parseXlsx
// ---------------------------------------------------------------------------

export function parseXlsx(buffer: Buffer): {
  headers: string[];
  rows: string[][];
  totalRows: number;
} {
  // Dynamic import is not possible in a sync function, so we use require-style
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const XLSX = require('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [], totalRows: 0 };
  }
  const sheet = workbook.Sheets[sheetName];
  const jsonRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (jsonRows.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }
  const headers = Object.keys(jsonRows[0]);
  const rows = jsonRows.map((row) => headers.map((h) => String(row[h] ?? '')));
  return { headers, rows, totalRows: rows.length };
}

// ---------------------------------------------------------------------------
// importFromGoogleSheet
// ---------------------------------------------------------------------------

const GSHEET_ID_REGEX = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;

export async function importFromGoogleSheet(
  sheetUrl: string,
  baseId: string,
  userId: string,
  tableName?: string
): Promise<{ tableId: string; result: ImportResult }> {
  const match = sheetUrl.match(GSHEET_ID_REGEX);
  if (!match || !match[1]) {
    throw new Error(
      'Invalid Google Sheets URL. Expected format: https://docs.google.com/spreadsheets/d/{ID}/...'
    );
  }

  const spreadsheetId = match[1];
  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

  let csvContent: string;
  try {
    const response = await fetch(exportUrl, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    csvContent = await response.text();
  } catch (err) {
    throw new Error(
      "Sheet must be publicly accessible or shared with 'Anyone with link'. " +
        `Fetch failed: ${(err as Error).message}`
    );
  }

  if (!csvContent || csvContent.trim().length === 0) {
    throw new Error('Google Sheet returned empty content');
  }

  const finalName = tableName || 'Google Sheet Import';
  return importToNewTable(baseId, finalName, csvContent, userId);
}

// ---------------------------------------------------------------------------
// Service export
// ---------------------------------------------------------------------------

const csvImportService = {
  parseCSV,
  parseXlsx,
  inferFieldTypes,
  importToTable,
  importToNewTable,
  importFromGoogleSheet,
};

export default csvImportService;
