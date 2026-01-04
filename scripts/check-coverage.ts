/**
 * Coverage Check Script
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Checks if coverage meets thresholds (95%+)
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface CoverageThresholds {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
}

const THRESHOLDS: CoverageThresholds = {
    lines: 95,
    functions: 95,
    branches: 90,
    statements: 95,
};

function checkCoverage(): void {
    try {
        const coveragePath = join(process.cwd(), 'coverage', 'coverage-final.json');
        const coverage = JSON.parse(readFileSync(coveragePath, 'utf-8'));

        let totalLines = 0;
        let coveredLines = 0;
        let totalFunctions = 0;
        let coveredFunctions = 0;
        let totalBranches = 0;
        let coveredBranches = 0;
        let totalStatements = 0;
        let coveredStatements = 0;

        for (const file in coverage) {
            const fileCoverage = coverage[file];
            const s = fileCoverage.s || {};
            const f = fileCoverage.f || {};
            const b = fileCoverage.b || {};
            const statementMap = fileCoverage.statementMap || {};

            // Calculate statements
            totalStatements += Object.keys(statementMap).length;
            coveredStatements += Object.values(s).filter((count: number) => count > 0).length;

            // Calculate functions
            totalFunctions += Object.keys(f).length;
            coveredFunctions += Object.values(f).filter((count: number) => count > 0).length;

            // Calculate branches
            totalBranches += Object.keys(b).length;
            coveredBranches += Object.values(b).filter((counts: number[]) => counts.some((count) => count > 0)).length;

            // Calculate lines (approximate from statements)
            totalLines += Object.keys(statementMap).length;
            coveredLines += Object.values(s).filter((count: number) => count > 0).length;
        }

        const coverageMetrics = {
            lines: (coveredLines / totalLines) * 100,
            functions: (coveredFunctions / totalFunctions) * 100,
            branches: (coveredBranches / totalBranches) * 100,
            statements: (coveredStatements / totalStatements) * 100,
        };

        console.log('\n📊 Coverage Report:');
        console.log(`Lines: ${coverageMetrics.lines.toFixed(2)}% (threshold: ${THRESHOLDS.lines}%)`);
        console.log(`Functions: ${coverageMetrics.functions.toFixed(2)}% (threshold: ${THRESHOLDS.functions}%)`);
        console.log(`Branches: ${coverageMetrics.branches.toFixed(2)}% (threshold: ${THRESHOLDS.branches}%)`);
        console.log(`Statements: ${coverageMetrics.statements.toFixed(2)}% (threshold: ${THRESHOLDS.statements}%)\n`);

        const failures: string[] = [];

        if (coverageMetrics.lines < THRESHOLDS.lines) {
            failures.push(
                `Lines coverage ${coverageMetrics.lines.toFixed(2)}% is below threshold ${THRESHOLDS.lines}%`,
            );
        }
        if (coverageMetrics.functions < THRESHOLDS.functions) {
            failures.push(
                `Functions coverage ${coverageMetrics.functions.toFixed(2)}% is below threshold ${THRESHOLDS.functions}%`,
            );
        }
        if (coverageMetrics.branches < THRESHOLDS.branches) {
            failures.push(
                `Branches coverage ${coverageMetrics.branches.toFixed(2)}% is below threshold ${THRESHOLDS.branches}%`,
            );
        }
        if (coverageMetrics.statements < THRESHOLDS.statements) {
            failures.push(
                `Statements coverage ${coverageMetrics.statements.toFixed(2)}% is below threshold ${THRESHOLDS.statements}%`,
            );
        }

        if (failures.length > 0) {
            console.error('❌ Coverage thresholds not met:');
            failures.forEach((f) => console.error(`  - ${f}`));
            process.exit(1);
        } else {
            console.log('✅ All coverage thresholds met!');
            process.exit(0);
        }
    } catch (error) {
        console.error('Error checking coverage:', error);
        process.exit(1);
    }
}

checkCoverage();
