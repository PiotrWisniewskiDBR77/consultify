const sqlite3 = require('sqlite3').verbose();
import path from 'path';

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

console.log('--- Migrating organization_profiles to add branding fields ---');

const columnsToAdd = [
    { name: 'logo_url', type: 'TEXT' },
    { name: 'favicon_url', type: 'TEXT' },
    { name: 'brand_color', type: 'TEXT' },
    { name: 'accent_color', type: 'TEXT' },
    { name: 'custom_domain', type: 'TEXT' },
    { name: 'custom_domain_verified', type: 'INTEGER DEFAULT 0' },
    { name: 'linkedin_url', type: 'TEXT' },
    { name: 'twitter_url', type: 'TEXT' },
    { name: 'website', type: 'TEXT' },
    { name: 'description', type: 'TEXT' }
];

db.serialize(() => {
    columnsToAdd.forEach(column => {
        db.run(`ALTER TABLE organization_profiles ADD COLUMN ${column.name} ${column.type}`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`Column ${column.name} already exists.`);
                } else {
                    console.error(`Error adding column ${column.name}:`, err.message);
                }
            } else {
                console.log(`Column ${column.name} added successfully.`);
            }
        });
    });
});

db.close((err) => {
    if (err) {
        console.error('Error closing database:', err.message);
    } else {
        console.log('Migration completed.');
    }
});
