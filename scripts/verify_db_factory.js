
import { TestDatabaseFactory } from '../tests/utils/TestDatabaseFactory.js';

async function testFactory() {
    try {
        console.log('Creating DB...');
        const db = await TestDatabaseFactory.create();
        console.log('DB Created.');

        await new Promise((resolve, reject) => {
            db.run('INSERT INTO organizations (id, name) VALUES (?, ?)', ['org-1', 'Test Org'], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('Insert successful.');

        await new Promise((resolve, reject) => {
            db.get('SELECT * FROM organizations', (err, row) => {
                if (err) reject(err);
                console.log('Row:', row);
                resolve();
            });
        });

        console.log('✅ Factory Test Passed');
    } catch (err) {
        console.error('❌ Factory Test Failed:', err);
    }
}

testFactory();
