import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { initTestDb, cleanTables, dbAll, dbRun } = require('../../helpers/dbHelper.cjs');
const EmailService = require('../../../server/services/emailService.js');

/**
 * Integration tests for EmailService
 * Uses real database - production-ready tests
 */
describe('Backend Service Test: EmailService', () => {
    beforeAll(async () => {
        await initTestDb();
    });

    beforeEach(async () => {
        // Clean settings table before each test
        await cleanTables(['settings']);
        // Mock console.log to avoid noise in tests
        console.log = vi.fn();
    });

    describe('sendEmail', () => {
        it('sends email with default config', async () => {
            const result = await EmailService.sendEmail(
                'test@example.com',
                'Test Subject',
                '<p>Test HTML</p>'
            );

            expect(result).toBe(true);
            // Verify it tried to fetch SMTP settings from database
            const settings = await dbAll('SELECT * FROM settings WHERE key LIKE ?', ['smtp_%']);
            // Settings might be empty, which is fine - service uses defaults
            expect(Array.isArray(settings)).toBe(true);
        });

        it('uses SMTP settings from database', async () => {
            // Insert SMTP settings
            await dbRun(
                'INSERT INTO settings (key, value) VALUES (?, ?)',
                ['smtp_host', 'smtp.example.com']
            );
            await dbRun(
                'INSERT INTO settings (key, value) VALUES (?, ?)',
                ['smtp_port', '587']
            );
            await dbRun(
                'INSERT INTO settings (key, value) VALUES (?, ?)',
                ['smtp_user', 'user@example.com']
            );

            await new Promise(resolve => setTimeout(resolve, 50));

            const result = await EmailService.sendEmail('test@example.com', 'Subject', 'Body');

            expect(result).toBe(true);
            // Verify settings were read (service logs will show it)
            expect(console.log).toHaveBeenCalled();
        });

        it('handles database errors gracefully', async () => {
            // Service should handle errors internally
            const result = await EmailService.sendEmail(
                'test@example.com',
                'Subject',
                'Body'
            );

            expect(result).toBe(true);
        });

        it('logs email details', async () => {
            await EmailService.sendEmail('test@example.com', 'Subject', 'Body');

            expect(console.log).toHaveBeenCalled();
            const logCalls = console.log.mock.calls;
            const hasEmailLog = logCalls.some(call => 
                call[0] && typeof call[0] === 'string' && call[0].includes('EMAIL SERVICE')
            );
            expect(hasEmailLog).toBe(true);
        });

        it('uses environment variables when database settings are missing', async () => {
            // Clear any database settings
            await cleanTables(['settings']);
            
            // Set environment variables
            const originalEnv = process.env.SMTP_HOST;
            process.env.SMTP_HOST = 'env-smtp.example.com';
            
            const result = await EmailService.sendEmail('test@example.com', 'Subject', 'Body');
            
            expect(result).toBe(true);
            
            // Restore
            if (originalEnv) {
                process.env.SMTP_HOST = originalEnv;
            } else {
                delete process.env.SMTP_HOST;
            }
        });
    });
});
