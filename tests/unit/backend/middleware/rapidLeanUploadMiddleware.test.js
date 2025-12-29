import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRapidLeanUpload, rapidLeanPhotoUpload, _setDependencies } from '../../../../server/middleware/rapidLeanUploadMiddleware';

describe('RapidLean Upload Middleware', () => {
    let req;
    let res;
    let next;
    let mockFs;
    let mockMulter;
    let mockMulterMiddleware;

    beforeEach(() => {
        vi.clearAllMocks();
        req = {
            user: { organizationId: 'org1' },
            body: {},
            headers: { 'content-type': 'multipart/form-data' }
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        next = vi.fn();

        // Create Mocks
        mockFs = {
            existsSync: vi.fn().mockReturnValue(true),
            mkdirSync: vi.fn()
        };

        const multerMiddleware = vi.fn((req, res, next) => next());
        multerMiddleware.array = vi.fn().mockReturnValue(multerMiddleware);
        mockMulterMiddleware = multerMiddleware;

        mockMulter = vi.fn(() => multerMiddleware);
        mockMulter.diskStorage = vi.fn(() => 'mockStorage');

        // Inject Mocks
        _setDependencies({
            fs: mockFs,
            multer: mockMulter
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createRapidLeanUpload', () => {
        it('should create directory if not exists', () => {
            mockFs.existsSync.mockReturnValue(false);
            createRapidLeanUpload('org1', 'assess1');
            expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('org1/rapidlean/assess1'), { recursive: true });
        });

        it('should configure storage', () => {
            createRapidLeanUpload('org1');
            expect(mockMulter.diskStorage).toHaveBeenCalled();
        });
    });

    describe('rapidLeanPhotoUpload', () => {
        it('should require organizationId', () => {
            req.user.organizationId = null;
            rapidLeanPhotoUpload(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should handle uploads using multer', () => {
            rapidLeanPhotoUpload(req, res, next);
            expect(mockMulterMiddleware.array).toHaveBeenCalledWith('photos', 10);
            expect(next).toHaveBeenCalled();
        });
    });
});
