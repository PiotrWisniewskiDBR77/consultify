/**
 * Pricing Service
 * Loads and manages subscription pricing from legal-metadata.json
 * Provides single source of truth for pricing information
 */

import fs from 'fs';
import path from 'path';

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



// Dependency injection container (for deterministic unit tests)
const deps = {
    db,
    uuidv4,
};

// Cache for pricing data
let pricingCache = null;
let metadataCache = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Set dependencies (for testing)
 */
function setDependencies(newDeps = {}) {
    Object.assign(deps, newDeps);
}

/**
 * Load legal metadata from file
 */
function loadLegalMetadata() {
    const now = Date.now();
    
    // Return cached data if still valid
    if (metadataCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return metadataCache;
    }
    
    try {
        const metadataPath = path.resolve(__dirname, '../../Legal/config/legal-metadata.json');
        const rawData = fs.readFileSync(metadataPath, 'utf8');
        metadataCache = JSON.parse(rawData);
        cacheTimestamp = now;
        return metadataCache;
    } catch (error) {
        console.error('Failed to load legal metadata:', error.message);
        // Return cached data if file read fails
        if (metadataCache) return metadataCache;
        throw new Error('Could not load pricing information');
    }
}

/**
 * Get all subscription plans from legal-metadata.json
 */
function getPlans() {
    const metadata = loadLegalMetadata();
    return metadata.pricing?.plans || [];
}

/**
 * Get trial configuration
 */
function getTrialConfig() {
    const metadata = loadLegalMetadata();
    return metadata.pricing?.trial || {
        durationDays: 14,
        planLevel: 'SCALE',
        aiCredits: 2000,
        seats: 5,
        creditCardRequired: false,
        autoConvert: false
    };
}

/**
 * Get a specific plan by ID
 */
function getPlanById(planId) {
    const plans = getPlans();
    return plans.find(p => p.id === planId) || null;
}

/**
 * Get currency configuration
 */
function getCurrency() {
    const metadata = loadLegalMetadata();
    return metadata.pricing?.currency || 'EUR';
}

/**
 * Get company information
 */
function getCompanyInfo() {
    const metadata = loadLegalMetadata();
    return metadata.metadata?.company || {};
}

/**
 * Get contact emails
 */
function getContactEmails() {
    const metadata = loadLegalMetadata();
    return metadata.metadata?.contacts || {};
}

/**
 * Get document metadata
 */
function getDocuments() {
    const metadata = loadLegalMetadata();
    return metadata.documents || {};
}

/**
 * Get document by type
 */
function getDocumentByType(docType) {
    const documents = getDocuments();
    return documents[docType] || null;
}

/**
 * Get compliance information
 */
function getComplianceInfo() {
    const metadata = loadLegalMetadata();
    return metadata.compliance || {};
}

/**
 * Get full metadata
 */
function getFullMetadata() {
    return loadLegalMetadata();
}

/**
 * Format plan for API response
 */
function formatPlanForApi(plan) {
    const currency = getCurrency();
    return {
        id: plan.id,
        name: plan.name,
        description: getPlanDescription(plan.id),
        annualPrice: plan.annualPrice,
        monthlyPrice: plan.monthlyPrice,
        monthlyPriceNote: plan.monthlyPriceNote || null,
        currency,
        seatsIncluded: plan.seatsIncluded,
        aiCreditsMonthly: plan.aiCreditsMonthly,
        extraSeatPrice: plan.extraSeatPrice,
        overagePrice: plan.overagePrice,
        byokEnabled: plan.byokEnabled,
        byokPrice: plan.byokPrice || null,
        workspaces: plan.workspaces === -1 ? 'Unlimited' : plan.workspaces,
        supportSla: plan.supportSla,
        features: getPlanFeatures(plan.id)
    };
}

/**
 * Get plan description
 */
function getPlanDescription(planId) {
    const descriptions = {
        GROWTH: 'Perfect for small consulting teams getting started with AI-powered PMO',
        SCALE: 'For growing organizations that need advanced features and BYOK capability',
        ENTERPRISE: 'Full-featured solution with custom integrations, SSO, and dedicated support'
    };
    return descriptions[planId] || '';
}

/**
 * Get plan features list
 */
function getPlanFeatures(planId) {
    const features = {
        GROWTH: [
            'AI Assessment & Recommendations',
            'Initiative Planning & Tracking',
            'Basic Reports & Exports',
            'Google/Microsoft SSO',
            'Email Support (48h)',
            '5 Team Members Included',
            '5,000 AI Credits/month'
        ],
        SCALE: [
            'Everything in Growth, plus:',
            'BYOK (Bring Your Own Key)',
            'Advanced Analytics',
            'Custom Report Builder',
            'Multi-Workspace Support',
            'API Access',
            'Priority Support (24h)',
            '15 Team Members Included',
            '20,000 AI Credits/month'
        ],
        ENTERPRISE: [
            'Everything in Scale, plus:',
            'SAML/SCIM SSO',
            'Custom Integrations',
            'Data Residency Options',
            'Audit Logs (7 years)',
            'IP Allowlisting',
            'Dedicated Success Manager',
            'SLA-backed Support (4h)',
            '50+ Team Members',
            '100,000+ AI Credits/month'
        ]
    };
    return features[planId] || [];
}

/**
 * Get all formatted plans for API
 */
function getFormattedPlans() {
    const plans = getPlans();
    return plans.map(formatPlanForApi);
}

/**
 * Get pricing page data (for public display)
 */
function getPricingPageData() {
    const metadata = loadLegalMetadata();
    const plans = getFormattedPlans();
    const trial = getTrialConfig();
    
    return {
        currency: getCurrency(),
        plans,
        trial: {
            durationDays: trial.durationDays,
            creditCardRequired: trial.creditCardRequired,
            features: 'Full Scale plan features during trial'
        },
        companyName: metadata.metadata?.company?.tradeName || 'Consultinity',
        links: {
            terms: '/terms',
            privacy: '/privacy',
            subscription: '/legal/subscription',
            refunds: '/legal/refunds',
            sla: '/legal/sla'
        }
    };
}

/**
 * Sync pricing to database (for billing operations)
 * Updates subscription_plans table with data from legal-metadata.json
 */
async function syncPricingToDatabase() {
    const plans = getPlans();
    const results = [];
    
    for (const plan of plans) {
        try {
            // Check if plan exists
            const existing = await new Promise((resolve, reject) => {
                deps.db.get('SELECT id FROM subscription_plans WHERE id = ?', [plan.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            const features = {
                seatsIncluded: plan.seatsIncluded,
                aiCreditsMonthly: plan.aiCreditsMonthly,
                extraSeatPrice: plan.extraSeatPrice,
                overagePrice: plan.overagePrice,
                byokEnabled: plan.byokEnabled,
                byokPrice: plan.byokPrice || null,
                workspaces: plan.workspaces,
                supportSla: plan.supportSla
            };
            
            if (existing) {
                // Update existing plan
                await new Promise((resolve, reject) => {
                    deps.db.run(
                        `UPDATE subscription_plans SET 
                            name = ?, 
                            price_monthly = ?, 
                            token_limit = ?,
                            features = ?,
                            updated_at = datetime('now')
                        WHERE id = ?`,
                        [plan.name, plan.monthlyPrice, plan.aiCreditsMonthly, JSON.stringify(features), plan.id],
                        function(err) {
                            if (err) reject(err);
                            else resolve({ updated: true, id: plan.id });
                        }
                    );
                });
                results.push({ id: plan.id, action: 'updated' });
            } else {
                // Insert new plan
                await new Promise((resolve, reject) => {
                    deps.db.run(
                        `INSERT INTO subscription_plans (id, name, price_monthly, token_limit, storage_limit_gb, token_overage_rate, storage_overage_rate, features, is_active)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                        [plan.id, plan.name, plan.monthlyPrice, plan.aiCreditsMonthly, 10, plan.overagePrice, 0.10, JSON.stringify(features)],
                        function(err) {
                            if (err) reject(err);
                            else resolve({ inserted: true, id: plan.id });
                        }
                    );
                });
                results.push({ id: plan.id, action: 'inserted' });
            }
        } catch (error) {
            results.push({ id: plan.id, action: 'error', error: error.message });
        }
    }
    
    return results;
}

/**
 * Clear pricing cache
 */
function clearCache() {
    pricingCache = null;
    metadataCache = null;
    cacheTimestamp = null;
}

export {
setDependencies,
    loadLegalMetadata,
    getPlans,
    getPlanById,
    getTrialConfig,
    getCurrency,
    getCompanyInfo,
    getContactEmails,
    getDocuments,
    getDocumentByType,
    getComplianceInfo,
    getFullMetadata,
    formatPlanForApi,
    getFormattedPlans,
    getPricingPageData,
    syncPricingToDatabase,
    clearCache
};

export default {
    setDependencies,
    loadLegalMetadata,
    getPlans,
    getPlanById,
    getTrialConfig,
    getCurrency,
    getCompanyInfo,
    getContactEmails,
    getDocuments,
    getDocumentByType,
    getComplianceInfo,
    getFullMetadata,
    formatPlanForApi,
    getFormattedPlans,
    getPricingPageData,
    syncPricingToDatabase,
    clearCache
};











