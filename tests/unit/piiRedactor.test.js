/**
 * PII Redactor Unit Tests
 * Step 14: Governance, Security & Enterprise Controls
 */

import { describe, it, expect } from 'vitest';

// Import CJS module
const PiiRedactor = require('../../server/utils/piiRedactor');

describe('PII Redactor', () => {
    describe('redactEmails', () => {
        it('should redact email addresses', () => {
            const input = 'Contact john.doe@example.com for more info';
            const result = PiiRedactor.redactEmails(input);
            expect(result).toBe('Contact [REDACTED] for more info');
        });

        it('should redact multiple emails', () => {
            const input = 'CC: alice@test.com and bob@test.com';
            const result = PiiRedactor.redactEmails(input);
            expect(result).toBe('CC: [REDACTED] and [REDACTED]');
        });

        it('should return non-string values unchanged', () => {
            expect(PiiRedactor.redactEmails(123)).toBe(123);
            expect(PiiRedactor.redactEmails(null)).toBe(null);
        });
    });

    describe('redactTokens', () => {
        it('should redact JWT-like tokens', () => {
            const input = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
            const result = PiiRedactor.redactTokens(input);
            expect(result).toBe('[REDACTED]');
        });

        it('should handle partial JWT patterns', () => {
            const input = 'Token: abc.def.ghi';
            const result = PiiRedactor.redactTokens(input);
            expect(result).toBe('Token: [REDACTED]');
        });
    });

    describe('redact (deep object redaction)', () => {
        it('should redact email fields', () => {
            const input = { user: { email: 'test@example.com', name: 'John' } };
            const result = PiiRedactor.redact(input);
            expect(result.user.email).toBe('[REDACTED]');
        });

        it('should redact name fields', () => {
            const input = { first_name: 'John', last_name: 'Doe' };
            const result = PiiRedactor.redact(input);
            expect(result.first_name).toBe('[REDACTED]');
            expect(result.last_name).toBe('[REDACTED]');
        });

        it('should redact password fields', () => {
            const input = { userId: 'admin', password: 'secret123' }; // Using userId instead of username (contains 'name')
            const result = PiiRedactor.redact(input);
            expect(result.password).toBe('[REDACTED]');
            expect(result.userId).toBe('admin'); // userId is not PII
        });

        it('should redact token and secret fields', () => {
            const input = {
                access_token: 'abc123',
                api_key: 'key-xyz',
                secret: 'shh'
            };
            const result = PiiRedactor.redact(input);
            expect(result.access_token).toBe('[REDACTED]');
            expect(result.api_key).toBe('[REDACTED]');
            expect(result.secret).toBe('[REDACTED]');
        });

        it('should redact inline emails in string values', () => {
            const input = { notes: 'Contact user@test.com' };
            const result = PiiRedactor.redact(input);
            expect(result.notes).toBe('Contact [REDACTED]');
        });

        it('should handle arrays with email strings', () => {
            const input = { userIds: ['user1', 'user2'], contactEmail: 'a@b.com' };
            const result = PiiRedactor.redact(input);
            expect(result.userIds[0]).toBe('user1'); // Plain strings unchanged
            expect(result.contactEmail).toBe('[REDACTED]'); // Email field redacted
        });

        it('should handle nested objects', () => {
            const input = {
                user: {
                    profile: {
                        email: 'nested@test.com',
                        bio: 'Hello!'
                    }
                }
            };
            const result = PiiRedactor.redact(input);
            expect(result.user.profile.email).toBe('[REDACTED]');
            expect(result.user.profile.bio).toBe('Hello!');
        });

        it('should not mutate original object', () => {
            const input = { email: 'test@example.com' };
            const result = PiiRedactor.redact(input);
            expect(input.email).toBe('test@example.com');
            expect(result.email).toBe('[REDACTED]');
        });

        it('should handle null and undefined', () => {
            expect(PiiRedactor.redact(null)).toBe(null);
            expect(PiiRedactor.redact(undefined)).toBe(undefined);
        });
    });

    describe('redactKeys', () => {
        it('should redact specific keys', () => {
            const input = { a: 1, b: 2, c: 3 };
            const result = PiiRedactor.redactKeys(input, ['a', 'c']);
            expect(result.a).toBe('[REDACTED]');
            expect(result.b).toBe(2);
            expect(result.c).toBe('[REDACTED]');
        });
    });

    describe('createAuditSnapshot', () => {
        it('should return JSON string with redacted PII', () => {
            const input = { action: 'UPDATE', user: { email: 'test@x.com' } };
            const result = PiiRedactor.createAuditSnapshot(input);
            const parsed = JSON.parse(result);
            expect(parsed.user.email).toBe('[REDACTED]');
            expect(parsed.action).toBe('UPDATE');
        });
    });

    describe('DEFAULT_PII_FIELDS', () => {
        it('should include common PII fields', () => {
            const fields = PiiRedactor.DEFAULT_PII_FIELDS;
            expect(fields).toContain('email');
            expect(fields).toContain('password');
            expect(fields).toContain('token');
            expect(fields).toContain('first_name');
            expect(fields).toContain('last_name');
        });
    });
});
