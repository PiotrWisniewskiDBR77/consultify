/**
 * IP Whitelist Service
 * Manages IP whitelisting for organizations
 */

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



const IPWhitelistService = {
    /**
     * Get IP whitelist for an organization
     */
    getWhitelist: (organizationId) => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM organization_ip_whitelist WHERE organization_id = ? AND is_active = 1 ORDER BY created_at DESC',
                [organizationId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Add IP to whitelist
     */
    addIP: (organizationId, ipAddress, ipRange = null, description = null, createdBy) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            db.run(
                `INSERT INTO organization_ip_whitelist 
                 (id, organization_id, ip_address, ip_range, description, created_by)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, organizationId, ipAddress, ipRange, description, createdBy],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint')) {
                            return reject(new Error('IP address already whitelisted'));
                        }
                        return reject(err);
                    }
                    resolve({ id, organizationId, ipAddress, ipRange, description });
                }
            );
        });
    },

    /**
     * Remove IP from whitelist
     */
    removeIP: (ipId) => {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE organization_ip_whitelist SET is_active = 0 WHERE id = ?',
                [ipId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ removed: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Check if IP is whitelisted
     */
    isWhitelisted: (organizationId, ipAddress) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT 1 FROM organization_ip_whitelist 
                 WHERE organization_id = ? AND is_active = 1 
                 AND (ip_address = ? OR ip_range IS NOT NULL)`,
                [organizationId, ipAddress],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(!!row);
                }
            );
        });
    }
};

export default IPWhitelistService;












