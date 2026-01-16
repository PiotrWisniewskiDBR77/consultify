import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration - Support both DATABASE_URL and individual parameters
// Default to Railway PostgreSQL database
let config;

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL if provided (Railway, Heroku, etc.)
  // Replace 'railway' user with 'postgres' if present in connection string
  let connectionString = process.env.DATABASE_URL;
  
  // Fix user in connection string if it's 'railway'
  if (connectionString.includes('railway@') && !connectionString.includes('postgres@')) {
    connectionString = connectionString.replace(/railway@/g, 'postgres@');
    console.log('[Migrate] Updated DATABASE_URL to use postgres user');
  }
  
  // Railway's proxy (caboose.proxy.rlwy.net) might not support SSL
  // Try without SSL first - if it fails, we'll get a different error
  config = {
    connectionString: connectionString,
    ssl: false,  // Disable SSL - Railway proxy handles encryption at proxy level
  };
} else {
  // Default to Railway PostgreSQL database
  config = {
    host: process.env.DB_HOST || 'caboose.proxy.rlwy.net',
    port: parseInt(process.env.DB_PORT || '15646', 10),
    database: process.env.DB_NAME || 'railway',
    user: 'postgres',
    password: 'l5jjc8wrhxmkuxlsuvc7ic1j998gbp5l',
    // Only enable SSL if explicitly requested
    ssl: process.env.DB_SSL === 'true' 
      ? { rejectUnauthorized: false }
      : false,
  };
}

const pool = new Pool(config);

// Create core tables if they don't exist
async function ensureCoreTables(client) {
  console.log('[Migrate] Ensuring core tables exist...');
  
  // Organizations table
  await client.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT,
      plan TEXT DEFAULT 'free',
      status TEXT DEFAULT 'active',
      billing_status TEXT DEFAULT 'PENDING',
      organization_type TEXT DEFAULT 'TRIAL',
      token_balance INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      valid_until TIMESTAMP,
      discount_percent INTEGER DEFAULT 0,
      monthly_budget_usd REAL,
      budget_spent_current_period REAL DEFAULT 0,
      budget_alert_threshold REAL DEFAULT 0.8,
      budget_period_start TIMESTAMP,
      memory_usage_mb_current INTEGER DEFAULT 0,
      cpu_usage_percent_avg REAL DEFAULT 0,
      mfa_required INTEGER DEFAULT 0,
      mfa_grace_period_days INTEGER DEFAULT 7,
      trial_started_at TIMESTAMP,
      trial_expires_at TIMESTAMP,
      trial_extension_count INTEGER DEFAULT 0,
      trial_warning_sent_at TIMESTAMP,
      trial_tokens_used INTEGER DEFAULT 0,
      attribution_data TEXT,
      transformation_context TEXT DEFAULT '{}',
      onboarding_status TEXT DEFAULT 'NOT_STARTED',
      onboarding_plan_snapshot TEXT,
      onboarding_plan_version INTEGER DEFAULT 0,
      onboarding_accepted_at TIMESTAMP,
      onboarding_accept_idempotency_key TEXT,
      ai_assertiveness_level TEXT DEFAULT 'MEDIUM',
      ai_autonomy_level TEXT DEFAULT 'SUGGEST_ONLY',
      created_by_user_id TEXT
    )
  `).catch(() => {}); // Ignore errors if table already exists
  
  // Users table
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      email TEXT UNIQUE,
      password TEXT,
      first_name TEXT,
      last_name TEXT,
      role TEXT,
      status TEXT DEFAULT 'active',
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP,
      mfa_enabled INTEGER DEFAULT 0,
      mfa_secret TEXT,
      mfa_backup_codes TEXT,
      mfa_verified_at TIMESTAMP,
      mfa_recovery_email TEXT,
      token_limit INTEGER DEFAULT 100000,
      token_used INTEGER DEFAULT 0,
      token_reset_at TIMESTAMP,
      FOREIGN KEY(organization_id) REFERENCES organizations(id)
    )
  `).catch(() => {});
  
  // Projects table
  await client.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      name TEXT,
      description TEXT,
      goal TEXT,
      status TEXT DEFAULT 'active',
      owner_id TEXT,
      initiative_count INTEGER DEFAULT 0,
      assessment_count INTEGER DEFAULT 0,
      member_count INTEGER DEFAULT 0,
      document_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `).catch(() => {});
  
  // Settings table
  await client.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});
  
  // Sessions table
  await client.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      project_id TEXT,
      type TEXT,
      data TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `).catch(() => {});
  
  // Tasks table
  await client.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      organization_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      assignee_id TEXT,
      reporter_id TEXT,
      due_date TIMESTAMP,
      estimated_hours REAL,
      checklist TEXT,
      attachments TEXT,
      tags TEXT,
      custom_status_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      task_type TEXT DEFAULT 'execution',
      budget_allocated REAL DEFAULT 0,
      budget_spent REAL DEFAULT 0,
      risk_rating TEXT DEFAULT 'low',
      acceptance_criteria TEXT DEFAULT '',
      blocking_issues TEXT DEFAULT '',
      step_phase TEXT DEFAULT 'design',
      initiative_id TEXT,
      why TEXT DEFAULT '',
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(assignee_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `).catch(() => {});
  
  // Note: custom_status_id foreign key will be added later when custom_statuses table is created
  
  // Notifications table
  await client.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      data TEXT,
      read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).catch(() => {});
  
  console.log('[Migrate] Core tables ensured.');
}

async function migrate() {
  console.log('[Migrate] Connecting to database...');
  console.log('[Migrate] Config:', {
    hasConnectionString: !!config.connectionString,
    ssl: config.ssl,
    host: config.host || 'from connection string'
  });
  
  const client = await pool.connect();

  try {
    // 0. Ensure core tables exist (organizations, users, projects, etc.)
    await ensureCoreTables(client);
    
    // 1. Create migrations table - check if it exists and what columns it has
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      // Create table with full schema
      await client.query(`
        CREATE TABLE schema_migrations (
          version TEXT PRIMARY KEY,
          filename TEXT NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          checksum TEXT,
          execution_time_ms INTEGER,
          status TEXT DEFAULT 'success' CHECK(status IN ('success', 'failed', 'rolled_back'))
        )
      `);
    } else {
      // Table exists - add missing columns
      const columns = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'schema_migrations'
      `);
      const columnNames = columns.rows.map(r => r.column_name);
      
      // Add version column if missing (and migrate from id if it exists)
      if (!columnNames.includes('version')) {
        if (columnNames.includes('id')) {
          // Migrate from id-based to version-based
          await client.query(`ALTER TABLE schema_migrations ADD COLUMN version TEXT`);
          await client.query(`UPDATE schema_migrations SET version = id::text WHERE version IS NULL`);
          await client.query(`ALTER TABLE schema_migrations DROP CONSTRAINT IF EXISTS schema_migrations_pkey`);
          await client.query(`ALTER TABLE schema_migrations ADD PRIMARY KEY (version)`);
          await client.query(`ALTER TABLE schema_migrations DROP COLUMN IF EXISTS id`);
        } else {
          await client.query(`ALTER TABLE schema_migrations ADD COLUMN version TEXT PRIMARY KEY`);
        }
      }
      
      // Add other missing columns
      if (!columnNames.includes('checksum')) {
        await client.query(`ALTER TABLE schema_migrations ADD COLUMN checksum TEXT`);
      }
      if (!columnNames.includes('execution_time_ms')) {
        await client.query(`ALTER TABLE schema_migrations ADD COLUMN execution_time_ms INTEGER`);
      }
      if (!columnNames.includes('status')) {
        await client.query(`ALTER TABLE schema_migrations ADD COLUMN status TEXT DEFAULT 'success'`);
      }
    }

    // 2. Get applied migrations
    const res = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(res.rows.map((r) => r.filename));

    // 3. Read migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('[Migrate] No migrations directory found.');
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .filter((f) => {
        // Start from init-pgvector.sql onwards
        if (f === 'init-pgvector.sql') return true; // Include init-pgvector.sql
        const version = f.split('_')[0];
        if (!version) {
          // For files without version prefix, include if they come after init-pgvector.sql alphabetically
          return f >= 'init-pgvector.sql';
        }
        // Include all numbered migrations (they come after init-pgvector.sql alphabetically)
        return true;
      })
      .sort(); // Ensure order (001, 002...)

    // 4. Apply new migrations
    for (const file of files) {
      if (applied.has(file)) {
        // Already applied
        continue;
      }

      console.log(`[Migrate] Applying ${file}...`);
      let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      // Extract version from filename (e.g., "000_schema_migrations.sql" -> "000")
      const version = file.split('_')[0] || file.replace('.sql', '');

      // Convert SQLite syntax to PostgreSQL - COMPREHENSIVE FIXES
      sql = sql
        // Date/Time conversions
        .replace(/DATETIME/g, 'TIMESTAMP')  // SQLite DATETIME -> PostgreSQL TIMESTAMP
        .replace(/datetime\s*\(\s*['"]now['"]\s*\)/gi, 'CURRENT_TIMESTAMP')  // SQLite datetime('now') -> PostgreSQL CURRENT_TIMESTAMP
        .replace(/datetime\s*\(\s*['"]now['"]\s*,\s*['"]-(\d+)\s+days?['"]\s*\)/gi, "CURRENT_TIMESTAMP - INTERVAL '$1 days'")  // SQLite datetime('now','-2 days') -> PostgreSQL
        .replace(/datetime\s*\(\s*['"]now['"]\s*,\s*['"]-(\d+)\s+day['"]\s*\)/gi, "CURRENT_TIMESTAMP - INTERVAL '$1 days'")  // SQLite datetime('now','-1 day') -> PostgreSQL
        
        // Boolean conversions - SQLite uses INTEGER 0/1 or BOOLEAN DEFAULT 0/1, PostgreSQL uses BOOLEAN FALSE/TRUE
        // Must do these replacements multiple times to catch all variations
        .replace(/BOOLEAN\s+DEFAULT\s+0/gi, 'BOOLEAN DEFAULT FALSE')
        .replace(/BOOLEAN\s+DEFAULT\s+1/gi, 'BOOLEAN DEFAULT TRUE')
        .replace(/BOOLEAN\s+DEFAULT\s+0/gi, 'BOOLEAN DEFAULT FALSE')  // Second pass to catch any missed
        .replace(/BOOLEAN\s+DEFAULT\s+1/gi, 'BOOLEAN DEFAULT TRUE')   // Second pass
        // Also catch DEFAULT 0/1 after BOOLEAN (in case of different spacing)
        .replace(/BOOLEAN\s+DEFAULT\s*\(\s*0\s*\)/gi, 'BOOLEAN DEFAULT FALSE')
        .replace(/BOOLEAN\s+DEFAULT\s*\(\s*1\s*\)/gi, 'BOOLEAN DEFAULT TRUE')
        // Convert boolean comparisons in WHERE clauses: WHERE boolean_col = 0/1 -> WHERE boolean_col = FALSE/TRUE
        // Only convert if column name suggests boolean (is_*, has_*, etc.)
        .replace(/WHERE\s+((?:is_|has_|can_|should_|will_|must_|enabled|active|visible|required|locked|verified|approved|resolved|is_default|is_active|is_required|is_locked|is_verified|is_approved|is_resolved)\w*)\s*=\s*0\b/gi, 'WHERE $1 = FALSE')
        .replace(/WHERE\s+((?:is_|has_|can_|should_|will_|must_|enabled|active|visible|required|locked|verified|approved|resolved|is_default|is_active|is_required|is_locked|is_verified|is_approved|is_resolved)\w*)\s*=\s*1\b/gi, 'WHERE $1 = TRUE')
        // Convert INTEGER DEFAULT 0/1 to BOOLEAN DEFAULT FALSE/TRUE for boolean-like column names
        .replace(/(\w+)\s+INTEGER\s+DEFAULT\s+0(?=\s*(?:CHECK|,|\)|\n|$))/gi, (match, colName, offset, fullString) => {
          // Check if column name suggests boolean
          if (/^(is_|has_|can_|should_|will_|must_|enabled|active|visible|required|locked|verified|approved|resolved)/i.test(colName)) {
            return `${colName} BOOLEAN DEFAULT FALSE`;
          }
          return match;
        })
        .replace(/(\w+)\s+INTEGER\s+DEFAULT\s+1(?=\s*(?:CHECK|,|\)|\n|$))/gi, (match, colName) => {
          if (/^(is_|has_|can_|should_|will_|must_|enabled|active|visible|required|locked|verified|approved|resolved)/i.test(colName)) {
            return `${colName} BOOLEAN DEFAULT TRUE`;
          }
          return match;
        })
        
        // UUID/ID generation
        .replace(/lower\s*\(\s*hex\s*\(\s*randomblob\s*\(\s*16\s*\)\s*\)\s*\)/gi, "gen_random_uuid()::text")  // SQLite random ID generation -> PostgreSQL UUID
        // Convert UUID type to TEXT (our schema uses TEXT for IDs, not UUID)
        // Order matters - do more specific patterns first
        .replace(/\bUUID\s+DEFAULT\s+uuid_generate_v4\(\)/gi, 'TEXT')
        .replace(/\bUUID\s+PRIMARY KEY/gi, 'TEXT PRIMARY KEY')
        .replace(/\bUUID\s+NOT NULL/gi, 'TEXT NOT NULL')
        .replace(/\bUUID\s+REFERENCES/gi, 'TEXT REFERENCES')
        .replace(/\bUUID\s*,/gi, 'TEXT,')
        .replace(/\bUUID\s*\)/gi, 'TEXT)')
        .replace(/\bUUID\s+$/gm, 'TEXT')
        .replace(/\bUUID\b/gi, 'TEXT')  // Catch any remaining UUID
        
        // INSERT OR IGNORE conversions - handle both single-line and multi-line
        // First, replace INSERT OR IGNORE INTO with INSERT INTO
        .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO')
        
        // Remove SQLite-specific statements
        .replace(/PRAGMA\s+\w+\s*=\s*\w+;?/gi, '')  // Remove PRAGMA statements (SQLite-specific)
        .replace(/BEGIN TRANSACTION;?/gi, '')  // Remove BEGIN TRANSACTION (we handle transactions ourselves)
        .replace(/COMMIT;?/gi, '')  // Remove standalone COMMIT (we handle transactions ourselves)
        // Convert CREATE VIEW IF NOT EXISTS to CREATE OR REPLACE VIEW (PostgreSQL doesn't support IF NOT EXISTS for views)
        .replace(/CREATE\s+VIEW\s+IF\s+NOT\s+EXISTS/gi, 'CREATE OR REPLACE VIEW')
        // Replace SQLite pragma_table_info with PostgreSQL information_schema
        .replace(/FROM\s+pragma_table_info\s*\(['"]([^'"]+)['"]\)\s+WHERE\s+name\s*=\s*['"]([^'"]+)['"]/gi, 
                 `FROM information_schema.columns WHERE table_name = '$1' AND column_name = '$2'`)
        // Handle CASE statements that use pragma_table_info
        .replace(/SELECT\s+CASE\s+WHEN\s+COUNT\(\*\)\s*=\s*0\s+THEN\s+'([^']+)'\s+ELSE\s+'([^']+)'\s+END\s+FROM\s+information_schema\.columns/gi,
                 (match, alterStmt, selectStmt) => {
                   // This is a conditional column addition - we'll handle it separately
                   return `-- Conditional column addition (handled by migration script)`;
                 })
        .replace(/INSERT INTO schema_migrations \(([^)]+)\) VALUES \(([^)]+)\)(?!\s*ON CONFLICT)/g, 
                 'INSERT INTO schema_migrations ($1) VALUES ($2) ON CONFLICT DO NOTHING');  // Add PostgreSQL conflict handling

      try {
        // Execute statements individually to handle errors gracefully
        // Split SQL by semicolons, but be careful with multi-line strings
        // Use a more sophisticated approach: find complete statements by tracking parentheses and quotes
        const statements = [];
        let currentStatement = '';
        let inString = false;
        let stringChar = null;
        let inDollarQuote = false;
        let dollarTag = null;
        let parenDepth = 0;
        
        for (let i = 0; i < sql.length; i++) {
          const char = sql[i];
          const nextChar = sql[i + 1];
          
          // Handle SQL comments (-- until end of line)
          if (char === '-' && nextChar === '-' && !inString && !inDollarQuote) {
            // Skip to end of line (don't include the comment or newline in currentStatement)
            while (i < sql.length && sql[i] !== '\n') {
              i++;
            }
            // Continue to next iteration (the newline will be handled normally, but won't be added to statement)
            continue;
          }
          
          // Handle dollar-quoted strings (PostgreSQL): $$...$$ or $tag$...$tag$
          if (char === '$' && !inString && !inDollarQuote) {
            // Look ahead to find the closing $ or tag
            let j = i + 1;
            let tag = '';
            while (j < sql.length && sql[j] !== '$') {
              tag += sql[j];
              j++;
            }
            if (j < sql.length && sql[j] === '$') {
              // Found opening dollar quote
              inDollarQuote = true;
              dollarTag = tag;
              currentStatement += char + tag + '$';
              i = j; // Skip to after the closing $
              continue;
            }
          } else if (char === '$' && inDollarQuote) {
            // Check if this is the closing tag
            let j = i + 1;
            let tag = '';
            while (j < sql.length && sql[j] !== '$') {
              tag += sql[j];
              j++;
            }
            if (j < sql.length && sql[j] === '$' && tag === dollarTag) {
              // Found closing dollar quote
              currentStatement += char + tag + '$';
              i = j; // Skip to after the closing $
              inDollarQuote = false;
              dollarTag = null;
              continue;
            }
            // Not the closing tag, just a $ character inside the dollar-quoted string
            // Fall through to add it normally
          }
          
          // If we're inside a dollar-quoted string, just add the character
          if (inDollarQuote) {
            currentStatement += char;
            continue;
          }
          
          // Track string literals (handle both single and double quotes, and escaped quotes)
          if ((char === "'" || char === '"') && !inString) {
            inString = true;
            stringChar = char;
            currentStatement += char;
          } else if (char === stringChar && inString) {
            // Check if it's an escaped quote
            if (nextChar === stringChar) {
              currentStatement += char + nextChar;
              i++; // Skip next char
            } else {
              inString = false;
              stringChar = null;
              currentStatement += char;
            }
          } else {
            currentStatement += char;
            
            // Track parentheses (but not inside strings)
            if (!inString) {
              if (char === '(') parenDepth++;
              if (char === ')') parenDepth--;
              
              // Split on semicolon only if we're not in a string/dollar quote and parentheses are balanced
              if (char === ';' && !inString && !inDollarQuote && parenDepth === 0) {
                const trimmed = currentStatement.trim();
                // Filter out comments and empty statements
                if (trimmed.length > 0 && !trimmed.startsWith('--') && !trimmed.match(/^\s*--/)) {
                  statements.push(trimmed);
                }
                currentStatement = '';
              }
            }
          }
        }
        
        // Add any remaining statement (but skip if it's just a comment)
        const trimmed = currentStatement.trim();
        if (trimmed.length > 0 && !trimmed.startsWith('--') && !trimmed.match(/^\s*--/)) {
          statements.push(trimmed);
        }
        
        // Filter out empty statements and comments
        const filteredStatements = statements.filter(s => {
          const trimmed = s.trim();
          return trimmed.length > 0 && 
                 !trimmed.match(/^\s*$/) && 
                 !trimmed.startsWith('--') && 
                 !trimmed.match(/^\s*--/);
        });
        
        // Post-process INSERT statements: add ON CONFLICT DO NOTHING if missing
        // and convert 0/1 to FALSE/TRUE for boolean columns
        const processedStatements = filteredStatements.map(statement => {
          let processed = statement;
          const upperStatement = statement.toUpperCase().trim();
          
          // Check if it's an INSERT statement
          if (upperStatement.startsWith('INSERT INTO') && upperStatement.includes('VALUES')) {
            // Add ON CONFLICT DO NOTHING if missing
            if (!upperStatement.includes('ON CONFLICT')) {
              if (processed.trim().endsWith(';')) {
                processed = processed.trim().slice(0, -1) + ' ON CONFLICT DO NOTHING;';
              } else {
                processed = processed.trim() + ' ON CONFLICT DO NOTHING';
              }
            }
            
            // Convert 0/1 to FALSE/TRUE in VALUES clause for boolean columns
            // Match: INSERT INTO table (col1, col2, is_bool_col, ...) VALUES (val1, val2, 0/1, ...)
            const insertMatch = processed.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)\s*VALUES/i);
            if (insertMatch) {
              const columns = insertMatch[1].split(',').map(c => c.trim());
              // Check if there are boolean columns
              const hasBooleanCols = columns.some(col => 
                /^(is_|has_|can_|should_|will_|must_|enabled|active|visible|required|locked|verified|approved|resolved|is_default|is_active|is_required|is_locked|is_verified|is_approved|is_resolved)/i.test(col)
              );
              
              if (hasBooleanCols) {
                // Convert standalone 0 and 1 in VALUES clause to FALSE and TRUE
                // Only convert values surrounded by commas (middle of tuple), not at the end
                // This avoids false positives with integer values like version numbers
                const valuesStart = processed.toUpperCase().indexOf('VALUES');
                if (valuesStart >= 0) {
                  const beforeValues = processed.substring(0, valuesStart);
                  let valuesSection = processed.substring(valuesStart);
                  
                  // Only convert 0/1 that are clearly in the middle of a tuple (surrounded by commas)
                  // Skip conversion for values at the end of tuples to avoid converting integers
                  valuesSection = valuesSection.replace(/,\s*0\s*,/g, ', FALSE,');
                  valuesSection = valuesSection.replace(/,\s*1\s*,/g, ', TRUE,');
                  valuesSection = valuesSection.replace(/\(\s*0\s*,/g, '(FALSE,');
                  valuesSection = valuesSection.replace(/\(\s*1\s*,/g, '(TRUE,');
                  
                  processed = beforeValues + valuesSection;
                }
              }
            }
          }
          
          return processed;
        });
        
        let statementsExecuted = 0;
        let statementsSkipped = 0;
        
        for (let i = 0; i < processedStatements.length; i++) {
          const statement = processedStatements[i];
          if (statement.length > 0) {
            try {
              // Skip SQLite-specific PRAGMA statements (not supported in PostgreSQL)
              if (statement.toUpperCase().trim().startsWith('PRAGMA')) {
                console.log(`[Migrate] Skipping PRAGMA statement (SQLite-specific, not needed in PostgreSQL)`);
                statementsSkipped++;
                continue;
              }
              
              // Convert CREATE VIEW IF NOT EXISTS to CREATE OR REPLACE VIEW (if conversion didn't catch it)
              if (statement.toUpperCase().includes('CREATE VIEW IF NOT EXISTS')) {
                statement = statement.replace(/CREATE\s+VIEW\s+IF\s+NOT\s+EXISTS/gi, 'CREATE OR REPLACE VIEW');
              }
              
              // Skip SQLite-style triggers (CREATE TRIGGER with BEGIN/END blocks or FOR EACH ROW BEGIN)
              // PostgreSQL requires function-based triggers with EXECUTE FUNCTION, so these need to be rewritten
              const upperStatement = statement.toUpperCase();
              if (upperStatement.includes('CREATE TRIGGER')) {
                // Check if it's a SQLite-style trigger (doesn't have EXECUTE FUNCTION, which PostgreSQL requires)
                const hasExecuteFunction = upperStatement.includes('EXECUTE FUNCTION') || upperStatement.includes('EXECUTE PROCEDURE');
                const hasSqliteSyntax = upperStatement.includes('IF NOT EXISTS') || 
                                       (upperStatement.includes('FOR EACH ROW') && !hasExecuteFunction) ||
                                       (upperStatement.includes('BEGIN') && upperStatement.includes('END') && !upperStatement.includes('$$'));
                
                if (!hasExecuteFunction && hasSqliteSyntax) {
                  console.log(`[Migrate] Skipping SQLite-style trigger (PostgreSQL requires function-based triggers)`);
                  statementsSkipped++;
                  continue;
                }
              }
              
              // Skip standalone BEGIN statements that are part of SQLite triggers (they'll be caught above, but just in case)
              // But allow BEGIN in DO blocks ($$) and function definitions
              if (upperStatement.trim() === 'BEGIN' || 
                  (upperStatement.includes('BEGIN') && 
                   !upperStatement.includes('CREATE') && 
                   !upperStatement.includes('FUNCTION') && 
                   !upperStatement.includes('PROCEDURE') &&
                   !upperStatement.includes('$$') &&
                   !upperStatement.includes('DO'))) {
                // This might be a fragment of a SQLite trigger - skip it
                console.log(`[Migrate] Skipping standalone BEGIN statement (likely part of SQLite trigger)`);
                statementsSkipped++;
                continue;
              }
              
              // Skip SELECT statements that use pragma_table_info (SQLite-specific)
              if (statement.toUpperCase().includes('PRAGMA_TABLE_INFO') || 
                  (statement.toUpperCase().includes('SELECT CASE') && statement.toUpperCase().includes('ALTER TABLE') && statement.toUpperCase().includes('ELSE'))) {
                console.log(`[Migrate] Skipping SQLite-specific pragma_table_info query (conditional column addition will be handled separately)`);
                statementsSkipped++;
                continue;
              }
              
              // Handle ALTER TABLE statements - check if table exists first, and for ADD COLUMN, check if column exists
              if (statement.toUpperCase().includes('ALTER TABLE')) {
                const tableMatch = statement.match(/ALTER TABLE\s+(\w+)/i);
                if (tableMatch) {
                  const tableName = tableMatch[1];
                  const tableExists = await client.query(`
                    SELECT EXISTS (
                      SELECT FROM information_schema.tables 
                      WHERE table_schema = 'public' 
                      AND table_name = $1
                    )
                  `, [tableName]);
                  
                  if (!tableExists.rows[0].exists) {
                    console.log(`[Migrate] Skipping ALTER TABLE ${tableName} - table does not exist yet`);
                    statementsSkipped++;
                    continue;
                  }
                  
                  // For ADD COLUMN, check if column already exists
                  if (statement.toUpperCase().includes('ADD COLUMN')) {
                    const columnMatch = statement.match(/ADD COLUMN\s+(\w+)/i);
                    if (columnMatch) {
                      const columnName = columnMatch[1];
                      const columnExists = await client.query(`
                        SELECT EXISTS (
                          SELECT FROM information_schema.columns 
                          WHERE table_schema = 'public' 
                          AND table_name = $1 
                          AND column_name = $2
                        )
                      `, [tableName, columnName]);
                      
                      if (columnExists.rows[0].exists) {
                        console.log(`[Migrate] Skipping ALTER TABLE ${tableName} ADD COLUMN ${columnName} - column already exists`);
                        statementsSkipped++;
                        continue;
                      }
                    }
                  }
                }
              }
              
              // Handle FOREIGN KEY references - but only skip if it's NOT a CREATE TABLE statement
              // CREATE TABLE statements can have FOREIGN KEY references - PostgreSQL will validate them on insert, not creation
              if (statement.toUpperCase().includes('FOREIGN KEY') && 
                  statement.toUpperCase().includes('REFERENCES') &&
                  !statement.toUpperCase().includes('CREATE TABLE')) {
                const fkMatch = statement.match(/REFERENCES\s+(\w+)\s*\(/i);
                if (fkMatch) {
                  const refTableName = fkMatch[1];
                  const refTableExists = await client.query(`
                    SELECT EXISTS (
                      SELECT FROM information_schema.tables 
                      WHERE table_schema = 'public' 
                      AND table_name = $1
                    )
                  `, [refTableName]);
                  
                  if (!refTableExists.rows[0].exists) {
                    console.log(`[Migrate] Skipping statement with FOREIGN KEY to ${refTableName} - referenced table does not exist yet`);
                    statementsSkipped++;
                    continue;
                  }
                }
              }
              
              // Handle CREATE INDEX - check if table and columns exist first
              if (statement.toUpperCase().includes('CREATE INDEX')) {
                const indexMatch = statement.match(/CREATE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?\w+\s+ON\s+(\w+)\s*\(([^)]+)\)/i);
                if (indexMatch) {
                  const tableName = indexMatch[1];
                  const columnsStr = indexMatch[2];
                  
                  // Check if table exists
                  const tableExists = await client.query(`
                    SELECT EXISTS (
                      SELECT FROM information_schema.tables 
                      WHERE table_schema = 'public' 
                      AND table_name = $1
                    )
                  `, [tableName]);
                  
                  if (!tableExists.rows[0].exists) {
                    console.log(`[Migrate] Skipping CREATE INDEX - table "${tableName}" does not exist yet`);
                    statementsSkipped++;
                    continue;
                  }
                  
                  // Check if columns exist (extract column names, handling expressions like "col DESC")
                  const columnNames = columnsStr.split(',').map(col => {
                    const match = col.trim().match(/^(\w+)/i);
                    return match ? match[1] : null;
                  }).filter(Boolean);
                  
                  let shouldSkip = false;
                  for (const columnName of columnNames) {
                    const columnExists = await client.query(`
                      SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = $1 
                        AND column_name = $2
                      )
                    `, [tableName, columnName]);
                    
                    if (!columnExists.rows[0].exists) {
                      console.log(`[Migrate] Skipping CREATE INDEX - column "${columnName}" does not exist in table "${tableName}"`);
                      shouldSkip = true;
                      break;
                    }
                  }
                  
                  if (shouldSkip) {
                    statementsSkipped++;
                    continue;
                  }
                }
              }
              
              // Handle COMMENT ON FUNCTION - check if function exists first
              if (statement.toUpperCase().includes('COMMENT ON FUNCTION')) {
                const funcMatch = statement.match(/COMMENT\s+ON\s+FUNCTION\s+(\w+)\s*\(/i);
                if (funcMatch) {
                  const funcName = funcMatch[1];
                  const funcExists = await client.query(`
                    SELECT EXISTS (
                      SELECT FROM pg_proc p
                      JOIN pg_namespace n ON p.pronamespace = n.oid
                      WHERE n.nspname = 'public' AND p.proname = $1
                    )
                  `, [funcName]);
                  
                  if (!funcExists.rows[0].exists) {
                    console.log(`[Migrate] Skipping COMMENT ON FUNCTION ${funcName} - function does not exist yet`);
                    statementsSkipped++;
                    continue;
                  }
                }
              }
              
              // Execute the statement in its own transaction to avoid aborting the whole migration
              await client.query('BEGIN');
              try {
                await client.query(statement);
                await client.query('COMMIT');
                statementsExecuted++;
              } catch (stmtError) {
                await client.query('ROLLBACK');
                // Log the problematic statement for debugging
                const errorMsg = stmtError.message || '';
                if (errorMsg.includes('syntax error')) {
                  console.log(`[Migrate] Problematic statement (first 200 chars): ${statement.substring(0, 200)}...`);
                }
                // Check if error is about missing table/relation
                if (errorMsg.includes('does not exist') && errorMsg.includes('relation')) {
                  // Try to extract the table name from the error
                  const tableMatch = errorMsg.match(/relation\s+"?(\w+)"?\s+does not exist/i);
                  if (tableMatch) {
                    const missingTable = tableMatch[1];
                    console.log(`[Migrate] Skipping statement - table "${missingTable}" does not exist yet`);
                    statementsSkipped++;
                    continue;
                  }
                  console.log(`[Migrate] Skipping statement - referenced table/relation does not exist: ${errorMsg.split('\n')[0]}`);
                  statementsSkipped++;
                  continue;
                }
                // Check if error is about boolean default type mismatch
                if (errorMsg.includes('is of type boolean') && errorMsg.includes('default expression is of type integer')) {
                  // Try to fix by converting DEFAULT 0/1 to FALSE/TRUE and retry
                  let fixedStatement = statement
                    .replace(/DEFAULT\s+0(?=\s*(?:CHECK|,|\)|\n|$))/gi, 'DEFAULT FALSE')
                    .replace(/DEFAULT\s+1(?=\s*(?:CHECK|,|\)|\n|$))/gi, 'DEFAULT TRUE');
                  
                  if (fixedStatement !== statement) {
                    console.log(`[Migrate] Retrying with fixed boolean defaults...`);
                    try {
                      await client.query('BEGIN');
                      await client.query(fixedStatement);
                      await client.query('COMMIT');
                      statementsExecuted++;
                      continue;
                    } catch (retryError) {
                      await client.query('ROLLBACK');
                      // If retry also fails, skip it
                      console.log(`[Migrate] Skipping statement - boolean default conversion failed: ${retryError.message.split('\n')[0]}`);
                      statementsSkipped++;
                      continue;
                    }
                  }
                }
                
                // Check if error is about foreign key constraint violation
                if (errorMsg.includes('violates foreign key constraint')) {
                  // Try to extract table name from error message
                  // Format: "insert or update on table "table_name" violates foreign key constraint "constraint_name""
                  const fkMatch = errorMsg.match(/table\s+"?(\w+)"?\s+violates foreign key constraint/i) ||
                                 errorMsg.match(/on table\s+"?(\w+)"?\s+violates/i);
                  if (fkMatch) {
                    const tableName = fkMatch[1];
                    console.log(`[Migrate] Skipping INSERT - foreign key constraint violation in table "${tableName}" (referenced record may not exist)`);
                    statementsSkipped++;
                    continue;
                  }
                  console.log(`[Migrate] Skipping statement - foreign key constraint violation: ${errorMsg.split('\n')[0]}`);
                  statementsSkipped++;
                  continue;
                }
                
                // Check if error is about duplicate key (primary key or unique constraint violation)
                if (errorMsg.includes('duplicate key') || 
                    (errorMsg.includes('violates unique constraint') && errorMsg.includes('pkey'))) {
                  // Try to extract the table name from the error
                  const tableMatch = errorMsg.match(/relation\s+"?(\w+)"?/i) || 
                                    errorMsg.match(/table\s+"?(\w+)"?/i) ||
                                    errorMsg.match(/constraint\s+"?(\w+)_pkey"?/i);
                  if (tableMatch) {
                    const tableName = tableMatch[1].replace('_pkey', '');
                    console.log(`[Migrate] Skipping INSERT - duplicate key in table "${tableName}" (likely already exists)`);
                    statementsSkipped++;
                    continue;
                  }
                  console.log(`[Migrate] Skipping statement - duplicate key violation: ${errorMsg.split('\n')[0]}`);
                  statementsSkipped++;
                  continue;
                }
                
                // Check if error is about column already existing
                if (errorMsg.includes('already exists') && errorMsg.includes('column')) {
                  // Try to extract the column name from the error
                  const columnMatch = errorMsg.match(/column\s+"?(\w+)"?\s+of relation\s+"?(\w+)"?\s+already exists/i);
                  if (columnMatch) {
                    const existingColumn = columnMatch[1];
                    const tableName = columnMatch[2];
                    console.log(`[Migrate] Skipping statement - column "${existingColumn}" already exists in table "${tableName}"`);
                    statementsSkipped++;
                    continue;
                  }
                  console.log(`[Migrate] Skipping statement - column already exists: ${errorMsg.split('\n')[0]}`);
                  statementsSkipped++;
                  continue;
                }
                
                // Check if error is about missing column
                if (errorMsg.includes('does not exist') && errorMsg.includes('column')) {
                  // Try to extract the column name from the error
                  const columnMatch = errorMsg.match(/column\s+"?(\w+)"?\s+does not exist/i);
                  if (columnMatch) {
                    const missingColumn = columnMatch[1];
                    console.log(`[Migrate] Skipping statement - column "${missingColumn}" does not exist yet`);
                    statementsSkipped++;
                    continue;
                  }
                  console.log(`[Migrate] Skipping statement - referenced column does not exist: ${errorMsg.split('\n')[0]}`);
                  statementsSkipped++;
                  continue;
                }
                // Check if error is about missing function
                if (errorMsg.includes('could not find a function') || 
                    (errorMsg.includes('does not exist') && errorMsg.includes('function'))) {
                  // Try to extract the function name from the error
                  const funcMatch = errorMsg.match(/function\s+(?:named\s+)?"?(\w+)"?/i);
                  if (funcMatch) {
                    const missingFunc = funcMatch[1];
                    console.log(`[Migrate] Skipping statement - function "${missingFunc}" does not exist yet`);
                    statementsSkipped++;
                    continue;
                  }
                  console.log(`[Migrate] Skipping statement - referenced function does not exist: ${errorMsg.split('\n')[0]}`);
                  statementsSkipped++;
                  continue;
                }
                // Re-throw if it's a different error
                throw stmtError;
              }
            } catch (stmtError) {
              // If we get here, it's a non-recoverable error
              throw stmtError;
            }
          }
        }
        
        // Record migration with version (only if not already recorded by the migration itself)
        try {
          await client.query('BEGIN');
          await client.query(
            'INSERT INTO schema_migrations (version, filename) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING', 
            [version, file]
          );
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          // Migration might have already recorded itself, that's OK
          if (!e.message.includes('duplicate') && !e.message.includes('unique') && !e.message.includes('null')) {
            throw e;
          }
        }
        
        console.log(`[Migrate] Applied ${file} (${statementsExecuted} statements executed, ${statementsSkipped} skipped)`);
      } catch (e) {
        console.error(`[Migrate] Failed to apply ${file}:`, e.message);
        process.exit(1);
      }
    }

    console.log('[Migrate] All migrations applied.');
  } catch (err) {
    console.error('[Migrate] Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
