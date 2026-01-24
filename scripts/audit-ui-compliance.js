#!/usr/bin/env node
/**
 * UI/UX Compliance Audit Script
 *
 * Automatically scans TSX/JSX files for deprecated UI patterns and violations
 * of the Consultify Design System standards.
 *
 * Usage:
 *   node scripts/audit-ui-compliance.js src/                       # Scan entire src directory
 *   node scripts/audit-ui-compliance.js src/views/SettingsView.tsx # Scan single file
 *   node scripts/audit-ui-compliance.js src/ --report=json         # JSON output
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================================
// CONFIGURATION
// ========================================

const DEPRECATED_PATTERNS = {
  // Dark Mode Border Issues
  darkBorderWhite: {
    pattern: /dark:border-white\/(?:5|10)/g,
    severity: 'HIGH',
    category: 'Dark Mode Parity',
    message: 'Deprecated dark:border-white/5 or /10 - use dark:border-navy-700',
    fix: 'Replace with: dark:border-navy-700',
  },

  // Border Radius Issues
  rounded2xl: {
    pattern: /rounded-2xl/g,
    severity: 'MEDIUM',
    category: 'Visual Consistency',
    message: 'Using deprecated rounded-2xl - should be rounded-xl for cards',
    fix: 'Replace with: rounded-xl (12px)',
  },

  // Spacing Violations (non-8px grid)
  invalidSpacing: {
    pattern: /(?:p|m|gap|space-[xy])-(?:5|7|11)/g,
    severity: 'LOW',
    category: 'Visual Consistency',
    message: 'Spacing not on 8px grid - use 4px, 8px, 12px, 16px, 24px, 32px',
    fix: 'Use standard spacing: 1(4px), 2(8px), 3(12px), 4(16px), 6(24px), 8(32px)',
  },

  // Pill-style Navigation (deprecated)
  pillNavigation: {
    pattern: /isActive\s*\?\s*['"](?:.*?)bg-violet-600(?:.*?)['"]/g,
    severity: 'MEDIUM',
    category: 'Component Standards',
    message: 'Using deprecated pill-style navigation - switch to left-border pattern',
    fix: 'Use: bg-violet-50 dark:bg-violet-900/20 border-l-2 border-violet-600',
  },

  // Border-r on Floating Panels ONLY (v3.0 violation) - excluding functional separators
  borderRSidebar: {
    pattern: /border-r(?:\s|$)/g,
    severity: 'HIGH',
    category: 'Layout Architecture',
    message: 'Using border-r for panel separation - violates Floating Panels pattern',
    fix: 'Remove border-r, use gap-0.5 on parent container instead',
    customCheck: (line) => {
      // SKIP if this is a functional separator (sidebars, tables, charts)
      const functionalKeywords =
        /(?:sidebar|table|gantt|chart|grid|column|w-\d+|flex-shrink|timeline|matrix)/i;
      const isSidebar = /(?:sidebar|w-80|w-64|w-72|fixed.*left)/i.test(line);
      const isTable = /(?:<tr|<td|<th|thead|tbody)/i.test(line);
      const isChart = /(?:gantt|timeline|grid|matrix)/i.test(line);

      // Only flag if NOT functional
      return !isSidebar && !isTable && !isChart && !functionalKeywords.test(line);
    },
  },

  // Missing Dark Mode Variants - FIXED to properly detect ALL dark variants
  orphanLightBg: {
    pattern: /(?:bg-white|bg-slate-50)(?![\w-])/g,
    severity: 'MEDIUM',
    category: 'Dark Mode Parity',
    message: 'Background color missing dark mode variant',
    fix: 'Add: dark:bg-navy-900 (for bg-white) or dark:bg-navy-800 (for bg-slate-50)',
    customCheck: (line, match) => {
      // Ensure this isn't part of a dark: prefix pattern
      const matchIndex = line.indexOf(match[0]);
      const before = line.substring(Math.max(0, matchIndex - 20), matchIndex);

      // Check if line has ANY dark variant (including hover, focus, active)
      const hasDarkVariant = /dark:(?:hover:|focus:|active:)?bg-/.test(line);

      // Skip if part of dark: prefix OR line already has dark variant
      return !/dark:/.test(before) && !hasDarkVariant;
    },
  },

  // Orphan Light Borders - FIXED
  orphanLightBorder: {
    pattern: /border-slate-(?:100|200)(?![\w-])/g,
    severity: 'LOW',
    category: 'Dark Mode Parity',
    message: 'Border color missing dark mode variant',
    fix: 'Add: dark:border-navy-700',
    customCheck: (line, match) => {
      const matchIndex = line.indexOf(match[0]);
      const before = line.substring(Math.max(0, matchIndex - 20), matchIndex);

      // Check for ANY dark border variant
      const hasDarkVariant = /dark:(?:hover:|focus:|active:)?border-/.test(line);

      return !/dark:/.test(before) && !hasDarkVariant;
    },
  },

  // Window Confirm/Alert (breaks Premium aesthetic)
  nativeDialogs: {
    pattern: /window\.(confirm|alert|prompt)/g,
    severity: 'HIGH',
    category: 'Enterprise Polish',
    message: 'Using native browser dialogs - breaks premium immersion',
    fix: 'Use application-level modals or toast notifications',
  },
};

// ========================================
// SCANNING LOGIC
// ========================================

class AuditResults {
  constructor() {
    this.violations = [];
    this.filesScanned = 0;
    this.filesWithIssues = 0;
  }

  addViolation(file, line, lineNum, patternKey, match) {
    const pattern = DEPRECATED_PATTERNS[patternKey];
    this.violations.push({
      file,
      line: lineNum,
      code: line.trim(),
      match: match[0],
      severity: pattern.severity,
      category: pattern.category,
      message: pattern.message,
      fix: pattern.fix,
    });
  }

  getSummary() {
    const bySeverity = {
      HIGH: this.violations.filter((v) => v.severity === 'HIGH').length,
      MEDIUM: this.violations.filter((v) => v.severity === 'MEDIUM').length,
      LOW: this.violations.filter((v) => v.severity === 'LOW').length,
    };

    const byCategory = {};
    this.violations.forEach((v) => {
      byCategory[v.category] = (byCategory[v.category] || 0) + 1;
    });

    return {
      totalViolations: this.violations.length,
      filesScanned: this.filesScanned,
      filesWithIssues: this.filesWithIssues,
      bySeverity,
      byCategory,
    };
  }
}

function scanFile(filePath, results) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let hasIssues = false;

  lines.forEach((line, index) => {
    Object.keys(DEPRECATED_PATTERNS).forEach((patternKey) => {
      const pattern = DEPRECATED_PATTERNS[patternKey];
      const matches = line.matchAll(pattern.pattern);

      for (const match of matches) {
        // If pattern has custom check, validate before adding violation
        if (pattern.customCheck && !pattern.customCheck(line, match)) {
          continue;
        }

        results.addViolation(filePath, line, index + 1, patternKey, match);
        hasIssues = true;
      }
    });
  });

  results.filesScanned++;
  if (hasIssues) results.filesWithIssues++;
}

function scanDirectory(targetPath, results) {
  function walkDir(dir) {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Skip node_modules, dist, build
        if (!['node_modules', 'dist', 'build', '.git'].includes(file)) {
          walkDir(filePath);
        }
      } else if (stat.isFile() && (file.endsWith('.tsx') || file.endsWith('.jsx'))) {
        scanFile(filePath, results);
      }
    });
  }

  walkDir(targetPath);
}

// ========================================
// REPORTING
// ========================================

function generateConsoleReport(results) {
  const summary = results.getSummary();

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║          UI/UX Compliance Audit - Results                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('📊 Summary:');
  console.log(`  Files Scanned:     ${summary.filesScanned}`);
  console.log(`  Files with Issues: ${summary.filesWithIssues}`);
  console.log(`  Total Violations:  ${summary.totalViolations}\n`);

  console.log('🔴 By Severity:');
  console.log(`  HIGH:   ${summary.bySeverity.HIGH} (blocking deployment)`);
  console.log(`  MEDIUM: ${summary.bySeverity.MEDIUM} (scheduled fixes)`);
  console.log(`  LOW:    ${summary.bySeverity.LOW} (polish)\n`);

  console.log('📁 By Category:');
  Object.entries(summary.byCategory).forEach(([category, count]) => {
    console.log(`  ${category}: ${count}`);
  });

  if (results.violations.length > 0) {
    console.log('\n🔍 Violations (showing first 20):');
    results.violations.slice(0, 20).forEach((v, idx) => {
      const severityIcon = v.severity === 'HIGH' ? '🔴' : v.severity === 'MEDIUM' ? '🟡' : '🟢';
      console.log(`\n${severityIcon} [${v.severity}] ${v.category}`);
      console.log(`  File: ${v.file}:${v.line}`);
      console.log(`  Issue: ${v.message}`);
      console.log(`  Code: ${v.code.substring(0, 80)}${v.code.length > 80 ? '...' : ''}`);
      console.log(`  Fix: ${v.fix}`);
    });

    if (results.violations.length > 20) {
      console.log(`\n... and ${results.violations.length - 20} more violations`);
    }
  } else {
    console.log('\n✅ No violations found! Application is compliant.\n');
  }

  // Compliance Score Estimation
  const maxViolations = summary.filesScanned * 10; // Assume max 10 violations per file
  const complianceScore = Math.max(0, 100 - (summary.totalViolations / maxViolations) * 100);

  console.log('\n📈 Estimated Compliance Score:');
  const scoreColor = complianceScore >= 95 ? '🟢' : complianceScore >= 85 ? '🟡' : '🔴';
  console.log(`  ${scoreColor} ${complianceScore.toFixed(1)}% (based on automated checks only)`);
  console.log('  Note: Manual review required for full audit\n');
}

function generateJSONReport(results) {
  const summary = results.getSummary();
  const report = {
    timestamp: new Date().toISOString(),
    summary,
    violations: results.violations,
  };

  return JSON.stringify(report, null, 2);
}

// ========================================
// MAIN
// ========================================

async function main() {
  const args = process.argv.slice(2);
  const targetPath = args[0] || 'src/';
  const reportFormat = args.find((a) => a.startsWith('--report='))?.split('=')[1] || 'console';

  if (!fs.existsSync(targetPath)) {
    console.error(`Error: Path "${targetPath}" does not exist`);
    process.exit(1);
  }

  const results = new AuditResults();

  if (fs.statSync(targetPath).isDirectory()) {
    scanDirectory(targetPath, results);
  } else {
    scanFile(targetPath, results);
  }

  if (reportFormat === 'json') {
    console.log(generateJSONReport(results));
  } else {
    generateConsoleReport(results);
  }

  // Exit code for CI/CD
  const summary = results.getSummary();
  if (summary.bySeverity.HIGH > 0) {
    process.exit(1); // High severity violations = fail build
  }
}

main().catch(console.error);
