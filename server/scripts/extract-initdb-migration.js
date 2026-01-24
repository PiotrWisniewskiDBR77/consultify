#!/usr/bin/env node
/**
 * Script to extract CREATE TABLE statements from PostgresDatabase.ts
 * and create a migration file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const postgresDbPath = path.join(__dirname, '..', 'src', 'database', 'PostgresDatabase.ts');
const migrationsDir = path.join(__dirname, '..', 'migrations');

async function extractMigration() {
  console.log('📖 Reading PostgresDatabase.ts...');
  const content = fs.readFileSync(postgresDbPath, 'utf8');
  
  // Extract all CREATE TABLE statements
  const createTableRegex = /await query\(`CREATE TABLE IF NOT EXISTS ([a-z_][a-z0-9_]*)\(([\s\S]*?)`\)/gi;
  const tables = [];
  
  let match;
  while ((match = createTableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const tableDefinition = match[2].trim();
    
    // Find the full CREATE TABLE statement including the closing backtick
    const startPos = match.index;
    const afterMatch = content.substring(startPos);
    const endMatch = afterMatch.match(/`\)/);
    
    if (endMatch) {
      const fullStatement = afterMatch.substring(0, endMatch.index + 2);
      // Extract just the SQL part
      const sqlMatch = fullStatement.match(/`([\s\S]*)`\)/);
      if (sqlMatch) {
        tables.push({
          name: tableName,
          sql: sqlMatch[1].trim()
        });
      }
    }
  }
  
  console.log(`Found ${tables.length} CREATE TABLE statements\n`);
  
  // Generate migration file
  const migrationNumber = '000';
  const migrationName = 'initdb_core_tables';
  const migrationFile = path.join(migrationsDir, `${migrationNumber}_${migrationName}.sql`);
  
  let migrationContent = `-- Migration: ${migrationNumber}_${migrationName}.sql
-- Purpose: Create core tables from PostgresDatabase.ts initDb() function
-- Generated: ${new Date().toISOString()}
-- 
-- This migration extracts all CREATE TABLE statements from PostgresDatabase.ts
-- to ensure they exist even if initDb() hasn't run or failed.
-- 
-- Note: These tables use CREATE TABLE IF NOT EXISTS, so this migration is idempotent.

`;

  // Add tables in dependency order (roughly)
  const orderedTables = [
    'organizations',
    'users',
    'settings',
    'sessions',
    'knowledge_docs',
    'knowledge_chunks',
    'llm_providers',
    'teams',
    'team_members',
    'project_users',
    'custom_statuses',
    'tasks',
    'task_comments',
    'notifications',
    'activity_logs',
    'ai_feedback',
    'custom_prompts',
    'webhooks',
    'ai_logs',
    'system_prompts',
    'feedback',
    'revoked_tokens',
    'invitations',
    'access_requests',
    'access_codes',
    'access_code_usage',
    'initiatives',
    'task_dependencies',
    'subscription_plans',
    'organization_billing',
    'usage_records',
    'usage_summaries',
    'invoices',
    'plan_features',
    'billing_margins',
    'token_packages',
    'user_token_balance',
    'token_transactions',
    'user_api_keys',
    'gdpr_requests',
    'user_consents',
    'ai_ideas',
    'ai_observations',
    'approval_assignments',
    'mfa_attempts',
    'trusted_devices',
    'refresh_tokens',
    'scheduled_emails'
  ];
  
  // Add tables in order, then any remaining ones
  const added = new Set();
  for (const tableName of orderedTables) {
    const table = tables.find(t => t.name === tableName);
    if (table) {
      migrationContent += `-- ${table.name}\n`;
      migrationContent += `CREATE TABLE IF NOT EXISTS ${table.name}(\n${table.sql}\n);\n\n`;
      added.add(tableName);
    }
  }
  
  // Add any remaining tables
  for (const table of tables) {
    if (!added.has(table.name)) {
      migrationContent += `-- ${table.name}\n`;
      migrationContent += `CREATE TABLE IF NOT EXISTS ${table.name}(\n${table.sql}\n);\n\n`;
    }
  }
  
  // Write migration file
  fs.writeFileSync(migrationFile, migrationContent);
  console.log(`✅ Created migration file: ${migrationFile}`);
  console.log(`   Contains ${tables.length} CREATE TABLE statements\n`);
  
  // List all tables
  console.log('Tables included:');
  tables.forEach(t => console.log(`  - ${t.name}`));
}

extractMigration().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
