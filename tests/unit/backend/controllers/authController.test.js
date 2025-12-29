
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, setDependencies } from '../../../../server/controllers/authController';

// Mock Dependencies
const mockDb = {
    get: vi.fn(),
    run: vi.fn(),
};

const mockBcrypt = {
    compareSync: vi.fn(),
};

const mockJwt = {
    sign: vi.fn(),
};

const mockConfig = {
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '1h'
};

const mockActivityService = {
    log: vi.fn(),
};

const mockMFAService = {
    getMFAStatus: vi.fn(),
    isDeviceTrusted: vi.fn(),
    verifyTOTP: vi.fn(),
    trustDevice: vi.fn(),
};

const mockRefreshTokenService = {
    generateTokenPair: vi.fn(),
};

const mockRedisStore = {
    resetKey: vi.fn(),
};

// Mock Express
const mockReq = {
    body: {},
    ip: '127.0.0.1',
    get: vi.fn((header) => {
        if (header === 'user-agent') return 'TestAgent';
        return null;
    })
};

const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
};

describe('AuthController', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Inject Mocks
        setDependencies({
            db: mockDb,
            bcrypt: mockBcrypt,
            jwt: mockJwt,
            config: mockConfig,
            ActivityService: mockActivityService,
            MFAService: mockMFAService,
            RefreshTokenService: mockRefreshTokenService,
            RedisStore: class MockRedisStore {
                constructor() { }
                async resetKey() { return mockRedisStore.resetKey(); }
            }
        });

        mockReq.body = {};
    });

    describe('login', () => {
        it('should return 400 if email or password missing', async () => {
            mockReq.body = { email: 'test@example.com' }; // missing password
            await login(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should return 401 if user not found', async () => {
            mockReq.body = { email: 'test@example.com', password: 'password' };
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, null)); // User not found

            await login(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should return 401 if password invalid', async () => {
            mockReq.body = { email: 'test@example.com', password: 'wrong' };
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { id: 1, password: 'hash' }));
            mockBcrypt.compareSync.mockReturnValue(false);

            await login(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should return 404 if organization not found', async () => {
            mockReq.body = { email: 'test@example.com', password: 'password' };
            mockDb.get.mockImplementationOnce((sql, params, cb) => cb(null, { id: 1, password: 'hash', organization_id: 99 })); // User
            mockBcrypt.compareSync.mockReturnValue(true);
            mockDb.get.mockImplementationOnce((sql, params, cb) => cb(null, null)); // Org not found

            await login(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(404);
        });

        it('should successfully login and return tokens', async () => {
            mockReq.body = { email: 'test@example.com', password: 'password' };

            // Mocks
            const user = { id: 1, email: 'test@example.com', password: 'hash', organization_id: 10, role: 'ADMIN' };
            const org = { id: 10, name: 'Test Org', status: 'active' };

            mockDb.get.mockImplementationOnce((sql, params, cb) => cb(null, user)); // User
            mockBcrypt.compareSync.mockReturnValue(true);
            mockDb.get.mockImplementationOnce((sql, params, cb) => cb(null, org)); // Org

            mockMFAService.getMFAStatus.mockResolvedValue({ enabled: false });
            mockDb.run.mockImplementation((sql, params, cb) => { if (cb) cb(null); }); // Last Login update

            const tokens = { accessToken: 'access', refreshToken: 'refresh', expiresIn: 3600 };
            mockRefreshTokenService.generateTokenPair.mockResolvedValue(tokens);

            await login(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                token: 'access',
                refreshToken: 'refresh'
            }));
            expect(mockActivityService.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'login',
                userId: 1
            }));
        });
    });
});
