#!/usr/bin/env node
/**
 * Advanced ClickUp-Grade Fix Script v2
 * 
 * Targets remaining violations with enhanced pattern matching:
 * - rounded-2xl → rounded-xl
 * - Complex conditional styling
 * - Missing bg + text dark variants
 */

import fs from 'fs';
import path from 'path';

const TARGET_DIR = process.argv[2] || 'src/';
const DRY_RUN = process.argv.includes('--dry-run');

const FIXES_V2 = [
    // Fix rounded-2xl (deprecated radius)
    {
        name: 'Border Radius - rounded-2xl',
        from: /rounded-2xl(?![\w-])/g,
        to: 'rounded-xl',
        tier: 1
    },

    // Complex pattern: bg-white in className (non-dark mode aware backgrounds)
    {
        name: 'BG Missing Dark - bg-white standalone',
        from: /(\s)(bg-white)(\s)/g,
        to: (match, space1, bg, space2) => {
            // Check if line already has dark:bg-
            const hasDark = /dark:bg-/.test(match);
            if (!hasDark) {
                return `${space1}${bg} dark:bg-navy-900${space2}`;
            }
            return match;
        },
        condition: (line) => {
            // Only if it doesn't already have dark:bg-
            return !/dark:bg-/.test(line) && /bg-white(?:\s|")/.test(line);
        },
        tier: 2
    }
];

class Report {
    constructor() {
        this.filesScanned = 0;
        this.filesModified = 0;
        this.fixesByType = {};
    }

    addFix(name) {
        this.fixesByType[name] = (this.fixesByType[name] || 0) + 1;
    }

    print() {
        console.log('\n╔════════════════════════════════════════════════╗');
        console.log('║     Advanced ClickUp Fixes v2                  ║');
        console.log('╚════════════════════════════════════════════════╝\n');

        console.log(`Files Scanned: ${this.filesScanned}`);
        console.log(`Files Modified: ${this.filesModified}\n`);

        console.log('Fixes Applied:');
        Object.entries(this.fixesByType)
            .sort((a, b) => b[1] - a[1])
            .forEach(([name, count]) => {
                console.log(`  ${name}: ${count}`);
            });

        console.log(DRY_RUN ? '\n🔍 DRY RUN\n' : '\n✅ Done!\n');
    }
}

function processFile(filePath, report) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let modified = false;
    let newLines = [];

    lines.forEach((line) => {
        let modifiedLine = line;

        FIXES_V2.forEach(fix => {
            if (fix.condition && !fix.condition(modifiedLine)) return;

            if (typeof fix.to === 'function') {
                const original = modifiedLine;
                modifiedLine = modifiedLine.replace(fix.from, fix.to);
                if (original !== modifiedLine) {
                    report.addFix(fix.name);
                    modified = true;
                }
            } else {
                if (fix.from.test(modifiedLine)) {
                    modifiedLine = modifiedLine.replace(fix.from, fix.to);
                    report.addFix(fix.name);
                    modified = true;
                }
            }
        });

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

    files.forEach(file => {
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

console.log(`\n🔧 Advanced ClickUp Fixes v2`);
console.log(`Target: ${TARGET_DIR}\n`);

const report = new Report();
walkDir(TARGET_DIR, report);
report.print();
