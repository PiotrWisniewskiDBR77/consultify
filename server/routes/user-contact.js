/**
 * User Contact Information Routes
 * 
 * Manages multiple contact methods for users:
 * - Multiple email addresses (work, personal, other)
 * - Multiple phone numbers (work, mobile, home)
 * - Office/home addresses
 * - Emergency contacts
 * - Preferred contact method
 */

import express from 'express';
const router = express.Router();
import requireAuth from '../middleware/authMiddleware.js';
import { getDatabase } from '../database/Database.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';
const crypto = require('crypto');

router.use(requireAuth);

/**
 * GET /api/user/contact-information
 * Get all contact information for current user
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;

        const [emails, phones, addresses, emergencyContacts, preferredMethod] = await Promise.all([
            // Get emails
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, email, type, is_primary, is_verified, verified_at, created_at
                     FROM user_contact_emails 
                     WHERE user_id = ?
                     ORDER BY is_primary DESC, created_at ASC`,
                    [userId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            }),
            // Get phones
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, phone, type, country_code, is_primary, is_verified, verified_at, created_at
                     FROM user_contact_phones 
                     WHERE user_id = ?
                     ORDER BY is_primary DESC, created_at ASC`,
                    [userId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            }),
            // Get addresses
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, type, street, city, state, postal_code, country, formatted, is_primary, created_at
                     FROM user_addresses 
                     WHERE user_id = ?
                     ORDER BY is_primary DESC, created_at ASC`,
                    [userId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            }),
            // Get emergency contacts
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, name, relationship, phone, email, is_primary, created_at
                     FROM user_emergency_contacts 
                     WHERE user_id = ?
                     ORDER BY is_primary DESC, created_at ASC`,
                    [userId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            }),
            // Get preferred contact method from user preferences or users table
            new Promise((resolve) => {
                db.get(
                    `SELECT preferred_contact_method FROM users WHERE id = ?`,
                    [userId],
                    (err, row) => {
                        if (err || !row) resolve(null);
                        else resolve(row.preferred_contact_method || null);
                    }
                );
            })
        ]);

        res.json({
            success: true,
            data: {
                emails,
                phones,
                addresses,
                emergencyContacts,
                preferredContactMethod: preferredMethod || 'email'
            }
        });
    } catch (error) {
        console.error('Error fetching contact information:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch contact information' });
    }
});

/**
 * PUT /api/user/contact-information
 * Update contact information (bulk update)
 */
router.put('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { emails, phones, addresses, emergencyContacts, preferredContactMethod } = req.body;

        // Start transaction-like operations
        const updates = [];

        // Update emails
        if (emails) {
            // Delete existing emails
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM user_contact_emails WHERE user_id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Insert new emails
            for (const email of emails) {
                const emailId = email.id || uuidv4();
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO user_contact_emails 
                         (id, user_id, email, type, is_primary, is_verified, verified_at, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)`,
                        [
                            emailId,
                            userId,
                            email.email,
                            email.type || 'work',
                            email.is_primary ? 1 : 0,
                            email.is_verified ? 1 : 0,
                            email.verified_at || null,
                            email.created_at || null
                        ],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
        }

        // Update phones
        if (phones) {
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM user_contact_phones WHERE user_id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            for (const phone of phones) {
                const phoneId = phone.id || uuidv4();
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO user_contact_phones 
                         (id, user_id, phone, type, country_code, is_primary, is_verified, verified_at, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)`,
                        [
                            phoneId,
                            userId,
                            phone.phone,
                            phone.type || 'mobile',
                            phone.country_code || '+1',
                            phone.is_primary ? 1 : 0,
                            phone.is_verified ? 1 : 0,
                            phone.verified_at || null,
                            phone.created_at || null
                        ],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
        }

        // Update addresses
        if (addresses) {
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM user_addresses WHERE user_id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            for (const address of addresses) {
                const addressId = address.id || uuidv4();
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO user_addresses 
                         (id, user_id, type, street, city, state, postal_code, country, formatted, is_primary, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)`,
                        [
                            addressId,
                            userId,
                            address.type || 'office',
                            address.street || null,
                            address.city || null,
                            address.state || null,
                            address.postal_code || address.postalCode || null,
                            address.country || null,
                            address.formatted || null,
                            address.is_primary ? 1 : 0,
                            address.created_at || null
                        ],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
        }

        // Update emergency contacts
        if (emergencyContacts) {
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM user_emergency_contacts WHERE user_id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            for (const contact of emergencyContacts) {
                const contactId = contact.id || uuidv4();
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO user_emergency_contacts 
                         (id, user_id, name, relationship, phone, email, is_primary, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)`,
                        [
                            contactId,
                            userId,
                            contact.name,
                            contact.relationship,
                            contact.phone,
                            contact.email || null,
                            contact.is_primary ? 1 : 0,
                            contact.created_at || null
                        ],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
        }

        // Update preferred contact method
        if (preferredContactMethod) {
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE users SET preferred_contact_method = ? WHERE id = ?`,
                    [preferredContactMethod, userId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        res.json({ success: true, message: 'Contact information updated successfully' });
    } catch (error) {
        console.error('Error updating contact information:', error);
        res.status(500).json({ success: false, error: 'Failed to update contact information' });
    }
});

/**
 * POST /api/user/contact-information/verify-email
 * Send verification email
 */
router.post('/verify-email', async (req, res) => {
    try {
        const userId = req.user.id;
        const { emailId } = req.body;

        // Generate verification token
        const token = crypto.randomBytes(32).toString('hex');

        // Update email with token
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE user_contact_emails 
                 SET verification_token = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND user_id = ?`,
                [token, emailId, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // In production, send verification email here
        // For now, just return success
        res.json({
            success: true,
            message: 'Verification email sent',
            token // In production, don't return token
        });
    } catch (error) {
        console.error('Error sending verification email:', error);
        res.status(500).json({ success: false, error: 'Failed to send verification email' });
    }
});

/**
 * POST /api/user/contact-information/verify-phone
 * Send verification SMS
 */
router.post('/verify-phone', async (req, res) => {
    try {
        const userId = req.user.id;
        const { phoneId } = req.body;

        // Generate verification code (6 digits)
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Update phone with code
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE user_contact_phones 
                 SET verification_code = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND user_id = ?`,
                [code, phoneId, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // In production, send SMS here
        // For now, just return success
        res.json({
            success: true,
            message: 'Verification code sent',
            code // In production, don't return code
        });
    } catch (error) {
        console.error('Error sending verification SMS:', error);
        res.status(500).json({ success: false, error: 'Failed to send verification SMS' });
    }
});

export default router;

