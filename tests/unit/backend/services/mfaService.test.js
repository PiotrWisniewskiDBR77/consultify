/**
 * MFA Service Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDatabase } from '../../../../server/src/database/index.js';
import mfaService from '../../../../server/services/mfaService.js';

// Define mocks for dependencies
const mocks = vi.hoisted(() => ({
    sms: {
        initiatePhoneVerification: vi.fn(),
        completePhoneVerification: vi.fn(),
        sendOTP: vi.fn(),
        verifyOTP: vi.fn()
    },
    crypto: {
        randomBytes: vi.fn(() => Buffer.from('12345678123456781234567812345678', 'hex')),
        createCipheriv: vi.fn(() => ({
            update: vi.fn(() => 'encrypted'),
            final: vi.fn(() => ''),
            getAuthTag: vi.fn(() => Buffer.from('tag'))
        })),
        createDecipheriv: vi.fn(() => ({
            setAuthTag: vi.fn(),
            update: vi.fn(() => 'decrypted'),
            final: vi.fn(() => '')
        })),
        createHash: vi.fn(() => ({
            update: vi.fn().mockReturnThis(),
            digest: vi.fn().mockReturnValue('hashed')
        }))
    }
}));

vi.mock('../../../../server/services/smsService.js', () => ({
    default: mocks.sms
}));

vi.mock('crypto', async () => {
    const actual = await vi.importActual('crypto');
    const mockedCrypto = {
        ...actual,
        randomBytes: mocks.crypto.randomBytes,
        createCipheriv: mocks.crypto.createCipheriv,
        createDecipheriv: mocks.crypto.createDecipheriv,
        createHash: mocks.crypto.createHash
    };
    return {
        ...mockedCrypto,
        default: mockedCrypto
    };
});

vi.mock('speakeasy', () => ({
    default: {
        generateSecret: () => ({ base32: 'SECRET', otpauth_url: 'otpauth://...' }),
        totp: {
            verify: vi.fn().mockReturnValue(true)
        }
    }
}));

vi.mock('qrcode', () => ({
    default: {
        toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,...')
    }
}));

describe('MFA Service', () => {
    let db;

    beforeEach(() => {
        vi.clearAllMocks();
        // Get the global DB mock instance
        db = getDatabase();
        // Clear mock history on the db instance
        db.run.mockClear();
        db.get.mockClear();
        db.all.mockClear();
    });

    describe('setupMFA', () => {
        it('should generate secret and QR code', async () => {
            // Mock db behavior for this test
            db.run.mockImplementation((sql, params, cb) => {
                const callback = cb || params;
                if (typeof callback === 'function') {
                    callback.call({ lastID: 1, changes: 1 }, null);
                }
            });

            const result = await mfaService.setupMFA('user-1', 'test@example.com');

            expect(result.secret).toBe('SECRET');
            expect(result.qrCode).toBeDefined();
            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users SET mfa_secret'),
                expect.any(Array),
                expect.any(Function)
            );
        });
    });

    describe('verifyTOTP', () => {
        it('should verify valid token', async () => {
            db.get.mockImplementation((sql, params, cb) => {
                const callback = cb || params;
                if (typeof callback === 'function') {
                    callback(null, { mfa_secret: 'iv:tag:encrypted', mfa_enabled: 1 });
                }
            });

            const result = await mfaService.verifyTOTP('user-1', '123456');
            expect(result.success).toBe(true);
        });
    });
});
