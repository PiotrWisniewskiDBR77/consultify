import { v4 as uuidv4 } from 'uuid';

import type { CellStyle, WorkbookSchema } from './WorkbookSchema.js';

export type WorkbookMutation =
  | {
      type: 'setCell' | 'clearCell';
      sheetIndex: number;
      rowIndex: number;
      columnKey: string;
      value?: string | number | boolean | null;
      formula?: string;
    }
  | { type: 'addSheet'; name?: string; afterIndex?: number; sheetId?: string }
  | { type: 'renameSheet'; sheetId: string; name: string }
  | { type: 'duplicateSheet'; sheetId: string; name?: string; newSheetId?: string }
  | { type: 'deleteSheet'; sheetId: string }
  | { type: 'reorderSheet'; sheetId: string; targetIndex: number }
  | { type: 'setSheetHidden'; sheetId: string; hidden: boolean }
  | { type: 'insertRows' | 'deleteRows'; sheetIndex: number; atIndex: number; count: number }
  | { type: 'insertColumns' | 'deleteColumns'; sheetIndex: number; atIndex: number; count: number }
  | {
      type: 'setCellStyle';
      sheetIndex: number;
      startRow: number;
      endRow: number;
      startColumn: number;
      endColumn: number;
      patch: Partial<CellStyle>;
    }
  | { type: 'setColumn'; sheetIndex: number; columnIndex: number; header: string; width?: number };

export type WorkbookAnchorTransform = Extract<
  WorkbookMutation,
  { type: 'insertRows' | 'deleteRows' | 'insertColumns' | 'deleteColumns' }
> & { sheetId: string };

const ALLOWED_TYPES = new Set<WorkbookMutation['type']>([
  'setCell',
  'clearCell',
  'addSheet',
  'renameSheet',
  'duplicateSheet',
  'deleteSheet',
  'reorderSheet',
  'setSheetHidden',
  'insertRows',
  'deleteRows',
  'insertColumns',
  'deleteColumns',
  'setCellStyle',
  'setColumn',
]);
const FORBIDDEN_SHEET_NAME = new RegExp(String.raw`[\[\]:*?/\\]`);
const STYLE_KEYS = new Set([
  'bold',
  'italic',
  'fontColor',
  'bgColor',
  'numberFormat',
  'alignment',
  'wrapText',
  'border',
]);

function sheetName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid sheet name');
  const name = value.trim();
  if (!name || name.length > 31 || FORBIDDEN_SHEET_NAME.test(name)) {
    throw new Error('Invalid sheet name');
  }
  return name;
}

function uniqueSheetName(schema: WorkbookSchema, requested: string, excludeId?: string): string {
  const base = sheetName(requested);
  const occupied = new Set(
    schema.sheets.filter((item) => item.id !== excludeId).map((item) => item.name.toLowerCase())
  );
  if (!occupied.has(base.toLowerCase())) return base;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const tail = ` (${suffix})`;
    const candidate = `${base.slice(0, 31 - tail.length)}${tail}`;
    if (!occupied.has(candidate.toLowerCase())) return candidate;
  }
  throw new Error('Unable to create unique sheet name');
}

function validSheetId(value?: string): string {
  if (value === undefined) return uuidv4();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Invalid sheet id');
  }
  return value;
}

function columnLetters(index: number): string {
  let current = index + 1;
  let result = '';
  while (current > 0) {
    result = String.fromCharCode(65 + ((current - 1) % 26)) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function blankSheet(name: string, id?: string): WorkbookSchema['sheets'][number] {
  return {
    id: validSheetId(id),
    name,
    columns: Array.from({ length: 12 }, (_, index) => ({
      key: columnLetters(index),
      header: columnLetters(index),
    })),
    rows: Array.from({ length: 30 }, () => ({ cells: {} })),
  };
}

function applyCell(
  schema: WorkbookSchema,
  operation: Extract<WorkbookMutation, { type: 'setCell' | 'clearCell' }>
): void {
  const { sheetIndex, rowIndex, columnKey } = operation;
  if (!Number.isInteger(sheetIndex) || sheetIndex < 0) throw new Error('Invalid sheetIndex');
  if (!Number.isInteger(rowIndex) || rowIndex < 0) throw new Error('Invalid rowIndex');
  if (typeof columnKey !== 'string' || !columnKey.trim()) throw new Error('Invalid columnKey');
  if (operation.formula !== undefined && typeof operation.formula !== 'string')
    throw new Error('Invalid formula');
  if (
    operation.value !== undefined &&
    operation.value !== null &&
    !['string', 'number', 'boolean'].includes(typeof operation.value)
  ) {
    throw new Error('Invalid value');
  }
  const sheet = schema.sheets[sheetIndex];
  if (!sheet?.rows || !sheet.columns) throw new Error(`Unknown sheetIndex ${sheetIndex}`);
  if (rowIndex >= sheet.rows.length) throw new Error(`Unknown rowIndex ${rowIndex}`);
  if (!sheet.columns.some((column) => column.key === columnKey))
    throw new Error(`Unknown columnKey ${columnKey}`);
  const row = sheet.rows[rowIndex];
  row.cells ||= {};
  const previous = row.cells[columnKey] ?? {};
  const next: Record<string, unknown> = {
    style: previous.style,
    comment: previous.comment,
    validation: previous.validation,
  };
  if (operation.type === 'setCell') {
    const formula = operation.formula?.trim().replace(/^=+/, '');
    if (formula) next.formula = formula;
    else if (operation.value !== undefined) next.value = operation.value;
  }
  row.cells[columnKey] = next as (typeof row.cells)[string];
}

function applyStyle(
  schema: WorkbookSchema,
  operation: Extract<WorkbookMutation, { type: 'setCellStyle' }>
): void {
  const { sheetIndex, startRow, endRow, startColumn, endColumn, patch } = operation;
  if (
    ![sheetIndex, startRow, endRow, startColumn, endColumn].every(Number.isInteger) ||
    sheetIndex < 0 ||
    startRow < 0 ||
    startColumn < 0 ||
    endRow < startRow ||
    endColumn < startColumn
  ) {
    throw new Error('Invalid cell style range');
  }
  if (
    !patch ||
    typeof patch !== 'object' ||
    Array.isArray(patch) ||
    Object.keys(patch).length === 0
  ) {
    throw new Error('Cell style patch must not be empty');
  }
  if (Object.keys(patch).some((key) => !STYLE_KEYS.has(key)))
    throw new Error('Unsupported cell style property');
  const sheet = schema.sheets[sheetIndex];
  if (!sheet || endRow >= sheet.rows.length || endColumn >= sheet.columns.length)
    throw new Error('Unknown cell style range');
  if ((endRow - startRow + 1) * (endColumn - startColumn + 1) > 10_000)
    throw new Error('Cell style range is too large');
  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    const row = sheet.rows[rowIndex];
    row.cells ||= {};
    for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
      const key = sheet.columns[columnIndex].key;
      const cell = row.cells[key] ?? {};
      cell.style = { ...(cell.style ?? {}), ...patch };
      row.cells[key] = cell;
    }
  }
}

function applyColumn(
  schema: WorkbookSchema,
  operation: Extract<WorkbookMutation, { type: 'setColumn' }>
): void {
  if (!Number.isInteger(operation.sheetIndex) || operation.sheetIndex < 0)
    throw new Error('Invalid sheetIndex');
  if (!Number.isInteger(operation.columnIndex) || operation.columnIndex < 0)
    throw new Error('Invalid columnIndex');
  const header = typeof operation.header === 'string' ? operation.header.trim() : '';
  if (!header || header.length > 200) throw new Error('Invalid column header');
  if (
    operation.width !== undefined &&
    (!Number.isFinite(operation.width) || operation.width < 4 || operation.width > 100)
  )
    throw new Error('Invalid column width');
  const column = schema.sheets[operation.sheetIndex]?.columns?.[operation.columnIndex];
  if (!column) throw new Error('Unknown columnIndex');
  column.header = header;
  if (operation.width !== undefined) column.width = operation.width;
}

function lettersIndex(value: string): number {
  return (
    value
      .replace(/\$/g, '')
      .split('')
      .reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1
  );
}

function shifted(
  value: number,
  operation: WorkbookAnchorTransform,
  axis: 'row' | 'column'
): number | null {
  const relevant =
    axis === 'row'
      ? operation.type === 'insertRows' || operation.type === 'deleteRows'
      : operation.type === 'insertColumns' || operation.type === 'deleteColumns';
  if (!relevant) return value;
  const inserting = operation.type === 'insertRows' || operation.type === 'insertColumns';
  if (inserting) return value >= operation.atIndex ? value + operation.count : value;
  if (value < operation.atIndex) return value;
  if (value >= operation.atIndex + operation.count) return value - operation.count;
  return null;
}

function transformCell(reference: string, operation: WorkbookAnchorTransform): string {
  const match = /^(\$?)([A-Z]{1,3})(\$?)([1-9]\d*)$/.exec(reference.toUpperCase());
  if (!match) return reference;
  const column = shifted(lettersIndex(match[2]), operation, 'column');
  const row = shifted(Number(match[4]) - 2, operation, 'row');
  if (column === null || row === null || row < -1) return '#REF!';
  return `${match[1]}${columnLetters(column)}${match[3]}${row + 2}`;
}

function transformFormula(
  formula: string,
  formulaSheet: string,
  targetSheet: string,
  operation: WorkbookAnchorTransform
): string {
  const pattern =
    /(?:(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_. ]*))!)?(\$?[A-Z]{1,3}\$?[1-9]\d*)/g;
  return formula.replace(pattern, (whole, quotedSheet, plainSheet, reference) => {
    const explicit = quotedSheet ? String(quotedSheet).replace(/''/g, "'") : plainSheet;
    const target = explicit
      ? explicit.toLowerCase() === targetSheet.toLowerCase()
      : formulaSheet.toLowerCase() === targetSheet.toLowerCase();
    if (!target) return whole;
    return `${whole.slice(0, whole.length - reference.length)}${transformCell(reference, operation)}`;
  });
}

export function transformWorkbookRangeRef(
  rangeRef: string,
  operation: WorkbookAnchorTransform
): string | null {
  const transformed = rangeRef
    .trim()
    .toUpperCase()
    .split(':')
    .map((part) => transformCell(part, operation));
  return transformed.some((part) => part === '#REF!') ? null : transformed.join(':');
}

function applyAxis(
  schema: WorkbookSchema,
  operation: Extract<
    WorkbookMutation,
    { type: 'insertRows' | 'deleteRows' | 'insertColumns' | 'deleteColumns' }
  >
): WorkbookAnchorTransform {
  if (!Number.isInteger(operation.sheetIndex) || operation.sheetIndex < 0)
    throw new Error('Invalid sheetIndex');
  if (!Number.isInteger(operation.atIndex) || operation.atIndex < 0)
    throw new Error('Invalid axis index');
  if (!Number.isInteger(operation.count) || operation.count < 1 || operation.count > 100)
    throw new Error('Axis mutation count must be between 1 and 100');
  const sheet = schema.sheets[operation.sheetIndex];
  if (!sheet?.id) throw new Error('Unknown sheetIndex');
  const transform = { ...operation, sheetId: sheet.id } as WorkbookAnchorTransform;
  if (operation.type === 'insertRows') {
    if (operation.atIndex > sheet.rows.length) throw new Error('Invalid row insertion index');
    sheet.rows.splice(
      operation.atIndex,
      0,
      ...Array.from({ length: operation.count }, () => ({ cells: {} }))
    );
  } else if (operation.type === 'deleteRows') {
    if (operation.atIndex + operation.count > sheet.rows.length)
      throw new Error('Invalid row deletion range');
    if (operation.count >= sheet.rows.length) throw new Error('Cannot delete all rows');
    sheet.rows.splice(operation.atIndex, operation.count);
  } else if (operation.type === 'insertColumns') {
    if (operation.atIndex > sheet.columns.length) throw new Error('Invalid column insertion index');
    sheet.columns.splice(
      operation.atIndex,
      0,
      ...Array.from({ length: operation.count }, (_, offset) => ({
        key: `col_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
        header: columnLetters(operation.atIndex + offset),
      }))
    );
  } else {
    if (operation.atIndex + operation.count > sheet.columns.length)
      throw new Error('Invalid column deletion range');
    if (operation.count >= sheet.columns.length) throw new Error('Cannot delete all columns');
    const keys = new Set(
      sheet.columns
        .slice(operation.atIndex, operation.atIndex + operation.count)
        .map((column) => column.key)
    );
    sheet.columns.splice(operation.atIndex, operation.count);
    for (const row of sheet.rows) for (const key of keys) delete row.cells[key];
  }
  for (const formulaSheet of schema.sheets) {
    for (const row of formulaSheet.rows || []) {
      for (const cell of Object.values(row.cells || {})) {
        if (typeof cell.formula === 'string')
          cell.formula = transformFormula(cell.formula, formulaSheet.name, sheet.name, transform);
      }
    }
  }
  return transform;
}

function applySheet(
  schema: WorkbookSchema,
  operation: Extract<
    WorkbookMutation,
    {
      type:
        | 'addSheet'
        | 'renameSheet'
        | 'duplicateSheet'
        | 'deleteSheet'
        | 'reorderSheet'
        | 'setSheetHidden';
    }
  >
): string | undefined {
  if (operation.type === 'addSheet') {
    const name = uniqueSheetName(schema, operation.name || 'Arkusz');
    const index =
      operation.afterIndex === undefined ? schema.sheets.length : operation.afterIndex + 1;
    if (!Number.isInteger(index) || index < 0 || index > schema.sheets.length)
      throw new Error('Invalid sheet insertion index');
    const id = validSheetId(operation.sheetId);
    if (schema.sheets.some((item) => item.id === id)) throw new Error('Duplicate sheet id');
    schema.sheets.splice(index, 0, blankSheet(name, id));
    return;
  }
  const index = schema.sheets.findIndex((item) => item.id === operation.sheetId);
  if (index < 0) throw new Error('Unknown sheetId');
  const sheet = schema.sheets[index];
  if (operation.type === 'renameSheet')
    sheet.name = uniqueSheetName(schema, operation.name, sheet.id);
  else if (operation.type === 'duplicateSheet') {
    const clone = JSON.parse(JSON.stringify(sheet)) as typeof sheet;
    clone.id = validSheetId(operation.newSheetId);
    if (schema.sheets.some((item) => item.id === clone.id)) throw new Error('Duplicate sheet id');
    clone.name = uniqueSheetName(schema, operation.name || `${sheet.name} kopia`);
    clone.hidden = false;
    schema.sheets.splice(index + 1, 0, clone);
  } else if (operation.type === 'deleteSheet') {
    if (schema.sheets.length === 1) throw new Error('Cannot delete the last sheet');
    schema.sheets.splice(index, 1);
    return operation.sheetId;
  } else if (operation.type === 'reorderSheet') {
    if (
      !Number.isInteger(operation.targetIndex) ||
      operation.targetIndex < 0 ||
      operation.targetIndex >= schema.sheets.length
    )
      throw new Error('Invalid targetIndex');
    schema.sheets.splice(index, 1);
    schema.sheets.splice(operation.targetIndex, 0, sheet);
  } else if (operation.type === 'setSheetHidden') {
    if (
      operation.hidden &&
      !sheet.hidden &&
      schema.sheets.filter((item) => !item.hidden).length <= 1
    )
      throw new Error('Cannot hide the last visible sheet');
    sheet.hidden = operation.hidden;
  }
}

export function applyWorkbookMutations(
  schema: WorkbookSchema,
  operations: WorkbookMutation[]
): {
  orphanedSheetIds: string[];
  anchorTransforms: WorkbookAnchorTransform[];
} {
  for (const sheet of schema.sheets ?? []) {
    if (!sheet.id) sheet.id = uuidv4();
  }
  const orphanedSheetIds: string[] = [];
  const anchorTransforms: WorkbookAnchorTransform[] = [];
  for (const operation of operations) {
    if (!operation || !ALLOWED_TYPES.has(operation.type))
      throw new Error('Unsupported operation type');
    switch (operation.type) {
      case 'setCell':
      case 'clearCell':
        applyCell(schema, operation);
        break;
      case 'setCellStyle':
        applyStyle(schema, operation);
        break;
      case 'setColumn':
        applyColumn(schema, operation);
        break;
      case 'insertRows':
      case 'deleteRows':
      case 'insertColumns':
      case 'deleteColumns':
        anchorTransforms.push(applyAxis(schema, operation));
        break;
      default: {
        const orphaned = applySheet(schema, operation);
        if (orphaned) orphanedSheetIds.push(orphaned);
      }
    }
  }
  return { orphanedSheetIds, anchorTransforms };
}
