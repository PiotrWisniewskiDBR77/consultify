/**
 * Security Event Service
 * Tracks and manages security events and alerts
 */

import { getDatabase } from '../src/database/index.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



const SecurityEventService = {
    /**
     * Log a security event
     */
    logEvent: (eventData) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            db.run(
                `INSERT INTO security_events 
                 (id, organization_id, user_id, event_type, severity, ip_address, user_agent,
                  location_country, location_city, details_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    eventData.organizationId || null,
                    eventData.userId || null,
                    eventData.eventType,
                    eventData.severity || 'medium',
                    eventData.ipAddress || null,
                    eventData.userAgent || null,
                    eventData.locationCountry || null,
                    eventData.locationCity || null,
                    JSON.stringify(eventData.details || {})
                ],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, ...eventData });
                }
            );
        });
    },

    /**
     * Get security events with filters
     */
    getEvents: (filters = {}) => {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM security_events WHERE 1=1';
            const params = [];

            if (filters.organizationId) {
                query += ' AND organization_id = ?';
                params.push(filters.organizationId);
            }
            if (filters.userId) {
                query += ' AND user_id = ?';
                params.push(filters.userId);
            }
            if (filters.eventType) {
                query += ' AND event_type = ?';
                params.push(filters.eventType);
            }
            if (filters.severity) {
                query += ' AND severity = ?';
                params.push(filters.severity);
            }
            if (filters.resolved !== undefined) {
                query += ' AND resolved = ?';
                params.push(filters.resolved ? 1 : 0);
            }

            query += ' ORDER BY created_at DESC LIMIT ?';
            params.push(filters.limit || 100);

            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Resolve a security event
     */
    resolveEvent: (eventId, resolvedBy) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE security_events 
                 SET resolved = 1, resolved_at = datetime('now'), resolved_by = ?
                 WHERE id = ?`,
                [resolvedBy, eventId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ resolved: this.changes > 0 });
                }
            );
        });
    }
};

export default SecurityEventService;








