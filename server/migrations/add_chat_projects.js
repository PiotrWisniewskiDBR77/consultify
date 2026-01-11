/**
 * Migration: Add chat_projects table
 *
 * Creates the chat_projects table for organizing conversations into folders/projects
 * similar to Claude AI's project organization feature.
 */

const sqlite3 = require('sqlite3').verbose();
import path from 'path';

// Use the same database path as the main application
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../consultinity.db');

async function migrate() {
  const db = new sqlite3.Database(DB_PATH);

  const runAsync = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });

  console.log('[Migration] Creating chat_projects table...');

  try {
    // Create chat_projects table
    await runAsync(`
            CREATE TABLE IF NOT EXISTS chat_projects (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                organization_id TEXT,
                name TEXT NOT NULL,
                description TEXT,
                color TEXT DEFAULT '#6366f1',
                icon TEXT DEFAULT 'folder',
                conversation_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
    console.log('[Migration] ✓ chat_projects table created');

    // Create index for faster user lookups
    await runAsync(`
            CREATE INDEX IF NOT EXISTS idx_chat_projects_user ON chat_projects(user_id)
        `);
    console.log('[Migration] ✓ Index idx_chat_projects_user created');

    // Create index for organization lookups
    await runAsync(`
            CREATE INDEX IF NOT EXISTS idx_chat_projects_org ON chat_projects(organization_id)
        `);
    console.log('[Migration] ✓ Index idx_chat_projects_org created');

    // Add chat_project_id column to conversations table if not exists
    // First check if column exists
    const columns = await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(conversations)', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    const hasProjectColumn = columns.some((col) => col.name === 'chat_project_id');

    if (!hasProjectColumn) {
      await runAsync(`
                ALTER TABLE conversations ADD COLUMN chat_project_id TEXT REFERENCES chat_projects(id)
            `);
      console.log('[Migration] ✓ Added chat_project_id column to conversations');

      // Create index for the new column
      await runAsync(`
                CREATE INDEX IF NOT EXISTS idx_conversations_chat_project ON conversations(chat_project_id)
            `);
      console.log('[Migration] ✓ Index idx_conversations_chat_project created');
    } else {
      console.log('[Migration] → chat_project_id column already exists');
    }

    console.log('[Migration] ✅ Migration complete!');
  } catch (error) {
    console.error('[Migration] ❌ Error:', error.message);
    throw error;
  } finally {
    db.close();
  }
}

// Run if executed directly
if (require.main === module) {
  migrate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { migrate };

export default { migrate };
