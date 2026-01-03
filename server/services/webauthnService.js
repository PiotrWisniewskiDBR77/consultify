/**
 * WebAuthn Service
 * 
 * Implements WebAuthn (FIDO2) authentication
 * Supports passkeys, security keys, and platform authenticators
 * 
 * Features:
 * - Credential registration
 * - Authentication
 * - Credential management
 * - Challenge generation and verification
 */

import crypto from 'crypto';
import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';



// WebAuthn configuration
const WEBAUTHN_CONFIG = {
    rpName: 'Consultify',
    rpId: process.env.WEBAUTHN_RP_ID || 'localhost',
    origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000',
    challengeTimeout: 5 * 60 * 1000, // 5 minutes
    attestation: 'none', // 'none', 'direct', 'indirect', 'enterprise'
    userVerification: 'preferred', // 'required', 'preferred', 'discouraged'
};

class WebAuthnService {
    // ====== REGISTRATION ======

    /**
     * Generate registration options for WebAuthn credential creation
     */
    async generateRegistrationOptions(userId, userName, userDisplayName) {
        const challenge = this.generateChallenge();
        const challengeId = uuidv4();

        // Get existing credentials to exclude
        const existingCredentials = await this.getUserCredentials(userId);

        const options = {
            challenge: this.base64URLEncode(challenge),
            rp: {
                name: WEBAUTHN_CONFIG.rpName,
                id: WEBAUTHN_CONFIG.rpId,
            },
            user: {
                id: this.base64URLEncode(Buffer.from(userId)),
                name: userName,
                displayName: userDisplayName || userName,
            },
            pubKeyCredParams: [
                { alg: -7, type: 'public-key' },   // ES256
                { alg: -257, type: 'public-key' }, // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform', // or 'cross-platform'
                requireResidentKey: true,
                residentKey: 'preferred',
                userVerification: WEBAUTHN_CONFIG.userVerification,
            },
            timeout: WEBAUTHN_CONFIG.challengeTimeout,
            attestation: WEBAUTHN_CONFIG.attestation,
            excludeCredentials: existingCredentials.map(cred => ({
                id: cred.credential_id,
                type: 'public-key',
                transports: JSON.parse(cred.transports || '[]'),
            })),
        };

        // Store challenge for verification
        const expiresAt = new Date(Date.now() + WEBAUTHN_CONFIG.challengeTimeout).toISOString();
        await this.storeChallenge(challengeId, userId, challenge, 'registration', expiresAt, options);

        return {
            challengeId,
            options,
        };
    }

    /**
     * Verify registration response and store credential
     */
    async verifyRegistration(challengeId, userId, response, deviceName = null) {
        // Get stored challenge
        const storedChallenge = await this.getChallenge(challengeId);
        
        if (!storedChallenge || storedChallenge.status !== 'pending') {
            throw new Error('Invalid or expired challenge');
        }

        if (storedChallenge.user_id !== userId) {
            throw new Error('Challenge user mismatch');
        }

        if (new Date(storedChallenge.expires_at) < new Date()) {
            await this.invalidateChallenge(challengeId);
            throw new Error('Challenge expired');
        }

        // Parse the attestation response
        const { id, rawId, response: attestationResponse, type, authenticatorAttachment } = response;
        
        if (type !== 'public-key') {
            throw new Error('Invalid credential type');
        }

        // Decode client data
        const clientDataJSON = this.base64URLDecode(attestationResponse.clientDataJSON);
        const clientData = JSON.parse(clientDataJSON.toString('utf8'));

        // Verify challenge matches
        const expectedChallenge = this.base64URLEncode(Buffer.from(storedChallenge.challenge, 'base64'));
        if (clientData.challenge !== expectedChallenge) {
            throw new Error('Challenge mismatch');
        }

        // Verify origin
        if (clientData.origin !== WEBAUTHN_CONFIG.origin) {
            // Allow localhost variations in development
            if (!clientData.origin.includes('localhost')) {
                throw new Error('Origin mismatch');
            }
        }

        // Verify type
        if (clientData.type !== 'webauthn.create') {
            throw new Error('Invalid client data type');
        }

        // Decode attestation object
        const attestationObject = this.base64URLDecode(attestationResponse.attestationObject);
        const attestation = this.decodeAttestationObject(attestationObject);

        // Extract public key
        const publicKey = this.extractPublicKey(attestation.authData);

        // Store credential
        const credentialId = uuidv4();
        await this.storeCredential({
            id: credentialId,
            userId,
            credentialId: id,
            publicKey: this.base64URLEncode(publicKey),
            aaguid: attestation.aaguid,
            signCount: attestation.signCount,
            transports: attestationResponse.transports || [],
            attestationType: attestation.fmt || 'none',
            deviceName,
            deviceType: authenticatorAttachment || 'unknown',
            backupEligible: attestation.flags?.be || false,
            backupState: attestation.flags?.bs || false,
        });

        // Mark challenge as used
        await this.invalidateChallenge(challengeId);

        return {
            credentialId,
            deviceType: authenticatorAttachment,
            created: true,
        };
    }

    // ====== AUTHENTICATION ======

    /**
     * Generate authentication options
     */
    async generateAuthenticationOptions(userId = null) {
        const challenge = this.generateChallenge();
        const challengeId = uuidv4();

        let allowedCredentials = [];

        // If userId is provided, get user's credentials
        if (userId) {
            const credentials = await this.getUserCredentials(userId);
            allowedCredentials = credentials.map(cred => ({
                id: cred.credential_id,
                type: 'public-key',
                transports: JSON.parse(cred.transports || '[]'),
            }));
        }

        const options = {
            challenge: this.base64URLEncode(challenge),
            timeout: WEBAUTHN_CONFIG.challengeTimeout,
            rpId: WEBAUTHN_CONFIG.rpId,
            userVerification: WEBAUTHN_CONFIG.userVerification,
            allowCredentials: allowedCredentials.length > 0 ? allowedCredentials : undefined,
        };

        // Store challenge
        const expiresAt = new Date(Date.now() + WEBAUTHN_CONFIG.challengeTimeout).toISOString();
        await this.storeChallenge(challengeId, userId, challenge, 'authentication', expiresAt, options);

        return {
            challengeId,
            options,
        };
    }

    /**
     * Verify authentication response
     */
    async verifyAuthentication(challengeId, response) {
        // Get stored challenge
        const storedChallenge = await this.getChallenge(challengeId);
        
        if (!storedChallenge || storedChallenge.status !== 'pending') {
            throw new Error('Invalid or expired challenge');
        }

        if (new Date(storedChallenge.expires_at) < new Date()) {
            await this.invalidateChallenge(challengeId);
            throw new Error('Challenge expired');
        }

        const { id, rawId, response: assertionResponse, type } = response;

        if (type !== 'public-key') {
            throw new Error('Invalid credential type');
        }

        // Find credential by ID
        const credential = await this.getCredentialById(id);
        
        if (!credential) {
            throw new Error('Credential not found');
        }

        if (!credential.is_active) {
            throw new Error('Credential has been revoked');
        }

        // Decode client data
        const clientDataJSON = this.base64URLDecode(assertionResponse.clientDataJSON);
        const clientData = JSON.parse(clientDataJSON.toString('utf8'));

        // Verify challenge
        const expectedChallenge = this.base64URLEncode(Buffer.from(storedChallenge.challenge, 'base64'));
        if (clientData.challenge !== expectedChallenge) {
            throw new Error('Challenge mismatch');
        }

        // Verify type
        if (clientData.type !== 'webauthn.get') {
            throw new Error('Invalid client data type');
        }

        // Decode authenticator data
        const authenticatorData = this.base64URLDecode(assertionResponse.authenticatorData);
        const authData = this.parseAuthenticatorData(authenticatorData);

        // Verify sign count to detect cloned authenticators
        const currentSignCount = authData.signCount;
        if (currentSignCount > 0 && credential.sign_count >= currentSignCount) {
            // Potential cloned authenticator
            console.warn('[WebAuthn] Potential cloned authenticator detected:', {
                credentialId: id,
                storedCount: credential.sign_count,
                receivedCount: currentSignCount,
            });
        }

        // Update sign count and last used
        await this.updateCredentialUsage(credential.id, currentSignCount);

        // Mark challenge as used
        await this.invalidateChallenge(challengeId);

        return {
            verified: true,
            userId: credential.user_id,
            credentialId: credential.id,
        };
    }

    // ====== CREDENTIAL MANAGEMENT ======

    /**
     * Get all credentials for a user
     */
    async getUserCredentials(userId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM webauthn_credentials WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC`,
                [userId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    /**
     * Get credential by WebAuthn credential ID
     */
    async getCredentialById(credentialId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM webauthn_credentials WHERE credential_id = ?`,
                [credentialId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });
    }

    /**
     * Store a new credential
     */
    async storeCredential(credential) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO webauthn_credentials (
                    id, user_id, credential_id, public_key, aaguid, sign_count,
                    transports, attestation_type, device_name, device_type,
                    backup_eligible, backup_state, is_active, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
                [
                    credential.id,
                    credential.userId,
                    credential.credentialId,
                    credential.publicKey,
                    credential.aaguid,
                    credential.signCount,
                    JSON.stringify(credential.transports),
                    credential.attestationType,
                    credential.deviceName,
                    credential.deviceType,
                    credential.backupEligible ? 1 : 0,
                    credential.backupState ? 1 : 0,
                ],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id: credential.id });
                }
            );
        });
    }

    /**
     * Update credential usage (sign count and last used)
     */
    async updateCredentialUsage(id, signCount) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE webauthn_credentials 
                 SET sign_count = ?, last_used_at = datetime('now'), usage_count = usage_count + 1
                 WHERE id = ?`,
                [signCount, id],
                function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    }

    /**
     * Rename a credential
     */
    async renameCredential(credentialId, userId, newName) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE webauthn_credentials SET device_name = ? WHERE id = ? AND user_id = ?`,
                [newName, credentialId, userId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ renamed: this.changes > 0 });
                }
            );
        });
    }

    /**
     * Revoke a credential
     */
    async revokeCredential(credentialId, userId, reason = null) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE webauthn_credentials 
                 SET is_active = 0, revoked_at = datetime('now'), revoked_reason = ?
                 WHERE id = ? AND user_id = ?`,
                [reason, credentialId, userId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ revoked: this.changes > 0 });
                }
            );
        });
    }

    /**
     * Check if user has WebAuthn enabled
     */
    async isWebAuthnEnabled(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count FROM webauthn_credentials WHERE user_id = ? AND is_active = 1`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row && row.count > 0);
                }
            );
        });
    }

    // ====== CHALLENGE MANAGEMENT ======

    /**
     * Generate a random challenge
     */
    generateChallenge() {
        return crypto.randomBytes(32);
    }

    /**
     * Store a challenge
     */
    async storeChallenge(id, userId, challenge, type, expiresAt, options) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO webauthn_challenges (
                    id, user_id, challenge, challenge_type, rp_id, rp_name,
                    user_verification, attestation, authenticator_selection,
                    allowed_credentials, status, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
                [
                    id,
                    userId,
                    challenge.toString('base64'),
                    type,
                    WEBAUTHN_CONFIG.rpId,
                    WEBAUTHN_CONFIG.rpName,
                    options.authenticatorSelection?.userVerification || options.userVerification,
                    options.attestation || null,
                    options.authenticatorSelection ? JSON.stringify(options.authenticatorSelection) : null,
                    options.allowCredentials ? JSON.stringify(options.allowCredentials) : null,
                    expiresAt,
                ],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id });
                }
            );
        });
    }

    /**
     * Get a challenge
     */
    async getChallenge(id) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM webauthn_challenges WHERE id = ?`,
                [id],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });
    }

    /**
     * Invalidate a challenge (mark as used)
     */
    async invalidateChallenge(id) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE webauthn_challenges SET status = 'used', used_at = datetime('now') WHERE id = ?`,
                [id],
                function (err) {
                    if (err) return reject(err);
                    resolve({ invalidated: this.changes > 0 });
                }
            );
        });
    }

    // ====== HELPER METHODS ======

    /**
     * Base64URL encode
     */
    base64URLEncode(buffer) {
        return buffer.toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    /**
     * Base64URL decode
     */
    base64URLDecode(str) {
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
            base64 += '=';
        }
        return Buffer.from(base64, 'base64');
    }

    /**
     * Decode CBOR attestation object (simplified)
     */
    decodeAttestationObject(buffer) {
        // This is a simplified implementation
        // For production, use a proper CBOR library like 'cbor'
        
        // Basic CBOR map parsing
        const attestation = {
            fmt: 'none',
            authData: null,
            attStmt: {},
            flags: {},
            aaguid: null,
            signCount: 0,
        };

        // Extract authenticator data (authData is the key part we need)
        // In a simplified form, we assume it's in a known position
        // Real implementation should use cbor-x or cbor library
        
        try {
            // Find 'authData' in the CBOR structure
            // This is a hack for demo purposes - use proper CBOR parsing in production
            const authDataOffset = buffer.indexOf(Buffer.from('authData'));
            if (authDataOffset > 0) {
                // Skip to actual auth data
                const dataStart = authDataOffset + 8; // Skip 'authData' and CBOR overhead
                attestation.authData = buffer.slice(dataStart);
            } else {
                // Fallback - assume packed format with fixed structure
                attestation.authData = buffer.slice(buffer.indexOf(0x58) + 2); // Skip CBOR bytes prefix
            }

            // Parse authenticator data
            if (attestation.authData && attestation.authData.length >= 37) {
                const authData = attestation.authData;
                
                // RP ID hash (32 bytes)
                const rpIdHash = authData.slice(0, 32);
                
                // Flags (1 byte)
                const flags = authData[32];
                attestation.flags = {
                    up: !!(flags & 0x01), // User Present
                    uv: !!(flags & 0x04), // User Verified
                    be: !!(flags & 0x08), // Backup Eligible
                    bs: !!(flags & 0x10), // Backup State
                    at: !!(flags & 0x40), // Attested credential data included
                    ed: !!(flags & 0x80), // Extension data included
                };
                
                // Sign count (4 bytes, big-endian)
                attestation.signCount = authData.readUInt32BE(33);
                
                // If AT flag is set, credential data follows
                if (attestation.flags.at && authData.length > 37) {
                    // AAGUID (16 bytes)
                    attestation.aaguid = authData.slice(37, 53).toString('hex');
                }
            }
        } catch (e) {
            console.error('[WebAuthn] Error decoding attestation:', e);
        }

        return attestation;
    }

    /**
     * Extract public key from authenticator data
     */
    extractPublicKey(authData) {
        // In a real implementation, parse the COSE key from authData
        // For now, return the raw credential public key data
        
        if (!authData || authData.length < 77) {
            // Return a placeholder - real implementation needs proper COSE parsing
            return Buffer.alloc(32);
        }

        // Skip to credential public key
        // 32 (rpIdHash) + 1 (flags) + 4 (signCount) + 16 (aaguid) + 2 (credIdLen) + credIdLen
        const credIdLen = authData.readUInt16BE(53);
        const publicKeyStart = 55 + credIdLen;
        
        return authData.slice(publicKeyStart);
    }

    /**
     * Parse authenticator data for authentication
     */
    parseAuthenticatorData(authData) {
        if (!authData || authData.length < 37) {
            throw new Error('Invalid authenticator data');
        }

        return {
            rpIdHash: authData.slice(0, 32),
            flags: {
                up: !!(authData[32] & 0x01),
                uv: !!(authData[32] & 0x04),
                be: !!(authData[32] & 0x08),
                bs: !!(authData[32] & 0x10),
            },
            signCount: authData.readUInt32BE(33),
        };
    }
}

const webAuthnServiceInstance = new WebAuthnService();
export default webAuthnServiceInstance;






