/**
 * Backup Service
 * 
 * Automated backup system for SQLite database with:
 * - Full database backups
 * - Point-in-time recovery support
 * - Local and cloud storage (S3/GCS)
 * - Encryption at rest
 * - Retention policy enforcement
 * 
 * Usage:
 * - Run via cron job (daily at 3 AM)
 * - Manual backup: BackupService.createBackup()
 * - Restore: node scripts/restore-backup.js <backup-id>
 */

import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
    BACKUP_DIR: process.env.BACKUP_DIR || path.join(__dirname, '../../backups'),
    DATABASE_PATH: process.env.DATABASE_PATH || path.join(__dirname, '../consultify.db'),
    RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
    RETENTION_MONTHLY_DAYS: parseInt(process.env.BACKUP_RETENTION_MONTHLY_DAYS) || 365, // 12 months
    ENCRYPTION_KEY: process.env.BACKUP_ENCRYPTION_KEY, // 32 bytes hex
    S3_ENABLED: !!process.env.AWS_S3_BUCKET,
    S3_BUCKET: process.env.AWS_S3_BUCKET,
    S3_REGION: process.env.AWS_S3_REGION || 'eu-central-1',
    GCS_ENABLED: !!process.env.GCS_BUCKET,
    GCS_BUCKET: process.env.GCS_BUCKET,
    GCS_PROJECT_ID: process.env.GCS_PROJECT_ID,
    MAX_LOCAL_BACKUPS: parseInt(process.env.MAX_LOCAL_BACKUPS) || 10,
};

// Ensure backup directory exists
async function ensureBackupDir() {
    try {
        await fs.mkdir(CONFIG.BACKUP_DIR, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
}

// Backup metadata storage
const METADATA_FILE = path.join(CONFIG.BACKUP_DIR, 'backup_manifest.json');

async function loadManifest() {
    try {
        const data = await fs.readFile(METADATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { backups: [] };
    }
}

async function saveManifest(manifest) {
    await fs.writeFile(METADATA_FILE, JSON.stringify(manifest, null, 2));
}

const BackupService = {
    /**
     * Create a new backup
     * @param {string} type - 'full' | 'incremental' (incremental not implemented yet)
     * @param {string} reason - Reason for backup ('scheduled', 'manual', 'pre-deploy')
     * @returns {Promise<{id: string, path: string, size: number}>}
     */
    async createBackup(type = 'full', reason = 'manual') {
        await ensureBackupDir();

        const backupId = uuidv4();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup_${timestamp}_${backupId.slice(0, 8)}.db`;
        const backupPath = path.join(CONFIG.BACKUP_DIR, filename);

        console.log(`[Backup] Starting ${type} backup: ${backupId}`);

        try {
            // 1. Create SQLite backup (using VACUUM INTO for consistent snapshot)
            // Dynamic import for ESM compatibility within function
            const { getDatabase } = await import('../src/database/index.js');

            await new Promise((resolve, reject) => {
                db.run(`VACUUM INTO ?`, [backupPath], (err) => {
                    if (err) {
                        // Fallback to file copy if VACUUM INTO not supported
                        console.log('[Backup] VACUUM INTO not available, using file copy');
                        fsSync.copyFileSync(CONFIG.DATABASE_PATH, backupPath);
                    }
                    resolve();
                });
            });

            // 2. Get backup size
            const stats = await fs.stat(backupPath);
            const sizeBytes = stats.size;

            // 3. Calculate checksum
            const fileBuffer = await fs.readFile(backupPath);
            const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

            // 4. Encrypt if enabled
            let encryptedPath = null;
            if (CONFIG.ENCRYPTION_KEY) {
                encryptedPath = await this._encryptBackup(backupPath);
                // Remove unencrypted version
                await fs.unlink(backupPath);
            }

            // 5. Upload to cloud storage if enabled
            let s3Key = null;
            let gcsKey = null;
            if (CONFIG.S3_ENABLED) {
                s3Key = await this._uploadToS3(encryptedPath || backupPath, filename);
            }
            if (CONFIG.GCS_ENABLED) {
                gcsKey = await this._uploadToGCS(encryptedPath || backupPath, filename);
            }

            // 6. Update manifest
            const manifest = await loadManifest();
            const createdAt = new Date();
            const backupEntry = {
                id: backupId,
                type,
                reason,
                filename: encryptedPath ? `${filename}.enc` : filename,
                path: encryptedPath || backupPath,
                sizeBytes,
                checksum,
                encrypted: !!CONFIG.ENCRYPTION_KEY,
                s3Key,
                gcsKey,
                createdAt: createdAt.toISOString(),
                // Determine if this is a monthly backup (first backup of month)
                isMonthly: this._isMonthlyBackup(createdAt),
                expiresAt: this._calculateExpirationDate(createdAt),
            };

            manifest.backups.push(backupEntry);
            await saveManifest(manifest);

            console.log(`[Backup] Completed: ${backupId} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);

            return {
                id: backupId,
                path: encryptedPath || backupPath,
                size: sizeBytes,
                checksum,
            };
        } catch (error) {
            console.error('[Backup] Failed:', error);
            throw error;
        }
    },

    /**
     * List available backups
     * @param {Object} options - Filter options
     * @returns {Promise<Array>}
     */
    async listBackups(options = {}) {
        const manifest = await loadManifest();
        let backups = manifest.backups;

        // Filter by type
        if (options.type) {
            backups = backups.filter(b => b.type === options.type);
        }

        // Filter expired
        if (!options.includeExpired) {
            backups = backups.filter(b => new Date(b.expiresAt) > new Date());
        }

        // Sort by date (newest first)
        backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return backups.map(b => ({
            id: b.id,
            type: b.type,
            reason: b.reason,
            filename: b.filename,
            sizeMB: (b.sizeBytes / 1024 / 1024).toFixed(2),
            encrypted: b.encrypted,
            hasS3: !!b.s3Key,
            hasGCS: !!b.gcsKey,
            isMonthly: b.isMonthly || false,
            createdAt: b.createdAt,
            expiresAt: b.expiresAt,
        }));
    },

    /**
     * Restore from backup
     * @param {string} backupId 
     * @param {Object} options 
     * @returns {Promise<{success: boolean}>}
     */
    async restoreBackup(backupId, options = {}) {
        const manifest = await loadManifest();
        const backup = manifest.backups.find(b => b.id === backupId);

        if (!backup) {
            throw new Error(`Backup not found: ${backupId}`);
        }

        console.log(`[Backup] Starting restore from: ${backupId}`);

        try {
            let backupPath = backup.path;

            // 1. Download from cloud storage if needed
            if (backup.s3Key && !fsSync.existsSync(backupPath)) {
                console.log('[Backup] Downloading from S3...');
                backupPath = await this._downloadFromS3(backup.s3Key, backup.filename);
            }
            if (backup.gcsKey && !fsSync.existsSync(backupPath)) {
                console.log('[Backup] Downloading from GCS...');
                backupPath = await this._downloadFromGCS(backup.gcsKey, backup.filename);
            }

            // 2. Verify file exists
            if (!fsSync.existsSync(backupPath)) {
                throw new Error(`Backup file not found: ${backupPath}`);
            }

            // 3. Decrypt if needed
            let dbPath = backupPath;
            if (backup.encrypted) {
                console.log('[Backup] Decrypting...');
                dbPath = await this._decryptBackup(backupPath);
            }

            // 4. Verify checksum
            const fileBuffer = await fs.readFile(dbPath);
            const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

            if (!backup.encrypted && checksum !== backup.checksum) {
                throw new Error('Backup checksum mismatch - file may be corrupted');
            }

            // 5. Create pre-restore backup (safety)
            if (options.createPreRestoreBackup !== false) {
                console.log('[Backup] Creating pre-restore backup...');
                await this.createBackup('full', 'pre-restore');
            }

            // 6. Stop accepting new connections (in production, coordinate with load balancer)
            console.log('[Backup] Restoring database...');

            // 7. Replace database
            const targetPath = CONFIG.DATABASE_PATH;
            fsSync.copyFileSync(dbPath, targetPath);

            // 8. Cleanup decrypted temp file
            if (backup.encrypted && dbPath !== backupPath) {
                await fs.unlink(dbPath);
            }

            console.log(`[Backup] Restore completed from: ${backupId}`);

            return { success: true, restoredFrom: backupId };
        } catch (error) {
            console.error('[Backup] Restore failed:', error);
            throw error;
        }
    },

    /**
     * Delete a backup
     * @param {string} backupId 
     */
    async deleteBackup(backupId) {
        const manifest = await loadManifest();
        const index = manifest.backups.findIndex(b => b.id === backupId);

        if (index === -1) {
            throw new Error(`Backup not found: ${backupId}`);
        }

        const backup = manifest.backups[index];

        // Delete local file
        try {
            await fs.unlink(backup.path);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        // Delete from cloud storage
        if (backup.s3Key) {
            await this._deleteFromS3(backup.s3Key);
        }
        if (backup.gcsKey) {
            await this._deleteFromGCS(backup.gcsKey);
        }

        // Update manifest
        manifest.backups.splice(index, 1);
        await saveManifest(manifest);

        console.log(`[Backup] Deleted: ${backupId}`);
    },

    /**
     * Run retention policy - delete expired backups
     * Retention: 30 days for daily backups, 12 months for monthly backups
     * @returns {Promise<{deleted: number}>}
     */
    async runRetentionPolicy() {
        const manifest = await loadManifest();
        const now = new Date();
        let deleted = 0;

        // Find expired backups
        const expired = manifest.backups.filter(b => new Date(b.expiresAt) < now);

        for (const backup of expired) {
            try {
                await this.deleteBackup(backup.id);
                deleted++;
            } catch (error) {
                console.error(`[Backup] Failed to delete expired backup ${backup.id}:`, error);
            }
        }

        // Enforce max local backups (keep most recent)
        const remaining = manifest.backups
            .filter(b => new Date(b.expiresAt) >= now)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (remaining.length > CONFIG.MAX_LOCAL_BACKUPS) {
            const toDelete = remaining.slice(CONFIG.MAX_LOCAL_BACKUPS);
            for (const backup of toDelete) {
                try {
                    await this.deleteBackup(backup.id);
                    deleted++;
                } catch (error) {
                    console.error(`[Backup] Failed to delete excess backup ${backup.id}:`, error);
                }
            }
        }

        console.log(`[Backup] Retention policy: deleted ${deleted} backups`);
        return { deleted };
    },

    /**
     * Get backup status for monitoring
     * @returns {Promise<{total: number, lastBackup: string|null, nextBackup: string|null, failed: number}>}
     */
    async getBackupStatus() {
        const manifest = await loadManifest();
        const backups = manifest.backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return {
            total: backups.length,
            lastBackup: backups.length > 0 ? backups[0].createdAt : null,
            nextBackup: null, // Would need scheduler info
            failed: 0, // Would need to track failures
            expired: backups.filter(b => new Date(b.expiresAt) < new Date()).length,
        };
    },

    // ==========================================
    // PRIVATE HELPERS
    // ==========================================

    /**
     * Check if backup is monthly (first backup of the month)
     */
    _isMonthlyBackup(date) {
        // Check if this is the first backup today (simplified - in production, check manifest)
        return date.getDate() === 1; // First day of month
    },

    /**
     * Calculate expiration date based on backup type
     * Daily backups: RETENTION_DAYS
     * Monthly backups: RETENTION_MONTHLY_DAYS
     */
    _calculateExpirationDate(createdAt) {
        const isMonthly = this._isMonthlyBackup(createdAt);
        const retentionDays = isMonthly ? CONFIG.RETENTION_MONTHLY_DAYS : CONFIG.RETENTION_DAYS;
        return new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
    },

    async _encryptBackup(inputPath) {
        const outputPath = `${inputPath}.enc`;
        const iv = crypto.randomBytes(16);
        const key = Buffer.from(CONFIG.ENCRYPTION_KEY, 'hex');

        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        const input = fsSync.readFileSync(inputPath);
        const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
        const authTag = cipher.getAuthTag();

        // Format: IV (16) + AuthTag (16) + Encrypted data
        const output = Buffer.concat([iv, authTag, encrypted]);
        await fs.writeFile(outputPath, output);

        return outputPath;
    },

    async _decryptBackup(inputPath) {
        const outputPath = inputPath.replace('.enc', '.decrypted.db');
        const key = Buffer.from(CONFIG.ENCRYPTION_KEY, 'hex');

        const data = fsSync.readFileSync(inputPath);
        const iv = data.slice(0, 16);
        const authTag = data.slice(16, 32);
        const encrypted = data.slice(32);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        await fs.writeFile(outputPath, decrypted);

        return outputPath;
    },

    async _uploadToS3(filePath, filename) {
        try {
            // Dynamic import to avoid requiring AWS SDK if not used
            const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

            const s3Client = new S3Client({
                region: CONFIG.S3_REGION,
                credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                } : undefined, // Use IAM role if credentials not provided
            });

            const fileBuffer = await fs.readFile(filePath);
            const s3Key = `backups/${filename}`;

            await s3Client.send(new PutObjectCommand({
                Bucket: CONFIG.S3_BUCKET,
                Key: s3Key,
                Body: fileBuffer,
                ContentType: 'application/x-sqlite3',
                Metadata: {
                    'backup-timestamp': new Date().toISOString(),
                },
            }));

            console.log(`[Backup] Uploaded to S3: ${s3Key}`);
            return s3Key;
        } catch (error) {
            console.error('[Backup] S3 upload failed:', error);
            throw new Error(`S3 upload failed: ${error.message}`);
        }
    },

    async _downloadFromS3(s3Key, filename) {
        try {
            const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');

            const s3Client = new S3Client({
                region: CONFIG.S3_REGION,
                credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                } : undefined,
            });

            const localPath = path.join(CONFIG.BACKUP_DIR, filename);
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: CONFIG.S3_BUCKET,
                Key: s3Key,
            }));

            // Convert stream to buffer
            const chunks = [];
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            await fs.writeFile(localPath, buffer);
            console.log(`[Backup] Downloaded from S3: ${s3Key}`);
            return localPath;
        } catch (error) {
            console.error('[Backup] S3 download failed:', error);
            throw new Error(`S3 download failed: ${error.message}`);
        }
    },

    async _deleteFromS3(s3Key) {
        try {
            const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

            const s3Client = new S3Client({
                region: CONFIG.S3_REGION,
                credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                } : undefined,
            });

            await s3Client.send(new DeleteObjectCommand({
                Bucket: CONFIG.S3_BUCKET,
                Key: s3Key,
            }));

            console.log(`[Backup] Deleted from S3: ${s3Key}`);
        } catch (error) {
            console.error('[Backup] S3 delete failed:', error);
            // Don't throw - deletion failure is not critical
        }
    },

    async _uploadToGCS(filePath, filename) {
        try {
            // Dynamic import for GCS
            const { Storage } = await import('@google-cloud/storage');

            const storage = new Storage({
                projectId: CONFIG.GCS_PROJECT_ID,
                keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            });

            const bucket = storage.bucket(CONFIG.GCS_BUCKET);
            const gcsKey = `backups/${filename}`;
            const file = bucket.file(gcsKey);

            await file.save(await fs.readFile(filePath), {
                metadata: {
                    contentType: 'application/x-sqlite3',
                    metadata: {
                        'backup-timestamp': new Date().toISOString(),
                    },
                },
            });

            console.log(`[Backup] Uploaded to GCS: ${gcsKey}`);
            return gcsKey;
        } catch (error) {
            console.error('[Backup] GCS upload failed:', error);
            throw new Error(`GCS upload failed: ${error.message}`);
        }
    },

    async _downloadFromGCS(gcsKey, filename) {
        try {
            const { Storage } = await import('@google-cloud/storage');

            const storage = new Storage({
                projectId: CONFIG.GCS_PROJECT_ID,
                keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            });

            const bucket = storage.bucket(CONFIG.GCS_BUCKET);
            const file = bucket.file(gcsKey);
            const localPath = path.join(CONFIG.BACKUP_DIR, filename);

            await file.download({ destination: localPath });
            console.log(`[Backup] Downloaded from GCS: ${gcsKey}`);
            return localPath;
        } catch (error) {
            console.error('[Backup] GCS download failed:', error);
            throw new Error(`GCS download failed: ${error.message}`);
        }
    },

    async _deleteFromGCS(gcsKey) {
        try {
            const { Storage } = await import('@google-cloud/storage');

            const storage = new Storage({
                projectId: CONFIG.GCS_PROJECT_ID,
                keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            });

            const bucket = storage.bucket(CONFIG.GCS_BUCKET);
            const file = bucket.file(gcsKey);

            await file.delete();
            console.log(`[Backup] Deleted from GCS: ${gcsKey}`);
        } catch (error) {
            console.error('[Backup] GCS delete failed:', error);
            // Don't throw - deletion failure is not critical
        }
    },

    /**
     * Verify backup integrity
     * @param {string} backupId 
     * @returns {Promise<{valid: boolean, message: string}>}
     */
    async verifyBackupIntegrity(backupId) {
        const manifest = await loadManifest();
        const backup = manifest.backups.find(b => b.id === backupId);

        if (!backup) {
            throw new Error(`Backup not found: ${backupId}`);
        }

        console.log(`[Backup] Verifying integrity for: ${backupId}`);

        try {
            let backupPath = backup.path;

            // 1. Download if remote only
            let isTempDownload = false;
            if (!fsSync.existsSync(backupPath)) {
                if (backup.s3Key) {
                    backupPath = await this._downloadFromS3(backup.s3Key, backup.filename);
                    isTempDownload = true;
                } else if (backup.gcsKey) {
                    backupPath = await this._downloadFromGCS(backup.gcsKey, backup.filename);
                    isTempDownload = true;
                } else {
                    throw new Error('Backup file missing locally and remotely');
                }
            }

            // 2. Decrypt if needed
            let verificationPath = backupPath;
            let isTempDecrypted = false;
            if (backup.encrypted) {
                verificationPath = await this._decryptBackup(backupPath);
                isTempDecrypted = true;
            }

            // 3. Verify SQLite header
            const fd = await fs.open(verificationPath, 'r');
            const header = Buffer.alloc(16);
            await fd.read(header, 0, 16, 0);
            await fd.close();

            const isValidHeader = header.toString('utf8', 0, 15) === 'SQLite format 3';

            // 4. Verify checksum
            const fileBuffer = await fs.readFile(verificationPath);
            const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

            // Cleanup temp files
            if (isTempDecrypted) await fs.unlink(verificationPath);
            if (isTempDownload) await fs.unlink(backupPath);

            const isValidChecksum = !backup.encrypted && checksum === backup.checksum;
            // Note: If encrypted, we can't match original checksum without decrypting first, 
            // but we generated checksum on the UNENCRYPTED file during creation? 
            // Looking at createBackup: 
            //   Line 110: Checksum calculated on unencrypted file.
            //   Line 115: Encrypted.
            // So yes, after decryption, checksum must match.

            if (!isValidHeader) {
                return { valid: false, message: 'Invalid SQLite header' };
            }

            if (checksum !== backup.checksum) {
                return { valid: false, message: 'Checksum mismatch' };
            }

            console.log(`[Backup] Verification passed: ${backupId}`);
            return { valid: true, message: 'Backup verified successfully' };
        } catch (error) {
            console.error('[Backup] Verification failed:', error);
            return { valid: false, message: error.message };
        }
    },
};

export default BackupService;
