#!/usr/bin/env node
/**
 * Smart ClickUp-Grade UI Fix Script
 *
 * Context-aware fixes that preserve design intent while achieving compliance.
 * Follows ClickUp's professional B2B SaaS standards.
 */

import fs from 'fs';
import path from 'path';

const TARGET_DIR = process.argv[2] || 'src/views/superadmin';
const DRY_RUN = process.argv.includes('--dry-run');

// ========================================
// CONTEXT DETECTION
// ========================================

function isAtmospheric(line, context) {
  // Decorative glows, gradients, blurs - DON'T touch
  const atmosphericKeywords = /blur-|gradient-|glow|atmosphere|shadow-\[|from-|to-|via-/i;
  return atmosphericKeywords.test(line);
}

function isGlassmorphic(line, context) {
  // Glassmorphic effects - PRESERVE
  return /glass-|backdrop-blur|bg-\w+-\d+\/\d+.*backdrop/i.test(line);
}

function isHeroOrLanding(context) {
  // Hero sections, landing pages, marketing content
  const heroKeywords = /hero|landing|marketing|banner|cta|call-to-action/i;
  return (
    context.filePath.match(heroKeywords) || context.nearbyLines.some((l) => heroKeywords.test(l))
  );
}

function isStructuralUI(line, context) {
  // Tables, lists, panels, forms - ALWAYS fix these
  const structuralPatterns = [
    /<tr\s/, // Table rows
    /<td\s/, // Table cells
    /<th\s/, // Table headers
    /<li\s/, // List items
    /hover:bg-/, // Hover states (almost always structural)
    /border-r\s/, // Right borders (floating panel violations)
    /className="[^"]*?bg-white\/(?:5|10)[^"]*?border/, // Bg + border = structural
  ];
  return structuralPatterns.some((pattern) => pattern.test(line));
}

function shouldPreserve(line, context) {
  // Final decision: should we SKIP this line?
  if (isAtmospheric(line, context)) return true;
  if (isGlassmorphic(line, context)) return true;
  if (isHeroOrLanding(context)) return true;
  return false;
}

// ========================================
// SMART REPLACEMENTS
// ========================================

const SMART_FIXES = [
  // TIER 1: Structural Hover States (SAFE)
  {
    name: 'Hover State - bg-white/10',
    from: /(\s)hover:bg-white\/10(?![\w-])/g,
    to: '$1hover:bg-slate-100 dark:hover:bg-navy-800/40',
    condition: (line, ctx) => !shouldPreserve(line, ctx),
    tier: 1,
  },
  {
    name: 'Hover State - bg-white/5',
    from: /(\s)hover:bg-white\/5(?![\w-])/g,
    to: '$1hover:bg-slate-50 dark:hover:bg-navy-800/20',
    condition: (line, ctx) => !shouldPreserve(line, ctx),
    tier: 1,
  },

  // TIER 1: Deprecated Borders (SAFE)
  {
    name: 'Border - dark:border-white/10',
    from: /dark:border-white\/10(?![\w-])/g,
    to: 'dark:border-navy-700',
    condition: (line, ctx) => !shouldPreserve(line, ctx),
    tier: 1,
  },
  {
    name: 'Border - dark:border-white/5',
    from: /dark:border-white\/5(?![\w-])/g,
    to: 'dark:border-navy-700',
    condition: (line, ctx) => !shouldPreserve(line, ctx),
    tier: 1,
  },

  // TIER 1: Static Backgrounds on Structural Elements
  {
    name: 'Structural BG - bg-white/10',
    from: /className="([^"]*?)(\s)bg-white\/10(\s[^"]*?)"/g,
    to: (match, before, space1, after) => {
      // Only if it's structural AND doesn't have dark: already
      if (!match.includes('dark:bg-')) {
        return `className="${before}${space1}bg-slate-50/50 dark:bg-navy-950/30${after}"`;
      }
      return match;
    },
    condition: (line, ctx) => isStructuralUI(line, ctx) && !shouldPreserve(line, ctx),
    tier: 1,
  },
  {
    name: 'Structural BG - bg-white/5',
    from: /className="([^"]*?)(\s)bg-white\/5(\s[^"]*?)"/g,
    to: (match, before, space1, after) => {
      // Only if it's structural AND doesn't have dark: already
      if (!match.includes('dark:bg-')) {
        return `className="${before}${space1}bg-slate-50/30 dark:bg-navy-950/20${after}"`;
      }
      return match;
    },
    condition: (line, ctx) => isStructuralUI(line, ctx) && !shouldPreserve(line, ctx),
    tier: 1,
  },

  // TIER 1: Border-r violations (Floating Panels v3.0)
  {
    name: 'Layout - border-r removal',
    from: /(\s)border-r(\s)/g,
    to: '$1$2', // Remove border-r
    condition: (line, ctx) => {
      // Only if it's a sidebar/panel separation
      return /className="[^"]*?border-r[^"]*?(?:w-\d+|flex|overflow)/.test(line);
    },
    tier: 1,
    warning: '⚠️  BORDER-R removed - verify parent has gap-0.5',
  },
];

// ========================================
// FILE PROCESSING
// ========================================

class FixReport {
  constructor() {
    this.filesScanned = 0;
    this.filesModified = 0;
    this.fixesByTier = { 1: 0, 2: 0, 3: 0 };
    this.fixesByType = {};
    this.preservedLines = 0;
    this.warnings = [];
  }

  addFix(fixName, tier) {
    this.fixesByTier[tier]++;
    this.fixesByType[fixName] = (this.fixesByType[fixName] || 0) + 1;
  }

  addWarning(warning, file, lineNum) {
    this.warnings.push({ warning, file, lineNum });
  }

  print() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║       Smart ClickUp-Grade Fix Report                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('📊 Summary:');
    console.log(`  Files Scanned:   ${this.filesScanned}`);
    console.log(`  Files Modified:  ${this.filesModified}`);
    console.log(`  Lines Preserved: ${this.preservedLines} (design intent respected)\n`);

    console.log('🎯 Fixes by Tier:');
    console.log(`  Tier 1 (Safe Automation):    ${this.fixesByTier[1]}`);
    console.log(`  Tier 2 (Context-Aware):      ${this.fixesByTier[2]}`);
    console.log(`  Tier 3 (Manual Review):      ${this.fixesByTier[3]}\n`);

    console.log('📋 Fixes by Type:');
    Object.entries(this.fixesByType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => {
        console.log(`  ${name}: ${count}`);
      });

    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings (Manual Review Required):');
      this.warnings.slice(0, 10).forEach((w) => {
        console.log(`  ${w.file}:${w.lineNum} - ${w.warning}`);
      });
      if (this.warnings.length > 10) {
        console.log(`  ... and ${this.warnings.length - 10} more warnings`);
      }
    }

    console.log(DRY_RUN ? '\n🔍 DRY RUN - No files were modified\n' : '\n✅ Fixes applied!\n');
  }
}

function processFile(filePath, report) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let modified = false;
  let newLines = [];

  lines.forEach((line, index) => {
    // Build context
    const context = {
      filePath,
      lineNum: index + 1,
      line,
      nearbyLines: lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 3)),
    };

    let modifiedLine = line;
    let lineModified = false;

    // Check if we should preserve this line
    if (shouldPreserve(line, context)) {
      report.preservedLines++;
      newLines.push(line);
      return;
    }

    // Apply smart fixes
    SMART_FIXES.forEach((fix) => {
      if (fix.condition && !fix.condition(modifiedLine, context)) {
        return;
      }

      if (typeof fix.to === 'function') {
        const original = modifiedLine;
        modifiedLine = modifiedLine.replace(fix.from, fix.to);
        if (original !== modifiedLine) {
          report.addFix(fix.name, fix.tier);
          lineModified = true;
          if (fix.warning) {
            report.addWarning(fix.warning, path.basename(filePath), index + 1);
          }
        }
      } else {
        if (fix.from.test(modifiedLine)) {
          modifiedLine = modifiedLine.replace(fix.from, fix.to);
          report.addFix(fix.name, fix.tier);
          lineModified = true;
          if (fix.warning) {
            report.addWarning(fix.warning, path.basename(filePath), index + 1);
          }
        }
      }
    });

    if (lineModified) {
      modified = true;
    }

    newLines.push(modifiedLine);
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

// ========================================
// MAIN
// ========================================

console.log(`\n🔧 Smart ClickUp-Grade Fix Script`);
console.log(`Target: ${TARGET_DIR}`);
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (preview only)' : 'LIVE (will modify files)'}\n`);

const report = new FixReport();
walkDir(TARGET_DIR, report);
report.print();

if (DRY_RUN) {
  console.log('💡 Run without --dry-run to apply fixes\n');
} else {
  console.log('📊 Re-run audit: node scripts/audit-ui-compliance.js ' + TARGET_DIR + '\n');
}
