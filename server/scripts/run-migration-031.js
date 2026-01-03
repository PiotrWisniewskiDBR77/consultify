/**
 * Run Migration 031: Performance Indexes
 * 
 * This script applies performance optimization indexes to the database.
 * It works with both SQLite and PostgreSQL.
 */

require('dotenv').config();
const db = require('../database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    console.log('🚀 Starting Migration 031: Performance Indexes...\n');

    const migrationFile = path.join(__dirname, '../migrations/031_performance_indexes.sql');
    
    if (!fs.existsSync(migrationFile)) {
        console.error('❌ Migration file not found:', migrationFile);
        process.exit(1);
    }

    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // Split by semicolon and filter out empty statements
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📋 Found ${statements.length} statements to execute\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        
        // Skip comments
        if (statement.startsWith('--')) {
            continue;
        }

        try {
            await new Promise((resolve, reject) => {
                db.run(statement + ';', [], (err) => {
                    if (err) {
                        // Ignore "already exists" errors for indexes
                        if (err.message.includes('already exists') || 
                            err.message.includes('duplicate') ||
                            err.message.includes('UNIQUE constraint')) {
                            console.log(`⏭️  [${i + 1}/${statements.length}] Skipped (already exists)`);
                            skipCount++;
                            resolve();
                        } else {
                            reject(err);
                        }
                    } else {
                        console.log(`✅ [${i + 1}/${statements.length}] Executed successfully`);
                        successCount++;
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.error(`❌ [${i + 1}/${statements.length}] Error:`, error.message);
            errorCount++;
        }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
    if (errorCount === 0) {
        console.log('\n✨ Migration completed successfully!');
    } else {
        console.log('\n⚠️  Migration completed with errors. Please review the output above.');
        process.exit(1);
    }
}

// Run migration
runMigration()
    .then(() => {
        // Close database connection if needed
        if (db.close) {
            db.close();
        }
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    });















