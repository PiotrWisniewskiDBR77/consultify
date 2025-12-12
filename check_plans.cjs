const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'server/consultify.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database at ' + dbPath, err);
        return;
    }
});

db.all('SELECT * FROM subscription_plans', [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log('Total plans:', rows.length);
    if (rows.length === 0) {
        console.log('No plans found.');
    } else {
        rows.forEach(p => console.log(p));
    }
});
