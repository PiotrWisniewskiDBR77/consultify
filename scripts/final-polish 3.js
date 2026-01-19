#!/usr/bin/env node
/**
 * Final Polish Script - To 95%+ Compliance
 *
 * Phase 1: Visual Consistency
 * Phase 2: Dark Mode Parity
 */

import fs from 'fs';
import path from 'path';

const TARGET_DIR = 'src/';
const DRY_RUN = process.argv.includes('--dry-run');

// Phase 1: Visual Consistency
const VISUAL_FIXES = [
  {
    name: 'rounded-2xl → rounded-xl',
    from: /rounded-2xl/g,
    to: 'rounded-xl',
    priority: 1,
  },
  {
    name: 'rounded-3xl → rounded-2xl',
    from: /rounded-3xl/g,
    to: 'rounded-2xl',
    priority: 1,
  },
];

// Phase 2: Dark Mode Parity - Safe patterns only
const DARK_MODE_FIXES = [
  // Pattern 1: bg-slate-50 without dark variant
  {
    name: 'bg-slate-50 + dark variant',
    from: /(\s)(bg-slate-50)(?!\s)/g,
    to: (match, space, bg) => {
      return `${space}${bg} dark:bg-navy-800/30`;
    },
    condition: (line) => {
      return /bg-slate-50/.test(line) && !/dark:bg-/.test(line);
    },
    priority: 2,
  },

  // Pattern 2: bg-white in structural contexts
  {
    name: 'bg-white + dark variant (structural)',
    from: /className="([^"]*?)bg-white(\s[^"]*?border[^"]*?)"/g,
    to: 'className="$1bg-white dark:bg-navy-900$2"',
    condition: (line) => {
      return (
        /bg-white/.test(line) &&
        /border/.test(line) &&
        !/dark:bg-/.test(line) &&
        !/gradient|blur|glow/.test(line)
      ); // Skip atmospherics
    },
    priority: 2,
  },
];

class FinalReport {
  constructor() {
    this.filesScanned = 0;
    this.filesModified = 0;
    this.fixCounts = {};
    this.phases = { visual: 0, darkMode: 0 };
  }

  addFix(name, priority) {
    this.fixCounts[name] = (this.fixCounts[name] || 0) + 1;
    if (priority === 1) this.phases.visual++;
    if (priority === 2) this.phases.darkMode++;
  }

  print() {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║       Final Polish to 95%+ Compliance            ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    console.log(`📊 Files Scanned:   ${this.filesScanned}`);
    console.log(`📝 Files Modified:  ${this.filesModified}\n`);

    console.log('🎨 Phase 1 - Visual Consistency: ' + this.phases.visual);
    console.log('🌓 Phase 2 - Dark Mode Parity:   ' + this.phases.darkMode);
    console.log(`\n📋 Total Fixes: ${this.phases.visual + this.phases.darkMode}\n`);

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
  const content = fs.readFileSync(filePath, 'utf-8');
  let modified = content;
  let hasChanges = false;

  // Phase 1: Visual fixes
  VISUAL_FIXES.forEach((fix) => {
    const original = modified;
    modified = modified.replace(fix.from, fix.to);
    if (original !== modified) {
      const count = (original.match(fix.from) || []).length;
      for (let i = 0; i < count; i++) {
        report.addFix(fix.name, fix.priority);
      }
      hasChanges = true;
    }
  });

  // Phase 2: Dark mode fixes (line by line for safety)
  const lines = modified.split('\n');
  const newLines = lines.map((line) => {
    let modifiedLine = line;

    DARK_MODE_FIXES.forEach((fix) => {
      if (fix.condition && !fix.condition(modifiedLine)) return;

      const original = modifiedLine;
      modifiedLine = modifiedLine.replace(fix.from, fix.to);

      if (original !== modifiedLine) {
        report.addFix(fix.name, fix.priority);
        hasChanges = true;
      }
    });

    return modifiedLine;
  });

  if (hasChanges) {
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

console.log('🚀 Starting Final Polish...\n');
const report = new FinalReport();
walkDir(TARGET_DIR, report);
report.print();
