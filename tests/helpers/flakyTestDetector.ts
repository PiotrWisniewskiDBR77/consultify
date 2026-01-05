/**
 * Flaky Test Detector
 * 
 * Detects and reports flaky tests by tracking test execution history
 * and identifying tests that pass/fail intermittently.
 */

import { vi } from 'vitest';

interface TestExecution {
    testName: string;
    passed: boolean;
    duration: number;
    timestamp: number;
    error?: string;
}

interface FlakyTestReport {
    testName: string;
    failureRate: number;
    totalRuns: number;
    failures: number;
    passes: number;
    lastFailure?: string;
    lastPass?: number;
}

class FlakyTestDetector {
    private executions: Map<string, TestExecution[]> = new Map();
    private readonly FLAKY_THRESHOLD = 0.1; // 10% failure rate indicates flaky test

    /**
     * Record a test execution
     */
    recordExecution(testName: string, passed: boolean, duration: number, error?: string): void {
        if (!this.executions.has(testName)) {
            this.executions.set(testName, []);
        }

        const executions = this.executions.get(testName)!;
        executions.push({
            testName,
            passed,
            duration,
            timestamp: Date.now(),
            error
        });

        // Keep only last 100 executions per test
        if (executions.length > 100) {
            executions.shift();
        }
    }

    /**
     * Check if a test is flaky
     */
    isFlaky(testName: string): boolean {
        const executions = this.executions.get(testName);
        if (!executions || executions.length < 5) {
            return false; // Need at least 5 runs to determine flakiness
        }

        const report = this.getReport(testName);
        return report.failureRate > this.FLAKY_THRESHOLD && report.totalRuns >= 5;
    }

    /**
     * Get flaky test report
     */
    getReport(testName: string): FlakyTestReport {
        const executions = this.executions.get(testName) || [];
        const failures = executions.filter(e => !e.passed).length;
        const passes = executions.filter(e => e.passed).length;
        const totalRuns = executions.length;
        const failureRate = totalRuns > 0 ? failures / totalRuns : 0;

        const lastFailure = executions
            .filter(e => !e.passed)
            .sort((a, b) => b.timestamp - a.timestamp)[0]?.error;

        const lastPass = executions
            .filter(e => e.passed)
            .sort((a, b) => b.timestamp - a.timestamp)[0]?.timestamp;

        return {
            testName,
            failureRate,
            totalRuns,
            failures,
            passes,
            lastFailure,
            lastPass
        };
    }

    /**
     * Get all flaky tests
     */
    getFlakyTests(): FlakyTestReport[] {
        const reports: FlakyTestReport[] = [];
        
        for (const testName of this.executions.keys()) {
            if (this.isFlaky(testName)) {
                reports.push(this.getReport(testName));
            }
        }

        return reports.sort((a, b) => b.failureRate - a.failureRate);
    }

    /**
     * Generate flaky test report
     */
    generateReport(): string {
        const flakyTests = this.getFlakyTests();
        
        if (flakyTests.length === 0) {
            return '✅ No flaky tests detected';
        }

        let report = `\n⚠️  Flaky Tests Detected (${flakyTests.length}):\n\n`;
        
        flakyTests.forEach((test, index) => {
            report += `${index + 1}. ${test.testName}\n`;
            report += `   Failure Rate: ${(test.failureRate * 100).toFixed(1)}%\n`;
            report += `   Total Runs: ${test.totalRuns} (${test.passes} passed, ${test.failures} failed)\n`;
            if (test.lastFailure) {
                report += `   Last Error: ${test.lastFailure.substring(0, 100)}...\n`;
            }
            report += '\n';
        });

        return report;
    }

    /**
     * Clear all recorded executions
     */
    clear(): void {
        this.executions.clear();
    }
}

// Singleton instance
export const flakyTestDetector = new FlakyTestDetector();

/**
 * Vitest hook to record test results
 */
export function setupFlakyTestDetection() {
    // This would be called from vitest setup
    // For now, it's a placeholder that can be extended
}

export default flakyTestDetector;






