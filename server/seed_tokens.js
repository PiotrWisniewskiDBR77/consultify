const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

const EMAILS = [
    'admin@dbr77.com',
    'piotr.wisniewski@dbr77.com',
    'justyna.laskowska@dbr77.com'
];

const INITIAL_TOKENS = 1000000;

console.log("Seeding Token Balances...");

db.serialize(() => {
    // Ensure table exists (in case it wasn't created by seed_models or app)
    db.run(`CREATE TABLE IF NOT EXISTS user_token_balance (
        user_id TEXT PRIMARY KEY,
        platform_tokens INTEGER DEFAULT 0,
        platform_tokens_bonus INTEGER DEFAULT 0,
        byok_usage_tokens INTEGER DEFAULT 0,
        local_usage_tokens INTEGER DEFAULT 0,
        lifetime_purchased INTEGER DEFAULT 0,
        lifetime_used INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    EMAILS.forEach(email => {
        db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
            if (err) console.error(err);
            if (row) {
                const userId = row.id;
                console.log(`Found user ${email} (ID: ${userId}). Crediting tokens...`);

                db.run(`INSERT OR IGNORE INTO user_token_balance (user_id) VALUES (?)`, [userId], (err) => {
                    if (err) console.error("Error creating balance record:", err);

                    db.run(`UPDATE user_token_balance SET platform_tokens = ? WHERE user_id = ?`, [INITIAL_TOKENS, userId], (err) => {
                        if (err) console.error("Error updating tokens:", err);
                        else console.log(`✅ Credited ${INITIAL_TOKENS} tokens to ${email}`);
                    });
                });
            } else {
                console.log(`User ${email} not found.`);
            }
        });
    });
});

setTimeout(() => {
    db.close();
}, 2000);
