/**
 * Journey Analytics Service
 * 
 * Tracks user journey events for Phase A-F progression.
 * Used for:
 * - Activation metrics
 * - Time-to-Value calculations
 * - Funnel drop-off analysis
 */

const { v4: uuidv4 } = require('uuid');

// Lazy-loaded database
let db = null;
const getDb = () => {
    if (!db) {
        try {
            db = require('../db/sqliteAsync');
        } catch (e) {
            db = require('../database');
        }
    }
    return db;
};

// Event types
const EVENT_TYPES = {
    PHASE_ENTRY: 'phase_entry',
    MILESTONE: 'milestone',
    FEATURE_USE: 'feature_use',
    TOUR_EVENT: 'tour_event',
};

// Phase milestones definition
const PHASE_MILESTONES = {
    A: ['cta_clicked'],
    B: ['demo_started', 'viewed_3_pages', 'used_ai_narrator', 'demo_completed'],
    C: ['code_entered', 'trial_started', 'confirmations_accepted'],
    D: ['org_name_set', 'role_selected', 'context_set', 'memory_activated'],
    E: ['first_axis_created', 'first_position_added', 'ai_question_answered', 'snapshot_created'],
    F: ['invite_sent', 'second_user_joined', 'multi_perspective_view'],
};

// Activation definition per phase
const ACTIVATION_CRITERIA = {
    A: ['cta_clicked'],
    B: ['demo_started', 'viewed_3_pages'],
    C: ['code_entered', 'trial_started'],
    D: ['memory_activated'],
    E: ['first_axis_created', 'snapshot_created'],
    F: ['second_user_joined'],
};

const JourneyAnalytics = {
    /**
     * Track phase entry
     */
    async trackPhaseEntry(userId, phase, metadata = {}) {
        return this._trackEvent({
            userId,
            eventType: EVENT_TYPES.PHASE_ENTRY,
            eventName: `phase_${phase}_entered`,
            phase,
            metadata,
        });
    },

    /**
     * Track activation milestone
     */
    async trackMilestone(userId, milestone, metadata = {}) {
        const phase = this._getPhaseForMilestone(milestone);
        return this._trackEvent({
            userId,
            eventType: EVENT_TYPES.MILESTONE,
            eventName: milestone,
            phase,
            metadata,
        });
    },

    /**
     * Track feature usage
     */
    async trackFeatureUse(userId, featureId, metadata = {}) {
        return this._trackEvent({
            userId,
            eventType: EVENT_TYPES.FEATURE_USE,
            eventName: featureId,
            metadata,
        });
    },

    /**
     * Track tour events
     */
    async trackTourEvent(userId, tourId, eventName, metadata = {}) {
        return this._trackEvent({
            userId,
            eventType: EVENT_TYPES.TOUR_EVENT,
            eventName: `tour_${eventName}`,
            metadata: { tourId, ...metadata },
        });
    },

    /**
     * Internal event tracking
     */
    async _trackEvent({ userId, eventType, eventName, phase = null, metadata = {} }) {
        const db = getDb();
        const id = uuidv4();
        const organizationId = metadata.organizationId || null;

        try {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO journey_events (id, user_id, organization_id, event_type, event_name, phase, metadata, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                    [id, userId, organizationId, eventType, eventName, phase, JSON.stringify(metadata)],
                    function (err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    }
                );
            });

            return { success: true, eventId: id };
        } catch (error) {
            console.error('[JourneyAnalytics] Track event error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get user's complete journey
     */
    async getUserJourney(userId) {
        const db = getDb();

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM journey_events 
                 WHERE user_id = ? 
                 ORDER BY created_at ASC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    },

    /**
     * Check if user is activated for a phase
     */
    async isActivated(userId, phase) {
        const events = await this.getUserJourney(userId);
        const eventNames = events.map(e => e.event_name);
        const criteria = ACTIVATION_CRITERIA[phase] || [];

        return criteria.every(milestone => eventNames.includes(milestone));
    },

    /**
     * Calculate Time-to-Value for user
     */
    async calculateTimeToValue(userId) {
        const events = await this.getUserJourney(userId);

        if (events.length === 0) {
            return null;
        }

        const findEvent = (name) => events.find(e => e.event_name === name);
        const timeDiff = (e1, e2) => {
            if (!e1 || !e2) return null;
            return new Date(e2.created_at) - new Date(e1.created_at);
        };

        const signup = findEvent('phase_A_entered');
        const demoStarted = findEvent('demo_started');
        const demoCompleted = findEvent('demo_completed');
        const trialStarted = findEvent('trial_started');
        const orgCreated = findEvent('memory_activated');
        const snapshotCreated = findEvent('snapshot_created');

        return {
            signup_to_demo: timeDiff(signup, demoStarted),
            demo_duration: timeDiff(demoStarted, demoCompleted),
            demo_to_trial: timeDiff(demoCompleted, trialStarted),
            trial_to_org: timeDiff(trialStarted, orgCreated),
            org_to_first_value: timeDiff(orgCreated, snapshotCreated),
            total_ttv: timeDiff(signup, snapshotCreated),
            first_event: events[0]?.created_at,
            last_event: events[events.length - 1]?.created_at,
        };
    },

    /**
     * Get aggregate funnel metrics
     */
    async getFunnelMetrics(dateRange = {}) {
        const db = getDb();
        const { startDate, endDate } = dateRange;

        let dateFilter = '';
        const params = [];

        if (startDate) {
            dateFilter += ' AND created_at >= ?';
            params.push(startDate);
        }
        if (endDate) {
            dateFilter += ' AND created_at <= ?';
            params.push(endDate);
        }

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    phase,
                    COUNT(DISTINCT user_id) as users
                 FROM journey_events 
                 WHERE event_type = 'phase_entry' ${dateFilter}
                 GROUP BY phase
                 ORDER BY phase`,
                params,
                (err, rows) => {
                    if (err) reject(err);
                    else {
                        // Convert to funnel format
                        const funnel = {};
                        (rows || []).forEach(row => {
                            funnel[row.phase] = row.users;
                        });
                        resolve(funnel);
                    }
                }
            );
        });
    },

    /**
     * Get drop-off analysis
     */
    async getDropOffAnalysis(dateRange = {}) {
        const funnel = await this.getFunnelMetrics(dateRange);
        const phases = ['A', 'B', 'C', 'D', 'E', 'F'];
        const analysis = [];

        for (let i = 0; i < phases.length - 1; i++) {
            const current = funnel[phases[i]] || 0;
            const next = funnel[phases[i + 1]] || 0;
            const dropOff = current > 0 ? ((current - next) / current * 100).toFixed(1) : 0;

            analysis.push({
                from: phases[i],
                to: phases[i + 1],
                usersIn: current,
                usersOut: next,
                dropOffPercent: parseFloat(dropOff),
            });
        }

        return analysis;
    },

    /**
     * Get average TTV across users
     */
    async getAverageTTV(dateRange = {}) {
        const db = getDb();

        // Get all users with snapshot_created
        const users = await new Promise((resolve, reject) => {
            db.all(
                `SELECT DISTINCT user_id FROM journey_events 
                 WHERE event_name = 'snapshot_created'`,
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        if (users.length === 0) {
            return { avgTTV: null, sampleSize: 0 };
        }

        let totalTTV = 0;
        let validSamples = 0;

        for (const user of users) {
            const ttv = await this.calculateTimeToValue(user.user_id);
            if (ttv?.total_ttv) {
                totalTTV += ttv.total_ttv;
                validSamples++;
            }
        }

        return {
            avgTTV: validSamples > 0 ? Math.round(totalTTV / validSamples / 1000 / 60) : null, // in minutes
            sampleSize: validSamples,
        };
    },

    /**
     * Helper: get phase for milestone
     */
    _getPhaseForMilestone(milestone) {
        for (const [phase, milestones] of Object.entries(PHASE_MILESTONES)) {
            if (milestones.includes(milestone)) {
                return phase;
            }
        }
        return null;
    },
};

module.exports = JourneyAnalytics;
