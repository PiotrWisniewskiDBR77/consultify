#!/usr/bin/env node
/**
 * Automated Dark Mode Fix Script
 * Fixes the most common dark mode violations in SuperAdmin
 */

import fs from 'fs';
import path from 'path';

const TARGET_DIR = 'src/views/superadmin';

// Pattern replacements - SAFE automated fixes
const SAFE_REPLACEMENTS = [
  // Hover states - very common pattern
  {
    from: /hover:bg-white\/10(?![\w-])/g,
    to: 'hover:bg-slate-100 dark:hover:bg-navy-800/40',
    description: 'Fix hover:bg-white/10',
  },
  {
    from: /hover:bg-white\/5(?![\w-])/g,
    to: 'hover:bg-slate-50 dark:hover:bg-navy-800/20',
    description: 'Fix hover:bg-white/5',
  },
  // Static backgrounds - need context check
  {
    from: /className="([^"]*?)bg-white\/10([^"]*?)"/g,
    to: (match, before, after) => {
      // Only if it doesn't already have dark:
      if (!match.includes('dark:')) {
        return `className="${before}bg-white/10 dark:bg-navy-900/30${after}"`;
      }
      return match;
    },
    description: 'Add dark mode to bg-white/10',
  },
  {
    from: /className="([^"]*?)bg-white\/5([^"]*?)"/g,
    to: (match, before, after) => {
      // Only if it doesn't already have dark:
      if (!match.includes('dark:')) {
        return `className="${before}bg-white/5 dark:bg-navy-900/20${after}"`;
      }
      return match;
    },
    description: 'Add dark mode to bg-white/5',
  },
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changes = 0;
  const original = content;

  SAFE_REPLACEMENTS.forEach(({ from, to, description }) => {
    if (typeof to === 'function') {
      const matches = content.match(from);
      if (matches) {
        content = content.replace(from, to);
        const newMatches = content.match(from);
        changes += (matches?.length || 0) - (newMatches?.length || 0);
      }
    } else {
      const matches = content.match(from);
      if (matches) {
        content = content.replace(from, to);
        changes += matches.length;
      }
    }
  });

  if (changes > 0) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ ${path.basename(filePath)}: ${changes} fixes`);
    return changes;
  }

  return 0;
}

function walkDir(dir) {
  let totalFixes = 0;
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      totalFixes += walkDir(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
      totalFixes += fixFile(filePath);
    }
  });

  return totalFixes;
}

console.log('🔧 Starting automated dark mode fixes...\n');
const total = walkDir(TARGET_DIR);
console.log(`\n✨ Total fixes applied: ${total}`);
console.log(
  '📊 Re-run audit to verify: node scripts/audit-ui-compliance.js src/views/superadmin/\n'
);
