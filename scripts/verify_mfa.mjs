import db from '../server/database.sqlite.active.js';

console.log('Waiting for DB initialization...');

setTimeout(() => {
    db.serialize(() => {
        // Check tables
        db.all("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('mfa_attempts', 'trusted_devices')", (err, tables) => {
            if (err) console.error(err);
            console.log('MFA Tables Found:', tables);
        });

        // Check columns
        db.all("PRAGMA table_info(users)", (err, columns) => {
            if (err) console.error(err);
            const mfaCols = columns.filter(c => c.name.startsWith('mfa_') || c.name.startsWith('phone_'));
            console.log('MFA Columns Found:', mfaCols.map(c => c.name));

            // Exit after check
            setTimeout(() => process.exit(0), 1000);
        });
    });
}, 3000);
