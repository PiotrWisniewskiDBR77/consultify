#!/usr/bin/env node
/**
 * Quick fix script to create conversations tables
 * Run: node server/scripts/fix-conversations.js
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration - Support both DATABASE_URL and individual parameters
let config;

if (process.env.DATABASE_URL) {
  let connectionString = process.env.DATABASE_URL;
  
  // Fix user in connection string if it's 'railway'
  if (connectionString.includes('railway@') && !connectionString.includes('postgres@')) {
    connectionString = connectionString.replace(/railway@/g, 'postgres@');
    console.log('[Fix] Updated DATABASE_URL to use postgres user');
  }
  
  config = {
    connectionString: connectionString,
    ssl: false,
  };
} else {
  config = {
    host: process.env.DB_HOST || 'caboose.proxy.rlwy.net',
    port: parseInt(process.env.DB_PORT || '15646', 10),
    database: process.env.DB_NAME || 'railway',
    user: 'postgres',
    password: process.env.DB_PASSWORD || 'l5jjc8wrhxmkuxlsuvc7ic1j998gbp5l',
    ssl: false,
  };
}

const pool = new Pool(config);

async function fixConversations() {
  console.log('[Fix] Connecting to database...');
  const client = await pool.connect();

  try {
    // Read the SQL file
    const sqlFile = path.join(__dirname, '../migrations/fix_conversations_table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('[Fix] Executing SQL to create conversations tables...');
    
    // Execute the SQL
    await client.query(sql);
    
    console.log('[Fix] ✅ Conversations tables created successfully!');
    
    // Verify the table exists
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'conversations'
      );
    `);
    
    if (result.rows[0].exists) {
      console.log('[Fix] ✅ Verified: conversations table exists');
    } else {
      console.log('[Fix] ⚠️  Warning: conversations table not found after creation');
    }
    
  } catch (error) {
    console.error('[Fix] ❌ Error:', error.message);
    console.error('[Fix] Full error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixConversations().catch((error) => {
    console.error('[Fix] Fatal error:', error);
    process.exit(1);
  });
}

export default fixConversations;
