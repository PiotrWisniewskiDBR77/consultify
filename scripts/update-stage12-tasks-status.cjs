/**
 * Update Stage 12 Tasks Status Script
 * 
 * Updates task status to completed for stages 12.1-12.4
 * 
 * Run with: node scripts/update-stage12-tasks-status.cjs
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'server', 'consultify.db');
console.log('Database path:', DB_PATH);
const db = new sqlite3.Database(DB_PATH);

// Helper for promises
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
    });
});

async function updateTasksStatus() {
    console.log('🔄 Updating Stage 12 tasks status...\n');

    try {
        // Find tasks for Stage 12
        const tasks = await dbAll(
            `SELECT id, title, status FROM tasks 
             WHERE title LIKE 'ETAP 12.%' 
             ORDER BY title`
        );

        if (tasks.length === 0) {
            console.log('❌ No Stage 12 tasks found');
            return;
        }

        console.log(`Found ${tasks.length} Stage 12 tasks:\n`);

        // Tasks to mark as completed (12.1-12.4)
        const completedTasks = [
            'ETAP 12.1: Weryfikacja kompletności migracji',
            'ETAP 12.2: Usunięcie backward compatibility',
            'ETAP 12.3: Optymalizacja build i performance',
            'ETAP 12.4: Dokumentacja finalna'
        ];

        for (const task of tasks) {
            const shouldComplete = completedTasks.some(title => task.title.includes(title.split(':')[0]));
            
            if (shouldComplete && task.status !== 'done') {
                await dbRun(
                    `UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?`,
                    [new Date().toISOString(), task.id]
                );
                console.log(`  ✅ Updated: ${task.title} → done`);
            } else if (task.status === 'done') {
                console.log(`  ✓ Already done: ${task.title}`);
            } else {
                console.log(`  ⏳ Pending: ${task.title}`);
            }
        }

        console.log(`\n✅ Successfully updated ${completedTasks.length} tasks!`);

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        db.close();
    }
}

// Run the script
updateTasksStatus()
    .then(() => {
        console.log('\n✨ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Failed:', error);
        process.exit(1);
    });

