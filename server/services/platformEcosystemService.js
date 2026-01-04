/**
 * Platform Ecosystem Service
 * 
 * Manages the Consultify platform ecosystem:
 * - Marketplace (templates, playbooks, integrations)
 * - Partner Program
 * - Developer API
 * - Community features
 */

import { getDatabase } from '../src/database/index.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';

// Marketplace categories
const MARKETPLACE_CATEGORIES = {
    TEMPLATES: 'templates',
    PLAYBOOKS: 'playbooks',
    INTEGRATIONS: 'integrations',
    REPORTS: 'reports',
    TRAINING: 'training'
};

// Partner tiers
const PARTNER_TIERS = {
    REGISTERED: 'registered',
    SILVER: 'silver',
    GOLD: 'gold',
    PLATINUM: 'platinum'
};

// API scopes
const API_SCOPES = {
    READ_PROJECTS: 'read:projects',
    WRITE_PROJECTS: 'write:projects',
    READ_ASSESSMENTS: 'read:assessments',
    WRITE_ASSESSMENTS: 'write:assessments',
    READ_ANALYTICS: 'read:analytics',
    WEBHOOKS: 'webhooks',
    ADMIN: 'admin'
};

const PlatformEcosystemService = {
    MARKETPLACE_CATEGORIES,
    PARTNER_TIERS,
    API_SCOPES,

    // ============================================
    // MARKETPLACE
    // ============================================

    /**
     * Get marketplace listings
     */
    getMarketplaceListings: async (options = {}) => {
        const { category, industry, search, limit = 20, offset = 0 } = options;

        return new Promise((resolve) => {
            let sql = `SELECT * FROM marketplace_listings WHERE status = 'published'`;
            const params = [];

            if (category) {
                sql += ` AND category = ?`;
                params.push(category);
            }

            if (industry) {
                sql += ` AND (industry = ? OR industry = 'all')`;
                params.push(industry);
            }

            if (search) {
                sql += ` AND (name LIKE ? OR description LIKE ?)`;
                params.push(`%${search}%`, `%${search}%`);
            }

            sql += ` ORDER BY featured DESC, downloads DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            db.all(sql, params, (err, rows) => {
                resolve((rows || []).map(r => ({
                    ...r,
                    tags: JSON.parse(r.tags || '[]'),
                    pricing: JSON.parse(r.pricing || '{}')
                })));
            });
        });
    },

    /**
     * Get marketplace listing by ID
     */
    getMarketplaceListing: async (listingId) => {
        return new Promise((resolve) => {
            db.get(`SELECT * FROM marketplace_listings WHERE id = ?`, [listingId], (err, row) => {
                if (!row) return resolve(null);
                resolve({
                    ...row,
                    tags: JSON.parse(row.tags || '[]'),
                    pricing: JSON.parse(row.pricing || '{}'),
                    content: JSON.parse(row.content || '{}')
                });
            });
        });
    },

    /**
     * Publish marketplace listing
     */
    publishListing: async (listingData) => {
        const listingId = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO marketplace_listings (
                    id, category, name, description, author_id, author_name,
                    industry, tags, pricing, content, version, status,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                listingId,
                listingData.category,
                listingData.name,
                listingData.description,
                listingData.authorId,
                listingData.authorName,
                listingData.industry || 'all',
                JSON.stringify(listingData.tags || []),
                JSON.stringify(listingData.pricing || { type: 'free' }),
                JSON.stringify(listingData.content || {}),
                listingData.version || '1.0.0'
            ], function(err) {
                if (err) return reject(err);
                resolve({ id: listingId, status: 'draft' });
            });
        });
    },

    /**
     * Install marketplace item
     */
    installMarketplaceItem: async (listingId, organizationId) => {
        const listing = await PlatformEcosystemService.getMarketplaceListing(listingId);
        if (!listing) throw new Error('Listing not found');

        const installId = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO marketplace_installations (
                    id, listing_id, organization_id, version, installed_at
                ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [installId, listingId, organizationId, listing.version], function(err) {
                if (err) return reject(err);

                // Increment download count
                db.run(`UPDATE marketplace_listings SET downloads = downloads + 1 WHERE id = ?`, [listingId]);

                resolve({
                    installId,
                    listingId,
                    name: listing.name,
                    category: listing.category,
                    content: listing.content
                });
            });
        });
    },

    // ============================================
    // PARTNER PROGRAM
    // ============================================

    /**
     * Register as partner
     */
    registerPartner: async (partnerData) => {
        const partnerId = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO partners (
                    id, organization_id, company_name, contact_name, contact_email,
                    website, tier, specializations, regions, status,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                partnerId,
                partnerData.organizationId,
                partnerData.companyName,
                partnerData.contactName,
                partnerData.contactEmail,
                partnerData.website,
                PARTNER_TIERS.REGISTERED,
                JSON.stringify(partnerData.specializations || []),
                JSON.stringify(partnerData.regions || [])
            ], function(err) {
                if (err) return reject(err);
                resolve({
                    id: partnerId,
                    tier: PARTNER_TIERS.REGISTERED,
                    status: 'pending'
                });
            });
        });
    },

    /**
     * Get partner profile
     */
    getPartnerProfile: async (partnerId) => {
        return new Promise((resolve) => {
            db.get(`SELECT * FROM partners WHERE id = ?`, [partnerId], (err, row) => {
                if (!row) return resolve(null);
                resolve({
                    ...row,
                    specializations: JSON.parse(row.specializations || '[]'),
                    regions: JSON.parse(row.regions || '[]'),
                    certifications: JSON.parse(row.certifications || '[]')
                });
            });
        });
    },

    /**
     * Get partner directory
     */
    getPartnerDirectory: async (options = {}) => {
        const { tier, specialization, region, limit = 50 } = options;

        return new Promise((resolve) => {
            let sql = `SELECT * FROM partners WHERE status = 'active'`;
            const params = [];

            if (tier) {
                sql += ` AND tier = ?`;
                params.push(tier);
            }

            sql += ` ORDER BY tier DESC, company_name ASC LIMIT ?`;
            params.push(limit);

            db.all(sql, params, (err, rows) => {
                resolve((rows || []).map(r => ({
                    id: r.id,
                    companyName: r.company_name,
                    tier: r.tier,
                    specializations: JSON.parse(r.specializations || '[]'),
                    regions: JSON.parse(r.regions || '[]')
                })));
            });
        });
    },

    // ============================================
    // DEVELOPER API
    // ============================================

    /**
     * Create API key
     */
    createAPIKey: async (organizationId, keyData) => {
        const apiKeyId = uuidv4();
        const apiKey = `pk_${uuidv4().replace(/-/g, '')}`;
        const hashedKey = require('crypto').createHash('sha256').update(apiKey).digest('hex');

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO api_keys (
                    id, organization_id, name, key_hash, key_prefix,
                    scopes, rate_limit, status, created_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, ?)
            `, [
                apiKeyId,
                organizationId,
                keyData.name,
                hashedKey,
                apiKey.substring(0, 10),
                JSON.stringify(keyData.scopes || [API_SCOPES.READ_PROJECTS]),
                keyData.rateLimit || 1000,
                keyData.expiresAt || null
            ], function(err) {
                if (err) return reject(err);
                resolve({
                    id: apiKeyId,
                    apiKey, // Only shown once!
                    name: keyData.name,
                    scopes: keyData.scopes,
                    message: 'Save this API key - it will not be shown again'
                });
            });
        });
    },

    /**
     * Validate API key
     */
    validateAPIKey: async (apiKey) => {
        const hashedKey = require('crypto').createHash('sha256').update(apiKey).digest('hex');

        return new Promise((resolve) => {
            db.get(`
                SELECT * FROM api_keys 
                WHERE key_hash = ? AND status = 'active'
                AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            `, [hashedKey], (err, row) => {
                if (!row) return resolve(null);
                
                // Update last used
                db.run(`UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?`, [row.id]);

                resolve({
                    id: row.id,
                    organizationId: row.organization_id,
                    scopes: JSON.parse(row.scopes || '[]'),
                    rateLimit: row.rate_limit
                });
            });
        });
    },

    /**
     * Get organization's API keys
     */
    getAPIKeys: async (organizationId) => {
        return new Promise((resolve) => {
            db.all(`
                SELECT id, name, key_prefix, scopes, rate_limit, status, created_at, last_used_at, expires_at
                FROM api_keys
                WHERE organization_id = ?
                ORDER BY created_at DESC
            `, [organizationId], (err, rows) => {
                resolve((rows || []).map(r => ({
                    ...r,
                    scopes: JSON.parse(r.scopes || '[]')
                })));
            });
        });
    },

    /**
     * Revoke API key
     */
    revokeAPIKey: async (apiKeyId) => {
        return new Promise((resolve) => {
            db.run(`UPDATE api_keys SET status = 'revoked' WHERE id = ?`, [apiKeyId], function(err) {
                resolve({ success: this.changes > 0 });
            });
        });
    },

    /**
     * Log API usage
     */
    logAPIUsage: async (apiKeyId, endpoint, method, statusCode, responseTime) => {
        return new Promise((resolve) => {
            db.run(`
                INSERT INTO api_usage_logs (id, api_key_id, endpoint, method, status_code, response_time_ms, created_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [uuidv4(), apiKeyId, endpoint, method, statusCode, responseTime], resolve);
        });
    },

    /**
     * Get API usage stats
     */
    getAPIUsageStats: async (apiKeyId, days = 30) => {
        return new Promise((resolve) => {
            db.all(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as requests,
                    AVG(response_time_ms) as avg_response_time,
                    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
                FROM api_usage_logs
                WHERE api_key_id = ?
                AND created_at > datetime('now', '-${days} days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `, [apiKeyId], (err, rows) => {
                resolve(rows || []);
            });
        });
    },

    // ============================================
    // WEBHOOKS
    // ============================================

    /**
     * Register webhook
     */
    registerWebhook: async (organizationId, webhookData) => {
        const webhookId = uuidv4();
        const secret = `whsec_${uuidv4().replace(/-/g, '')}`;

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO webhooks (
                    id, organization_id, url, events, secret, status, created_at
                ) VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
            `, [
                webhookId,
                organizationId,
                webhookData.url,
                JSON.stringify(webhookData.events || []),
                secret
            ], function(err) {
                if (err) return reject(err);
                resolve({
                    id: webhookId,
                    url: webhookData.url,
                    events: webhookData.events,
                    secret // Only shown once
                });
            });
        });
    },

    /**
     * Get webhooks
     */
    getWebhooks: async (organizationId) => {
        return new Promise((resolve) => {
            db.all(`
                SELECT id, url, events, status, created_at, last_triggered_at
                FROM webhooks
                WHERE organization_id = ?
            `, [organizationId], (err, rows) => {
                resolve((rows || []).map(r => ({
                    ...r,
                    events: JSON.parse(r.events || '[]')
                })));
            });
        });
    },

    // ============================================
    // COMMUNITY
    // ============================================

    /**
     * Get community stats
     */
    getCommunityStats: async () => {
        const stats = {};

        await new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as count FROM organizations`, (err, row) => {
                stats.organizations = row?.count || 0;
                resolve();
            });
        });

        await new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as count FROM partners WHERE status = 'active'`, (err, row) => {
                stats.partners = row?.count || 0;
                resolve();
            });
        });

        await new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as count FROM marketplace_listings WHERE status = 'published'`, (err, row) => {
                stats.marketplaceItems = row?.count || 0;
                resolve();
            });
        });

        await new Promise((resolve) => {
            db.get(`SELECT SUM(downloads) as total FROM marketplace_listings`, (err, row) => {
                stats.totalDownloads = row?.total || 0;
                resolve();
            });
        });

        return stats;
    },

    // ============================================
    // INITIALIZATION
    // ============================================

    initialize: async () => {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // Marketplace
                db.run(`
                    CREATE TABLE IF NOT EXISTS marketplace_listings (
                        id TEXT PRIMARY KEY,
                        category TEXT NOT NULL,
                        name TEXT NOT NULL,
                        description TEXT,
                        author_id TEXT,
                        author_name TEXT,
                        industry TEXT DEFAULT 'all',
                        tags TEXT,
                        pricing TEXT,
                        content TEXT,
                        version TEXT,
                        status TEXT DEFAULT 'draft',
                        featured INTEGER DEFAULT 0,
                        downloads INTEGER DEFAULT 0,
                        rating REAL,
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                `);

                db.run(`
                    CREATE TABLE IF NOT EXISTS marketplace_installations (
                        id TEXT PRIMARY KEY,
                        listing_id TEXT NOT NULL,
                        organization_id TEXT NOT NULL,
                        version TEXT,
                        installed_at DATETIME
                    )
                `);

                // Partners
                db.run(`
                    CREATE TABLE IF NOT EXISTS partners (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT,
                        company_name TEXT NOT NULL,
                        contact_name TEXT,
                        contact_email TEXT,
                        website TEXT,
                        tier TEXT DEFAULT 'registered',
                        specializations TEXT,
                        regions TEXT,
                        certifications TEXT,
                        status TEXT DEFAULT 'pending',
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                `);

                // API Keys (if not exists from previous implementations)
                db.run(`
                    CREATE TABLE IF NOT EXISTS developer_api_keys (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        key_hash TEXT NOT NULL,
                        key_prefix TEXT,
                        scopes TEXT,
                        rate_limit INTEGER DEFAULT 1000,
                        status TEXT DEFAULT 'active',
                        created_at DATETIME,
                        last_used_at DATETIME,
                        expires_at DATETIME
                    )
                `);

                db.run(`
                    CREATE TABLE IF NOT EXISTS api_usage_logs (
                        id TEXT PRIMARY KEY,
                        api_key_id TEXT NOT NULL,
                        endpoint TEXT,
                        method TEXT,
                        status_code INTEGER,
                        response_time_ms INTEGER,
                        created_at DATETIME
                    )
                `);

                // Webhooks
                db.run(`
                    CREATE TABLE IF NOT EXISTS webhooks (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        url TEXT NOT NULL,
                        events TEXT,
                        secret TEXT,
                        status TEXT DEFAULT 'active',
                        created_at DATETIME,
                        last_triggered_at DATETIME
                    )
                `);

                // Indexes
                db.run(`CREATE INDEX IF NOT EXISTS idx_ml_category ON marketplace_listings(category)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_ml_status ON marketplace_listings(status)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_mi_org ON marketplace_installations(organization_id)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status)`);

                resolve();
            });
        });
    }
};

export default PlatformEcosystemService;










