#!/usr/bin/env node
/**
 * Remaining Dark Mode Patterns - Wave 2
 *
 * Targeting specific remaining patterns identified in audit
 */

import fs from 'fs';
import path from 'path';

const TARGET_DIR = 'src/';
const DRY_RUN = process.argv.includes('--dry-run');

const WAVE2_PATTERNS = [
  // Specific problematic patterns from audit
  {
    name: 'bg-slate-50 in className (edge cases)',
    test: (line) =>
      /className=.*bg-slate-50/.test(line) &&
      !/dark:bg-/.test(line) &&
      !/dark:hover:bg-/.test(line),
    apply: (line) => {
      // Only if line has bg-slate-50 but no dark variant at all
      if (!/dark:/.test(line)) {
        return line.replace(/bg-slate-50/g, 'bg-slate-50 dark:bg-navy-800/30');
      }
      return line;
    },
  },

  // Text colors without dark variants
  {
    name: 'text-slate-500',
    test: (line) => /text-slate-500/.test(line) && !/dark:text-/.test(line),
    apply: (line) => line.replace(/text-slate-500/g, 'text-slate-500 dark:text-slate-400'),
  },

  {
    name: 'text-slate-800',
    test: (line) => /text-slate-800/.test(line) && !/dark:text-/.test(line),
    apply: (line) => line.replace(/text-slate-800/g, 'text-slate-800 dark:text-slate-200'),
  },

  {
    name: 'text-slate-900',
    test: (line) => /text-slate-900/.test(line) && !/dark:text-/.test(line),
    apply: (line) => line.replace(/text-slate-900/g, 'text-slate-900 dark:text-white'),
  },

  // Border colors
  {
    name: 'border-slate-300',
    test: (line) => /border-slate-300/.test(line) && !/dark:border-/.test(line),
    apply: (line) => line.replace(/border-slate-300/g, 'border-slate-300 dark:border-navy-700'),
  },

  // Gray variants (legacy)
  {
    name: 'bg-gray-50',
    test: (line) => /bg-gray-50/.test(line) && !/dark:bg-/.test(line),
    apply: (line) => line.replace(/bg-gray-50/g, 'bg-gray-50 dark:bg-navy-800'),
  },

  {
    name: 'bg-gray-100',
    test: (line) => /bg-gray-100/.test(line) && !/dark:bg-/.test(line),
    apply: (line) => line.replace(/bg-gray-100/g, 'bg-gray-100 dark:bg-navy-800'),
  },

  {
    name: 'text-gray-600',
    test: (line) => /text-gray-600/.test(line) && !/dark:text-/.test(line),
    apply: (line) => line.replace(/text-gray-600/g, 'text-gray-600 dark:text-gray-400'),
  },

  {
    name: 'text-gray-700',
    test: (line) => /text-gray-700/.test(line) && !/dark:text-/.test(line),
    apply: (line) => line.replace(/text-gray-700/g, 'text-gray-700 dark:text-gray-300'),
  },
];

class Wave2Report {
  constructor() {
    this.filesScanned = 0;
    this.filesModified = 0;
    this.fixCounts = {};
    this.totalFixes = 0;
  }

  addFix(name) {
    this.fixCounts[name] = (this.fixCounts[name] || 0) + 1;
    this.totalFixes++;
  }

  print() {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║     Dark Mode Wave 2 - Edge Cases               ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    console.log(`📊 Files Scanned:   ${this.filesScanned}`);
    console.log(`📝 Files Modified:  ${this.filesModified}`);
    console.log(`🌓 Total Fixes:     ${this.totalFixes}\n`);

    if (this.totalFixes > 0) {
      console.log('Breakdown:');
      Object.entries(this.fixCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([name, count]) => {
          console.log(`  ${name}: ${count}`);
        });
    }

    console.log(DRY_RUN ? '\n🔍 DRY RUN\n' : '\n✅ Complete!\n');
  }
}

function processFile(filePath, report) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let modified = false;

  const newLines = lines.map((line) => {
    let modifiedLine = line;

    WAVE2_PATTERNS.forEach((pattern) => {
      if (!pattern.test(modifiedLine)) return;

      const result = pattern.apply(modifiedLine);
      if (result !== modifiedLine) {
        report.addFix(pattern.name);
        modifiedLine = result;
        modified = true;
      }
    });

    return modifiedLine;
  });

  if (modified) {
    report.filesModified++;
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
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

console.log('🚀 Dark Mode Wave 2 Fix...\n');
const report = new Wave2Report();
walkDir(TARGET_DIR, report);
report.print();
