const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Configuration
const DB_PATH = path.resolve(__dirname, '../server/consultify.db');
const OLD_UPLOAD_DIR = path.resolve(__dirname, '../knowledge_uploads');
const NEW_UPLOAD_BASE = path.resolve(__dirname, '../uploads');

// Default Org for legacy docs (adjust as needed)
const DEFAULT_ORG_ID = 'org-dbr77-system';

const db = new sqlite3.Database(DB_PATH);

async function migrate() {
    console.log('Starting Storage Migration...');

    // 1. Get all documents
    const docs = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM knowledge_docs", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    console.log(`Found ${docs.length} documents to check.`);

    let movedCount = 0;
    let errors = 0;

    for (const doc of docs) {
        // If already migrated (path contains 'uploads' and 'knowledge'), skip
        if (doc.filepath && doc.filepath.includes(path.sep + 'uploads' + path.sep)) {
            continue;
        }

        const oldPath = doc.filepath;

        // Skip if file doesn't exist
        if (!fs.existsSync(oldPath)) {
            console.warn(`File missing for doc ${doc.id}: ${oldPath}`);
            continue;
        }

        // Determine target
        const orgId = doc.organization_id || DEFAULT_ORG_ID;
        const projectId = doc.project_id || 'global';

        // Define new path
        const newDir = path.join(NEW_UPLOAD_BASE, orgId, projectId, 'knowledge');
        const fileName = path.basename(oldPath);
        const newPath = path.join(newDir, fileName);

        try {
            // Create dir
            if (!fs.existsSync(newDir)) {
                fs.mkdirSync(newDir, { recursive: true });
            }

            // Move file
            fs.renameSync(oldPath, newPath);

            // Get size
            const stats = fs.statSync(newPath);

            // Update DB
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE knowledge_docs 
                     SET filepath = ?, organization_id = ?, file_size_bytes = ? 
                     WHERE id = ?`,
                    [newPath, orgId, stats.size, doc.id],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            console.log(`Migrated: ${fileName} -> ${orgId}/${projectId}`);
            movedCount++;

        } catch (err) {
            console.error(`Failed to migrate ${doc.id}:`, err);
            errors++;
        }
    }

    console.log(`Migration Complete. Moved: ${movedCount}, Errors: ${errors}`);
    db.close();
}

migrate().catch(console.error);
