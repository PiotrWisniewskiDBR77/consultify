/**
 * Airtable Connector — reads base metadata and records via Airtable REST API.
 * Uses native fetch (Node 18+); no airtable package required.
 */

import type {
  IConnector,
  ExternalSchema,
  ExternalRecord,
  FetchOptions,
} from '../connectorFramework.js';
import logger from '../../../utils/Logger.js';

const AIRTABLE_API = 'https://api.airtable.com/v0';
const AIRTABLE_META_API = 'https://api.airtable.com/v0/meta/bases';
const DEFAULT_PAGE_SIZE = 100;

interface AirtableConfig {
  baseId: string;
  apiToken: string;
  tableName?: string;
}

function parseConfig(config: Record<string, unknown>): AirtableConfig {
  const baseId = config.baseId as string | undefined;
  const apiToken = config.apiToken as string | undefined;
  if (!baseId || typeof baseId !== 'string') {
    throw new Error('config.baseId is required');
  }
  if (!apiToken || typeof apiToken !== 'string') {
    throw new Error('config.apiToken is required');
  }
  return {
    baseId,
    apiToken,
    tableName: config.tableName as string | undefined,
  };
}

const AIRTABLE_TYPE_MAP: Record<string, string> = {
  singleLineText: 'singleLineText',
  multilineText: 'longText',
  number: 'number',
  currency: 'currency',
  percent: 'percent',
  checkbox: 'checkbox',
  date: 'date',
  dateTime: 'date',
  singleSelect: 'singleSelect',
  multipleSelects: 'multiSelect',
  url: 'url',
  email: 'email',
  phoneNumber: 'phone',
  multipleRecordLinks: 'linkedRecord',
  multipleAttachments: 'attachment',
  formula: 'formula',
  rollup: 'rollup',
  count: 'count',
  lookup: 'lookup',
  richText: 'longText',
  rating: 'number',
  duration: 'number',
  autoNumber: 'number',
  barcode: 'singleLineText',
  createdTime: 'date',
  lastModifiedTime: 'date',
  createdBy: 'singleLineText',
  lastModifiedBy: 'singleLineText',
  button: 'singleLineText',
  externalSyncSource: 'singleLineText',
};

function mapAirtableType(airtableType: string): string {
  return AIRTABLE_TYPE_MAP[airtableType] ?? 'singleLineText';
}

async function airtableGet(
  url: string,
  token: string
): Promise<unknown> {
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (resp.status === 429) {
    throw new Error('Airtable API rate limit exceeded (30 req/sec). Try again later.');
  }
  if (resp.status === 401 || resp.status === 403) {
    const text = await resp.text();
    throw new Error(`Airtable authentication failed (${resp.status}): ${text}`);
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Airtable API error ${resp.status}: ${text}`);
  }

  return resp.json();
}

export const airtableConnector: IConnector = {
  type: 'airtable',

  async testConnection(
    config: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const cfg = parseConfig(config);
      await airtableGet(
        `${AIRTABLE_META_API}/${cfg.baseId}/tables`,
        cfg.apiToken
      );
      return { success: true };
    } catch (e) {
      logger.warn('[AirtableConnector] testConnection failed', {
        error: (e as Error).message,
      });
      return { success: false, error: (e as Error).message };
    }
  },

  async fetchSchema(config: Record<string, unknown>): Promise<ExternalSchema> {
    const cfg = parseConfig(config);

    const meta = (await airtableGet(
      `${AIRTABLE_META_API}/${cfg.baseId}/tables`,
      cfg.apiToken
    )) as {
      tables: Array<{
        id: string;
        name: string;
        fields: Array<{
          id: string;
          name: string;
          type: string;
          options?: Record<string, unknown>;
        }>;
      }>;
    };

    const filteredTables = cfg.tableName
      ? meta.tables.filter((t) => t.name === cfg.tableName)
      : meta.tables;

    return {
      tables: filteredTables.map((table) => ({
        name: table.name,
        externalId: table.id,
        fields: table.fields.map((field) => ({
          name: field.name,
          externalType: field.type,
          inferredType: mapAirtableType(field.type),
          sample: undefined,
        })),
      })),
    };
  },

  async fetchRecords(
    config: Record<string, unknown>,
    options?: FetchOptions
  ): Promise<ExternalRecord[]> {
    const cfg = parseConfig(config);

    if (!cfg.tableName) {
      const meta = (await airtableGet(
        `${AIRTABLE_META_API}/${cfg.baseId}/tables`,
        cfg.apiToken
      )) as { tables: Array<{ name: string }> };
      if (!meta.tables.length) {
        throw new Error('No tables found in Airtable base');
      }
      cfg.tableName = meta.tables[0].name;
    }

    const allRecords: ExternalRecord[] = [];
    let airtableOffset: string | undefined;
    const maxRecords = options?.limit ?? Infinity;
    const skipRecords = options?.offset ?? 0;

    do {
      const params = new URLSearchParams();
      params.set('pageSize', String(DEFAULT_PAGE_SIZE));
      if (airtableOffset) {
        params.set('offset', airtableOffset);
      }

      const page = (await airtableGet(
        `${AIRTABLE_API}/${cfg.baseId}/${encodeURIComponent(cfg.tableName)}?${params.toString()}`,
        cfg.apiToken
      )) as {
        records: Array<{
          id: string;
          fields: Record<string, unknown>;
          createdTime: string;
        }>;
        offset?: string;
      };

      for (const rec of page.records) {
        allRecords.push({
          externalId: rec.id,
          data: rec.fields,
        });
      }

      airtableOffset = page.offset;

      if (allRecords.length >= skipRecords + maxRecords) {
        break;
      }
    } while (airtableOffset);

    let result = allRecords;
    if (skipRecords > 0) {
      result = result.slice(skipRecords);
    }
    if (options?.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  },
};

export default airtableConnector;
