/**
 * Google Sheets Connector — reads spreadsheet data via Google Sheets API v4.
 * Uses native fetch (Node 18+); no googleapis package required.
 */

import logger from '../../../utils/Logger.js';
import type {
  ExternalRecord,
  ExternalSchema,
  FetchOptions,
  IConnector,
} from '../connectorFramework.js';
import { inferFieldType } from '../schemaMappingEngine.js';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SAMPLE_SIZE = 100;

interface GoogleSheetsConfig {
  spreadsheetId: string;
  apiKey?: string;
  serviceAccountJson?: string;
  sheetName?: string;
}

function parseConfig(config: Record<string, unknown>): GoogleSheetsConfig {
  const spreadsheetId = config.spreadsheetId as string | undefined;
  if (!spreadsheetId || typeof spreadsheetId !== 'string') {
    throw new Error('config.spreadsheetId is required');
  }
  return {
    spreadsheetId,
    apiKey: config.apiKey as string | undefined,
    serviceAccountJson: config.serviceAccountJson as string | undefined,
    sheetName: config.sheetName as string | undefined,
  };
}

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
    token_uri?: string;
  };

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  ).toString('base64url');

  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(sa.private_key, 'base64url');

  const jwt = `${header}.${payload}.${signature}`;

  const tokenUri = sa.token_uri ?? 'https://oauth2.googleapis.com/token';
  const resp = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to obtain access token: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as { access_token: string };
  return data.access_token;
}

async function buildHeaders(
  cfg: GoogleSheetsConfig
): Promise<{ headers: Record<string, string>; query: string }> {
  if (cfg.serviceAccountJson) {
    const token = await getAccessToken(cfg.serviceAccountJson);
    return { headers: { Authorization: `Bearer ${token}` }, query: '' };
  }
  if (cfg.apiKey) {
    return { headers: {}, query: `?key=${encodeURIComponent(cfg.apiKey)}` };
  }
  throw new Error('Either apiKey or serviceAccountJson must be provided');
}

async function sheetsGet(url: string, cfg: GoogleSheetsConfig): Promise<unknown> {
  const { headers, query } = await buildHeaders(cfg);
  const fullUrl = url + (url.includes('?') ? `&${query.slice(1)}` : query);
  const resp = await fetch(fullUrl, { headers });

  if (resp.status === 429) {
    throw new Error('Google Sheets API rate limit exceeded. Try again later.');
  }
  if (resp.status === 401 || resp.status === 403) {
    const text = await resp.text();
    throw new Error(`Authentication failed (${resp.status}): ${text}`);
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google Sheets API error ${resp.status}: ${text}`);
  }

  return resp.json();
}

function inferTypeFromValues(values: unknown[]): string {
  return inferFieldType('string', values);
}

export const googleSheetsConnector: IConnector = {
  type: 'google_sheets',

  async testConnection(
    config: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const cfg = parseConfig(config);
      await sheetsGet(`${SHEETS_API}/${cfg.spreadsheetId}`, cfg);
      return { success: true };
    } catch (e) {
      logger.warn('[GoogleSheetsConnector] testConnection failed', {
        error: (e as Error).message,
      });
      return { success: false, error: (e as Error).message };
    }
  },

  async fetchSchema(config: Record<string, unknown>): Promise<ExternalSchema> {
    const cfg = parseConfig(config);

    const meta = (await sheetsGet(
      `${SHEETS_API}/${cfg.spreadsheetId}?includeGridData=false`,
      cfg
    )) as {
      sheets: Array<{ properties: { title: string; sheetId: number } }>;
    };

    const sheetNames = cfg.sheetName ? [cfg.sheetName] : meta.sheets.map((s) => s.properties.title);

    const tables: ExternalSchema['tables'] = [];

    for (const name of sheetNames) {
      try {
        const range = `${name}!1:${SAMPLE_SIZE + 1}`;
        const data = (await sheetsGet(
          `${SHEETS_API}/${cfg.spreadsheetId}/values/${encodeURIComponent(range)}`,
          cfg
        )) as { values?: string[][] };

        const rows = data.values ?? [];
        if (rows.length === 0) {
          tables.push({ name, fields: [] });
          continue;
        }

        const headers = rows[0].map((h) => String(h ?? '').trim() || 'Column');
        const dataRows = rows.slice(1);

        const fields = headers.map((header, colIdx) => {
          const sampleVals = dataRows
            .slice(0, SAMPLE_SIZE)
            .map((row) => row[colIdx])
            .filter((v) => v != null && v !== '');
          return {
            name: header,
            externalType: 'string',
            inferredType: inferTypeFromValues(sampleVals),
            sample: sampleVals[0] ?? null,
          };
        });

        tables.push({ name, fields });
      } catch (e) {
        logger.warn(`[GoogleSheetsConnector] failed to read sheet "${name}"`, {
          error: (e as Error).message,
        });
        tables.push({ name, fields: [] });
      }
    }

    return { tables };
  },

  async fetchRecords(
    config: Record<string, unknown>,
    options?: FetchOptions
  ): Promise<ExternalRecord[]> {
    const cfg = parseConfig(config);

    const meta = (await sheetsGet(
      `${SHEETS_API}/${cfg.spreadsheetId}?includeGridData=false`,
      cfg
    )) as {
      sheets: Array<{ properties: { title: string } }>;
    };

    const sheetName = cfg.sheetName ?? meta.sheets[0]?.properties.title ?? 'Sheet1';

    const data = (await sheetsGet(
      `${SHEETS_API}/${cfg.spreadsheetId}/values/${encodeURIComponent(sheetName)}`,
      cfg
    )) as { values?: string[][] };

    const rows = data.values ?? [];
    if (rows.length <= 1) return [];

    const headers = rows[0].map((h) => String(h ?? '').trim() || 'Column');
    let dataRows = rows.slice(1);

    if (options?.offset) {
      dataRows = dataRows.slice(options.offset);
    }
    if (options?.limit) {
      dataRows = dataRows.slice(0, options.limit);
    }

    return dataRows.map((row, idx) => {
      const record: Record<string, unknown> = {};
      for (let i = 0; i < headers.length; i++) {
        record[headers[i]] = row[i] ?? null;
      }
      return {
        externalId: `row_${(options?.offset ?? 0) + idx + 2}`,
        data: record,
      };
    });
  },
};

export default googleSheetsConnector;
