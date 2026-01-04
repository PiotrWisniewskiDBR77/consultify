/**
 * Token Billing Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Handles 3-tier token billing:
 * 1. Platform Tokens - Purchased from us with margin
 * 2. BYOK Tokens - User's own API keys with usage fee
 * 3. Local Tokens - Self-hosted LLMs with minimal fee
 * 
 * Migrated from server/services/tokenBillingService.js
 */

import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';
import * as crypto from 'crypto';

// ==========================================
// TYPES
// ==========================================

interface TokenBillingServiceDeps {
    db: IDatabase;
    uuidv4: () => string;
    crypto: typeof crypto;
}

interface BillingMargin {
    source_type: string;
    base_cost_per_1k: number;
    margin_percent: number;
    min_charge: number;
    is_active: boolean;
}

interface TokenPackage {
    id: string;
    name: string;
    description: string;
    tokens: number;
    price_usd: number;
    bonus_percent: number;
    is_popular: boolean;
    sort_order: number;
    stripe_price_id: string | null;
}

interface UserBalance {
    user_id: string;
    platform_tokens: number;
    platform_tokens_bonus: number;
    byok_usage_tokens: number;
    local_usage_tokens: number;
}

interface OrgBalance {
    balance: number;
    billingStatus: string;
    organizationType: string;
}

// Encryption key for API keys (should be in env)
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET || 'default-32-char-key-for-dev-only!';
const IV_LENGTH = 16;

// ==========================================
// CLASS IMPLEMENTATION
// ==========================================

export class TokenBillingServiceClass {
    #deps: TokenBillingServiceDeps | null = null;
    #initialized = false;
    #initPromise: Promise<void> | null = null;

    constructor(deps?: Partial<TokenBillingServiceDeps>) {
        if (deps?.db && deps?.uuidv4 && deps?.crypto) {
            this.#deps = deps as TokenBillingServiceDeps;
            this.#initialized = true;
        }
    }

    async #initDeps() {
        if (this.#initialized) return;
        if (this.#initPromise) return this.#initPromise;

        this.#initPromise = (async () => {
            const [uuidModule] = await Promise.all([
                import('uuid')
            ]);

            this.#deps = {
                db: getDatabase(),
                uuidv4: uuidModule.v4,
                crypto
            };
            this.#initialized = true;
        })();

        return this.#initPromise;
    }

    setDependencies(newDeps: Partial<TokenBillingServiceDeps>) {
        this.#deps = { ...this.#deps!, ...newDeps };
        this.#initialized = true;
    }

    private async dbGet<T>(sql: string, params: any[] = []): Promise<T | null> {
        await this.#initDeps();
        return DbPromise.get<T>(this.#deps!.db, sql, params);
    }

    private async dbRun(sql: string, params: any[] = []): Promise<{ lastID?: number; changes: number }> {
        await this.#initDeps();
        const result = await DbPromise.run(this.#deps!.db, sql, params);
        return {
            lastID: result.lastID,
            changes: result.changes || 0
        };
    }

    private async dbAll<T>(sql: string, params: any[] = []): Promise<T[]> {
        await this.#initDeps();
        return DbPromise.all<T>(this.#deps!.db, sql, params);
    }

    // ==========================================
    // MARGIN MANAGEMENT
    // ==========================================

    async getMargins(): Promise<BillingMargin[]> {
        return this.dbAll<BillingMargin>('SELECT * FROM billing_margins ORDER BY source_type');
    }

    async getMargin(sourceType: string): Promise<BillingMargin | null> {
        return this.dbGet<BillingMargin>('SELECT * FROM billing_margins WHERE source_type = ?', [sourceType]);
    }

    async updateMargin(sourceType: string, { baseCostPer1k, marginPercent, minCharge, isActive }: Partial<BillingMargin>): Promise<{ changes: number }> {
        const result = await this.dbRun(
            `UPDATE billing_margins 
             SET base_cost_per_1k = COALESCE(?, base_cost_per_1k),
                 margin_percent = COALESCE(?, margin_percent),
                 min_charge = COALESCE(?, min_charge),
                 is_active = COALESCE(?, is_active),
                 updated_at = CURRENT_TIMESTAMP
             WHERE source_type = ?`,
            [baseCostPer1k, marginPercent, minCharge, isActive, sourceType]
        );
        return { changes: result.changes };
    }

    // ==========================================
    // TOKEN PACKAGES
    // ==========================================

    async getPackages(): Promise<TokenPackage[]> {
        return this.dbAll<TokenPackage>('SELECT * FROM token_packages WHERE is_active = 1 ORDER BY sort_order');
    }

    async getPackage(packageId: string): Promise<TokenPackage | null> {
        return this.dbGet<TokenPackage>('SELECT * FROM token_packages WHERE id = ?', [packageId]);
    }

    async upsertPackage(pkg: Partial<TokenPackage> & { id?: string; name: string; tokens: number; priceUsd: number }): Promise<{ id: string }> {
        await this.#initDeps();
        const { uuidv4 } = this.#deps!;

        const packageId = pkg.id || `pkg-${uuidv4().slice(0, 8)}`;
        await this.dbRun(
            `INSERT INTO token_packages (id, name, description, tokens, price_usd, bonus_percent, is_popular, sort_order, stripe_price_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                 name = excluded.name, description = excluded.description, tokens = excluded.tokens,
                 price_usd = excluded.price_usd, bonus_percent = excluded.bonus_percent,
                 is_popular = excluded.is_popular, sort_order = excluded.sort_order, stripe_price_id = excluded.stripe_price_id`,
            [packageId, pkg.name, pkg.description, pkg.tokens, pkg.priceUsd, pkg.bonusPercent || 0, pkg.isPopular ? 1 : 0, pkg.sortOrder || 0, pkg.stripePriceId]
        );
        return { id: packageId };
    }

    // ==========================================
    // USER BALANCE
    // ==========================================

    async getBalance(userId: string): Promise<UserBalance> {
        const row = await this.dbGet<UserBalance>('SELECT * FROM user_token_balance WHERE user_id = ?', [userId]);
        return row || { user_id: userId, platform_tokens: 0, platform_tokens_bonus: 0, byok_usage_tokens: 0, local_usage_tokens: 0 };
    }

    async ensureBalance(userId: string): Promise<{ userId: string }> {
        await this.dbRun(`INSERT OR IGNORE INTO user_token_balance (user_id) VALUES (?)`, [userId]);
        return { userId };
    }

    async hasSufficientBalance(userId: string, requiredTokens: number): Promise<boolean> {
        const balance = await this.getBalance(userId);
        return (balance.platform_tokens || 0) + (balance.platform_tokens_bonus || 0) >= requiredTokens;
    }

    // ==========================================
    // ENCRYPTION
    // ==========================================

    encryptApiKey(apiKey: string): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(apiKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    decryptApiKey(encryptedKey: string): string {
        const [ivHex, encrypted] = encryptedKey.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    // ==========================================
    // ORGANIZATION BALANCE
    // ==========================================

    async getOrgBalance(orgId: string): Promise<OrgBalance> {
        const row = await this.dbGet<any>(
            `SELECT token_balance, billing_status, organization_type FROM organizations WHERE id = ?`,
            [orgId]
        );
        if (!row) throw new Error('Organization not found');
        return {
            balance: row.token_balance || 0,
            billingStatus: row.billing_status || 'TRIAL',
            organizationType: row.organization_type || 'TRIAL'
        };
    }

    async hasOrgSufficientBalance(orgId: string, estimatedTokens: number): Promise<{ allowed: boolean; balance: number; reason?: string; paygoTriggered?: boolean }> {
        let org;
        try {
            org = await this.getOrgBalance(orgId);
        } catch (err: unknown) {
            return { allowed: false, balance: 0, reason: 'Balance check failed. Please retry.' };
        }

        const { balance, billingStatus, organizationType } = org;
        const isTrial = billingStatus === 'TRIAL' || organizationType === 'TRIAL';

        if (isTrial && balance < estimatedTokens) {
            return {
                allowed: false,
                balance,
                reason: 'Trial token limit reached. Upgrade to continue using AI features.'
            };
        }

        if (!isTrial && billingStatus === 'ACTIVE' && balance < estimatedTokens) {
            return { allowed: true, balance, paygoTriggered: true };
        }

        return { allowed: true, balance };
    }
}

// ==========================================
// EXPORTS
// ==========================================

const TokenBillingService = new TokenBillingServiceClass();

export default TokenBillingService;
