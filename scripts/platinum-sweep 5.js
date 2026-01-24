#!/usr/bin/env node
/**
 * PLATINUM ELITE SWEEP - 98% Target
 *
 * Final manual + automated fixes for remaining HIGH/MEDIUM issues
 */

import fs from 'fs';
import path from 'path';

const TARGET_DIR = 'src/';
const DRY_RUN = process.argv.includes('--dry-run');

const PLATINUM_PATTERNS = [
  // Fix all remaining rounded-2xl
  {
    name: 'rounded-2xl → rounded-xl (final)',
    test: (line) => /rounded-2xl/.test(line),
    apply: (line) => line.replace(/rounded-2xl/g, 'rounded-xl'),
  },

  // Fix any remaining p-11, m-11, gap-11 (non-8px)
  {
    name: 'Spacing p-11 → p-12',
    test: (line) => /\s(?:p|px|py)-11(?:\s|")/g.test(line),
    apply: (line) => line.replace(/(\s)(?:p|px|py)-11(\s|")/g, '$1p-12$2'),
  },

  {
    name: 'Spacing m-11 → m-12',
    test: (line) => /\s(?:m|mx|my)-11(?:\s|")/g.test(line),
    apply: (line) => line.replace(/(\s)(?:m|mx|my)-11(\s|")/g, '$1m-12$2'),
  },

  {
    name: 'Spacing gap-11 → gap-12',
    test: (line) => /\sgap-11(?:\s|")/g.test(line),
    apply: (line) => line.replace(/(\s)gap-11(\s|")/g, '$1gap-12$2'),
  },

  // Fix p-3.5, p-2.5 etc
  {
    name: 'Spacing decimal fixes',
    test: (line) => /\s(?:p|m|gap)-(?:2\.5|3\.5)(?:\s|")/.test(line),
    apply: (line) => {
      let modified = line;
      modified = modified.replace(/(\s)(?:p|px|py)-2\.5(\s|")/g, '$1p-2$2');
      modified = modified.replace(/(\s)(?:p|px|py)-3\.5(\s|")/g, '$1p-4$2');
      modified = modified.replace(/(\s)(?:m|mx|my)-2\.5(\s|")/g, '$1m-2$2');
      modified = modified.replace(/(\s)(?:m|mx|my)-3\.5(\s|")/g, '$1m-4$2');
      modified = modified.replace(/(\s)gap-2\.5(\s|")/g, '$1gap-2$2');
      modified = modified.replace(/(\s)gap-3\.5(\s|")/g, '$1gap-4$2');
      return modified;
    },
  },
];

class PlatinumReport {
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
    console.log('║     PLATINUM ELITE SWEEP - 98% Target           ║');
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

    PLATINUM_PATTERNS.forEach((pattern) => {
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

console.log('🚀 PLATINUM ELITE SWEEP - 98% Push...\n');
const report = new PlatinumReport();
walkDir(TARGET_DIR, report);
report.print();
