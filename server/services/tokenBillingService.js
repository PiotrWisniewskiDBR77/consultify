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
const { runAsync, getAsync, allAsync, withTransaction } = require('../db/sqliteAsync');

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

                // 1. Log Transaction
                db.run(`INSERT INTO token_transactions (id, user_id, organization_id, type, source_type, tokens, package_id, stripe_payment_id, description) VALUES (?, ?, ?, 'purchase', 'platform', ?, ?, ?, ?)`,
                    [txId, userId, organizationId, tokens + bonusTokens, packageId, stripePaymentId, `Purchased ${tokens} tokens`],
                    function (err) {
                        if (err) return reject(err);

                        // 2. Generate Invoice Record if Organization ID is present
                        if (organizationId) {
                            // Fetch Package Price to log invoice correctly
                            db.get('SELECT price_usd FROM token_packages WHERE id = ?', [packageId], (err, row) => {
                                if (row && row.price_usd > 0) {
                                    const invoiceId = `inv-${uuidv4().slice(0, 8)}`;
                                    db.run(`INSERT INTO billing_invoices (id, organization_id, amount_due, currency, status, stripe_invoice_id, created_at) VALUES (?, ?, ?, 'USD', 'paid', ?, CURRENT_TIMESTAMP)`,
                                        [invoiceId, organizationId, row.price_usd, stripePaymentId || 'manual_credit']);
                                }
                            });
                        }

                        resolve({ transactionId: txId, tokens, bonusTokens });
                    });
            });
        });
    }

    static async deductTokens(userId, tokens, sourceType, { organizationId, llmProvider, modelUsed, multiplier } = {}) {
        await this.ensureBalance(userId);

        // 1. Calculate Billed Amount
        const margin = await this.getMargin(sourceType);
        // If margin config missing, default to 1:1 and 0 cost for safety, or throw? 
        // We'll proceed with defaults if missing to avoid breaking.
        const baseCostPer1k = margin?.base_cost_per_1k || 0;
        const marginPercent = margin?.margin_percent || 0;
        const minCharge = margin?.min_charge || 0;

        // Apply Markup Multiplier (Default 1.0)
        const finalMultiplier = multiplier || 1.0;
        const billedTokens = Math.ceil(tokens * finalMultiplier);

        let marginUsd = 0;
        if (sourceType === 'platform') {
            const baseCost = (billedTokens / 1000) * baseCostPer1k;
            marginUsd = baseCost * (marginPercent / 100);
        } else {
            const estimatedValue = (billedTokens / 1000) * 0.01; // Estimated cost valuation
            marginUsd = estimatedValue * (marginPercent / 100);
        }
        marginUsd = Math.max(marginUsd, minCharge);

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                // 2. DEDUCTION LOGIC
                // PRIORITY: If OrganizationID present and Source=Platform, deduct from ORGANIZATION Balance
                // OTHERWISE: Deduct from USER Balance

                if (organizationId && sourceType === 'platform') {
                    // Org-Level Deduction
                    db.run(
                        `UPDATE organizations 
                         SET token_balance = MAX(0, IFNULL(token_balance, 0) - ?) 
                         WHERE id = ?`,
                        [billedTokens, organizationId],
                        function (err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }
                        }
                    );
                } else {
                    // User-Level Deduction (Legacy / Personal / BYOK)
                    const field = sourceType === 'platform' ? 'platform_tokens' : sourceType === 'byok' ? 'byok_usage_tokens' : 'local_usage_tokens';
                    const op = sourceType === 'platform' ? `${field} = MAX(0, ${field} - ?)` : `${field} = ${field} + ?`;

                    db.run(`UPDATE user_token_balance SET ${op}, lifetime_used = lifetime_used + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
                        [billedTokens, billedTokens, userId],
                        function (err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return reject(err);
                            }
                        }
                    );
                }

                // 3. LOG TRANSACTION (Legacy table)
                const txId = `tx-${uuidv4()}`;
                const metadata = JSON.stringify({ raw_tokens: tokens, multiplier: finalMultiplier });

                db.run(`INSERT INTO token_transactions (id, user_id, organization_id, type, source_type, tokens, margin_usd, net_revenue_usd, llm_provider, model_used, description, metadata) VALUES (?, ?, ?, 'usage', ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [txId, userId, organizationId, sourceType, -billedTokens, marginUsd, marginUsd, llmProvider, modelUsed, `Used ${tokens} tokens (x${finalMultiplier}) via ${sourceType}`, metadata],
                    function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }

                        // 4. LOG TO TOKEN_LEDGER (New immutable ledger)
                        if (organizationId) {
                            const ledgerId = `led-${uuidv4()}`;
                            const ledgerMeta = JSON.stringify({
                                raw_tokens: tokens,
                                multiplier: finalMultiplier,
                                llm_provider: llmProvider,
                                model_used: modelUsed,
                                margin_usd: marginUsd
                            });
                            db.run(
                                `INSERT INTO token_ledger (id, organization_id, actor_user_id, actor_type, type, amount, reason, ref_entity_type, ref_entity_id, metadata_json)
                                 VALUES (?, ?, ?, 'USER', 'DEBIT', ?, ?, 'AI_CALL', ?, ?)`,
                                [ledgerId, organizationId, userId, billedTokens, `AI Call: ${modelUsed || 'unknown'}`, txId, ledgerMeta],
                                function (ledgerErr) {
                                    if (ledgerErr) {
                                        console.error('Token Ledger Insert Error (non-fatal):', ledgerErr);
                                        // Non-fatal: continue with commit
                                    }
                                    db.run('COMMIT', (commitErr) => {
                                        if (commitErr) return reject(commitErr);
                                        resolve({ transactionId: txId, tokens: billedTokens, marginUsd });
                                    });
                                }
                            );
                        } else {
                            db.run('COMMIT', (commitErr) => {
                                if (commitErr) return reject(commitErr);
                                resolve({ transactionId: txId, tokens: billedTokens, marginUsd });
                            });
                        }
                    }
                );
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

    /**
     * Get Organization Token Balance (FAIL-CLOSED)
     * Returns cached balance from organizations table (source of truth for speed)
     * @param {string} orgId 
     * @returns {Promise<{balance: number, billingStatus: string, organizationType: string}>}
     * @throws {Error} if org not found
     */
    static async getOrgBalance(orgId) {
        const row = await getAsync(
            db,
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

    /**
     * Check if Organization has sufficient balance for AI call (FAIL-CLOSED)
     * @param {string} orgId 
     * @param {number} estimatedTokens 
     * @returns {Promise<{allowed: boolean, balance: number, reason?: string, paygoTriggered?: boolean}>}
     */
    static async hasOrgSufficientBalance(orgId, estimatedTokens) {
        let org;
        try {
            org = await this.getOrgBalance(orgId);
        } catch (err) {
            // FAIL CLOSED - enterprise stance: deny on error
            return { allowed: false, balance: 0, reason: 'Balance check failed. Please retry.' };
        }

        const { balance, billingStatus, organizationType } = org;
        const isTrial = billingStatus === 'TRIAL' || organizationType === 'TRIAL';

        // TRIAL MODE: Hard stop when insufficient
        if (isTrial && balance < estimatedTokens) {
            return {
                allowed: false,
                balance,
                reason: 'Trial token limit reached. Upgrade to continue using AI features.'
            };
        }

        // PAYGO MODE: Allow overdraft only when billingStatus ACTIVE (stub)
        if (!isTrial && billingStatus === 'ACTIVE' && balance < estimatedTokens) {
            return { allowed: true, balance, paygoTriggered: true };
        }

        return { allowed: true, balance };
    }

    /**
     * Atomic DEBIT for Organization (ENTERPRISE-GRADE)
     * Single transaction, ledger insert is FATAL, fail-closed for trial
     * 
     * @param {Object} params
     * @returns {Promise<{transactionId: string, ledgerId: string, tokensBilled: number, balanceAfter: number}>}
     * @throws {Error} with statusCode 402 if insufficient balance
     */
    static async deductTokensForOrg({
        organizationId,
        userId,
        tokens,
        billedTokens,
        sourceType,
        llmProvider,
        modelUsed,
        finalMultiplier,
        marginUsd
    }) {
        if (!organizationId) throw new Error('organizationId required');

        // 1) Pre-check (fail-closed for trial)
        const check = await this.hasOrgSufficientBalance(organizationId, billedTokens);
        if (!check.allowed) {
            const err = new Error(check.reason || 'Insufficient token balance');
            err.statusCode = 402;
            throw err;
        }

        return withTransaction(db, async () => {
            // 2) Lock row / read status inside transaction for safety
            const orgRow = await getAsync(
                db,
                `SELECT token_balance, billing_status, organization_type FROM organizations WHERE id = ?`,
                [organizationId]
            );
            if (!orgRow) throw new Error('Organization not found');

            const isTrial = (orgRow.billing_status || 'TRIAL') === 'TRIAL' || (orgRow.organization_type || 'TRIAL') === 'TRIAL';
            const currentBalance = orgRow.token_balance || 0;

            // Re-check under transaction for TRIAL hard stop
            if (isTrial && currentBalance < billedTokens) {
                const err = new Error('Trial token limit reached. Upgrade to continue using AI features.');
                err.statusCode = 402;
                throw err;
            }

            // 3) Apply balance change
            const upd = await runAsync(
                db,
                `UPDATE organizations SET token_balance = IFNULL(token_balance, 0) - ? WHERE id = ?`,
                [billedTokens, organizationId]
            );
            if (upd.changes === 0) throw new Error('Organization not found');

            // 4) Legacy transaction (backward compat)
            const txId = `tx-${uuidv4()}`;
            const legacyMeta = JSON.stringify({ raw_tokens: tokens, multiplier: finalMultiplier });

            await runAsync(
                db,
                `INSERT INTO token_transactions
                 (id, user_id, organization_id, type, source_type, tokens, margin_usd, net_revenue_usd, llm_provider, model_used, description, metadata)
                 VALUES (?, ?, ?, 'usage', ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    txId,
                    userId,
                    organizationId,
                    sourceType,
                    -billedTokens,
                    marginUsd,
                    marginUsd,
                    llmProvider,
                    modelUsed,
                    `Used ${tokens} tokens (x${finalMultiplier}) via ${sourceType}`,
                    legacyMeta
                ]
            );

            // 5) Immutable ledger entry (FATAL - will rollback on failure)
            const ledgerId = `led-${uuidv4()}`;
            const ledgerMeta = JSON.stringify({
                raw_tokens: tokens,
                billed_tokens: billedTokens,
                multiplier: finalMultiplier,
                llm_provider: llmProvider,
                model_used: modelUsed,
                margin_usd: marginUsd,
                source_type: sourceType
            });

            await runAsync(
                db,
                `INSERT INTO token_ledger
                 (id, organization_id, actor_user_id, actor_type, type, amount, reason, ref_entity_type, ref_entity_id, metadata_json)
                 VALUES (?, ?, ?, 'USER', 'DEBIT', ?, ?, 'AI_CALL', ?, ?)`,
                [ledgerId, organizationId, userId, billedTokens, `AI Call: ${modelUsed || 'unknown'}`, txId, ledgerMeta]
            );

            // 6) PAYGO trigger - measurable (status flag + ledger event)
            const newBalanceRow = await getAsync(
                db,
                `SELECT token_balance, billing_status, organization_type FROM organizations WHERE id = ?`,
                [organizationId]
            );
            const newBalance = newBalanceRow?.token_balance || 0;
            const isActivePaid = (newBalanceRow?.billing_status || '') === 'ACTIVE' && !isTrial;

            if (isActivePaid && newBalance < 0) {
                // Mark as PAYGO_PENDING
                await runAsync(
                    db,
                    `UPDATE organizations SET billing_status = 'PAYGO_PENDING' WHERE id = ? AND billing_status = 'ACTIVE'`,
                    [organizationId]
                );

                // Log PAYGO event to ledger
                const paygoLedgerId = `led-${uuidv4()}`;
                await runAsync(
                    db,
                    `INSERT INTO token_ledger
                     (id, organization_id, actor_user_id, actor_type, type, amount, reason, ref_entity_type, ref_entity_id, metadata_json)
                     VALUES (?, ?, ?, 'SYSTEM', 'DEBIT', 0, 'PAYGO_TRIGGERED', 'ORG', ?, ?)`,
                    [paygoLedgerId, organizationId, null, organizationId, JSON.stringify({ new_balance: newBalance })]
                );
            }

            return {
                transactionId: txId,
                ledgerId,
                tokensBilled: billedTokens,
                balanceAfter: newBalance
            };
        });
    }

    /**
     * Get Token Ledger for an Organization
     * @param {string} orgId 
     * @param {Object} options 
     * @returns {Promise<Array>}
     */
    static async getLedger(orgId, { limit = 50, offset = 0 } = {}) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    id, created_at, actor_user_id, actor_type, type, amount, reason, 
                    ref_entity_type, ref_entity_id, metadata_json
                 FROM token_ledger 
                 WHERE organization_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`,
                [orgId, limit, offset],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    /**
     * Add Credit to Organization (ATOMIC)
     * @param {string} orgId 
     * @param {number} tokens 
     * @param {Object} options 
     * @returns {Promise<Object>}
     */
    static async creditOrganization(orgId, tokens, { userId = null, reason = 'Credit', refType = 'GRANT', refId = null, metadata = {} } = {}) {
        const ledgerId = `led-${uuidv4()}`;
        const metadataJson = JSON.stringify(metadata);

        return withTransaction(db, async () => {
            // 1. Update Organization Balance
            const upd = await runAsync(
                db,
                `UPDATE organizations SET token_balance = IFNULL(token_balance, 0) + ? WHERE id = ?`,
                [tokens, orgId]
            );
            if (upd.changes === 0) throw new Error('Organization not found');

            // 2. Insert Ledger Entry (FATAL)
            await runAsync(
                db,
                `INSERT INTO token_ledger (id, organization_id, actor_user_id, actor_type, type, amount, reason, ref_entity_type, ref_entity_id, metadata_json)
                 VALUES (?, ?, ?, ?, 'CREDIT', ?, ?, ?, ?, ?)`,
                [ledgerId, orgId, userId, userId ? 'USER' : 'SYSTEM', tokens, reason, refType, refId, metadataJson]
            );

            return { ledgerId, tokens, orgId };
        });
    }

    /**
     * Get Ledger Summary for Organization
     * @param {string} orgId 
     * @returns {Promise<Object>}
     */
    static async getLedgerSummary(orgId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END) as total_credits,
                    SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END) as total_debits,
                    COUNT(*) as transaction_count
                 FROM token_ledger 
                 WHERE organization_id = ?`,
                [orgId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve({
                        totalCredits: row?.total_credits || 0,
                        totalDebits: row?.total_debits || 0,
                        computedBalance: (row?.total_credits || 0) - (row?.total_debits || 0),
                        transactionCount: row?.transaction_count || 0
                    });
                }
            );
        });
    }
}

module.exports = TokenBillingService;
