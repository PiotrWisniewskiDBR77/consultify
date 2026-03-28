/**
 * PostgreSQL Connector — reads schema and records from an external PostgreSQL database.
 * Uses a SEPARATE pg.Pool — never reuses the application's database pool.
 */

import { Pool } from 'pg';

import logger from '../../../utils/Logger.js';
import type {
  ExternalRecord,
  ExternalSchema,
  FetchOptions,
  IConnector,
} from '../connectorFramework.js';

interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema?: string;
  table: string;
  query?: string;
}

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function sanitizeIdentifier(name: string): string {
  if (!IDENTIFIER_RE.test(name)) {
    throw new Error(
      `Invalid identifier: "${name}". Only alphanumeric characters and underscores are allowed.`
    );
  }
  return `"${name}"`;
}

function parseConfig(config: Record<string, unknown>): PostgresConfig {
  const host = config.host as string | undefined;
  const database = config.database as string | undefined;
  const user = config.user as string | undefined;
  const password = config.password as string | undefined;
  const table = config.table as string | undefined;

  if (!host || typeof host !== 'string') throw new Error('config.host is required');
  if (!database || typeof database !== 'string') throw new Error('config.database is required');
  if (!user || typeof user !== 'string') throw new Error('config.user is required');
  if (!password || typeof password !== 'string') throw new Error('config.password is required');
  if (!table || typeof table !== 'string') {
    if (!config.query) throw new Error('config.table is required (or provide config.query)');
  }

  return {
    host,
    port: Number(config.port) || 5432,
    database,
    user,
    password,
    schema: (config.schema as string) || 'public',
    table: table ?? '',
    query: config.query as string | undefined,
  };
}

function createPool(cfg: PostgresConfig): Pool {
  return new Pool({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    max: 3,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
}

const PG_TYPE_MAP: Record<string, string> = {
  varchar: 'singleLineText',
  'character varying': 'singleLineText',
  text: 'singleLineText',
  char: 'singleLineText',
  character: 'singleLineText',
  name: 'singleLineText',
  integer: 'number',
  int4: 'number',
  bigint: 'number',
  int8: 'number',
  smallint: 'number',
  int2: 'number',
  serial: 'number',
  bigserial: 'number',
  numeric: 'number',
  decimal: 'number',
  real: 'number',
  float4: 'number',
  'double precision': 'number',
  float8: 'number',
  money: 'currency',
  boolean: 'checkbox',
  bool: 'checkbox',
  date: 'date',
  timestamp: 'date',
  'timestamp without time zone': 'date',
  'timestamp with time zone': 'date',
  timestamptz: 'date',
  json: 'longText',
  jsonb: 'longText',
  uuid: 'singleLineText',
  inet: 'singleLineText',
  cidr: 'singleLineText',
  macaddr: 'singleLineText',
  bytea: 'singleLineText',
  xml: 'longText',
  'USER-DEFINED': 'singleLineText',
  ARRAY: 'longText',
};

function mapPgType(pgType: string): string {
  return PG_TYPE_MAP[pgType.toLowerCase()] ?? 'singleLineText';
}

export const postgresConnector: IConnector = {
  type: 'postgres',

  async testConnection(
    config: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    let pool: Pool | undefined;
    try {
      const cfg = parseConfig(config);
      pool = createPool(cfg);
      await pool.query('SELECT 1');
      return { success: true };
    } catch (e) {
      logger.warn('[PostgresConnector] testConnection failed', {
        error: (e as Error).message,
      });
      return { success: false, error: (e as Error).message };
    } finally {
      if (pool) await pool.end().catch(() => {});
    }
  },

  async fetchSchema(config: Record<string, unknown>): Promise<ExternalSchema> {
    const cfg = parseConfig(config);
    const pool = createPool(cfg);

    try {
      const schemaName = cfg.schema ?? 'public';
      sanitizeIdentifier(schemaName);

      const tableName = cfg.table;
      if (tableName) sanitizeIdentifier(tableName);

      let query = `
        SELECT table_name, column_name, data_type, udt_name, is_nullable,
               character_maximum_length, column_default
        FROM information_schema.columns
        WHERE table_schema = $1
      `;
      const params: unknown[] = [schemaName];

      if (tableName) {
        query += ' AND table_name = $2';
        params.push(tableName);
      }

      query += ' ORDER BY table_name, ordinal_position';

      const result = await pool.query(query, params);

      const tableMap = new Map<
        string,
        Array<{ name: string; externalType: string; inferredType: string }>
      >();

      for (const row of result.rows) {
        const tName = row.table_name as string;
        if (!tableMap.has(tName)) {
          tableMap.set(tName, []);
        }
        tableMap.get(tName)!.push({
          name: row.column_name as string,
          externalType: row.data_type as string,
          inferredType: mapPgType(row.data_type as string),
        });
      }

      return {
        tables: Array.from(tableMap.entries()).map(([name, fields]) => ({
          name,
          fields,
        })),
      };
    } finally {
      await pool.end().catch(() => {});
    }
  },

  async fetchRecords(
    config: Record<string, unknown>,
    options?: FetchOptions
  ): Promise<ExternalRecord[]> {
    const cfg = parseConfig(config);
    const pool = createPool(cfg);

    try {
      const limit = options?.limit ?? 1000;
      const offset = options?.offset ?? 0;

      let query: string;
      let params: unknown[];

      if (cfg.query) {
        query = `SELECT * FROM (${cfg.query}) AS _subq LIMIT $1 OFFSET $2`;
        params = [limit, offset];
      } else {
        const schemaId = sanitizeIdentifier(cfg.schema ?? 'public');
        const tableId = sanitizeIdentifier(cfg.table);
        query = `SELECT * FROM ${schemaId}.${tableId} LIMIT $1 OFFSET $2`;
        params = [limit, offset];
      }

      const result = await pool.query(query, params);

      return result.rows.map((row: Record<string, unknown>) => {
        const id = (row.id as string) ?? (row.uuid as string) ?? (row._id as string) ?? undefined;
        return {
          externalId: id ? String(id) : undefined,
          data: row,
        };
      });
    } finally {
      await pool.end().catch(() => {});
    }
  },
};

export default postgresConnector;
