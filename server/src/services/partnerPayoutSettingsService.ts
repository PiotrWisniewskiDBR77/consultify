import crypto from 'node:crypto';

import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { EncryptionService } from './encryption/EncryptionService.js';

export type PartnerPayoutMethod = 'BANK_TRANSFER' | 'PAYPAL' | 'STRIPE' | 'WISE';

export interface PartnerPayoutAccountDetails {
  accountHolderName: string;
  iban: string;
  bicSwift: string;
  bankName: string;
}

export interface PartnerPayoutSettings {
  minimumThreshold: number;
  payoutMethod: PartnerPayoutMethod;
  autoPayoutEnabled: boolean;
  payoutAccount: PartnerPayoutAccountDetails | null;
}

export interface UpdatePartnerPayoutSettingsInput {
  minimumThreshold?: number;
  payoutMethod?: PartnerPayoutMethod;
  autoPayoutEnabled?: boolean;
  payoutAccount?: Partial<PartnerPayoutAccountDetails> | null;
}

let payoutSchemaEnsured = false;

function normalizePayoutMethod(value: unknown): PartnerPayoutMethod {
  const candidate = String(value || 'BANK_TRANSFER')
    .trim()
    .toUpperCase();
  if (candidate === 'PAYPAL' || candidate === 'STRIPE' || candidate === 'WISE') {
    return candidate;
  }
  return 'BANK_TRANSFER';
}

function sanitizeAccountDetails(
  details?: Partial<PartnerPayoutAccountDetails> | null
): PartnerPayoutAccountDetails | null {
  if (!details) {
    return null;
  }

  const normalized = {
    accountHolderName: String(details.accountHolderName || '').trim(),
    iban: String(details.iban || '').trim(),
    bicSwift: String(details.bicSwift || '').trim(),
    bankName: String(details.bankName || '').trim(),
  };

  if (
    !normalized.accountHolderName &&
    !normalized.iban &&
    !normalized.bicSwift &&
    !normalized.bankName
  ) {
    return null;
  }

  return normalized;
}

function buildAccountDisplayName(details: PartnerPayoutAccountDetails): string {
  return details.bankName || details.accountHolderName || 'Primary payout account';
}

function getAccountLastFour(details: PartnerPayoutAccountDetails): string | null {
  const normalizedIban = details.iban.replace(/\s+/g, '');
  if (!normalizedIban) {
    return null;
  }
  return normalizedIban.slice(-4) || null;
}

function parseStoredPayoutAccount(
  rawValue: string | null | undefined
): PartnerPayoutAccountDetails | null {
  if (!rawValue || typeof rawValue !== 'string') return null;
  const normalizedRaw = rawValue.trim();
  if (!normalizedRaw) return null;

  const parseCandidate = (candidate: string): PartnerPayoutAccountDetails | null => {
    try {
      return sanitizeAccountDetails(JSON.parse(candidate));
    } catch {
      return null;
    }
  };

  // Preferred path: encrypted JSON payload.
  try {
    const decrypted = EncryptionService.decrypt(normalizedRaw);
    const parsed = parseCandidate(decrypted);
    if (parsed) return parsed;
  } catch {
    // Continue with legacy/plaintext fallback below.
  }

  // Legacy fallback: JSON stored without encryption.
  return parseCandidate(normalizedRaw);
}

async function ensurePartnerPayoutSchema(): Promise<void> {
  if (payoutSchemaEnsured) return;
  await DbPromise.exec(`
    ALTER TABLE partner_organizations ADD COLUMN IF NOT EXISTS payout_threshold NUMERIC(10,2) DEFAULT 100.00;
    ALTER TABLE partner_organizations ADD COLUMN IF NOT EXISTS payout_method VARCHAR(50) DEFAULT 'BANK_TRANSFER';
    ALTER TABLE partner_organizations ADD COLUMN IF NOT EXISTS auto_payout_enabled BOOLEAN DEFAULT FALSE;
    CREATE TABLE IF NOT EXISTS partner_payout_accounts (
      id TEXT PRIMARY KEY,
      partner_org_id TEXT NOT NULL,
      payout_method VARCHAR(50) NOT NULL,
      account_details_encrypted TEXT NOT NULL,
      account_name TEXT,
      account_last_four TEXT,
      currency VARCHAR(10) DEFAULT 'EUR',
      is_primary BOOLEAN DEFAULT FALSE,
      is_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  payoutSchemaEnsured = true;
}

/**
 * P29-C: partner może żądać fazy payout tylko przy kompletnej destynacji wypłaty (FINAL 29 §2.3.6).
 */
export function isPartnerPayoutDestinationComplete(settings: PartnerPayoutSettings): boolean {
  const acc = settings.payoutAccount;
  if (!acc) return false;
  const holder = acc.accountHolderName?.trim();
  const iban = acc.iban?.replace(/\s+/g, '').trim();
  if (settings.payoutMethod === 'BANK_TRANSFER') {
    return Boolean(holder && iban);
  }
  return Boolean(holder);
}

export async function getPartnerPayoutSettings(
  partnerOrgId: string
): Promise<PartnerPayoutSettings> {
  await ensurePartnerPayoutSchema();
  const db = getDatabase();

  const [orgRow, accountRows] = await Promise.all([
    DbPromise.get<{
      payout_threshold?: number | null;
      payout_method?: string | null;
      auto_payout_enabled?: number | boolean | null;
    }>(
      db,
      `SELECT payout_threshold, payout_method, auto_payout_enabled
       FROM partner_organizations
       WHERE id = ?`,
      [partnerOrgId],
      { fallback: false }
    ),
    DbPromise.all<{
      id: string;
      account_details_encrypted?: string | null;
      payout_method?: string | null;
      is_primary?: boolean | number | null;
      updated_at?: string | null;
    }>(
      db,
      `SELECT id, account_details_encrypted, payout_method, is_primary, updated_at
       FROM partner_payout_accounts
       WHERE partner_org_id = ?
       ORDER BY is_primary DESC, updated_at DESC, created_at DESC`,
      [partnerOrgId],
      { fallback: false }
    ),
  ]);

  const decryptedAccount =
    accountRows
      .map((row) => parseStoredPayoutAccount(row.account_details_encrypted))
      .find((account): account is PartnerPayoutAccountDetails => Boolean(account)) || null;

  return {
    minimumThreshold: Number(orgRow?.payout_threshold ?? 100),
    payoutMethod: normalizePayoutMethod(orgRow?.payout_method),
    autoPayoutEnabled: false,
    payoutAccount: decryptedAccount,
  };
}

export async function updatePartnerPayoutSettings(
  partnerOrgId: string,
  input: UpdatePartnerPayoutSettingsInput
): Promise<PartnerPayoutSettings> {
  await ensurePartnerPayoutSchema();
  const db = getDatabase();

  const minimumThreshold = Number.isFinite(Number(input.minimumThreshold))
    ? Number(input.minimumThreshold)
    : 100;
  const payoutMethod = normalizePayoutMethod(input.payoutMethod);
  // Commercial owner decision fixes MVP to manual payout requests only.
  const autoPayoutEnabled = false;
  const payoutAccount = sanitizeAccountDetails(input.payoutAccount);

  await DbPromise.run(
    db,
    `UPDATE partner_organizations
     SET payout_threshold = ?, payout_method = ?, auto_payout_enabled = ?, updated_at = NOW()
     WHERE id = ?`,
    [minimumThreshold, payoutMethod, autoPayoutEnabled, partnerOrgId],
    { fallback: false }
  );

  if (payoutAccount) {
    const encryptedDetails = EncryptionService.encrypt(JSON.stringify(payoutAccount));
    const accountName = buildAccountDisplayName(payoutAccount);
    const accountLastFour = getAccountLastFour(payoutAccount);

    // Keep one canonical primary record to avoid nondeterministic reads
    // when historical duplicated primary rows exist.
    const tx = await DbPromise.transaction([
      {
        sql: `UPDATE partner_payout_accounts
              SET is_primary = FALSE, updated_at = NOW()
              WHERE partner_org_id = ? AND is_primary = TRUE`,
        params: [partnerOrgId],
      },
      {
        sql: `INSERT INTO partner_payout_accounts
                (id, partner_org_id, payout_method, account_details_encrypted, account_name,
                 account_last_four, currency, is_primary, is_verified, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 'EUR', TRUE, FALSE, NOW(), NOW())`,
        params: [
          crypto.randomUUID(),
          partnerOrgId,
          payoutMethod,
          encryptedDetails,
          accountName,
          accountLastFour,
        ],
      },
    ]);
    if (!tx.success) {
      throw new Error(tx.error || 'Failed to persist payout account');
    }
  }

  logger.info('[PartnerPayoutSettingsService] Updated payout settings', { partnerOrgId });
  return getPartnerPayoutSettings(partnerOrgId);
}
