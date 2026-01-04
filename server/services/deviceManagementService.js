/**
 * Device Management Service
 * Manages user devices and device trust
 */

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



const DeviceManagementService = {
    /**
     * Register or update a device
     */
    registerDevice: (userId, deviceId, deviceInfo) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM user_devices WHERE device_id = ?',
                [deviceId],
                (err, existing) => {
                    if (err) return reject(err);

                    if (existing) {
                        // Update existing device
                        db.run(
                            `UPDATE user_devices 
                             SET last_seen_at = datetime('now'),
                                 device_name = COALESCE(?, device_name),
                                 device_type = COALESCE(?, device_type),
                                 browser = COALESCE(?, browser),
                                 os = COALESCE(?, os),
                                 ip_address = COALESCE(?, ip_address)
                             WHERE device_id = ?`,
                            [deviceInfo.deviceName, deviceInfo.deviceType, deviceInfo.browser,
                             deviceInfo.os, deviceInfo.ipAddress, deviceId],
                            function (updateErr) {
                                if (updateErr) return reject(updateErr);
                                resolve({ ...existing, ...deviceInfo, lastSeenAt: new Date().toISOString() });
                            }
                        );
                    } else {
                        // Create new device
                        const id = uuidv4();
                        db.run(
                            `INSERT INTO user_devices 
                             (id, user_id, device_id, device_name, device_type, browser, os, ip_address)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            [id, userId, deviceId, deviceInfo.deviceName || '', deviceInfo.deviceType || 'desktop',
                             deviceInfo.browser || '', deviceInfo.os || '', deviceInfo.ipAddress || ''],
                            function (insertErr) {
                                if (insertErr) return reject(insertErr);
                                resolve({ id, userId, deviceId, ...deviceInfo });
                            }
                        );
                    }
                }
            );
        });
    },

    /**
     * Get devices for a user
     */
    getUserDevices: (userId) => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM user_devices WHERE user_id = ? ORDER BY last_seen_at DESC',
                [userId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Trust a device
     */
    trustDevice: (deviceId) => {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE user_devices SET is_trusted = 1 WHERE device_id = ?',
                [deviceId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ trusted: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Block a device
     */
    blockDevice: (deviceId, reason = null) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE user_devices 
                 SET is_blocked = 1, blocked_reason = ?, blocked_at = datetime('now')
                 WHERE device_id = ?`,
                [reason, deviceId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ blocked: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Unblock a device
     */
    unblockDevice: (deviceId) => {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE user_devices SET is_blocked = 0, blocked_reason = NULL, blocked_at = NULL WHERE device_id = ?',
                [deviceId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ unblocked: this.changes > 0 });
                }
            );
        });
    }
};

export default DeviceManagementService;












