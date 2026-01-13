/**
 * RapidLean Upload Middleware Test
 *
 * Tests for RapidLean upload validation middleware.
 *
 * @module tests/unit/backend/middleware/rapidLeanUploadMiddleware.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create RapidLean upload middleware
const createRapidLeanUploadMiddleware = (options = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB
    allowedTypes = [
      'image/jpeg',
      'image/png',
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
    ],
    requireLocation = true,
  } = options;

  return (req, res, next) => {
    // Only for RapidLean upload endpoints
    if (!req.path.includes('/rapidlean/upload') && !req.path.includes('/rapidlean/observations')) {
      return next();
    }

    const file = req.file;
    const { location, templateId } = req.body || {};

    // Validate file if present
    if (file) {
      if (file.size > maxSize) {
        return res.status(400).json({
          error: 'File too large',
          code: 'FILE_TOO_LARGE',
          maxSize,
        });
      }

      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: 'Invalid file type',
          code: 'INVALID_FILE_TYPE',
          allowedTypes,
        });
      }
    }

    // Validate location for observations
    if (req.path.includes('/observations') && requireLocation) {
      if (!location || typeof location !== 'string' || location.trim().length < 2) {
        return res.status(400).json({
          error: 'Location required',
          code: 'LOCATION_REQUIRED',
          message: 'A valid observation location is required',
        });
      }
    }

    // Validate templateId
    if (templateId !== undefined) {
      const validTemplates = ['value_stream', 'waste', '5s', 'flow', 'pull', 'quality'];
      if (!validTemplates.includes(templateId)) {
        return res.status(400).json({
          error: 'Invalid template',
          code: 'INVALID_TEMPLATE',
          validTemplates,
        });
      }
    }

    return next();
  };
};

describe('RapidLean Upload Middleware', () => {
  let middleware;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    middleware = createRapidLeanUploadMiddleware();

    mockReq = {
      path: '/api/rapidlean/upload',
      body: { location: 'Assembly Line A', templateId: 'waste' },
      file: {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        size: 1024 * 1024,
      },
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('Valid Upload', () => {
    it('should allow valid file upload', () => {
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip non-RapidLean paths', () => {
      mockReq.path = '/api/projects';
      mockReq.file.size = 100 * 1024 * 1024; // Too large but should be ignored

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('File Validation', () => {
    it('should reject oversized files', () => {
      mockReq.file.size = 50 * 1024 * 1024;

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FILE_TOO_LARGE' })
      );
    });

    it('should reject invalid file types', () => {
      mockReq.file.mimetype = 'application/x-executable';

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_FILE_TYPE' })
      );
    });
  });

  describe('Location Validation', () => {
    it('should require location for observations', () => {
      mockReq.path = '/api/rapidlean/observations';
      delete mockReq.body.location;

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'LOCATION_REQUIRED' })
      );
    });

    it('should reject empty location', () => {
      mockReq.path = '/api/rapidlean/observations';
      mockReq.body.location = ' ';

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Template Validation', () => {
    it('should reject invalid template', () => {
      mockReq.body.templateId = 'invalid_template';

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_TEMPLATE' })
      );
    });
  });
});
