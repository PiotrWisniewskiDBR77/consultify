/**
 * Gamification Service
 * 
 * Manages user points, levels, and achievements.
 */

const { v4: uuidv4 } = require('uuid');

// Points Configuration
const POINTS_TABLE = {
    LOGIN: 10,                 // Daily login
    CREATE_AXIS: 50,           // Creating a new axis
    ADD_POSITION: 20,          // Adding a position
    INVITE_USER: 100,          // Inviting a team member
    COMPLETE_TOUR: 30,         // Finishing a guide
    COMPLETE_PHASE: 500,       // Finishing a lifecycle phase
    ADD_COMMENT: 5,            // Collaboration
};

// Level Configuration
const LEVELS = [
    { level: 1, name: 'Novice', minPoints: 0 },
    { level: 2, name: 'Explorer', minPoints: 200 },
    { level: 3, name: 'Contributor', minPoints: 500 },
    { level: 4, name: 'Strategist', minPoints: 1000 },
    { level: 5, name: 'Master', minPoints: 2500 },
    { level: 6, name: 'Visionary', minPoints: 5000 },
];

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

const GamificationService = {

    /**
     * Award points to a user
     */
    async awardPoints(userId, actionType, metadata = {}) {
        const points = POINTS_TABLE[actionType];
        if (!points) {
            console.warn(`Unknown gamification action: ${actionType}`);
            return null;
        }

        const db = getDb();
        const id = uuidv4();

        // Prevent spamming points (e.g., login points only once per day)
        if (actionType === 'LOGIN') {
            const hasLoginToday = await new Promise((resolve) => {
                db.get(
                    `SELECT id FROM user_points_ledger 
                     WHERE user_id = ? AND action_type = 'LOGIN' 
                     AND date(created_at) = date('now')`,
                    [userId],
                    (err, row) => resolve(!!row)
                );
            });
            if (hasLoginToday) return null;
        }

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_points_ledger (id, user_id, action_type, points_awarded, metadata)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, userId, actionType, points, JSON.stringify(metadata)],
                async function (err) {
                    if (err) return reject(err);

                    // Return new total points
                    const totalPoints = await GamificationService.getUserPoints(userId);
                    const level = GamificationService.calculateLevel(totalPoints);
                    resolve({ pointsAwarded: points, totalPoints, level });
                }
            );
        });
    },

    /**
     * Get total user points
     */
    async getUserPoints(userId) {
        const db = getDb();
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT SUM(points_awarded) as total FROM user_points_ledger WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.total || 0);
                }
            );
        });
    },

    /**
     * Calculate level based on points
     */
    calculateLevel(points) {
        // Find highest level where points >= minPoints
        return LEVELS.reduce((prev, curr) => {
            return (points >= curr.minPoints) ? curr : prev;
        }, LEVELS[0]);
    },

    /**
     * Get user gamification profile
     */
    async getUserProfile(userId) {
        const points = await this.getUserPoints(userId);
        const level = this.calculateLevel(points);
        const nextLevel = LEVELS.find(l => l.level === level.level + 1);

        // Progress to next level
        let progress = 100;
        if (nextLevel) {
            const range = nextLevel.minPoints - level.minPoints;
            const currentInLevel = points - level.minPoints;
            progress = Math.min(100, Math.round((currentInLevel / range) * 100));
        }

        return { points, level, nextLevel, progress };
    },

    /**
     * Unlock achievement
     */
    async unlockAchievement(userId, achievementId, metadata = {}) {
        const db = getDb();

        // Check if already unlocked
        const isUnlocked = await new Promise((resolve) => {
            db.get(
                `SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?`,
                [userId, achievementId],
                (err, row) => resolve(!!row)
            );
        });

        if (isUnlocked) return false;

        const id = uuidv4();
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_achievements (id, user_id, achievement_id, metadata, unlocked_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [id, userId, achievementId, JSON.stringify(metadata)],
                (err) => {
                    if (err) reject(err);
                    else resolve(true);
                }
            );
        });
    },

    /**
     * Get user achievements
     */
    async getUserAchievements(userId) {
        const db = getDb();
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }
};

module.exports = GamificationService;
