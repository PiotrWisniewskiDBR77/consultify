#!/usr/bin/env tsx
/**
 * Migration Naming Convention Validator
 *
 * Enforces consistent naming:
 *   - Standard: NNN_descriptive_name.sql       (numeric prefix)
 *   - V8:       YYYYMMDD_v8_descriptive_name.sql (date prefix, v8 marker)
 *
 * Flags violations:
 *   - .sql.sql double extensions (legacy SQLite artifacts)
 *   - Missing numeric/date prefix
 *   - Space characters in filenames
 *   - Non-lowercase filenames
 *   - Duplicate numeric prefixes (collisions)
 *
 * Run: npx tsx server/scripts/validate-migration-naming.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

interface Violation {
  file: string;
  rule: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

const VALID_NUMERIC = /^\d{3}_[a-z0-9_]+\.sql$/;
const VALID_DATE_V8 = /^\d{8}_v8_[a-z0-9_]+\.sql$/;
const VALID_DATE_GENERIC = /^\d{8}_[a-z0-9_]+\.sql$/;
const VALID_JS_MIGRATION = /^\d{3}_[a-z0-9_]+\.js$/;

function validate(): Violation[] {
  const violations: Violation[] = [];
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => !f.startsWith('.'));
  const numericPrefixes = new Map<string, string[]>();

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) continue;

    if (file.includes(' ')) {
      violations.push({
        file,
        rule: 'no-spaces',
        severity: 'error',
        suggestion: `Rename to: ${file.replace(/ /g, '_')}`,
      });
    }

    if (file.endsWith('.sql.sql')) {
      violations.push({
        file,
        rule: 'no-double-extension',
        severity: 'warning',
        suggestion: `Legacy SQLite artifact — rename to ${file.replace('.sql.sql', '.sql')} or archive`,
      });
      continue;
    }

    if (file !== file.toLowerCase()) {
      violations.push({
        file,
        rule: 'lowercase-only',
        severity: 'warning',
        suggestion: `Rename to: ${file.toLowerCase()}`,
      });
    }

    if (file.endsWith('.sql') || file.endsWith('.js')) {
      const isValid =
        VALID_NUMERIC.test(file) ||
        VALID_DATE_V8.test(file) ||
        VALID_DATE_GENERIC.test(file) ||
        VALID_JS_MIGRATION.test(file);

      if (!isValid && file.endsWith('.sql')) {
        violations.push({
          file,
          rule: 'naming-convention',
          severity: 'error',
          suggestion: 'Must match NNN_name.sql or YYYYMMDD_name.sql',
        });
      }

      const numMatch = file.match(/^(\d{3})_/);
      if (numMatch) {
        const prefix = numMatch[1];
        if (!numericPrefixes.has(prefix)) numericPrefixes.set(prefix, []);
        numericPrefixes.get(prefix)!.push(file);
      }
    }

    if (file.endsWith('.json') && file !== 'v8-manifest.json') {
      violations.push({
        file,
        rule: 'unexpected-json',
        severity: 'warning',
        suggestion: 'JSON files in migrations/ may cause confusion — consider moving to config/',
      });
    }
  }

  for (const [prefix, names] of numericPrefixes) {
    if (names.length > 1) {
      violations.push({
        file: names.join(', '),
        rule: 'duplicate-prefix',
        severity: 'warning',
        suggestion: `Numeric prefix ${prefix} used ${names.length} times — risk of ordering ambiguity`,
      });
    }
  }

  return violations;
}

const violations = validate();

if (violations.length === 0) {
  console.log('All migration files follow naming conventions.');
  process.exit(0);
}

const errors = violations.filter(v => v.severity === 'error');
const warnings = violations.filter(v => v.severity === 'warning');

console.log(`\nMigration Naming Audit: ${errors.length} errors, ${warnings.length} warnings\n`);

for (const v of violations) {
  const icon = v.severity === 'error' ? 'ERROR' : 'WARN ';
  console.log(`  [${icon}] ${v.rule}: ${v.file}`);
  if (v.suggestion) console.log(`         -> ${v.suggestion}`);
}

console.log(`\nTotal: ${violations.length} issues in ${fs.readdirSync(MIGRATIONS_DIR).length} files\n`);
process.exit(errors.length > 0 ? 1 : 0);
