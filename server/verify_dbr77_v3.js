const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

const orgId = 'org-dbr77-test';

console.log('--- Verifying DBR77 Workspace Data ---');

db.all(`SELECT * FROM projects WHERE organization_id = ?`, [orgId], (err, rows) => {
    console.log(`Projects: ${rows ? rows.length : 0}`);
    if (rows) rows.forEach(r => console.log(` - ${r.name} (${r.status})`));
});

db.all(`SELECT * FROM knowledge_candidates`, [], (err, rows) => {
    console.log(`Knowledge Candidates: ${rows ? rows.length : 0}`);
});

db.all(`SELECT * FROM global_strategies`, [], (err, rows) => {
    console.log(`Global Strategies: ${rows ? rows.length : 0}`);
});

db.all(`SELECT * FROM ai_playbook_templates`, [], (err, rows) => {
    console.log(`Playbook Templates: ${rows ? rows.length : 0}`);
});

db.all(`SELECT * FROM invoices WHERE organization_id = ?`, [orgId], (err, rows) => {
    console.log(`Invoices: ${rows ? rows.length : 0}`);
    if (rows) rows.forEach(r => console.log(` - ${r.id}: ${r.amount_paid} (${r.status})`));
    db.close();
});
