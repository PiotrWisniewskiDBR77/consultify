#!/usr/bin/env tsx

/**
 * Database & Auth Auto-Test
 * Comprehensive verification and auto-fix script
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlite3 = require('sqlite3').verbose();

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function error(message: string) {
  log(`❌ ${message}`, colors.red);
}

function warning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function header(message: string) {
  log(`\n${'='.repeat(60)}`, colors.blue);
  log(`  ${message}`, colors.blue);
  log(`${'='.repeat(60)}`, colors.blue);
}

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  autoFixed?: boolean;
}

const results: TestResult[] = [];

function addResult(name: string, passed: boolean, message: string, autoFixed = false) {
  results.push({ name, passed, message, autoFixed });
  if (passed) {
    success(`${name}: ${message}`);
  } else {
    error(`${name}: ${message}`);
  }
  if (autoFixed) {
    info(`  → Auto-fixed!`);
  }
}

// Database path
const dbPath = process.env.SQLITE_PATH || path.resolve(__dirname, '../consultinity.db');

async function runQuery(db: any, sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: any) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function runExec(db: any, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function testDatabaseExists(db: any): Promise<boolean> {
  header('TEST 1: Database File');

  try {
    const fs = await import('fs');
    const exists = fs.existsSync(dbPath);

    if (exists) {
      const stats = fs.statSync(dbPath);
      addResult(
        'Database File',
        true,
        `Found at ${dbPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`
      );
      return true;
    } else {
      addResult('Database File', false, `Not found at ${dbPath}`);
      return false;
    }
  } catch (err) {
    addResult('Database File', false, `Error: ${err}`);
    return false;
  }
}

async function testCriticalTables(db: any): Promise<boolean> {
  header('TEST 2: Critical Tables');

  const criticalTables = [
    'users',
    'organizations',
    'sessions',
    'projects',
    'refresh_tokens',
    'mfa_settings',
    'api_keys',
  ];

  let allExist = true;

  for (const table of criticalTables) {
    try {
      const result = await runQuery(
        db,
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [table]
      );

      if (result.length > 0) {
        // Count rows
        const count = await runQuery(db, `SELECT COUNT(*) as count FROM ${table}`, []);
        addResult(`Table: ${table}`, true, `Exists (${count[0].count} rows)`);
      } else {
        addResult(`Table: ${table}`, false, 'Missing');
        allExist = false;
      }
    } catch (err) {
      addResult(`Table: ${table}`, false, `Error: ${err}`);
      allExist = false;
    }
  }

  return allExist;
}

async function testUsers(db: any): Promise<boolean> {
  header('TEST 3: User Accounts');

  try {
    const users = await runQuery(
      db,
      `SELECT id, email, role, status, organization_id FROM users LIMIT 10`,
      []
    );

    if (users.length === 0) {
      addResult('Users', false, 'No users found in database');
      return false;
    }

    addResult('Users', true, `Found ${users.length} users`);

    // Check for admin user
    const admins = users.filter((u: any) => u.role === 'SUPERADMIN' || u.role === 'ADMIN');
    if (admins.length > 0) {
      success(`  → Found ${admins.length} admin user(s):`);
      admins.forEach((admin: any) => {
        info(`    - ${admin.email} (${admin.role})`);
      });
    } else {
      warning('  → No admin users found');
    }

    return true;
  } catch (err) {
    addResult('Users', false, `Error: ${err}`);
    return false;
  }
}

async function testDefaultUser(db: any): Promise<boolean> {
  header('TEST 4: Default Test User');

  const testEmail = 'admin@dbr77.com';
  const testPassword = '123456';

  try {
    const user = await runQuery(db, `SELECT * FROM users WHERE email = ?`, [testEmail]);

    if (user.length === 0) {
      // Create default user
      warning(`Default user ${testEmail} not found. Creating...`);

      // Check if organization exists
      let org = await runQuery(db, `SELECT * FROM organizations WHERE id = 'default-org'`, []);

      if (org.length === 0) {
        // Create default organization
        await runExec(
          db,
          `INSERT INTO organizations (id, name, plan, status) 
                     VALUES ('default-org', 'Default Organization', 'enterprise', 'active')`
        );
        info('  → Created default organization');
      }

      // Create user
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      const userId = 'default-admin-user';

      await runExec(
        db,
        `INSERT INTO users (id, email, password, first_name, last_name, role, status, organization_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );

      // Use runQuery with INSERT to avoid parameter issues
      await runQuery(
        db,
        `INSERT INTO users (id, email, password, first_name, last_name, role, status, organization_id)
                 VALUES ('${userId}', '${testEmail}', '${hashedPassword}', 'Admin', 'User', 'SUPERADMIN', 'active', 'default-org')`,
        []
      );

      addResult('Default User', true, `Created ${testEmail} with password: ${testPassword}`, true);
      return true;
    } else {
      // Verify password
      const isValid = await bcrypt.compare(testPassword, user[0].password);

      if (isValid) {
        addResult('Default User', true, `${testEmail} exists with correct password`);
        return true;
      } else {
        // Reset password
        warning(`Password incorrect. Resetting...`);
        const hashedPassword = await bcrypt.hash(testPassword, 10);

        await runQuery(
          db,
          `UPDATE users SET password = '${hashedPassword}' WHERE email = '${testEmail}'`,
          []
        );

        addResult('Default User', true, `Password reset to: ${testPassword}`, true);
        return true;
      }
    }
  } catch (err) {
    addResult('Default User', false, `Error: ${err}`);
    return false;
  }
}

async function testMFASettings(db: any): Promise<boolean> {
  header('TEST 5: MFA Settings');

  try {
    // Check if mfa_settings table exists
    const tableExists = await runQuery(
      db,
      `SELECT name FROM sqlite_master WHERE type='table' AND name='mfa_settings'`,
      []
    );

    if (tableExists.length === 0) {
      // Create mfa_settings table
      warning('mfa_settings table missing. Creating...');

      await runExec(
        db,
        `CREATE TABLE IF NOT EXISTS mfa_settings (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL UNIQUE,
                    enabled INTEGER DEFAULT 0,
                    method TEXT DEFAULT 'totp',
                    secret TEXT,
                    backup_codes TEXT,
                    phone_number TEXT,
                    verified INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )`
      );

      addResult('MFA Settings Table', true, 'Created', true);
      return true;
    } else {
      const count = await runQuery(db, `SELECT COUNT(*) as count FROM mfa_settings`, []);
      addResult('MFA Settings Table', true, `Exists (${count[0].count} entries)`);
      return true;
    }
  } catch (err) {
    addResult('MFA Settings', false, `Error: ${err}`);
    return false;
  }
}

async function testSessions(db: any): Promise<boolean> {
  header('TEST 6: Sessions');

  try {
    const sessions = await runQuery(db, `SELECT COUNT(*) as count FROM sessions`, []);

    addResult('Sessions', true, `${sessions[0].count} active sessions`);

    // Clean old sessions (optional)
    const oldSessions = await runQuery(
      db,
      `SELECT COUNT(*) as count FROM sessions 
             WHERE updated_at < datetime('now', '-7 days')`,
      []
    );

    if (oldSessions[0].count > 0) {
      warning(`  → Found ${oldSessions[0].count} old sessions (>7 days)`);
      info("    Run: DELETE FROM sessions WHERE updated_at < datetime('now', '-7 days')");
    }

    return true;
  } catch (err) {
    addResult('Sessions', false, `Error: ${err}`);
    return false;
  }
}

async function testDatabaseIntegrity(db: any): Promise<boolean> {
  header('TEST 7: Database Integrity');

  try {
    const result = await runQuery(db, `PRAGMA integrity_check`, []);

    if (result[0].integrity_check === 'ok') {
      addResult('Database Integrity', true, 'OK');
      return true;
    } else {
      addResult('Database Integrity', false, result[0].integrity_check);
      return false;
    }
  } catch (err) {
    addResult('Database Integrity', false, `Error: ${err}`);
    return false;
  }
}

async function printSummary() {
  header('TEST SUMMARY');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => r.passed === false).length;
  const autoFixed = results.filter((r) => r.autoFixed).length;

  console.log('');
  log(`Total Tests: ${results.length}`, colors.blue);
  success(`Passed: ${passed}`);
  if (failed > 0) {
    error(`Failed: ${failed}`);
  }
  if (autoFixed > 0) {
    info(`Auto-Fixed: ${autoFixed}`);
  }

  console.log('');

  if (failed === 0) {
    header('✅ ALL TESTS PASSED!');
    console.log('');
    success('Database is healthy and ready to use!');
    success('You can now login with:');
    info('  Email: admin@dbr77.com');
    info('  Password: 123456');
    console.log('');
  } else {
    header('❌ SOME TESTS FAILED');
    console.log('');
    error('Please review the errors above and fix manually.');
    console.log('');
  }
}

async function main() {
  console.clear();
  header('DATABASE & AUTH AUTO-TEST');
  info(`Database: ${dbPath}`);
  info(`Time: ${new Date().toISOString()}`);

  const db = new sqlite3.Database(dbPath, (err: Error | null) => {
    if (err) {
      error(`Failed to open database: ${err.message}`);
      process.exit(1);
    }
  });

  try {
    await testDatabaseExists(db);
    await testCriticalTables(db);
    await testUsers(db);
    await testDefaultUser(db);
    await testMFASettings(db);
    await testSessions(db);
    await testDatabaseIntegrity(db);

    await printSummary();
  } catch (err) {
    error(`Fatal error: ${err}`);
    process.exit(1);
  } finally {
    db.close();
  }
}

main().catch(console.error);
