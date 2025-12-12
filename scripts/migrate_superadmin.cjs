const db = require('../server/database');

console.log('Starting SuperAdmin Schema Migration (Retry)...');

db.serialize(() => {
    // 1. Add created_at to organizations (without dynamic default first)
    db.run(`ALTER TABLE organizations ADD COLUMN created_at TEXT`, (err) => {
        if (err && err.message.includes('duplicate column')) {
            console.log('Column created_at already exists.');
        } else if (err) {
            console.error('Error adding created_at:', err.message);
        } else {
            console.log('Added created_at column.');
            // Backfill
            const now = new Date().toISOString();
            db.run(`UPDATE organizations SET created_at = ? WHERE created_at IS NULL`, [now]);
        }
    });

    // 2. Add discount_percent to organizations
    db.run(`ALTER TABLE organizations ADD COLUMN discount_percent INTEGER DEFAULT 0`, (err) => {
        if (err && err.message.includes('duplicate column')) {
            console.log('Column discount_percent already exists.');
        } else if (err) {
            console.error('Error adding discount_percent:', err.message);
        } else {
            console.log('Added discount_percent column.');
        }
    });

    // 3. Ensure last_login exists in users
    db.run(`ALTER TABLE users ADD COLUMN last_login DATETIME`, (err) => {
        if (err && err.message.includes('duplicate column')) {
            console.log('Column last_login already exists.');
        } else if (err) {
            console.error('Error adding last_login:', err.message);
        } else {
            console.log('Added last_login column.');
        }
    });

    console.log('Migration steps queued.');
});
