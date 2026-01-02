const db = require('../database');

function checkAndMigrate() {
    console.log('Checking user_ai_settings schema...');

    db.all("PRAGMA table_info(user_ai_settings)", [], (err, rows) => {
        if (err) {
            console.error('Error checking schema:', err);
            return;
        }

        const hasSelectedTier = rows.some(row => row.name === 'selected_tier');

        if (hasSelectedTier) {
            console.log('✅ Column selected_tier already exists.');
        } else {
            console.log('⚠️ Column selected_tier missing. Adding it...');
            db.run("ALTER TABLE user_ai_settings ADD COLUMN selected_tier TEXT DEFAULT 'BUDGET'", [], (alterErr) => {
                if (alterErr) {
                    console.error('❌ Failed to add column:', alterErr);
                } else {
                    console.log('✅ Successfully added selected_tier column.');
                }
            });
        }
    });
}

// Wait for DB to be ready (if async connection)
setTimeout(checkAndMigrate, 1000);
