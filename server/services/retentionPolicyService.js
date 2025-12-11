const db = require('../database');
const fs = require('fs');
const path = require('path');

// Retention period in days (e.g., 30 days for GDPR/trash)
const VISIBLE_RETENTION_DAYS = 30;
const HARD_DELETE_RETENTION_DAYS = 30; // Time in trash before permanent delete

const RetentionPolicyService = {

    /**
     * Run the retention cleanup policy
     */
    runCleanup: async () => {
        console.log('[Retention] Starting Cleanup Job...');
        const now = new Date();
        const cutoffDate = new Date(now.setDate(now.getDate() - HARD_DELETE_RETENTION_DAYS));

        try {
            // 1. Get files ready for hard delete
            const filesToDelete = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, filepath, organization_id, project_id 
                     FROM knowledge_docs 
                     WHERE deleted_at IS NOT NULL AND deleted_at < ?`,
                    [cutoffDate.toISOString()],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            });

            console.log(`[Retention] Found ${filesToDelete.length} files to permanently delete.`);

            for (const file of filesToDelete) {
                try {
                    // Physical Delete
                    // Path should technically point to the .trash location if we moved it there during soft delete
                    // Or if we implemented soft delete just as a flag, we delete it now.
                    // Assuming we moved it to .trash upon soft delete, or we delete it from original path now.
                    // Let's assume filepath is the current valid path (in trash or otherwise)
                    if (file.filepath && fs.existsSync(file.filepath)) {
                        fs.unlinkSync(file.filepath);
                        console.log(`[Retention] Permanently deleted physical file: ${file.filepath}`);
                    }

                    // Database Delete
                    await new Promise((resolve, reject) => {
                        db.run("DELETE FROM knowledge_docs WHERE id = ?", [file.id], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });

                    // Update Usage Records (Reclaim storage) - ACTUALLY usage should be reclaimed on soft delete or hard delete?
                    // Usually reclaimed on hard delete if trash counts towards quota.
                    // If trash does NOT count, we reclaimed on soft delete.
                    // Let's assume trash counts towards quota until emptied.

                    // Decrease Used Storage in Projects (if applicable)
                    if (file.project_id) {
                        db.run(`UPDATE projects SET storage_used_bytes = storage_used_bytes - ? WHERE id = ?`,
                            [file.file_size_bytes || 0, file.project_id]);
                    }

                } catch (e) {
                    console.error(`[Retention] Failed to delete file ${file.id}`, e);
                }
            }

            console.log('[Retention] Cleanup Job Completed.');

        } catch (err) {
            console.error('[Retention] Job Failed:', err);
        }
    }
};

module.exports = RetentionPolicyService;
