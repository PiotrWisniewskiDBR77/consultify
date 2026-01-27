#!/usr/bin/env node
/**
 * FINAL MEGA SWEEP - Absolute Maximum Compliance
 *
 * Target: Eliminate ALL remaining dark mode violations
 * Strategy: Ultra-aggressive pattern matching with minimal safety checks
 */

import fs from 'fs';
import path from 'path';

const TARGET_DIR = 'src/';
const DRY_RUN = process.argv.includes('--dry-run');

// FINAL patterns - absolute maximum aggression
const FINAL_PATTERNS = [
  // Any bg-slate-XX without dark variant
  {
    name: 'bg-slate-* comprehensive',
    test: (line) => /className=.*bg-slate-(?:50|100|200)/.test(line) && !/dark:bg-/.test(line),
    apply: (line) => {
      let modified = line;
      if (/bg-slate-50/.test(modified) && !/dark:bg-/.test(modified)) {
        modified = modified.replace(/(\s)(bg-slate-50)(\s|"|')/g, '$1$2 dark:bg-navy-800/30$3');
      }
      if (/bg-slate-100/.test(modified) && !/dark:bg-/.test(modified)) {
        modified = modified.replace(/(\s)(bg-slate-100)(\s|"|')/g, '$1$2 dark:bg-navy-800/40$3');
      }
      if (/bg-slate-200/.test(modified) && !/dark:bg-/.test(modified)) {
        modified = modified.replace(/(\s)(bg-slate-200)(\s|"|')/g, '$1$2 dark:bg-navy-700/50$3');
      }
      return modified;
    },
  },

  // Any hover:bg-slate without dark
  {
    name: 'hover:bg-slate-* comprehensive',
    test: (line) => /hover:bg-slate-(?:50|100|200)/.test(line) && !/dark:hover:bg-/.test(line),
    apply: (line) => {
      let modified = line;
      if (/hover:bg-slate-50(?!\s+dark:)/.test(modified)) {
        modified = modified.replace(/(hover:bg-slate-50)/g, '$1 dark:hover:bg-navy-800/20');
      }
      if (/hover:bg-slate-100(?!\s+dark:)/.test(modified)) {
        modified = modified.replace(/(hover:bg-slate-100)/g, '$1 dark:hover:bg-navy-800/30');
      }
      if (/hover:bg-slate-200(?!\s+dark:)/.test(modified)) {
        modified = modified.replace(/(hover:bg-slate-200)/g, '$1 dark:hover:bg-navy-700/40');
      }
      return modified;
    },
  },

  // Text colors comprehensive
  {
    name: 'text-slate-* comprehensive',
    test: (line) => /text-slate-(?:400|500|600|700|800|900)/.test(line) && !/dark:text-/.test(line),
    apply: (line) => {
      let modified = line;
      const textMap = {
        'text-slate-400': 'text-slate-400 dark:text-slate-500',
        'text-slate-500': 'text-slate-500 dark:text-slate-400',
        'text-slate-600': 'text-slate-600 dark:text-slate-400',
        'text-slate-700': 'text-slate-700 dark:text-slate-300',
        'text-slate-800': 'text-slate-800 dark:text-slate-200',
        'text-slate-900': 'text-slate-900 dark:text-white',
      };

      Object.entries(textMap).forEach(([light, full]) => {
        if (modified.includes(light) && !/dark:text-/.test(modified)) {
          modified = modified.replace(new RegExp(`\\b${light}\\b`, 'g'), full);
        }
      });

      return modified;
    },
  },

  // Border colors comprehensive
  {
    name: 'border-slate-* comprehensive',
    test: (line) => /border-slate-(?:100|200|300)/.test(line) && !/dark:border-/.test(line),
    apply: (line) => {
      let modified = line;
      if (/border-slate-100(?!\s+dark:)/.test(modified)) {
        modified = modified.replace(/(border-slate-100)/g, '$1 dark:border-navy-700');
      }
      if (/border-slate-200(?!\s+dark:)/.test(modified)) {
        modified = modified.replace(/(border-slate-200)/g, '$1 dark:border-navy-700');
      }
      if (/border-slate-300(?!\s+dark:)/.test(modified)) {
        modified = modified.replace(/(border-slate-300)/g, '$1 dark:border-navy-700');
      }
      return modified;
    },
  },

  // Gray legacy colors
  {
    name: 'gray-* legacy comprehensive',
    test: (line) =>
      /(?:bg|text|border)-gray-(?:50|100|200|300|400|500|600|700|800)/.test(line) &&
      !/dark:/.test(line),
    apply: (line) => {
      let modified = line;

      // Backgrounds
      if (/bg-gray-50(?!\s+dark:)/.test(modified)) {
        modified = modified.replace(/(bg-gray-50)/g, '$1 dark:bg-gray-900');
      }
      if (/bg-gray-100(?!\s+dark:)/.test(modified)) {
        modified = modified.replace(/(bg-gray-100)/g, '$1 dark:bg-gray-800');
      }
      if (/bg-gray-200(?!\s+dark:)/.test(modified)) {
        modified = modified.replace(/(bg-gray-200)/g, '$1 dark:bg-gray-700');
      }

      // Text
      if (/text-gray-400(?!\s+dark:)/.test(modified)) {
        modified = modified.replace(/(text-gray-400)/g, '$1 dark:text-gray-500');
      }
      if (/text-gray-500(?!\s+dark:)/.test(modified)) {
        modified = modified.replace(/(text-gray-500)/g, '$1 dark:text-gray-400');
      }
      if (/text-gray-600(?!\s+dark:)/.test(modified)) {
        modified = modified.replace(/(text-gray-600)/g, '$1 dark:text-gray-400');
      }
      if (/text-gray-700(?!\s+dark:)/.test(modified)) {
        modified = modified.replace(/(text-gray-700)/g, '$1 dark:text-gray-300');
      }
      if (/text-gray-800(?!\s+dark:)/.test(modified)) {
        modified = modified.replace(/(text-gray-800)/g, '$1 dark:text-gray-200');
      }

      // Borders
      if (/border-gray-200(?!\s+dark:)/.test(modified)) {
        modified = modified.replace(/(border-gray-200)/g, '$1 dark:border-gray-700');
      }
      if (/border-gray-300(?!\s+dark:)/.test(modified)) {
        modified = modified.replace(/(border-gray-300)/g, '$1 dark:border-gray-600');
      }

      return modified;
    },
  },
];

class FinalReport {
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
    console.log('║        FINAL MEGA SWEEP - Maximum Push          ║');
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
    let lineChanged = false;

    FINAL_PATTERNS.forEach((pattern) => {
      if (!pattern.test(modifiedLine)) return;

      const result = pattern.apply(modifiedLine);
      if (result !== modifiedLine) {
        // Count changes
        const changes = (result.length - modifiedLine.length) / 10; // Rough estimate
        report.addFixes(pattern.name, Math.max(1, Math.floor(changes)));
        modifiedLine = result;
        lineChanged = true;
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

console.log('🚀 FINAL MEGA SWEEP - Maximum Compliance Push...\n');
const report = new FinalReport();
walkDir(TARGET_DIR, report);
report.print();
