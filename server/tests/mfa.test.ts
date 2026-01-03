import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import mfaRoutes from '../routes/mfa.js';
import MFAService from '../services/mfaService.js';

vi.mock('../middleware/authMiddleware.js', () => ({
    default: (req: any, res: any, next: any) => next()
}));

vi.mock('../services/mfaService.js', () => {
    const mock = {
        setupMFA: vi.fn(),
        verifyAndEnableMFA: vi.fn(),
        getMFAStatus: vi.fn(),
        verifyTOTP: vi.fn(),
        trustDevice: vi.fn(),
        useBackupCode: vi.fn(),
        regenerateBackupCodes: vi.fn(),
        disableMFA: vi.fn(),
        getTrustedDevices: vi.fn(),
        revokeTrustedDevice: vi.fn(),
        revokeAllTrustedDevices: vi.fn(),
        getMFAMethods: vi.fn(),
        setupSMSMFA: vi.fn(),
        verifySMSSetup: vi.fn(),
        sendSMSChallenge: vi.fn(),
        verifySMSCode: vi.fn(),
        setPrimaryMethod: vi.fn(),
        disableSMSMFA: vi.fn()
    };
    return {
        default: mock,
        ...mock
    };
});

vi.mock('../services/auditService.js', () => {
    const mock = {
        logFromRequest: vi.fn(),
        logEvent: vi.fn()
    };
    return {
        default: mock,
        ...mock
    };
});

vi.mock('../services/smsService.js', () => {
    const mock = {
        getPhoneStatus: vi.fn()
    };
    return {
        default: mock,
        ...mock
    };
});

const app = express();
app.use(bodyParser.json());
app.use((req, res, next) => {
    (req as any).user = { id: 'test-user-id', email: 'test@example.com', organizationId: 'test-org-id' }; // Mock auth
    next();
});
app.use('/api/mfa', mfaRoutes);

describe('MFA API Routes', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('POST /api/mfa/setup', () => {
        it('should return QR code and secret', async () => {
            const mockSetup = {
                qrCode: 'data:image/png;base64,...',
                manualEntry: 'TESTSECRET'
            };
            (MFAService.setupMFA as any).mockResolvedValue(mockSetup);

            const res = await request(app).post('/api/mfa/setup');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('qrCode');
            expect(res.body).toHaveProperty('manualEntry', 'TESTSECRET');
        });
    });

    describe('POST /api/mfa/verify-setup', () => {
        it('should verify token and enable MFA', async () => {
            const mockResult = {
                success: true,
                backupCodes: ['code1', 'code2']
            };
            (MFAService.verifyAndEnableMFA as any).mockResolvedValue(mockResult);

            const res = await request(app)
                .post('/api/mfa/verify-setup')
                .send({ token: '123456' });

            expect(res.status).toBe(200);
            expect(res.body.backupCodes).toHaveLength(2);
            expect(MFAService.verifyAndEnableMFA).toHaveBeenCalledWith('test-user-id', '123456');
        });

        it('should fail with invalid token', async () => {
            (MFAService.verifyAndEnableMFA as any).mockResolvedValue({
                success: false,
                error: 'Invalid token'
            });

            const res = await request(app)
                .post('/api/mfa/verify-setup')
                .send({ token: '000000' });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Invalid token');
        });
    });
});
