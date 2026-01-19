#!/usr/bin/env node
/**
 * ULTIMATE FINAL SWEEP - 100% Compliance
 *
 * Targeting the last 796 violations with surgical precision
 */

import fs from 'fs';
import path from 'path';

const TARGET_DIR = 'src/';
const DRY_RUN = process.argv.includes('--dry-run');

const ULTIMATE_PATTERNS = [
  // Fix deprecated dark:border-white/5 and /10
  {
    name: 'dark:border-white/5 or /10',
    test: (line) => /dark:border-white\/(?:5|10)/.test(line),
    apply: (line) => line.replace(/dark:border-white\/(?:5|10)/g, 'dark:border-navy-700'),
  },

  // Spacing fixes - convert non-8px grid to proper values
  {
    name: 'Spacing p-5 → p-4 or p-6',
    test: (line) => /\s(?:p|px|py)-5(?:\s|")/g.test(line),
    apply: (line) => line.replace(/(\s)(?:p|px|py)-5(\s|")/g, '$1p-4$2'), // 5 → 4 (closest 8px grid)
  },

  {
    name: 'Spacing p-7 → p-6  or p-8',
    test: (line) => /\s(?:p|px|py)-7(?:\s|")/g.test(line),
    apply: (line) => line.replace(/(\s)(?:p|px|py)-7(\s|")/g, '$1p-6$2'), // 7 → 6 (closest)
  },

  {
    name: 'Spacing m-5 → m-4 or m-6',
    test: (line) => /\s(?:m|mx|my)-5(?:\s|")/g.test(line),
    apply: (line) => line.replace(/(\s)(?:m|mx|my)-5(\s|")/g, '$1m-4$2'),
  },

  {
    name: 'Spacing m-7 → m-6 or m-8',
    test: (line) => /\s(?:m|mx|my)-7(?:\s|")/g.test(line),
    apply: (line) => line.replace(/(\s)(?:m|mx|my)-7(\s|")/g, '$1m-6$2'),
  },

  {
    name: 'Spacing gap-5 → gap-4 or gap-6',
    test: (line) => /\sgap-5(?:\s|")/g.test(line),
    apply: (line) => line.replace(/(\s)gap-5(\s|")/g, '$1gap-4$2'),
  },

  {
    name: 'Spacing gap-7 → gap-6 or gap-8',
    test: (line) => /\sgap-7(?:\s|")/g.test(line),
    apply: (line) => line.replace(/(\s)gap-7(\s|")/g, '$1gap-6$2'),
  },
];

class UltimateReport {
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
    console.log('║     ULTIMATE FINAL SWEEP - 100% Push            ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    console.log(`📊 Files Scanned:   ${this.filesScanned}`);
    console.log(`📝 Files Modified:  ${this.filesModified}`);
    console.log(`🎯 Total Fixes:     ${this.totalFixes}\n`);

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
  let fileModified = false;

  const newLines = lines.map((line) => {
    let modifiedLine = line;

    ULTIMATE_PATTERNS.forEach((pattern) => {
      if (!pattern.test(modifiedLine)) return;

      const result = pattern.apply(modifiedLine);
      if (result !== modifiedLine) {
        report.addFix(pattern.name);
        modifiedLine = result;
        fileModified = true;
      }
    });

    return modifiedLine;
  });

  if (fileModified) {
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

console.log('🚀 ULTIMATE FINAL SWEEP - 100% Compliance...\n');
const report = new UltimateReport();
walkDir(TARGET_DIR, report);
report.print();
