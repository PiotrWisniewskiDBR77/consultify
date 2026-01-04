import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getDatabaseAsync } from '../server/src/database/Database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHEMA_FILE = path.resolve(__dirname, '../server/database.sqlite.active.js');

async function validateSchema() {
    console.log('================================================');
    console.log('       SCHEMA VALIDATION (Live vs Source)');
    console.log('================================================');

    // 1. Extract Expected Tables from Source Code
    console.log(`[1] Reading Schema Source: ${SCHEMA_FILE}`);
    if (!fs.existsSync(SCHEMA_FILE)) {
        console.error('❌ FAIL: Schema source file not found!');
        process.exit(1);
    }

    const content = fs.readFileSync(SCHEMA_FILE, 'utf8');
    const tableRegex = /CREATE TABLE IF NOT EXISTS\s+([a-zA-Z0-9_]+)/gi;
    const expectedTables = new Set<string>();

    let match;
    while ((match = tableRegex.exec(content)) !== null) {
        expectedTables.add(match[1]);
    }

    console.log(`    Found ${expectedTables.size} table definitions in source code.`);

    // 2. Get Actual Tables from Database
    console.log('[2] Connecting to Database...');
    const db = await getDatabaseAsync();

    // SQLite specific query
    const actualTablesRows = await db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    const actualTables = new Set(actualTablesRows.map((r) => r.name));

    console.log(`    Found ${actualTables.size} tables in active database.`);

    // 3. Compare
    console.log('\n[3] Analysis:');

    const missingInDb = [...expectedTables].filter((t) => !actualTables.has(t));
    const extraInDb = [...actualTables].filter((t) => !expectedTables.has(t));

    let hasErrors = false;

    if (missingInDb.length > 0) {
        console.log('\n❌ MISSING TABLES (In Code but NOT in DB):');
        missingInDb.forEach((t) => console.log(`   - ${t}`));
        hasErrors = true;
    } else {
        console.log('\n✅ All source tables are present in DB.');
    }

    if (extraInDb.length > 0) {
        console.log('\n⚠️  EXTRA TABLES (In DB but NOT in Code - might be migrations or old tables):');
        extraInDb.forEach((t) => console.log(`   - ${t}`));
        // This is not a fatal error for "Integrity", but worth noting.
    } else {
        console.log('\n✅ No extra tables found.');
    }

    // Specific Checks from Task
    const specificChecks = ['ai_drafts', 'ai_project_memory'];
    console.log('\n[4] Specific Task Checks:');
    specificChecks.forEach((table) => {
        const inCode = expectedTables.has(table);
        const inDb = actualTables.has(table);

        let status = '';
        if (inCode && inDb) status = '✅ OK';
        else if (!inCode && !inDb) status = '❓ Missing in BOTH (Likely unimplemented)';
        else if (inCode && !inDb) status = '❌ Missing in DB';
        else if (!inCode && inDb) status = '⚠️  In DB only';

        console.log(`   - ${table}: ${status} (Code: ${inCode}, DB: ${inDb})`);

        if (!inCode && !inDb && table === 'ai_drafts') {
            hasErrors = true; // Flag as error per user request to identify it
            console.log('     -> ACTION REQUIRED: ai_drafts needs to be added to schema!');
        }
    });

    console.log('\n================================================');
    if (hasErrors) {
        console.warn('⚠️  Schema Validation Completed with ISSUES.');
        process.exit(1);
    } else {
        console.log('✅ Schema Validation PASSED.');
        process.exit(0);
    }
}

validateSchema().catch((e) => {
    console.error(e);
    process.exit(1);
});
