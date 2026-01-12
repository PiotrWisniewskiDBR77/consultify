/**
 * Consent Management Service
 * Manages user consents for GDPR compliance
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const ConsentManagementService = {
    /**
     * Get consents for a user
     */
    getConsents: (userId, organizationId) => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM user_consents WHERE user_id = ? AND organization_id = ? ORDER BY created_at DESC',
                [userId, organizationId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    /**
     * Grant consent
     */
    grantConsent: (userId, organizationId, consentType, consentVersion, ipAddress, userAgent) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            db.run(
                `INSERT INTO user_consents 
                 (id, user_id, organization_id, consent_type, consent_status, consent_version, granted_at, ip_address, user_agent)
                 VALUES (?, ?, ?, ?, 'granted', ?, datetime('now'), ?, ?)
                 ON CONFLICT(user_id, organization_id, consent_type) DO UPDATE SET
                 consent_status = 'granted',
                 consent_version = excluded.consent_version,
                 granted_at = datetime('now'),
                 withdrawn_at = NULL,
                 ip_address = excluded.ip_address,
                 user_agent = excluded.user_agent`,
                [id, userId, organizationId, consentType, consentVersion, ipAddress, userAgent],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, userId, organizationId, consentType, status: 'granted' });
                }
            );
        });
    },

    /**
     * Withdraw consent
     */
    withdrawConsent: (userId, organizationId, consentType) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE user_consents 
                 SET consent_status = 'withdrawn', withdrawn_at = datetime('now')
                 WHERE user_id = ? AND organization_id = ? AND consent_type = ?`,
                [userId, organizationId, consentType],
                function (err) {
                    if (err) return reject(err);
                    resolve({ withdrawn: this.changes > 0 });
                }
            );
        });
    },

    /**
     * Check if user has granted consent
     */
    hasConsent: (userId, organizationId, consentType) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT 1 FROM user_consents 
                 WHERE user_id = ? AND organization_id = ? AND consent_type = ? 
                 AND consent_status = 'granted' AND withdrawn_at IS NULL`,
                [userId, organizationId, consentType],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(!!row);
                }
            );
        });
    }
};

export default ConsentManagementService;





