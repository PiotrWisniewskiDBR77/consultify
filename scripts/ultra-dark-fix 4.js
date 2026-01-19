#!/usr/bin/env node
/**
 * Ultra-Aggressive Dark Mode Fix - Final 1000 Violations
 *
 * Strategy: Fix ALL remaining dark mode patterns systematically
 */

import fs from 'fs';
import path from 'path';

const TARGET_DIR = 'src/';
const DRY_RUN = process.argv.includes('--dry-run');

// Comprehensive dark mode patterns
const ULTRA_PATTERNS = [
  // Pattern 1: bg-white alone (most common)
  {
    name: 'bg-white standalone',
    test: (line) => /\sbg-white(?!\s+dark:)/.test(line) && !/dark:bg-/.test(line),
    from: /(\s)(bg-white)(\s|")/g,
    to: '$1bg-white dark:bg-navy-900$3',
  },

  // Pattern 2: bg-slate-50 standalone
  {
    name: 'bg-slate-50 standalone',
    test: (line) => /\sbg-slate-50(?!\s+dark:)/.test(line) && !/dark:bg-/.test(line),
    from: /(\s)(bg-slate-50)(\s|")/g,
    to: '$1bg-slate-50 dark:bg-navy-800/30$3',
  },

  // Pattern 3: hover:bg-slate-50 without dark
  {
    name: 'hover:bg-slate-50',
    test: (line) => /hover:bg-slate-50/.test(line) && !/dark:hover:bg-/.test(line),
    from: /(hover:bg-slate-50)/g,
    to: '$1 dark:hover:bg-navy-800/20',
  },

  // Pattern 4: border-slate-200 without dark
  {
    name: 'border-slate-200',
    test: (line) => /border-slate-200/.test(line) && !/dark:border-/.test(line),
    from: /(border-slate-200)/g,
    to: '$1 dark:border-navy-700',
  },

  // Pattern 5: text-slate-600 without dark
  {
    name: 'text-slate-600',
    test: (line) => /text-slate-600/.test(line) && !/dark:text-/.test(line),
    from: /(text-slate-600)/g,
    to: '$1 dark:text-slate-400',
  },

  // Pattern 6: text-slate-700 without dark
  {
    name: 'text-slate-700',
    test: (line) => /text-slate-700/.test(line) && !/dark:text-/.test(line),
    from: /(text-slate-700)/g,
    to: '$1 dark:text-slate-300',
  },
];

class UltraReport {
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
    console.log('║   Ultra-Aggressive Dark Mode - Final Push       ║');
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
  const lines = content.split('\n');

  const newLines = lines.map((line) => {
    let modifiedLine = line;

    ULTRA_PATTERNS.forEach((pattern) => {
      if (!pattern.test(modifiedLine)) return;

      const matches = modifiedLine.match(pattern.from);
      if (matches && matches.length > 0) {
        modifiedLine = modifiedLine.replace(pattern.from, pattern.to);
        report.addFixes(pattern.name, matches.length);
      }
    });

    return modifiedLine;
  });

  content = newLines.join('\n');

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

console.log('🚀 Ultra-Aggressive Dark Mode Fix...\n');
const report = new UltraReport();
walkDir(TARGET_DIR, report);
report.print();
