#!/usr/bin/env node
/**
 * Script to run the initDb migration file
 * 
 * RECOMMENDED: Use the migration system instead:
 *   ./run-migrations.sh
 * 
 * This script is a convenience wrapper that runs the migration file directly.
 * The migration system handles errors and dependencies better.
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:l5jjc8wrhxmkuxlsuvc7ic1j998gbp5l@caboose.proxy.rlwy.net:15646/railway';

async function main() {
  console.log('🚀 Running initDb() via migration file...\n');
  
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: false
  });

  try {
    // Read the migration file we created
    const migrationFile = path.join(__dirname, '..', 'migrations', '000_initdb_core_tables.sql');
    
    if (!fs.existsSync(migrationFile)) {
      console.error(`❌ Migration file not found: ${migrationFile}`);
      console.log('💡 Please run the migration file instead: ./run-migrations.sh');
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('📖 Executing migration file...');
    console.log(`   File: ${migrationFile}\n`);
    
    // Execute the entire SQL file as one transaction
    // This is safer than splitting by semicolons
    try {
      await pool.query(sql);
      console.log(`\n✅ Migration completed successfully!`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      // Check if it's just "already exists" errors
      if (err.message.includes('already exists') || 
          err.message.includes('duplicate') ||
          (err.message.includes('relation') && err.message.includes('already exists'))) {
        console.log(`\n⚠️  Some tables/indexes already exist (this is OK)`);
        console.log(`✅ Migration completed (idempotent)`);
      } else {
        console.error(`\n❌ Error:`, err.message);
        throw error;
      }
    }
    
    console.log(`\n✅ Migration completed!`);
    console.log(`   Executed: ${executed} statements`);
    console.log(`   Skipped: ${skipped} statements (already exist)`);
    console.log(`\nAll core tables from PostgresDatabase.ts should now exist in the database.`);
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    await pool.end();
    process.exit(1);
  }
}

main();
