export default BackupService;
declare namespace BackupService {
    /**
     * Create a new backup
     * @param {string} type - 'full' | 'incremental' (incremental not implemented yet)
     * @param {string} reason - Reason for backup ('scheduled', 'manual', 'pre-deploy')
     * @returns {Promise<{id: string, path: string, size: number}>}
     */
    function createBackup(type?: string, reason?: string): Promise<{
        id: string;
        path: string;
        size: number;
    }>;
    /**
     * List available backups
     * @param {Object} options - Filter options
     * @returns {Promise<Array>}
     */
    function listBackups(options?: Object): Promise<any[]>;
    /**
     * Restore from backup
     * @param {string} backupId
     * @param {Object} options
     * @returns {Promise<{success: boolean}>}
     */
    function restoreBackup(backupId: string, options?: Object): Promise<{
        success: boolean;
    }>;
    /**
     * Delete a backup
     * @param {string} backupId
     */
    function deleteBackup(backupId: string): Promise<void>;
    /**
     * Run retention policy - delete expired backups
     * @returns {Promise<{deleted: number}>}
     */
    function runRetentionPolicy(): Promise<{
        deleted: number;
    }>;
    function _encryptBackup(inputPath: any): Promise<string>;
    function _decryptBackup(inputPath: any): Promise<any>;
    function _uploadToS3(filePath: any, filename: any): Promise<string>;
    function _downloadFromS3(s3Key: any, filename: any): Promise<string>;
    function _deleteFromS3(s3Key: any): Promise<void>;
}
//# sourceMappingURL=backupService.d.ts.map