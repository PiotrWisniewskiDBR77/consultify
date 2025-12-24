/**
 * Multer middleware for RapidLean observation photo uploads
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Create multer instance for RapidLean photo uploads
 * @param {string} organizationId - Organization ID
 * @param {string} assessmentId - Assessment ID (optional, for organizing files)
 * @returns {Object} Multer instance
 */
function createRapidLeanUpload(organizationId, assessmentId = null) {
    const uploadDir = assessmentId
        ? path.join(__dirname, '../../uploads/organizations', organizationId, 'rapidlean', assessmentId)
        : path.join(__dirname, '../../uploads/organizations', organizationId, 'rapidlean', 'temp');

    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            // Sanitize filename and append unique suffix
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname);
            cb(null, `photo_${uniqueSuffix}${ext}`);
        }
    });

    return multer({
        storage: storage,
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB per file
            files: 10 // Max 10 files
        },
        fileFilter: (req, file, cb) => {
            const filetypes = /jpeg|jpg|png|webp/;
            const mimetype = filetypes.test(file.mimetype);
            const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
            
            if (mimetype && extname) {
                return cb(null, true);
            }
            cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'));
        }
    });
}

/**
 * Middleware factory for RapidLean photo uploads
 */
function rapidLeanPhotoUpload(req, res, next) {
    const organizationId = req.user?.organizationId || req.user?.organization_id;
    const assessmentId = req.body?.assessmentId || req.params?.assessmentId || null;

    if (!organizationId) {
        return res.status(401).json({ error: 'Organization ID required' });
    }

    const upload = createRapidLeanUpload(organizationId, assessmentId);
    
    // Handle multiple files with field name 'photos'
    upload.array('photos', 10)(req, res, (err) => {
        if (err) {
            console.error('[RapidLean Upload] Error:', err.message);
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}

module.exports = {
    createRapidLeanUpload,
    rapidLeanPhotoUpload
};

