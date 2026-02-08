#!/usr/bin/env node

/**
 * Pre-commit Secret Scanning
 * Checks staged files for potential secrets before commit
 *
 * Usage: node scripts/check-secrets.js <file1> <file2> ...
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// Common secret patterns (basic detection)
const SECRET_PATTERNS = [
  // API Keys
  /api[_-]?key\s*[=:]\s*['"]?[a-zA-Z0-9]{20,}['"]?/gi,
  /apikey\s*[=:]\s*['"]?[a-zA-Z0-9]{20,}['"]?/gi,

  // Passwords
  // Require quotes to avoid false positives from TypeScript annotations like `password: string): ...`
  /password\s*[=:]\s*['"][^'"]{8,}['"]/gi,
  /pwd\s*[=:]\s*['"][^'"]{8,}['"]/gi,

  // Tokens
  /token\s*[=:]\s*['"]?[a-zA-Z0-9]{20,}['"]?/gi,
  /secret\s*[=:]\s*['"]?[a-zA-Z0-9]{20,}['"]?/gi,

  // AWS
  /AKIA[0-9A-Z]{16}/gi,
  /aws[_-]?secret[_-]?access[_-]?key/gi,

  // Private Keys
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,

  // JWT Secrets (long strings)
  /jwt[_-]?secret\s*[=:]\s*['"]?[a-zA-Z0-9]{32,}['"]?/gi,
];

// Files that are allowed to contain secrets (config files, examples)
const ALLOWED_FILES = [
  /\.env\.example$/,
  /\.env\.local$/,
  /\.env\.template$/,
  /config\/.*\.example\./,
  /docs\/.*secret.*/i,
  /tests\/.*secret.*/i,
  /tests\/.*security.*/i,
  /tests\/.*\.test\.(ts|js|tsx|jsx)$/,
];

// Files to skip
const SKIP_FILES = [
  /node_modules/,
  /dist\//,
  /build\//,
  /coverage\//,
  /\.git\//,
  /package-lock\.json$/,
];

function isAllowed(file) {
  return ALLOWED_FILES.some((pattern) => pattern.test(file));
}

function shouldSkip(file) {
  return SKIP_FILES.some((pattern) => pattern.test(file));
}

function checkFile(filePath) {
  if (shouldSkip(filePath)) {
    return { found: false, file: filePath };
  }

  if (isAllowed(filePath)) {
    return { found: false, file: filePath, allowed: true };
  }

  try {
    const content = readFileSync(filePath, 'utf8');
    const matches = [];

    for (const pattern of SECRET_PATTERNS) {
      const found = content.match(pattern);
      if (found) {
        matches.push({
          pattern: pattern.toString(),
          matches: found.slice(0, 3), // Show first 3 matches
        });
      }
    }

    if (matches.length > 0) {
      return { found: true, file: filePath, matches };
    }

    return { found: false, file: filePath };
  } catch (error) {
    // File might not exist (deleted), skip
    return { found: false, file: filePath, error: error.message };
  }
}

// Main
const files = process.argv.slice(2);

if (files.length === 0) {
  // Get staged files from git
  try {
    const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);

    files.push(...stagedFiles);
  } catch (error) {
    console.error('Error getting staged files:', error.message);
    process.exit(0); // Don't block if git command fails
  }
}

if (files.length === 0) {
  process.exit(0);
}

const results = files.map(checkFile);
const secretsFound = results.filter((r) => r.found && !r.allowed);

if (secretsFound.length > 0) {
  console.error('\n❌ SECRET SCANNING FAILED\n');
  console.error('Potential secrets found in staged files:\n');

  secretsFound.forEach(({ file, matches }) => {
    console.error(`  ${file}:`);
    matches.forEach(({ pattern, matches: m }) => {
      console.error(`    Pattern: ${pattern}`);
      console.error(`    Found: ${m.length} potential secrets`);
    });
    console.error('');
  });

  console.error(
    '⚠️  If these are false positives, add file to ALLOWED_FILES in scripts/check-secrets.js'
  );
  console.error('⚠️  For real secrets, use environment variables or secret management\n');

  process.exit(1);
}

process.exit(0);
