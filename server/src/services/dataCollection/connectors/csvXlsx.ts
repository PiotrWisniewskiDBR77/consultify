/**
 * CSV/XLSX Connector — implements IConnector for local CSV and XLSX files.
 * Reuses parseCSV and inferFieldTypes from CsvImportService.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import type {
  IConnector,
  ExternalSchema,
  ExternalRecord,
  FetchOptions,
} from '../connectorFramework.js';
import { parseCSV, inferFieldTypes } from '../../tablePlatform/CsvImportService.js';

const SAMPLE_SIZE = 100;

function resolveFilePath(config: Record<string, unknown>): string {
  const filePath = config.filePath as string | undefined;
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('config.filePath is required');
  }
  return path.resolve(filePath);
}

function isXlsx(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.xlsx', '.xls', '.xlsb', '.xlsm'].includes(ext);
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function csvFetchSchema(content: string): ExternalSchema {
  const { headers, rows } = parseCSV(content);
  const sample = rows.slice(0, SAMPLE_SIZE);
  const inferred = inferFieldTypes(headers, sample);

  return {
    tables: [
      {
        name: 'Sheet1',
        fields: inferred.map((f, i) => ({
          name: f.name,
          externalType: 'string',
          inferredType: f.fieldType,
          sample: sample[0]?.[i] ?? null,
        })),
      },
    ],
  };
}

function csvFetchRecords(
  content: string,
  options?: FetchOptions
): ExternalRecord[] {
  const { headers, rows } = parseCSV(content);
  let data = rows;

  if (options?.offset) {
    data = data.slice(options.offset);
  }
  if (options?.limit) {
    data = data.slice(0, options.limit);
  }

  return data.map((row) => {
    const record: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) {
      record[headers[i]] = row[i] ?? null;
    }
    return { data: record };
  });
}

// ---------------------------------------------------------------------------
// XLSX helpers
// ---------------------------------------------------------------------------

function xlsxFetchSchema(filePath: string, config: Record<string, unknown>): ExternalSchema {
  const workbook = XLSX.readFile(filePath);
  const sheetName = (config.sheetName as string) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' not found in workbook`);
  }

  const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  if (jsonData.length === 0) {
    return { tables: [{ name: sheetName, fields: [] }] };
  }

  const headers = (jsonData[0] || []).map((h) => String(h ?? '').trim() || 'Column');
  const dataRows = jsonData.slice(1, SAMPLE_SIZE + 1).map((row) =>
    row.map((cell) => String(cell ?? ''))
  );

  const inferred = inferFieldTypes(headers, dataRows);

  return {
    tables: [
      {
        name: sheetName,
        fields: inferred.map((f, i) => ({
          name: f.name,
          externalType: 'string',
          inferredType: f.fieldType,
          sample: dataRows[0]?.[i] ?? null,
        })),
      },
    ],
  };
}

function xlsxFetchRecords(
  filePath: string,
  config: Record<string, unknown>,
  options?: FetchOptions
): ExternalRecord[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = (config.sheetName as string) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' not found in workbook`);
  }

  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  let records = jsonData;

  if (options?.offset) {
    records = records.slice(options.offset);
  }
  if (options?.limit) {
    records = records.slice(0, options.limit);
  }

  return records.map((row) => ({
    data: row,
  }));
}

// ---------------------------------------------------------------------------
// CsvXlsxConnector
// ---------------------------------------------------------------------------

export const csvXlsxConnector: IConnector = {
  type: 'csv_xlsx',

  async testConnection(config: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
    try {
      const resolved = resolveFilePath(config);
      await fs.promises.access(resolved, fs.constants.R_OK);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },

  async fetchSchema(config: Record<string, unknown>): Promise<ExternalSchema> {
    const resolved = resolveFilePath(config);

    if (isXlsx(resolved)) {
      return xlsxFetchSchema(resolved, config);
    }

    const content = await fs.promises.readFile(resolved, 'utf-8');
    return csvFetchSchema(content);
  },

  async fetchRecords(
    config: Record<string, unknown>,
    options?: FetchOptions
  ): Promise<ExternalRecord[]> {
    const resolved = resolveFilePath(config);

    if (isXlsx(resolved)) {
      return xlsxFetchRecords(resolved, config, options);
    }

    const content = await fs.promises.readFile(resolved, 'utf-8');
    return csvFetchRecords(content, options);
  },
};

export default csvXlsxConnector;
