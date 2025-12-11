/**
 * Storage Service
 * Abstract file system operations to support Multi-tenant Isolation and S3 migration
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Base upload directory - could be an environment variable or config
const BASE_UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

class StorageService {

    constructor() {
        // Ensure base directory exists
        if (!fs.existsSync(BASE_UPLOAD_DIR)) {
            fs.mkdirSync(BASE_UPLOAD_DIR, { recursive: true });
        }
    }

    /**
     * Get the isolated path for a project
     * Structure: /uploads/{orgId}/{projectId}/{type}/filename
     */
    getIsolatedPath(orgId, projectId, type = 'global') {
        if (!orgId) throw new Error('Organization ID is required for storage path');

        // If no project, store in 'global' scope of organization
        const projectScope = projectId || 'global';

        return path.join(BASE_UPLOAD_DIR, orgId, projectScope, type);
    }

    /**
     * Move a file from temporary location to permanent isolated storage
     * @param {string} tempPath - Current path of the file (e.g. from multer)
     * @param {string} orgId - Organization ID
     * @param {string} projectId - Project ID (optional)
     * @param {string} type - File type category (e.g. 'knowledge', 'avatars')
     * @param {string} filename - Original filename
     * @returns {string} - Absolute path to stored file
     */
    async storeFile(tempPath, orgId, projectId, type, filename) {
        const targetDir = this.getIsolatedPath(orgId, projectId, type);

        // Sanitize filename
        const safeName = `${Date.now()}-${filename.replace(/[^a-z0-9.]/gi, '_').toLowerCase()}`;
        const targetPath = path.join(targetDir, safeName);

        // Ensure directory exists
        await fs.promises.mkdir(targetDir, { recursive: true });

        // Move file
        await fs.promises.rename(tempPath, targetPath);

        return targetPath;
    }

    /**
     * Soft delete a file (move to trash folder within org)
     */
    async softDeleteFile(currentPath, orgId) {
        if (!currentPath || !fs.existsSync(currentPath)) return false;

        const fileName = path.basename(currentPath);
        const trashDir = path.join(BASE_UPLOAD_DIR, orgId, '.trash');
        const trashPath = path.join(trashDir, `${Date.now()}-${fileName}`);

        await fs.promises.mkdir(trashDir, { recursive: true });
        await fs.promises.rename(currentPath, trashPath);

        return true;
    }

    /**
     * Get file metadata
     */
    async getFileStats(filePath) {
        try {
            return await fs.promises.stat(filePath);
        } catch (e) {
            return null;
        }
    }

    /**
     * Recursively calculate directory size (for reconciliation)
     */
    async getDirectorySize(dirPath) {
        let size = 0;
        try {
            const files = await fs.promises.readdir(dirPath, { withFileTypes: true });

            for (const file of files) {
                const fullPath = path.join(dirPath, file.name);
                if (file.isDirectory()) {
                    size += await this.getDirectorySize(fullPath);
                } else {
                    const stats = await fs.promises.stat(fullPath);
                    size += stats.size;
                }
            }
        } catch (e) {
            // Directory might not exist or access denied
            return 0;
        }
        return size;
    }
}

module.exports = new StorageService();
