/**
 * Key Management Service
 * Enterprise SaaS Architecture - Security & Compliance
 *
 * Implements secure key management strategy:
 * - Key generation and derivation
 * - Key rotation scheduling
 * - Key versioning
 * - Audit logging for key operations
 * - Integration ready for external KMS (AWS KMS, HashiCorp Vault)
 *
 * Security Best Practices:
 * - Keys never stored in plaintext
 * - Automatic rotation reminders
 * - Key usage auditing
 * - Separation of duties (DEK/KEK pattern ready)
 */

import crypto from 'crypto';

import logger from '../../utils/Logger.js';

// ==========================================
// CONFIGURATION
// ==========================================

interface KeyRotationPolicy {
    maxAgeInDays: number;
    warningDaysBeforeExpiry: number;
    autoRotate: boolean;
}

interface KeyMetadata {
    id: string;
    version: number;
    algorithm: string;
    keyLength: number;
    createdAt: Date;
    expiresAt: Date | null;
    rotatedAt: Date | null;
    status: 'active' | 'rotated' | 'expired' | 'compromised';
    purpose: 'encryption' | 'signing' | 'authentication';
}

interface AuditLogEntry {
    timestamp: Date;
    operation: string;
    keyId: string;
    keyVersion: number;
    userId?: string;
    ipAddress?: string;
    success: boolean;
    details?: string;
}

// Default rotation policy
const DEFAULT_ROTATION_POLICY: KeyRotationPolicy = {
    maxAgeInDays: 90, // Rotate every 90 days
    warningDaysBeforeExpiry: 14, // Warn 14 days before
    autoRotate: false, // Manual rotation by default
};

// ==========================================
// KEY MANAGEMENT SERVICE
// ==========================================

class KeyManagementServiceImpl {
    private rotationPolicy: KeyRotationPolicy;
    private keyMetadata: Map<string, KeyMetadata> = new Map();
    private auditLog: AuditLogEntry[] = [];

    constructor(policy?: Partial<KeyRotationPolicy>) {
        this.rotationPolicy = { ...DEFAULT_ROTATION_POLICY, ...policy };
        this.initializeKeyMetadata();
    }

    /**
     * Initialize key metadata from environment
     */
    private initializeKeyMetadata(): void {
        const encryptionKeySet = !!process.env.ENCRYPTION_KEY;

        if (encryptionKeySet) {
            const createdAt = new Date(process.env.ENCRYPTION_KEY_CREATED_AT || Date.now());
            const expiresAt = new Date(createdAt);
            expiresAt.setDate(expiresAt.getDate() + this.rotationPolicy.maxAgeInDays);

            this.keyMetadata.set('primary-encryption-key', {
                id: 'primary-encryption-key',
                version: 1,
                algorithm: 'aes-256-gcm',
                keyLength: 256,
                createdAt,
                expiresAt,
                rotatedAt: null,
                status: 'active',
                purpose: 'encryption',
            });
        }

        // Check for rotated keys
        for (let v = 2; v <= 10; v++) {
            if (process.env[`ENCRYPTION_KEY_V${v}`]) {
                const metadata = this.keyMetadata.get('primary-encryption-key');
                if (metadata) {
                    metadata.version = v;
                    metadata.rotatedAt = new Date();
                }
            }
        }
    }

    /**
     * Generate a new encryption key (for rotation)
     */
    generateKey(keyLength: number = 32): string {
        const key = crypto.randomBytes(keyLength);
        const keyHex = key.toString('hex');

        this.logAudit({
            timestamp: new Date(),
            operation: 'KEY_GENERATION',
            keyId: 'new-key',
            keyVersion: 0,
            success: true,
            details: `Generated ${keyLength * 8}-bit key`,
        });

        logger.info('[KeyManagement] New encryption key generated');
        return keyHex;
    }

    /**
     * Generate a salt for key derivation
     */
    generateSalt(length: number = 32): string {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Check if key rotation is needed
     */
    needsRotation(keyId: string = 'primary-encryption-key'): boolean {
        const metadata = this.keyMetadata.get(keyId);
        if (!metadata || !metadata.expiresAt) return false;

        const now = new Date();
        return now >= metadata.expiresAt;
    }

    /**
     * Check if rotation warning should be shown
     */
    rotationWarningNeeded(keyId: string = 'primary-encryption-key'): boolean {
        const metadata = this.keyMetadata.get(keyId);
        if (!metadata || !metadata.expiresAt) return false;

        const now = new Date();
        const warningDate = new Date(metadata.expiresAt);
        warningDate.setDate(warningDate.getDate() - this.rotationPolicy.warningDaysBeforeExpiry);

        return now >= warningDate && now < metadata.expiresAt;
    }

    /**
     * Get key status information
     */
    getKeyStatus(keyId: string = 'primary-encryption-key'): {
        exists: boolean;
        status: string;
        daysUntilExpiry: number | null;
        needsRotation: boolean;
        warningNeeded: boolean;
    } {
        const metadata = this.keyMetadata.get(keyId);

        if (!metadata) {
            return {
                exists: false,
                status: 'not_configured',
                daysUntilExpiry: null,
                needsRotation: false,
                warningNeeded: false,
            };
        }

        const now = new Date();
        const daysUntilExpiry = metadata.expiresAt
            ? Math.ceil((metadata.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null;

        return {
            exists: true,
            status: metadata.status,
            daysUntilExpiry,
            needsRotation: this.needsRotation(keyId),
            warningNeeded: this.rotationWarningNeeded(keyId),
        };
    }

    /**
     * Get all key statuses for monitoring
     */
    getAllKeyStatuses(): Record<string, ReturnType<typeof this.getKeyStatus>> {
        const statuses: Record<string, ReturnType<typeof this.getKeyStatus>> = {};

        for (const [keyId] of this.keyMetadata) {
            statuses[keyId] = this.getKeyStatus(keyId);
        }

        return statuses;
    }

    /**
     * Log a key operation for auditing
     */
    logAudit(entry: AuditLogEntry): void {
        this.auditLog.push(entry);

        // Keep only last 1000 entries in memory
        if (this.auditLog.length > 1000) {
            this.auditLog.shift();
        }

        // Log to persistent logger
        logger.info('[KeyManagement] Audit', {
            operation: entry.operation,
            keyId: entry.keyId,
            keyVersion: entry.keyVersion,
            success: entry.success,
        });
    }

    /**
     * Get audit log entries
     */
    getAuditLog(limit: number = 100): AuditLogEntry[] {
        return this.auditLog.slice(-limit);
    }

    /**
     * Mark a key as compromised (for incident response)
     */
    markKeyCompromised(keyId: string, reason: string): void {
        const metadata = this.keyMetadata.get(keyId);
        if (metadata) {
            metadata.status = 'compromised';

            this.logAudit({
                timestamp: new Date(),
                operation: 'KEY_COMPROMISED',
                keyId,
                keyVersion: metadata.version,
                success: true,
                details: reason,
            });

            logger.error('[KeyManagement] KEY COMPROMISED:', { keyId, reason });
        }
    }

    /**
     * Generate rotation instructions
     */
    getRotationInstructions(): string {
        return `
# Encryption Key Rotation Instructions

## Step 1: Generate new key
Run: node -e "logger.info(require('crypto').randomBytes(32).toString('hex'))"

## Step 2: Update environment variables
1. Copy current ENCRYPTION_KEY to ENCRYPTION_KEY_V{current_version}
2. Set new key as ENCRYPTION_KEY
3. Update ENCRYPTION_KEY_CREATED_AT to current ISO date

## Step 3: Deploy and re-encrypt
1. Deploy the application with new environment variables
2. Run re-encryption migration: npm run migrate:reencrypt
3. After successful migration, old key version can be removed after grace period

## Step 4: Verify
1. Test encryption/decryption with new data
2. Verify old data can still be decrypted
3. Monitor for any decryption errors

## Security Notes
- Never log or expose encryption keys
- Store keys securely (use Vault/KMS in production)
- Keep old keys available for grace period (default: 30 days)
- Document rotation in security log
`;
    }

    /**
     * Check encryption configuration health
     */
    checkHealth(): {
        healthy: boolean;
        issues: string[];
        recommendations: string[];
    } {
        const issues: string[] = [];
        const recommendations: string[] = [];

        // Check if encryption key is set
        if (!process.env.ENCRYPTION_KEY && !process.env.DATA_ENCRYPTION_KEY) {
            issues.push('No ENCRYPTION_KEY configured');
            recommendations.push('Set ENCRYPTION_KEY environment variable for production');
        }

        // Check if salt is set
        if (!process.env.ENCRYPTION_SALT && process.env.NODE_ENV === 'production') {
            issues.push('No ENCRYPTION_SALT configured in production');
            recommendations.push('Set ENCRYPTION_SALT environment variable');
        }

        // Check key rotation status
        const status = this.getKeyStatus();
        if (status.needsRotation) {
            issues.push('Encryption key has expired and needs rotation');
            recommendations.push('Follow rotation instructions: getRotationInstructions()');
        } else if (status.warningNeeded) {
            recommendations.push(`Key expires in ${status.daysUntilExpiry} days - plan rotation`);
        }

        return {
            healthy: issues.length === 0,
            issues,
            recommendations,
        };
    }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

export const KeyManagementService = new KeyManagementServiceImpl();

// ==========================================
// ENVIRONMENT TEMPLATE
// ==========================================

export const ENCRYPTION_ENV_TEMPLATE = `
# ===========================================
# ENCRYPTION CONFIGURATION
# ===========================================

# Primary encryption key (32 bytes / 256 bits, hex encoded)
# Generate: node -e "logger.info(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=

# Salt for key derivation (32 bytes, hex encoded)
# Generate: node -e "logger.info(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_SALT=

# Key creation date (ISO 8601 format, for rotation tracking)
ENCRYPTION_KEY_CREATED_AT=

# Rotated keys (keep for decryption of old data)
# ENCRYPTION_KEY_V2=
# ENCRYPTION_KEY_V3=
`;

export default KeyManagementService;

