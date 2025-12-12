const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'server/consultify.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database at ' + dbPath, err);
        return;
    }
});

db.all('SELECT id, name, plan FROM organizations', [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log('Total organizations:', rows.length);
    const nullPlans = rows.filter(r => !r.plan);
    console.log('Organizations with null/empty plan:', nullPlans.length);
    if (nullPlans.length > 0) {
        console.log('Example:', nullPlans[0]);
    } else {
        console.log('All organizations have a plan set.');
    }
});
