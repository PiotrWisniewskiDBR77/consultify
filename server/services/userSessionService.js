/**
 * User Session Service
 * Manages detailed user sessions
 */

import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';



const UserSessionService = {
    /**
     * Create a new session
     */
    createSession: (userId, organizationId, sessionToken, ipAddress, userAgent, deviceInfo, expiresAt, loginMethod = 'password') => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            const deviceType = deviceInfo?.deviceType || 'desktop';
            const browser = deviceInfo?.browser || '';
            const os = deviceInfo?.os || '';
            const locationCountry = deviceInfo?.locationCountry || '';
            const locationCity = deviceInfo?.locationCity || '';

            db.run(
                `INSERT INTO user_sessions 
                 (id, user_id, organization_id, session_token, ip_address, user_agent,
                  device_type, browser, os, location_country, location_city, login_method, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, userId, organizationId, sessionToken, ipAddress, userAgent,
                 deviceType, browser, os, locationCountry, locationCity, loginMethod, expiresAt],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, userId, organizationId, sessionToken, isActive: true });
                }
            );
        });
    },

    /**
     * Get active sessions for a user
     */
    getActiveSessions: (userId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM user_sessions 
                 WHERE user_id = ? AND is_active = 1 AND expires_at > datetime('now')
                 ORDER BY last_activity_at DESC`,
                [userId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Get all sessions for a user
     */
    getAllSessions: (userId, limit = 50) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM user_sessions 
                 WHERE user_id = ? 
                 ORDER BY started_at DESC LIMIT ?`,
                [userId, limit],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Update session activity
     */
    updateActivity: (sessionId) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE user_sessions 
                 SET last_activity_at = datetime('now')
                 WHERE id = ? AND is_active = 1`,
                [sessionId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    },

    /**
     * End a session
     */
    endSession: (sessionId, endReason = 'logout') => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE user_sessions 
                 SET is_active = 0, ended_at = datetime('now'), end_reason = ?
                 WHERE id = ?`,
                [endReason, sessionId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ ended: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Revoke all sessions for a user
     */
    revokeAllSessions: (userId, endReason = 'revoked') => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE user_sessions 
                 SET is_active = 0, ended_at = datetime('now'), end_reason = ?
                 WHERE user_id = ? AND is_active = 1`,
                [endReason, userId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ revoked: true });
                }
            );
        });
    }
};

export default UserSessionService;






