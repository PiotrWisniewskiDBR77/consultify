/**
 * User Goals Service
 * 
 * Manages user goal preferences for personalized onboarding.
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

// Valid goal IDs
const VALID_GOALS = [
    'strategic_decision',
    'team_alignment',
    'executive_prep',
    'explore',
];

const UserGoalsService = {
    /**
     * Get user's selected goal
     */
    async getUserGoal(userId) {
        const db = getDb();

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT goal_id, selected_at, metadata 
                 FROM user_goals 
                 WHERE user_id = ? 
                 ORDER BY selected_at DESC 
                 LIMIT 1`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? {
                        goalId: row.goal_id,
                        selectedAt: row.selected_at,
                        metadata: row.metadata ? JSON.parse(row.metadata) : {},
                    } : null);
                }
            );
        });
    },

    /**
     * Set user's goal
     */
    async setUserGoal(userId, goalId, metadata = {}) {
        if (!VALID_GOALS.includes(goalId)) {
            throw new Error(`Invalid goal ID: ${goalId}`);
        }

        const db = getDb();
        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_goals (id, user_id, goal_id, metadata, selected_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [id, userId, goalId, JSON.stringify(metadata)],
                function (err) {
                    if (err) reject(err);
                    else resolve({ id, goalId, userId });
                }
            );
        });
    },

    /**
     * Get goal history for user
     */
    async getGoalHistory(userId) {
        const db = getDb();

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT goal_id, selected_at, metadata 
                 FROM user_goals 
                 WHERE user_id = ? 
                 ORDER BY selected_at DESC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    },

    /**
     * Get suggested actions for a goal
     */
    getSuggestedActions(goalId) {
        const actionMap = {
            'strategic_decision': [
                { action: 'create_axis', label: 'Utwórz oś decyzyjną' },
                { action: 'add_position', label: 'Dodaj perspektywę' },
                { action: 'generate_snapshot', label: 'Wygeneruj snapshot' },
            ],
            'team_alignment': [
                { action: 'create_axis', label: 'Utwórz oś decyzyjną' },
                { action: 'invite_team', label: 'Zaproś członków zespołu' },
                { action: 'multi_perspective', label: 'Zobacz różne perspektywy' },
            ],
            'executive_prep': [
                { action: 'create_axis', label: 'Utwórz oś decyzyjną' },
                { action: 'document_positions', label: 'Udokumentuj stanowiska' },
                { action: 'generate_report', label: 'Wygeneruj raport' },
            ],
            'explore': [
                { action: 'browse_demo', label: 'Przeglądaj demo' },
                { action: 'read_methodology', label: 'Poznaj metodologię DRD' },
            ],
        };

        return actionMap[goalId] || [];
    },

    /**
     * Get tour ID for goal
     */
    getTourForGoal(goalId) {
        const tourMap = {
            'strategic_decision': 'first_value',
            'team_alignment': 'team_expansion',
            'executive_prep': 'first_value',
            'explore': 'demo_main',
        };

        return tourMap[goalId] || null;
    },
};

module.exports = UserGoalsService;
