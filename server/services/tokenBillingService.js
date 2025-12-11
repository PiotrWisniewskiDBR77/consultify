/**
 * Token Billing Service
 * 
 * Handles 3-tier token billing:
 * 1. Platform Tokens - Purchased from us with margin
 * 2. BYOK Tokens - User's own API keys with usage fee
 * 3. Local Tokens - Self-hosted LLMs with minimal fee
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Encryption key for API keys (should be in env)
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET || 'default-32-char-key-for-dev-only!';
const IV_LENGTH = 16;

class TokenBillingService {
    // ==========================================
    // MARGIN MANAGEMENT
    // ==========================================

    static async getMargins() {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM billing_margins ORDER BY source_type', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    static async getMargin(sourceType) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM billing_margins WHERE source_type = ?', [sourceType], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    static async updateMargin(sourceType, { baseCostPer1k, marginPercent, minCharge, isActive }) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE billing_margins 
                 SET base_cost_per_1k = COALESCE(?, base_cost_per_1k),
                     margin_percent = COALESCE(?, margin_percent),
                     min_charge = COALESCE(?, min_charge),
                     is_active = COALESCE(?, is_active),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE source_type = ?`,
                [baseCostPer1k, marginPercent, minCharge, isActive, sourceType],
                function (err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                }
            );
        });
    }

    // ==========================================
    // TOKEN PACKAGES
    // ==========================================

    static async getPackages() {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM token_packages WHERE is_active = 1 ORDER BY sort_order', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    static async getPackage(packageId) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM token_packages WHERE id = ?', [packageId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    static async upsertPackage({ id, name, description, tokens, priceUsd, bonusPercent, isPopular, sortOrder, stripePriceId }) {
        const packageId = id || `pkg-${uuidv4().slice(0, 8)}`;
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO token_packages (id, name, description, tokens, price_usd, bonus_percent, is_popular, sort_order, stripe_price_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                     name = excluded.name, description = excluded.description, tokens = excluded.tokens,
                     price_usd = excluded.price_usd, bonus_percent = excluded.bonus_percent,
                     is_popular = excluded.is_popular, sort_order = excluded.sort_order, stripe_price_id = excluded.stripe_price_id`,
                [packageId, name, description, tokens, priceUsd, bonusPercent || 0, isPopular ? 1 : 0, sortOrder || 0, stripePriceId],
                function (err) {
                    if (err) reject(err);
                    else resolve({ id: packageId });
                }
            );
        });
    }

    // ==========================================
    // USER BALANCE
    // ==========================================

    static async getBalance(userId) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM user_token_balance WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row || { user_id: userId, platform_tokens: 0, platform_tokens_bonus: 0, byok_usage_tokens: 0, local_usage_tokens: 0 });
            });
        });
    }

    static async ensureBalance(userId) {
        return new Promise((resolve, reject) => {
            db.run(`INSERT OR IGNORE INTO user_token_balance (user_id) VALUES (?)`, [userId], function (err) {
                if (err) reject(err);
                else resolve({ userId });
            });
        });
    }

    static async creditTokens(userId, tokens, bonusTokens = 0, { packageId, stripePaymentId, organizationId } = {}) {
        await this.ensureBalance(userId);
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run(`UPDATE user_token_balance SET platform_tokens = platform_tokens + ?, platform_tokens_bonus = platform_tokens_bonus + ?, lifetime_purchased = lifetime_purchased + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
                    [tokens, bonusTokens, tokens + bonusTokens, userId]);
                const txId = `tx-${uuidv4()}`;
                db.run(`INSERT INTO token_transactions (id, user_id, organization_id, type, source_type, tokens, package_id, stripe_payment_id, description) VALUES (?, ?, ?, 'purchase', 'platform', ?, ?, ?, ?)`,
                    [txId, userId, organizationId, tokens + bonusTokens, packageId, stripePaymentId, `Purchased ${tokens} tokens`],
                    function (err) { if (err) reject(err); else resolve({ transactionId: txId, tokens, bonusTokens }); });
            });
        });
    }

    static async deductTokens(userId, tokens, sourceType, { organizationId, llmProvider, modelUsed, multiplier } = {}) {
        await this.ensureBalance(userId);
        const margin = await this.getMargin(sourceType);
        if (!margin) throw new Error(`Unknown source type: ${sourceType}`);

        // Apply Markup Multiplier (Default 1.0)
        const finalMultiplier = multiplier || 1.0;
        const billedTokens = Math.ceil(tokens * finalMultiplier);

        let marginUsd = 0;
        if (sourceType === 'platform') {
            const baseCost = (billedTokens / 1000) * (margin.base_cost_per_1k || 0);
            marginUsd = baseCost * (margin.margin_percent / 100);
        } else {
            const estimatedValue = (billedTokens / 1000) * 0.01;
            marginUsd = estimatedValue * (margin.margin_percent / 100);
        }
        marginUsd = Math.max(marginUsd, margin.min_charge || 0);

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                const field = sourceType === 'platform' ? 'platform_tokens' : sourceType === 'byok' ? 'byok_usage_tokens' : 'local_usage_tokens';
                // Deduct BILLED tokens, not raw tokens
                const op = sourceType === 'platform' ? `${field} = MAX(0, ${field} - ?)` : `${field} = ${field} + ?`;

                db.run(`UPDATE user_token_balance SET ${op}, lifetime_used = lifetime_used + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
                    [billedTokens, billedTokens, userId]);

                const txId = `tx-${uuidv4()}`;
                const metadata = JSON.stringify({ raw_tokens: tokens, multiplier: finalMultiplier });

                db.run(`INSERT INTO token_transactions (id, user_id, organization_id, type, source_type, tokens, margin_usd, net_revenue_usd, llm_provider, model_used, description, metadata) VALUES (?, ?, ?, 'usage', ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [txId, userId, organizationId, sourceType, -billedTokens, marginUsd, marginUsd, llmProvider, modelUsed, `Used ${tokens} tokens (x${finalMultiplier}) via ${sourceType}`, metadata],
                    function (err) { if (err) reject(err); else resolve({ transactionId: txId, tokens: billedTokens, marginUsd }); });
            });
        });
    }

    static async hasSufficientBalance(userId, requiredTokens) {
        const balance = await this.getBalance(userId);
        return (balance.platform_tokens || 0) + (balance.platform_tokens_bonus || 0) >= requiredTokens;
    }

    // ==========================================
    // USER API KEYS (BYOK)
    // ==========================================

    static encryptApiKey(apiKey) {
        const iv = crypto.randomBytes(IV_LENGTH);
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(apiKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    static decryptApiKey(encryptedKey) {
        const [ivHex, encrypted] = encryptedKey.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    static async addUserApiKey(userId, { provider, apiKey, displayName, modelPreference, organizationId }) {
        const id = `uak-${uuidv4()}`;
        const encryptedKey = this.encryptApiKey(apiKey);
        return new Promise((resolve, reject) => {
            db.run(`INSERT INTO user_api_keys (id, user_id, organization_id, provider, display_name, encrypted_key, model_preference) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, userId, organizationId, provider, displayName || provider, encryptedKey, modelPreference],
                function (err) { if (err) reject(err); else resolve({ id, provider }); });
        });
    }

    static async getUserApiKeys(userId) {
        return new Promise((resolve, reject) => {
            db.all(`SELECT id, user_id, provider, display_name, model_preference, is_active, is_default, usage_count, last_used_at, created_at FROM user_api_keys WHERE user_id = ? ORDER BY is_default DESC, created_at`, [userId],
                (err, rows) => { if (err) reject(err); else resolve(rows || []); });
        });
    }

    static async getActiveByokKey(userId, provider) {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM user_api_keys WHERE user_id = ? AND provider = ? AND is_active = 1 ORDER BY is_default DESC LIMIT 1`, [userId, provider],
                (err, row) => {
                    if (err) reject(err);
                    else if (!row) resolve(null);
                    else { try { resolve({ ...row, api_key: this.decryptApiKey(row.encrypted_key) }); } catch (e) { resolve(null); } }
                });
        });
    }

    static async deleteUserApiKey(keyId, userId) {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM user_api_keys WHERE id = ? AND user_id = ?', [keyId, userId],
                function (err) { if (err) reject(err); else resolve({ deleted: this.changes > 0 }); });
        });
    }

    // ==========================================
    // TRANSACTIONS & ANALYTICS
    // ==========================================

    static async getTransactions(userId, { limit = 50, offset = 0 } = {}) {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM token_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', [userId, limit, offset],
                (err, rows) => { if (err) reject(err); else resolve(rows || []); });
        });
    }

    static async getRevenueAnalytics({ startDate, endDate } = {}) {
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const end = endDate || new Date().toISOString();
        return new Promise((resolve, reject) => {
            db.all(`SELECT source_type, COUNT(*) as transaction_count, SUM(ABS(tokens)) as total_tokens, SUM(margin_usd) as total_margin, SUM(net_revenue_usd) as total_revenue FROM token_transactions WHERE type = 'usage' AND created_at BETWEEN ? AND ? GROUP BY source_type`, [start, end],
                (err, rows) => { if (err) reject(err); else resolve(rows || []); });
        });
    }

    static async determineTokenSource(userId, preferredProvider = null) {
        if (preferredProvider) {
            const byokKey = await this.getActiveByokKey(userId, preferredProvider);
            if (byokKey) return { sourceType: 'byok', config: byokKey };
        }
        const balance = await this.getBalance(userId);
        return { sourceType: 'platform', availableTokens: (balance.platform_tokens || 0) + (balance.platform_tokens_bonus || 0) };
    }
}

module.exports = TokenBillingService;
