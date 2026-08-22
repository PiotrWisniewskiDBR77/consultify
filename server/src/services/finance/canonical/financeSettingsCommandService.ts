import crypto from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import { type PgTransactionClient, withPgTransaction } from '../../../utils/queryHelpers.js';

export type FinanceSettings = {
  defaultWacc: number;
  defaultCurrency: string;
  defaultHorizonYears: number;
};

export type FinanceSettingsState = FinanceSettings & { version: number };

const DEFAULTS: FinanceSettings = {
  defaultWacc: 12,
  defaultCurrency: 'PLN',
  defaultHorizonYears: 5,
};

export class FinanceSettingsCommandError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FinanceSettingsCommandError';
  }
}

type StateRow = { version: number; settings_json: unknown };
type ReceiptRow = { receipt_id: string; request_hash: string; response_json: unknown };
let testFaultInjector: (() => void | Promise<void>) | null = null;

export function setFinanceSettingsCommandFaultInjectorForTests(
  injector: (() => void | Promise<void>) | null
): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('Fault injection is test-only');
  testFaultInjector = injector;
}

function parseObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeSettings(value: unknown, base: FinanceSettings = DEFAULTS): FinanceSettings {
  const input = parseObject(value);
  const unknownKeys = Object.keys(input).filter(
    (key) => !['defaultWacc', 'defaultCurrency', 'defaultHorizonYears'].includes(key)
  );
  if (unknownKeys.length) {
    throw new FinanceSettingsCommandError('FINANCE_SETTINGS_INVALID', 400, 'Unknown setting', {
      keys: unknownKeys,
    });
  }
  const defaultWacc = input.defaultWacc == null ? base.defaultWacc : Number(input.defaultWacc);
  const defaultCurrency = String(input.defaultCurrency ?? base.defaultCurrency)
    .trim()
    .toUpperCase();
  const defaultHorizonYears =
    input.defaultHorizonYears == null
      ? base.defaultHorizonYears
      : Number(input.defaultHorizonYears);
  if (!Number.isFinite(defaultWacc) || defaultWacc < 0 || defaultWacc > 100) {
    throw new FinanceSettingsCommandError(
      'FINANCE_SETTINGS_INVALID',
      400,
      'defaultWacc must be between 0 and 100'
    );
  }
  if (!/^[A-Z]{3}$/.test(defaultCurrency)) {
    throw new FinanceSettingsCommandError(
      'FINANCE_SETTINGS_INVALID',
      400,
      'defaultCurrency must be a three-letter ISO currency code'
    );
  }
  if (
    !Number.isInteger(defaultHorizonYears) ||
    defaultHorizonYears < 1 ||
    defaultHorizonYears > 50
  ) {
    throw new FinanceSettingsCommandError(
      'FINANCE_SETTINGS_INVALID',
      400,
      'defaultHorizonYears must be an integer between 1 and 50'
    );
  }
  return { defaultWacc, defaultCurrency, defaultHorizonYears };
}

function normalizePatch(value: unknown): Partial<FinanceSettings> {
  const input = parseObject(value);
  const normalized = normalizeSettings(input);
  const patch: Partial<FinanceSettings> = {};
  if ('defaultWacc' in input) patch.defaultWacc = normalized.defaultWacc;
  if ('defaultCurrency' in input) patch.defaultCurrency = normalized.defaultCurrency;
  if ('defaultHorizonYears' in input) patch.defaultHorizonYears = normalized.defaultHorizonYears;
  return patch;
}

function hashRequest(parentVersion: number, patch: Partial<FinanceSettings>): string {
  return crypto.createHash('sha256').update(JSON.stringify({ parentVersion, patch })).digest('hex');
}

function stateFromRow(row: StateRow): FinanceSettingsState {
  return { ...normalizeSettings(row.settings_json), version: Number(row.version) };
}

async function legacySettings(tx: PgTransactionClient, organizationId: string) {
  const result = await tx.query<{ setting_value: unknown }>(
    `SELECT setting_value FROM organization_settings
      WHERE organization_id = ? AND setting_key = 'finance'`,
    [organizationId]
  );
  return normalizeSettings(result.rows[0]?.setting_value);
}

export async function readCanonicalFinanceSettings(
  organizationId: string
): Promise<FinanceSettingsState> {
  return withPgTransaction(async (tx) => {
    const org = await tx.query(`SELECT id FROM organizations WHERE id = ?`, [organizationId]);
    if (!org.rows[0]) {
      throw new FinanceSettingsCommandError(
        'ORGANIZATION_NOT_FOUND',
        404,
        'Organization not found'
      );
    }
    const state = await tx.query<StateRow>(
      `SELECT version, settings_json FROM finance_settings_states WHERE organization_id = ?`,
      [organizationId]
    );
    return state.rows[0]
      ? stateFromRow(state.rows[0])
      : { ...(await legacySettings(tx, organizationId)), version: 0 };
  });
}

export async function updateCanonicalFinanceSettings(input: {
  organizationId: string;
  actorId: string;
  idempotencyKey: string;
  expectedVersion: number;
  patch: unknown;
}): Promise<{ state: FinanceSettingsState; receiptId: string; idempotentReplay: boolean }> {
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey || idempotencyKey.length > 200) {
    throw new FinanceSettingsCommandError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'A bounded idempotency key is required'
    );
  }
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) {
    throw new FinanceSettingsCommandError(
      'EXPECTED_VERSION_REQUIRED',
      400,
      'expectedVersion must be a non-negative integer'
    );
  }
  const patch = normalizePatch(input.patch);

  return withPgTransaction(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext(?), hashtext('finance-settings'))`, [
      input.organizationId,
    ]);
    const org = await tx.query(`SELECT id FROM organizations WHERE id = ?`, [input.organizationId]);
    if (!org.rows[0]) {
      throw new FinanceSettingsCommandError(
        'ORGANIZATION_NOT_FOUND',
        404,
        'Organization not found'
      );
    }
    const existingState = await tx.query<StateRow>(
      `SELECT version, settings_json FROM finance_settings_states
        WHERE organization_id = ? FOR UPDATE`,
      [input.organizationId]
    );
    const current = existingState.rows[0]
      ? stateFromRow(existingState.rows[0])
      : { ...(await legacySettings(tx, input.organizationId)), version: 0 };
    const settings = normalizeSettings(patch, current);
    const requestHash = hashRequest(input.expectedVersion, patch);
    const receipt = await tx.query<ReceiptRow>(
      `SELECT receipt_id, request_hash, response_json FROM finance_settings_command_receipts
        WHERE organization_id = ? AND idempotency_key = ?`,
      [input.organizationId, idempotencyKey]
    );
    if (receipt.rows[0]) {
      if (receipt.rows[0].request_hash !== requestHash) {
        throw new FinanceSettingsCommandError(
          'IDEMPOTENCY_KEY_COLLISION',
          409,
          'Idempotency key was already used for a different command'
        );
      }
      const replay = parseObject(receipt.rows[0].response_json) as FinanceSettingsState;
      return {
        state: replay,
        receiptId: receipt.rows[0].receipt_id,
        idempotentReplay: true,
      };
    }
    if (current.version !== input.expectedVersion) {
      throw new FinanceSettingsCommandError('VERSION_CONFLICT', 409, 'Version conflict', {
        currentVersion: current.version,
      });
    }

    const next: FinanceSettingsState = { ...settings, version: current.version + 1 };
    if (existingState.rows[0]) {
      await tx.query(
        `UPDATE finance_settings_states
            SET version = ?, settings_json = ?::jsonb, updated_by = ?, updated_at = NOW()
          WHERE organization_id = ? AND version = ?`,
        [
          next.version,
          JSON.stringify(settings),
          input.actorId,
          input.organizationId,
          current.version,
        ]
      );
    } else {
      await tx.query(
        `INSERT INTO finance_settings_states
           (organization_id, version, settings_json, created_by, updated_by)
         VALUES (?, 1, ?::jsonb, ?, ?)`,
        [input.organizationId, JSON.stringify(settings), input.actorId, input.actorId]
      );
    }
    await tx.query(
      `INSERT INTO organization_settings (organization_id, setting_key, setting_value, updated_at)
       VALUES (?, 'finance', ?, NOW())
       ON CONFLICT (organization_id, setting_key) DO UPDATE SET
         setting_value = EXCLUDED.setting_value,
         updated_at = EXCLUDED.updated_at`,
      [input.organizationId, JSON.stringify(settings)]
    );
    await testFaultInjector?.();
    const receiptId = uuidv4();
    await tx.query(
      `INSERT INTO finance_settings_command_receipts
         (receipt_id, organization_id, idempotency_key, request_hash, parent_version,
          resulting_version, response_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?)`,
      [
        receiptId,
        input.organizationId,
        idempotencyKey,
        requestHash,
        current.version,
        next.version,
        JSON.stringify(next),
        input.actorId,
      ]
    );
    return { state: next, receiptId, idempotentReplay: false };
  });
}
