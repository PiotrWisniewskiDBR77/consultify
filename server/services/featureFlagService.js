const db = require('../database');

class FeatureFlagService {

    constructor() {
        this.cache = {}; // Simple in-memory cache
        this.cacheTTL = 60 * 1000; // 1 minute
        this.lastFetch = 0;
    }

    async refreshCache() {
        if (Date.now() - this.lastFetch < this.cacheTTL) return;

        return new Promise((resolve) => {
            db.all('SELECT * FROM feature_flags', [], (err, rows) => {
                if (!err && rows) {
                    rows.forEach(row => {
                        this.cache[row.key] = {
                            ...row,
                            rules: JSON.parse(row.rules || '[]')
                        };
                    });
                    this.lastFetch = Date.now();
                }
                resolve();
            });
        });
    }

    /**
     * Evaluate a flag for a specific context
     * @param {string} key - Flag key e.g. 'new_ai_dashboard'
     * @param {object} context - { userId, orgId, email, role }
     */
    async isEnabled(key, context = {}) {
        await this.refreshCache();
        const flag = this.cache[key];

        // 1. Flag doesn't exist? Default false
        if (!flag) return false;

        // 2. Global switch
        if (!flag.is_enabled) return false;

        // 3. Check rules (if any)
        // If no rules, and enabled=true -> everyone gets it
        if (!flag.rules || flag.rules.length === 0) return true;

        // 4. Evaluate rules
        // OR logic between rules (if ANY rule matches, allow)
        for (const rule of flag.rules) {
            if (this.evaluateRule(rule, context)) return true;
        }

        return false;
    }

    evaluateRule(rule, context) {
        switch (rule.type) {
            case 'email_domain':
                if (!context.email) return false;
                const domain = context.email.split('@')[1];
                return rule.values.includes(domain);

            case 'org_id':
                return rule.values.includes(context.orgId);

            case 'user_id':
                return rule.values.includes(context.userId);

            case 'percentage':
                // Deterministic hash of userId to 0-100
                if (!context.userId) return false;
                const hash = this.simpleHash(context.userId + rule.seed); // seed prevents all rollouts hitting same users
                return (hash % 100) < rule.value;

            default:
                return false;
        }
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return Math.abs(hash);
    }
}

module.exports = new FeatureFlagService();
