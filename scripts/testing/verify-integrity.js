#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

let errors = [];
const projectRoot = process.cwd();

// 1. run-audit nie ma hardcoded 96
try {
  const runAuditPath = path.join(projectRoot, 'scripts/testing/run-audit.ts');
  if (fs.existsSync(runAuditPath)) {
    const runAudit = fs.readFileSync(runAuditPath, 'utf-8');
    if (runAudit.includes('~96%') || runAudit.includes('| ~96%')) {
      errors.push('run-audit.ts: hardcoded ~96% coverage found');
    }
  } else {
    errors.push('Could not find scripts/testing/run-audit.ts');
  }
} catch (e) {
  errors.push('Could not read scripts/testing/run-audit.ts: ' + e.message);
}

// 2. Brak duplikatów
try {
  const dupes = execSync(
    'find tests/ server/tests/ -type f \\( -name "* 2.*" -o -name "* 3.*" \\) 2>/dev/null || true',
    { encoding: 'utf-8' }
  ).trim();
  if (dupes) {
    errors.push('Duplicate files found: ' + dupes.split('\n').length);
  }
} catch (e) {
  // find might fail if dirs don't exist, but that's handled by || true
}

if (errors.length > 0) {
  console.error('❌ Integrity check failed:', errors);
  process.exit(1);
}
console.log('✅ Integrity check passed');
process.exit(0);
