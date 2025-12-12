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

    /**
     * Get storage usage for a specific organization
     */
    async getUsageByOrganization(orgId) {
        const orgPath = path.join(BASE_UPLOAD_DIR, orgId);
        return await this.getDirectorySize(orgPath);
    }

    /**
     * Get global storage usage stats
     */
    async getGlobalUsage() {
        const totalSize = await this.getDirectorySize(BASE_UPLOAD_DIR);

        // Get breakdown by top-level folders (organizations)
        const breakdown = [];
        try {
            const entries = await fs.promises.readdir(BASE_UPLOAD_DIR, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const size = await this.getDirectorySize(path.join(BASE_UPLOAD_DIR, entry.name));
                    breakdown.push({ name: entry.name, size });
                }
            }
        } catch (e) {
            // Ignore error if base dir doesn't exist yet
        }

        return { totalSize, breakdown };
    }

    /**
     * List all files in an organization's directory
     */
    async listFiles(orgId) {
        const orgPath = path.join(BASE_UPLOAD_DIR, orgId);
        const files = [];

        try {
            await this._scanDir(orgPath, files, orgId); // Pass root orgId for relative path logic
        } catch (e) {
            // Likely dir doesn't exist
        }
        return files;
    }

    async _scanDir(dir, fileList, rootOrgId) {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await this._scanDir(fullPath, fileList, rootOrgId);
            } else {
                const stats = await fs.promises.stat(fullPath);
                // Create a relative path for display/ID purposes
                // If fullPath is ".../uploads/org-123/global/file.png" and root is ".../uploads/org-123"
                // relative is "global/file.png"

                // Construct root path to subtract
                const rootPath = path.join(BASE_UPLOAD_DIR, rootOrgId);
                const relPath = fullPath.replace(rootPath + path.sep, '');

                fileList.push({
                    name: entry.name,
                    path: relPath, // Use this as the ID for deletion
                    fullPath: fullPath, // Keep for debugging if needed, but don't expose to client if risky
                    size: stats.size,
                    created_at: stats.birthtime
                });
            }
        }
    }

    /**
     * Delete a specific file by relative path within org
     */
    async deleteFile(orgId, relativePath) {
        const fullPath = path.join(BASE_UPLOAD_DIR, orgId, relativePath);

        // Security check: Ensure path is still within org dir
        const orgRoot = path.join(BASE_UPLOAD_DIR, orgId);
        if (!fullPath.startsWith(orgRoot)) {
            throw new Error('Security: Invalid file path');
        }

        if (fs.existsSync(fullPath)) {
            await fs.promises.unlink(fullPath);
            return true;
        }
        return false;
    }
}

module.exports = new StorageService();
