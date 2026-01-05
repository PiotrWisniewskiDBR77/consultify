/**
 * User Availability Routes
 * 
 * Manages user availability settings:
 * - Custom status message
 * - Out of office dates
 * - Working hours (per day of week)
 * - Do not disturb hours
 */

import express from 'express';
const router = express.Router();
import requireAuth from '../middleware/authMiddleware.js';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();

import { v4 as uuidv4 } from 'uuid';

router.use(requireAuth);

/**
 * GET /api/user/availability
 * Get availability settings for current user
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;

        const [availability, oooPeriods] = await Promise.all([
            // Get availability settings
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT id, status_message, working_hours_json, dnd_hours_json, created_at, updated_at
                     FROM user_availability 
                     WHERE user_id = ?`,
                    [userId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row || null);
                    }
                );
            }),
            // Get out of office periods
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, start_date, end_date, reason, is_all_day, created_at
                     FROM user_out_of_office 
                     WHERE user_id = ? AND end_date >= date('now')
                     ORDER BY start_date ASC`,
                    [userId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            })
        ]);

        res.json({
            success: true,
            data: {
                statusMessage: availability?.status_message || null,
                workingHours: availability?.working_hours_json ? JSON.parse(availability.working_hours_json) : {},
                doNotDisturbHours: availability?.dnd_hours_json ? JSON.parse(availability.dnd_hours_json) : {},
                outOfOfficePeriods: oooPeriods
            }
        });
    } catch (error) {
        console.error('Error fetching availability:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch availability' });
    }
});

/**
 * PUT /api/user/availability
 * Update availability settings
 */
router.put('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { statusMessage, workingHours, doNotDisturbHours } = req.body;

        // Check if availability record exists
        const existing = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM user_availability WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (existing) {
            // Update existing
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE user_availability 
                     SET status_message = ?, working_hours_json = ?, dnd_hours_json = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = ?`,
                    [
                        statusMessage || null,
                        JSON.stringify(workingHours || {}),
                        JSON.stringify(doNotDisturbHours || {}),
                        userId
                    ],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        } else {
            // Create new
            const id = uuidv4();
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO user_availability 
                     (id, user_id, status_message, working_hours_json, dnd_hours_json, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [
                        id,
                        userId,
                        statusMessage || null,
                        JSON.stringify(workingHours || {}),
                        JSON.stringify(doNotDisturbHours || {})
                    ],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        res.json({ success: true, message: 'Availability updated successfully' });
    } catch (error) {
        console.error('Error updating availability:', error);
        res.status(500).json({ success: false, error: 'Failed to update availability' });
    }
});

/**
 * GET /api/user/out-of-office
 * Get all out of office periods
 */
router.get('/out-of-office', async (req, res) => {
    try {
        const userId = req.user.id;

        const periods = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id, start_date, end_date, reason, is_all_day, created_at
                 FROM user_out_of_office 
                 WHERE user_id = ?
                 ORDER BY start_date DESC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        res.json({ success: true, data: periods });
    } catch (error) {
        console.error('Error fetching out of office periods:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch out of office periods' });
    }
});

/**
 * POST /api/user/out-of-office
 * Create new out of office period
 */
router.post('/out-of-office', async (req, res) => {
    try {
        const userId = req.user.id;
        const { startDate, endDate, reason, isAllDay } = req.body;

        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, error: 'Start date and end date are required' });
        }

        const id = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_out_of_office 
                 (id, user_id, start_date, end_date, reason, is_all_day, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                    id,
                    userId,
                    startDate,
                    endDate,
                    reason || null,
                    isAllDay ? 1 : 0
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, message: 'Out of office period created', data: { id } });
    } catch (error) {
        console.error('Error creating out of office period:', error);
        res.status(500).json({ success: false, error: 'Failed to create out of office period' });
    }
});

/**
 * DELETE /api/user/out-of-office/:id
 * Delete out of office period
 */
router.delete('/out-of-office/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM user_out_of_office 
                 WHERE id = ? AND user_id = ?`,
                [id, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, message: 'Out of office period deleted' });
    } catch (error) {
        console.error('Error deleting out of office period:', error);
        res.status(500).json({ success: false, error: 'Failed to delete out of office period' });
    }
});

export default router;














