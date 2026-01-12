export default storageServiceInstance;
declare const storageServiceInstance: StorageService;
declare class StorageService {
    setDependencies(newDeps?: {}): void;
    /**
     * Get the isolated path for a project
     * Structure: /uploads/{orgId}/{projectId}/{type}/filename
     */
    getIsolatedPath(orgId: any, projectId: any, type?: string): string;
    /**
     * Move a file from temporary location to permanent isolated storage
     * @param {string} tempPath - Current path of the file (e.g. from multer)
     * @param {string} orgId - Organization ID
     * @param {string} projectId - Project ID (optional)
     * @param {string} type - File type category (e.g. 'knowledge', 'avatars')
     * @param {string} filename - Original filename
     * @returns {string} - Absolute path to stored file
     */
    storeFile(tempPath: string, orgId: string, projectId: string, type: string, filename: string): string;
    /**
     * Soft delete a file (move to trash folder within org)
     */
    softDeleteFile(currentPath: any, orgId: any): Promise<boolean>;
    /**
     * Get file metadata
     */
    getFileStats(filePath: any): Promise<fs.Stats | null>;
    /**
     * Recursively calculate directory size (for reconciliation)
     */
    getDirectorySize(dirPath: any): Promise<number>;
    /**
     * Get storage usage for a specific organization
     */
    getUsageByOrganization(orgId: any): Promise<{
        totalBytes: number;
        fileCount: number;
    }>;
    /**
     * Get storage usage (alias for getUsageByOrganization)
     */
    getStorageUsage(orgId: any): Promise<{
        totalBytes: number;
        fileCount: number;
    }>;
    /**
     * Get global storage usage stats
     */
    getGlobalUsage(): Promise<{
        totalSize: number;
        breakdown: {
            name: string;
            size: number;
        }[];
    }>;
    /**
     * List all files in an organization's directory
     */
    listFiles(orgId: any): Promise<any[]>;
    _scanDir(dir: any, fileList: any, rootOrgId: any): Promise<void>;
    /**
     * Delete a specific file by relative path within org
     */
    deleteFile(orgId: any, relativePath: any): Promise<boolean>;
}
import fs from 'fs';
//# sourceMappingURL=storageService.d.ts.map