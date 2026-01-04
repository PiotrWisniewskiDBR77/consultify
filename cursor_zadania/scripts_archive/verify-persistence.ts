import { getDatabaseAsync } from '../server/src/database/Database.js';

const KEY = 'persistence_test_token';
const VAL = 'verify_' + Date.now();

async function main() {
    const args = process.argv.slice(2);
    const command = args[0]; // 'write' or 'read'

    console.log('================================================');
    console.log('       DATA PERSISTENCE TEST');
    console.log('================================================');

    const db = await getDatabaseAsync();

    if (command === 'write') {
        console.log(`[WRITE] Inserting Key: ${KEY}, Value: ${VAL}`);
        try {
            // Ensure settings table exists (it should based on schema validation)
            await db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [KEY, VAL]);
            console.log('✅ Write Successful.');
            console.log(`Token written: ${VAL}`);
            // Save token to temp file or stdout to pipe to read?
            // For simplicity, we'll just require the user (me) to copy it or I'll just write a fixed value for this test?
            // Let's use a fixed value + random to be sure.
            // Actually, I'll print it and I can pass it to read.
        } catch (e: any) {
            console.error('❌ Write Failed:', e.message);
            process.exit(1);
        }
    } else if (command === 'read') {
        const expected = args[1];
        console.log(`[READ] Checking Key: ${KEY}`);

        try {
            const row = await db.get<{ value: string }>(`SELECT value FROM settings WHERE key = ?`, [KEY]);
            if (!row) {
                console.error('❌ Read Failed: Row not found.');
                process.exit(1);
            }

            console.log(`    Retrieved Value: ${row.value}`);

            if (expected) {
                if (row.value === expected) {
                    console.log('✅ MATCH: Data persisted successfully.');
                } else {
                    console.error(`❌ MISMATCH: Expected ${expected}, got ${row.value}`);
                    process.exit(1);
                }
            } else {
                console.log('✅ Read Successful (No expectation provided).');
            }
        } catch (e: any) {
            console.error('❌ Read Failed:', e.message);
            process.exit(1);
        }
    } else {
        console.error('Usage: persistence <write|read> [expected_value]');
        process.exit(1);
    }

    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
