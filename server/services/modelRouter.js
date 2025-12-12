const db = require('../database');

/**
 * Model Router Service
 * Responsible for selecting the best LLM provider and model based on:
 * 1. User Preference (BYOK or Manual Selection)
 * 2. Task Intent (Chat vs Analysis vs Vision)
 * 3. System Defaults & Cost/Performance Rules
 */

const ModelRouter = {
    /**
     * Determine the best model execution plan
     * @param {string} userId - Current user ID
     * @param {string} intent - 'chat' | 'analysis' | 'vision' | 'coding'
     * @returns {Promise<{ providerConfig: object, orgId: string, sourceType: 'platform'|'byok'|'local', model: string }>}
     */
    route: async (userId, intent = 'chat') => {
        // 1. Get User Context & Config
        const userContext = await getUserContext(userId);
        if (!userContext) {
            // Fallback for non-logged in (rare/impossible in this app?) 
            // Return system default
            return await getSystemDefault(intent);
        }

        const { user, orgId } = userContext;

        // 2. Check for User/Org Overrides (Manual Selection)
        // If user explicitly picked a model in settings, we respect it UNLESS functionality demands Vision and selected model is text-only.
        // For simplicity in v1: Manual selection overrides intent optimization.
        const manualSelectionId = getManualSelectionId(user);

        if (manualSelectionId) {
            const manualConfig = await getProviderConfig(manualSelectionId);
            if (manualConfig && manualConfig.is_active) {
                return {
                    providerConfig: manualConfig,
                    orgId,
                    sourceType: determineSourceType(manualConfig),
                    model: manualConfig.model_id
                };
            }
        }

        // 3. Auto-Routing (Intent Based)
        // If "Auto Mode" is on (default behavior if no manual selection found above) directly or implicit.

        // A. Vision Intent -> Needs Vision Model
        if (intent === 'vision') {
            const visionProvider = await findBestProvider(['gemini-pro-vision', 'gpt-4o', 'claude-3-opus']);
            if (visionProvider) return { providerConfig: visionProvider, orgId, sourceType: determineSourceType(visionProvider), model: visionProvider.model_id };
        }

        // B. Deep Analysis Intent -> Needs Smartest Model (High Context)
        if (intent === 'analysis') {
            const smartProvider = await findBestProvider(['gpt-4', 'gemini-1.5-pro', 'claude-3-opus']);
            if (smartProvider) return { providerConfig: smartProvider, orgId, sourceType: determineSourceType(smartProvider), model: smartProvider.model_id };
        }

        // C. Standard Chat -> Balance Speed/Cost
        // Default Logic
        return await getOrgDefault(orgId, intent) || await getSystemDefault(intent);
    }
};

// --- Helpers ---

const getUserContext = (userId) => {
    return new Promise((resolve) => {
        db.get("SELECT id, organization_id, ai_config FROM users WHERE id = ?", [userId], (err, row) => {
            if (err || !row) resolve(null);
            else resolve({ user: row, orgId: row.organization_id });
        });
    });
};

const getManualSelectionId = (user) => {
    if (!user.ai_config) return null;
    try {
        const cfg = JSON.parse(user.ai_config);
        // Only return if "Auto Mode" is FALSE, otherwise we treat selection as a "Preference" but Auto might override?
        // Actually typically: If user selects 'GPT-4', they want 'GPT-4'. 'Auto' checkbox usually disables the dropdown.
        // Let's assume if selectedModelId is present and valid, we use it. 
        // Ideally we check cfg.autoMode === false.
        if (cfg.autoMode === false && cfg.selectedModelId) {
            return cfg.selectedModelId;
        }
    } catch (e) { return null; }
    return null;
};

const getProviderConfig = (providerId) => {
    return new Promise((resolve) => {
        db.get("SELECT * FROM llm_providers WHERE id = ?", [providerId], (err, row) => resolve(row));
    });
};

const getOrgDefault = (orgId, intent) => {
    if (!orgId) return Promise.resolve(null);
    return new Promise((resolve) => {
        db.get(`
            SELECT p.* 
            FROM organizations o 
            JOIN llm_providers p ON o.active_llm_provider_id = p.id 
            WHERE o.id = ? AND p.is_active = 1
        `, [orgId], (err, row) => {
            if (row) {
                resolve({
                    providerConfig: row,
                    orgId,
                    sourceType: determineSourceType(row),
                    model: row.model_id
                });
            } else {
                resolve(null);
            }
        });
    });
};

const getSystemDefault = (intent) => {
    return new Promise((resolve) => {
        // Try to find marked default
        db.get("SELECT * FROM llm_providers WHERE is_active = 1 AND is_default = 1 LIMIT 1", [], (err, row) => {
            if (row) {
                resolve({ providerConfig: row, orgId: null, sourceType: determineSourceType(row), model: row.model_id });
            } else {
                // Last resort: Any active provider
                db.get("SELECT * FROM llm_providers WHERE is_active = 1 ORDER BY id ASC LIMIT 1", [], (err, anyRow) => {
                    resolve({ providerConfig: anyRow, orgId: null, sourceType: determineSourceType(anyRow), model: anyRow?.model_id });
                });
            }
        });
    });
};

// Heuristic to find best provider from a favored list.
// In reality, we'd query DB for providers matching these model_ids/providers.
const findBestProvider = (preferredModels) => {
    // This is simple mock logic. In real system, we'd enable 'capabilities' column in llm_providers.
    // changing query to finding by name/model_id match.
    return new Promise((resolve) => {
        const placeholders = preferredModels.map(() => '?').join(',');
        // We look for providers where model_id is in our list
        db.get(`SELECT * FROM llm_providers WHERE is_active = 1 AND model_id IN (${placeholders}) LIMIT 1`, preferredModels, (err, row) => resolve(row));
    });
};

const determineSourceType = (config) => {
    if (!config) return 'platform';
    if (config.provider === 'ollama') return 'local';
    // If it was a BYOK key (loaded from user_api_keys table), we'd need to know that from the caller.
    // For now, ModelRouter mainly routes System/Org providers. 
    // BYOK logic is usually "If User has Key, Use Key".
    // Integrating BYOK check into `route` would be best. 
    // For v1 of Router, we stick to Platform Configuration.
    return 'platform';
};

module.exports = ModelRouter;
