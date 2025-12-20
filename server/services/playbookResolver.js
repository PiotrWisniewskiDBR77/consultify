/**
 * Playbook Resolver Service
 * 
 * Handles priority, conflict resolution, and "next best playbook" logic.
 * Ensures users don't get overwhelmed with too many playbooks at once.
 * 
 * Step 6: Enterprise+ Ready
 */

const HelpService = require('./helpService');

/**
 * Maximum number of playbooks to show at once
 */
const MAX_CONCURRENT_PLAYBOOKS = 3;

/**
 * Playbook states for filtering
 */
const PLAYBOOK_STATES = {
    AVAILABLE: 'AVAILABLE',
    COMPLETED: 'COMPLETED',
    DISMISSED: 'DISMISSED'
};

const PlaybookResolver = {
    MAX_CONCURRENT_PLAYBOOKS,
    PLAYBOOK_STATES,

    /**
     * Get the next best playbooks based on context and priority
     * Filters out completed/dismissed playbooks and limits concurrent display
     * 
     * @param {Object} context - Context with orgType, role, userId, organizationId
     * @param {number} limit - Maximum playbooks to return
     * @returns {Promise<Array>} - Top N playbooks
     */
    getNextBestPlaybooks: async (context, limit = MAX_CONCURRENT_PLAYBOOKS) => {
        // Get all available playbooks for this context
        const allPlaybooks = await HelpService.getAvailablePlaybooks(context);

        // Filter out completed and dismissed (unless they want them shown again)
        const activePlaybooks = allPlaybooks.filter(p =>
            p.status === PLAYBOOK_STATES.AVAILABLE
        );

        // Resolve conflicts and priorities
        const resolved = PlaybookResolver.resolveConflicts(activePlaybooks, context);

        // Return top N
        return resolved.slice(0, limit);
    },

    /**
     * Check if a specific playbook should be shown to the user
     * 
     * @param {string} userId - User ID
     * @param {string} organizationId - Organization ID
     * @param {string} playbookKey - Playbook key
     * @returns {Promise<boolean>} - Whether to show
     */
    shouldShowPlaybook: async (userId, organizationId, playbookKey) => {
        const progress = await HelpService.getUserProgress(userId, organizationId, playbookKey);

        // Don't show if completed or dismissed
        return !progress.isCompleted && !progress.isDismissed;
    },

    /**
     * Resolve conflicts between multiple playbooks
     * Applies priority-based selection and context-aware filtering
     * 
     * @param {Array} playbooks - List of playbooks
     * @param {Object} context - Current context
     * @returns {Array} - Sorted and filtered playbooks
     */
    resolveConflicts: (playbooks, context) => {
        if (!playbooks || playbooks.length === 0) return [];

        // Apply scoring based on context relevance
        const scored = playbooks.map(p => {
            let score = 0;

            // Lower priority number = higher importance
            score += (6 - p.priority) * 10;

            // Specific org type match is better than ANY
            if (p.targetOrgType === context.orgType) {
                score += 5;
            }

            // Specific role match is better than ANY
            if (p.targetRole === context.role) {
                score += 5;
            }

            // Boost contextual playbooks based on route/feature
            if (context.currentRoute && p.targetRoute === context.currentRoute) {
                score += 20;
            }

            return { ...p, score };
        });

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        // Apply conflict rules:
        // - Don't show too many upgrade prompts at once
        // - Prefer action-oriented over informational
        const result = [];
        let upgradeCount = 0;
        const MAX_UPGRADE_PROMPTS = 1;

        for (const playbook of scored) {
            // Check for upgrade-type playbooks
            const isUpgrade = playbook.key.includes('upgrade') ||
                playbook.key.includes('trial') ||
                playbook.key.includes('demo');

            if (isUpgrade) {
                if (upgradeCount >= MAX_UPGRADE_PROMPTS) continue;
                upgradeCount++;
            }

            result.push(playbook);

            if (result.length >= MAX_CONCURRENT_PLAYBOOKS) break;
        }

        return result;
    },

    /**
     * Resolve the single recommended playbook key based on policy snapshot and context.
     * 
     * Deterministic priority order:
     * 1. Trial expired → trial_expired_upgrade
     * 2. Demo → start_trial_from_demo
     * 3. Trial <= 7 days → trial_last_week_upgrade
     * 4. Invites blocked → invite_blocked_explained
     * 5. Default → first_value_checklist
     * 
     * @param {Array} playbooks - Available playbooks for the user
     * @param {Object} policySnapshot - AccessPolicyService.buildPolicySnapshot() result
     * @param {string} route - Current route (for context-aware recommendations)
     * @returns {string|null} - Recommended playbook key or null if none
     */
    resolveRecommended: (playbooks, policySnapshot, route = '/') => {
        if (!policySnapshot || !playbooks || playbooks.length === 0) {
            return null;
        }

        const {
            isDemo,
            isTrial,
            isTrialExpired,
            trialDaysLeft,
            blockedActions = []
        } = policySnapshot;

        // Helper to check if playbook exists in available list
        const hasPlaybook = (key) => playbooks.some(p => p.key === key);

        // Rule 1: Trial expired - highest priority
        if (isTrial && isTrialExpired) {
            if (hasPlaybook('trial_expired_upgrade')) {
                return 'trial_expired_upgrade';
            }
        }

        // Rule 2: Demo mode - guide to start trial
        if (isDemo) {
            if (hasPlaybook('start_trial_from_demo')) {
                return 'start_trial_from_demo';
            }
        }

        // Rule 3: Trial with 7 or fewer days - nudge upgrade
        if (isTrial && !isTrialExpired && trialDaysLeft <= 7) {
            if (hasPlaybook('trial_last_week_upgrade')) {
                return 'trial_last_week_upgrade';
            }
        }

        // Rule 4: Invites blocked - explain why
        if (blockedActions.includes('INVITES')) {
            if (hasPlaybook('invite_blocked_explained')) {
                return 'invite_blocked_explained';
            }
        }

        // Rule 5: Route-based recommendations
        if (route) {
            if (route.includes('billing') || route.includes('settings')) {
                if (hasPlaybook('billing_upgrade_howto')) {
                    return 'billing_upgrade_howto';
                }
            }
            if (route.includes('team') || route.includes('users') || route.includes('invite')) {
                if (hasPlaybook('invite_team_howto')) {
                    return 'invite_team_howto';
                }
            }
        }

        // Default: First value checklist (onboarding)
        if (hasPlaybook('first_value_checklist')) {
            return 'first_value_checklist';
        }

        // Fallback: First available playbook
        return playbooks.length > 0 ? playbooks[0].key : null;
    },

    /**
     * Get contextual help hint for a specific feature
     * Used by inline help hooks
     * 
     * @param {string} featureKey - Feature identifier
     * @param {Object} context - User context
     * @returns {Promise<Object|null>} - Help hint or null
     */
    getHelpHintForFeature: async (featureKey, context) => {
        // Get all playbooks and find ones related to this feature
        const playbooks = await HelpService.getAvailablePlaybooks(context);

        // Check if the feature is in blockedActions (from AccessPolicy)
        const isBlocked = context.blockedActions?.includes(featureKey);
        const isLimited = context.blockedFeatures?.includes(featureKey);

        // Find relevant playbook
        const relevantPlaybook = playbooks.find(p => {
            // Check if playbook targets this feature (stored in description or a future field)
            const description = (p.description || '').toLowerCase();
            const key = p.key.toLowerCase();
            const featureLower = featureKey.toLowerCase();

            return description.includes(featureLower) || key.includes(featureLower);
        });

        if (!relevantPlaybook && !isBlocked && !isLimited) {
            return null;
        }

        // Build hint object
        return {
            featureKey,
            isBlocked,
            isLimited,
            reason: isBlocked ? PlaybookResolver._getBlockReason(featureKey, context) : null,
            playbook: relevantPlaybook ? {
                key: relevantPlaybook.key,
                title: relevantPlaybook.title,
                description: relevantPlaybook.description
            } : null,
            suggestedAction: isBlocked ? 'upgrade' : (relevantPlaybook ? 'learn' : null)
        };
    },

    /**
     * Get reason why a feature is blocked (based on AccessPolicy)
     * 
     * @param {string} featureKey - Feature that's blocked
     * @param {Object} context - Context including org type
     * @returns {string} - Human-readable reason
     */
    _getBlockReason: (featureKey, context) => {
        const { orgType } = context;

        switch (orgType) {
            case 'DEMO':
                return 'This feature is read-only in Demo mode. Start a free trial to unlock.';
            case 'TRIAL':
                if (context.isTrialExpired) {
                    return 'Your trial has expired. Upgrade to continue using this feature.';
                }
                if (featureKey.includes('ai')) {
                    return 'You have reached your daily AI limit. Upgrade for unlimited access.';
                }
                return 'This feature is limited in Trial mode. Upgrade for full access.';
            default:
                return 'This feature is not available in your current plan.';
        }
    },

    /**
     * Get recommended playbooks based on user's journey stage
     * 
     * @param {Object} context - Context object
     * @returns {Promise<Array>} - Recommended playbooks
     */
    getRecommendedPlaybooks: async (context) => {
        const playbooks = await PlaybookResolver.getNextBestPlaybooks(context);

        // Mark as recommended based on org stage
        return playbooks.map(p => ({
            ...p,
            isRecommended: true,
            recommendationReason: PlaybookResolver._getRecommendationReason(p, context)
        }));
    },

    /**
     * Generate recommendation reason
     * 
     * @param {Object} playbook - The playbook
     * @param {Object} context - Context
     * @returns {string} - Reason text
     */
    _getRecommendationReason: (playbook, context) => {
        if (context.orgType === 'DEMO') {
            return 'Explore how to get started';
        }
        if (context.orgType === 'TRIAL' && context.trialDaysLeft <= 7) {
            return 'Make the most of your trial';
        }
        if (playbook.key.includes('invite')) {
            return 'Grow your team';
        }
        if (playbook.key.includes('ai')) {
            return 'Unlock AI-powered insights';
        }
        return 'Recommended for you';
    }
};

module.exports = PlaybookResolver;
