/**
 * Restore script for SQLite Audio/Backups
 * Usage: node scripts/restore_backup.js <backup_file_path>
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import crypto from 'crypto';

const BACKUP_DIR = path.join(__dirname, '../../backups');
const DB_PATH = path.join(__dirname, '../consultify.db');
const KEY = process.env.BACKUP_ENCRYPTION_KEY;

const backupFile = process.argv[2];

if (!backupFile) {
    console.error('Usage: node scripts/restore_backup.js <backup_file_path>');
    process.exit(1);
}

async function restore() {
    console.log(`🔄 Restoring backup from: ${backupFile}`);

    try {
        // 1. Decrypt backup
        if (backupFile.endsWith('.enc')) {
            console.log('🔓 Decrypting backup...');
            if (!KEY) {
                throw new Error('BACKUP_ENCRYPTION_KEY required for decryption');
            }
            const decryptedPath = backupFile.replace('.enc', '');
            await decryptFile(backupFile, decryptedPath, KEY);
            console.log(`✅ Decrypted to ${decryptedPath}`);

            // Allow DB to close gracefully? Ideally we stop the server first
            console.log('⚠️  Ensure server is STOPPED before proceeding!');

            // 2. Replace DB
            fs.copyFileSync(decryptedPath, DB_PATH);
            console.log(`✅ Database restored to ${DB_PATH}`);

            // Cleanup
            fs.unlinkSync(decryptedPath);
        } else {
            console.log('📂 Restoring unencrypted backup...');
            fs.copyFileSync(backupFile, DB_PATH);
            console.log(`✅ Database restored to ${DB_PATH}`);
        }

        console.log('✨ Restore complete! Restart the server.');

    } catch (error) {
        console.error('❌ Restore failed:', error.message);
        process.exit(1);
    }
}

async function decryptFile(inputPath, outputPath, key) {
    return new Promise((resolve, reject) => {
        const input = fs.createReadStream(inputPath);
        const output = fs.createWriteStream(outputPath);
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.alloc(12, 0)); // Note: In production, IV should be read from file header!

        // This is a simplified example. Real backup service prepends IV to file.
        // Assuming IV is first 12 bytes if we implemented it that way.
        // For this script, we'll assume standard implementation.

        // Correct implementation matching backupService.js:
        // IV (12 bytes) + AuthTag (16 bytes) + EncryptedData

        // We need to read IV and AuthTag first.
        // Since streams are async, let's use readFileSync for simplicity in this script

        try {
            const fileData = fs.readFileSync(inputPath);
            const iv = fileData.subarray(0, 12);
            const authTag = fileData.subarray(12, 28);
            const encrypted = fileData.subarray(28);

            const decipherExact = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
            decipherExact.setAuthTag(authTag);

            const decrypted = Buffer.concat([decipherExact.update(encrypted), decipherExact.final()]);
            fs.writeFileSync(outputPath, decrypted);
            resolve();
        } catch (e) {
            reject(e);
        }
    });
}

restore();
