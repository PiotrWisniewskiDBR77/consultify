/**
 * File Upload Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Secure file upload handling for assessment documents
 */

import { Request } from 'express';
import * as fs from 'fs';
import multer from 'multer';
import * as path from 'path';

import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

interface _FileRequest extends AuthRequest {
    file?: Express.Multer.File;
}

// ==========================================
// STORAGE CONFIGURATION
// ==========================================

/**
 * Storage configuration
 */
const storage = multer.diskStorage({
    destination: (req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
        const orgId = (req as AuthRequest).user?.organizationId || 'unknown';
        const dir = path.join(__dirname, '../../../uploads/assessments', orgId);

        // Create directory if it doesn't exist
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        cb(null, dir);
    },
    filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        // Generate unique filename: timestamp-random-original.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext);
        cb(null, `${uniqueSuffix}-${basename}${ext}`);
    },
});

/**
 * File filter - only allow PDF, Excel, Word
 */
const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
): void => {
    const allowedExts = /pdf|xlsx|xls|docx|doc/;
    const allowedMimes = /pdf|spreadsheet|document|msword|ms-excel/;

    const extname = allowedExts.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimes.test(file.mimetype.toLowerCase());

    if (extname && mimetype) {
        return cb(null, true);
    }

    cb(new Error('Only PDF, Excel, and Word documents are allowed'), false);
};

/**
 * Multer upload middleware
 */
export const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
        files: 1, // Single file upload
    },
    fileFilter: fileFilter as any,
});

export { fileFilter };




