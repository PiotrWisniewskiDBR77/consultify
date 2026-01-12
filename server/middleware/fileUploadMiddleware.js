/**
 * File Upload Middleware
 * Secure file upload handling for assessment documents
 */

import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Storage configuration
 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const orgId = req.user?.organizationId || 'unknown';
        const dir = path.join(__dirname, '../../uploads/assessments', orgId);

        // Create directory if it doesn't exist
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: timestamp-random-original.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext);
        cb(null, `${uniqueSuffix}-${basename}${ext}`);
    }
});

/**
 * File filter - only allow PDF, Excel, Word
 */
export const fileFilter = (req, file, cb) => {
    const allowedExts = /pdf|xlsx|xls|docx|doc/;
    const allowedMimes = /pdf|spreadsheet|document|msword|ms-excel/;

    const extname = allowedExts.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimes.test(file.mimetype.toLowerCase());

    if (extname && mimetype) {
        return cb(null, true);
    }

    cb(new Error('Only PDF, Excel, and Word documents are allowed'));
};

/**
 * Multer upload middleware
 */
export const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
        files: 1 // Single file upload
    },
    fileFilter
});

// Redundant export block removed

export default {
    upload,
    fileFilter
};
