#!/usr/bin/env node
/**
 * Aggressive Dark Mode Fix - Final Push to 95%+
 *
 * Strategy: Add dark: variants to ALL common bg/hover patterns
 * that don't already have them.
 */

import fs from 'fs';
import path from 'path';

const TARGET_DIR = 'src/';
const DRY_RUN = process.argv.includes('--dry-run');

// Aggressive patterns - add dark variants everywhere
const PATTERNS = [
  //hover:bg-slate-50 → hover:bg-slate-50 dark:hover:bg-navy-800/20
  {
    name: 'hover:bg-slate-50',
    test: /hover:bg-slate-50(?!\s+dark:)/,
    from: /hover:bg-slate-50/g,
    to: 'hover:bg-slate-50 dark:hover:bg-navy-800/20',
  },

  // hover:bg-slate-100 → hover:bg-slate-100 dark:hover:bg-navy-800/30
  {
    name: 'hover:bg-slate-100',
    test: /hover:bg-slate-100(?!\s+dark:)/,
    from: /hover:bg-slate-100/g,
    to: 'hover:bg-slate-100 dark:hover:bg-navy-800/30',
  },

  // hover:bg-slate-200 → hover:bg-slate-200 dark:hover:bg-navy-700
  {
    name: 'hover:bg-slate-200',
    test: /hover:bg-slate-200(?!\s+dark:)/,
    from: /hover:bg-slate-200/g,
    to: 'hover:bg-slate-200 dark:hover:bg-navy-700',
  },

  // bg-slate-100 → bg-slate-100 dark:bg-navy-800/40
  {
    name: 'bg-slate-100 (static)',
    test: /(?<![:\w])bg-slate-100(?!\s+dark:)/,
    from: /(\s|^|")bg-slate-100(\s|$|")/g,
    to: '$1bg-slate-100 dark:bg-navy-800/40$2',
  },
];

class AggressiveReport {
  constructor() {
    this.filesScanned = 0;
    this.filesModified = 0;
    this.fixCounts = {};
    this.totalFixes = 0;
  }

  addFixes(name, count) {
    this.fixCounts[name] = (this.fixCounts[name] || 0) + count;
    this.totalFixes += count;
  }

  print() {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║     Aggressive Dark Mode Fix - Final Push       ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    console.log(`📊 Files Scanned:   ${this.filesScanned}`);
    console.log(`📝 Files Modified:  ${this.filesModified}`);
    console.log(`🌓 Total Fixes:     ${this.totalFixes}\n`);

    console.log('Breakdown:');
    Object.entries(this.fixCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => {
        console.log(`  ${name}: ${count}`);
      });

    console.log(DRY_RUN ? '\n🔍 DRY RUN\n' : '\n✅ Complete!\n');
  }
}

function processFile(filePath, report) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  PATTERNS.forEach((pattern) => {
    // Check if pattern exists and doesn't already have dark variant
    if (!pattern.test.test(content)) return;

    // Count occurrences
    const matches = content.match(pattern.from);
    if (!matches) return;

    // Apply fix
    content = content.replace(pattern.from, pattern.to);

    if (matches.length > 0) {
      report.addFixes(pattern.name, matches.length);
    }
  });

  if (content !== original) {
    report.filesModified++;
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, content, 'utf-8');
    }
  }

  report.filesScanned++;
}

function walkDir(dir, report) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!['node_modules', 'dist', 'build', '.git'].includes(file)) {
        walkDir(filePath, report);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
      processFile(filePath, report);
    }
  });
}

console.log('🚀 Aggressive Dark Mode Fix...\n');
const report = new AggressiveReport();
walkDir(TARGET_DIR, report);
report.print();
