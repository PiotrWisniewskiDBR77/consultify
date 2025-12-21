const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const mfaRoutes = require('../routes/mfa');
const MFAService = require('../services/mfaService');

// Mock MFAService
jest.mock('../services/mfaService');

const app = express();
app.use(bodyParser.json());
app.use((req, res, next) => {
    req.user = { id: 'test-user-id', organizationId: 'test-org-id' }; // Mock auth
    next();
});
app.use('/api/mfa', mfaRoutes);

describe('MFA API Routes', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/mfa/setup', () => {
        it('should return QR code and secret', async () => {
            MFAService.generateSecret.mockResolvedValue({
                secret: 'TESTSECRET',
                otpauth_url: 'otpauth://...',
                qrCode: 'data:image/png;base64,...'
            });

            const res = await request(app).post('/api/mfa/setup');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('secret', 'TESTSECRET');
            expect(res.body).toHaveProperty('qrCode');
        });
    });

    describe('POST /api/mfa/verify-setup', () => {
        it('should verify token and enable MFA', async () => {
            MFAService.verifyTOTP.mockResolvedValue({ success: true });
            MFAService.enableMFA.mockResolvedValue({ backupCodes: ['code1', 'code2'] });

            const res = await request(app)
                .post('/api/mfa/verify-setup')
                .send({ token: '123456', secret: 'TESTSECRET' });

            expect(res.status).toBe(200);
            expect(res.body.backupCodes).toHaveLength(2);
            expect(MFAService.enableMFA).toHaveBeenCalledWith('test-user-id', 'TESTSECRET');
        });

        it('should fail with invalid token', async () => {
            MFAService.verifyTOTP.mockRejectedValue(new Error('Invalid token'));

            const res = await request(app)
                .post('/api/mfa/verify-setup')
                .send({ token: '000000', secret: 'TESTSECRET' });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Invalid token');
        });
    });
});
