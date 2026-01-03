/**
 * Security Service
 * 
 * Manages security events and threat detection.
 * Features:
 * - Security event logging
 * - Threat detection
 * - Incident response
 * - Security event resolution
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');

class SecurityService {
    /**
     * Create a security event
     */
    async createEvent(eventData) {
        const {
            event_type,
            severity,
            user_id,
            ip_address,
            details = {}
        } = eventData;

        const id = uuidv4();
        const createdAt = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO security_events (
                    id, event_type, severity, user_id, ip_address,
                    details, resolved, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
                [
                    id, event_type, severity, user_id, ip_address,
                    JSON.stringify(details), createdAt
                ],
                function (err) {
                    if (err) {
                        console.error('[Security] Error creating event:', err);
                        return reject(err);
                    }
                    resolve({ id, ...eventData, created_at: createdAt });
                }
            );
        });
    }

    /**
     * Get security events with filtering
     */
    async getEvents(filters = {}, pagination = { page: 1, pageSize: 50 }) {
        const {
            severity,
            resolved,
            eventType,
            userId,
            startDate,
            endDate
        } = filters;

        const { page = 1, pageSize = 50 } = pagination;
        const offset = (page - 1) * pageSize;

        let query = 'SELECT * FROM security_events WHERE 1=1';
        const params = [];

        if (severity) {
            query += ' AND severity = ?';
            params.push(severity);
        }

        if (resolved !== undefined) {
            query += ' AND resolved = ?';
            params.push(resolved ? 1 : 0);
        }

        if (eventType) {
            query += ' AND event_type = ?';
            params.push(eventType);
        }

        if (userId) {
            query += ' AND user_id = ?';
            params.push(userId);
        }

        if (startDate) {
            query += ' AND created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND created_at <= ?';
            params.push(endDate);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(pageSize, offset);

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Security] Error fetching events:', err);
                    return reject(err);
                }

                const events = rows.map(row => ({
                    ...row,
                    details: row.details ? JSON.parse(row.details) : {},
                    resolved: row.resolved === 1
                }));

                resolve(events);
            });
        });
    }

    /**
     * Get security event by ID
     */
    async getEventById(id) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM security_events WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('[Security] Error fetching event:', err);
                    return reject(err);
                }

                if (!row) {
                    return resolve(null);
                }

                resolve({
                    ...row,
                    details: row.details ? JSON.parse(row.details) : {},
                    resolved: row.resolved === 1
                });
            });
        });
    }

    /**
     * Resolve a security event
     */
    async resolveEvent(id, resolvedBy) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE security_events 
                 SET resolved = 1, resolved_at = ?, resolved_by = ?
                 WHERE id = ?`,
                [new Date().toISOString(), resolvedBy, id],
                function (err) {
                    if (err) {
                        console.error('[Security] Error resolving event:', err);
                        return reject(err);
                    }
                    resolve({ resolved: this.changes > 0 });
                }
            );
        });
    }

    /**
     * Detect suspicious activity
     */
    async detectSuspiciousActivity(userId, ipAddress, activity) {
        // Check for multiple failed logins
        const recentFailedLogins = await this.getRecentFailedLogins(userId, ipAddress);
        
        if (recentFailedLogins >= 5) {
            await this.createEvent({
                event_type: 'brute_force_attempt',
                severity: 'HIGH',
                user_id: userId,
                ip_address: ipAddress,
                details: {
                    activity,
                    failed_attempts: recentFailedLogins
                }
            });
            return { suspicious: true, reason: 'brute_force' };
        }

        // Check for unusual IP location
        // This is a placeholder - implement actual IP geolocation check
        const unusualLocation = false;
        if (unusualLocation) {
            await this.createEvent({
                event_type: 'unusual_location',
                severity: 'MEDIUM',
                user_id: userId,
                ip_address: ipAddress,
                details: { activity }
            });
            return { suspicious: true, reason: 'unusual_location' };
        }

        return { suspicious: false };
    }

    /**
     * Get recent failed login attempts
     */
    async getRecentFailedLogins(userId, ipAddress) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count FROM security_events
                 WHERE event_type = 'failed_login'
                 AND (user_id = ? OR ip_address = ?)
                 AND created_at > datetime('now', '-1 hour')`,
                [userId, ipAddress],
                (err, row) => {
                    if (err) {
                        console.error('[Security] Error counting failed logins:', err);
                        return reject(err);
                    }
                    resolve(row ? row.count : 0);
                }
            );
        });
    }

    /**
     * Get security statistics
     */
    async getStats(filters = {}) {
        const { startDate, endDate } = filters;

        let query = `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical,
                COUNT(CASE WHEN severity = 'HIGH' THEN 1 END) as high,
                COUNT(CASE WHEN severity = 'MEDIUM' THEN 1 END) as medium,
                COUNT(CASE WHEN severity = 'LOW' THEN 1 END) as low,
                COUNT(CASE WHEN resolved = 1 THEN 1 END) as resolved,
                COUNT(CASE WHEN resolved = 0 THEN 1 END) as unresolved
            FROM security_events
            WHERE 1=1
        `;
        const params = [];

        if (startDate) {
            query += ' AND created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND created_at <= ?';
            params.push(endDate);
        }

        return new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) {
                    console.error('[Security] Error fetching stats:', err);
                    return reject(err);
                }
                resolve(row || {
                    total: 0, critical: 0, high: 0, medium: 0, low: 0,
                    resolved: 0, unresolved: 0
                });
            });
        });
    }
}

module.exports = new SecurityService();





