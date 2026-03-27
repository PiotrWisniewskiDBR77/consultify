import crypto from 'node:crypto';

import { getDatabase } from '../database/Database.js';
import { EncryptionService } from './encryption/EncryptionService.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

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

function normalizePayoutMethod(value: unknown): PartnerPayoutMethod {
  const candidate = String(value || 'BANK_TRANSFER').trim().toUpperCase();
  if (candidate === 'PAYPAL' || candidate === 'STRIPE' || candidate === 'WISE') {
    return candidate;
  }
  return 'BANK_TRANSFER';
}

function sanitizeAccountDetails(details?: Partial<PartnerPayoutAccountDetails> | null): PartnerPayoutAccountDetails | null {
  if (!details) {
    return null;
  }

  const normalized = {
    accountHolderName: String(details.accountHolderName || '').trim(),
    iban: String(details.iban || '').trim(),
    bicSwift: String(details.bicSwift || '').trim(),
    bankName: String(details.bankName || '').trim(),
  };

  if (!normalized.accountHolderName && !normalized.iban && !normalized.bicSwift && !normalized.bankName) {
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

export async function getPartnerPayoutSettings(partnerOrgId: string): Promise<PartnerPayoutSettings> {
  const db = getDatabase();

  const [orgRow, primaryAccount] = await Promise.all([
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
    ),
    DbPromise.get<{
      account_details_encrypted?: string | null;
    }>(
      db,
      `SELECT account_details_encrypted
       FROM partner_payout_accounts
       WHERE partner_org_id = ? AND is_primary = TRUE
       ORDER BY updated_at DESC
       LIMIT 1`,
      [partnerOrgId],
    ),
  ]);

  const decryptedAccount = primaryAccount?.account_details_encrypted
    ? sanitizeAccountDetails(
        JSON.parse(EncryptionService.decrypt(primaryAccount.account_details_encrypted)),
      )
    : null;

  return {
    minimumThreshold: Number(orgRow?.payout_threshold ?? 100),
    payoutMethod: normalizePayoutMethod(orgRow?.payout_method),
    autoPayoutEnabled: Boolean(orgRow?.auto_payout_enabled),
    payoutAccount: decryptedAccount,
  };
}

export async function updatePartnerPayoutSettings(
  partnerOrgId: string,
  input: UpdatePartnerPayoutSettingsInput,
): Promise<PartnerPayoutSettings> {
  const db = getDatabase();

  const minimumThreshold = Number.isFinite(Number(input.minimumThreshold))
    ? Number(input.minimumThreshold)
    : 100;
  const payoutMethod = normalizePayoutMethod(input.payoutMethod);
  const autoPayoutEnabled = Boolean(input.autoPayoutEnabled);
  const payoutAccount = sanitizeAccountDetails(input.payoutAccount);

  await DbPromise.run(
    db,
    `UPDATE partner_organizations
     SET payout_threshold = ?, payout_method = ?, auto_payout_enabled = ?, updated_at = NOW()
     WHERE id = ?`,
    [minimumThreshold, payoutMethod, autoPayoutEnabled, partnerOrgId],
  );

  if (payoutAccount) {
    const existingPrimary = await DbPromise.get<{ id: string }>(
      db,
      `SELECT id
       FROM partner_payout_accounts
       WHERE partner_org_id = ? AND is_primary = TRUE
       LIMIT 1`,
      [partnerOrgId],
    );

    const encryptedDetails = EncryptionService.encrypt(JSON.stringify(payoutAccount));
    const accountName = buildAccountDisplayName(payoutAccount);
    const accountLastFour = getAccountLastFour(payoutAccount);

    if (existingPrimary?.id) {
      await DbPromise.run(
        db,
        `UPDATE partner_payout_accounts
         SET payout_method = ?, account_details_encrypted = ?, account_name = ?, account_last_four = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [payoutMethod, encryptedDetails, accountName, accountLastFour, existingPrimary.id],
      );
    } else {
      await DbPromise.run(
        db,
        `INSERT INTO partner_payout_accounts
           (id, partner_org_id, payout_method, account_details_encrypted, account_name,
            account_last_four, currency, is_primary, is_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'EUR', TRUE, FALSE, NOW(), NOW())`,
        [
          crypto.randomUUID(),
          partnerOrgId,
          payoutMethod,
          encryptedDetails,
          accountName,
          accountLastFour,
        ],
      );
    }
  }

  logger.info('[PartnerPayoutSettingsService] Updated payout settings', { partnerOrgId });
  return getPartnerPayoutSettings(partnerOrgId);
}
