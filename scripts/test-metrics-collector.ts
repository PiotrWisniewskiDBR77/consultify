/**
 * Test Metrics Collector
 * Collects test execution metrics and sends to monitoring services
 */

import fs from 'fs';
import path from 'path';

interface TestMetrics {
    timestamp: string;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    duration: number;
    coverage: {
        statements: number;
        branches: number;
        functions: number;
        lines: number;
    };
    flakyTests: string[];
    executionTime: number;
}

interface CoverageSummary {
    total: {
        statements: { pct: number };
        branches: { pct: number };
        functions: { pct: number };
        lines: { pct: number };
    };
}

class TestMetricsCollector {
    private metrics: TestMetrics[] = [];
    private metricsFile: string;

    constructor() {
        this.metricsFile = path.join(process.cwd(), 'tests/metrics', 'test-metrics.json');
        this.ensureMetricsDirectory();
    }

    private ensureMetricsDirectory(): void {
        const metricsDir = path.dirname(this.metricsFile);
        if (!fs.existsSync(metricsDir)) {
            fs.mkdirSync(metricsDir, { recursive: true });
        }
    }

    /**
     * Collect metrics from test execution
     */
    async collectMetrics(): Promise<TestMetrics> {
        const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
        let coverage = {
            statements: 0,
            branches: 0,
            functions: 0,
            lines: 0,
        };

        if (fs.existsSync(coveragePath)) {
            const coverageData: CoverageSummary = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
            coverage = {
                statements: coverageData.total.statements.pct,
                branches: coverageData.total.branches.pct,
                functions: coverageData.total.functions.pct,
                lines: coverageData.total.lines.pct,
            };
        }

        // Read test results (simplified - would parse actual test output)
        const metrics: TestMetrics = {
            timestamp: new Date().toISOString(),
            totalTests: 0, // Would be parsed from test output
            passedTests: 0,
            failedTests: 0,
            skippedTests: 0,
            duration: 0,
            coverage,
            flakyTests: [],
            executionTime: Date.now(),
        };

        return metrics;
    }

    /**
     * Save metrics to file
     */
    async saveMetrics(metrics: TestMetrics): Promise<void> {
        // Load existing metrics
        let allMetrics: TestMetrics[] = [];
        if (fs.existsSync(this.metricsFile)) {
            allMetrics = JSON.parse(fs.readFileSync(this.metricsFile, 'utf8'));
        }

        // Add new metrics
        allMetrics.push(metrics);

        // Keep only last 1000 entries
        if (allMetrics.length > 1000) {
            allMetrics = allMetrics.slice(-1000);
        }

        // Save
        fs.writeFileSync(this.metricsFile, JSON.stringify(allMetrics, null, 2));
    }

    /**
     * Get metrics trends
     */
    getTrends(days: number = 30): {
        coverage: { statements: number[]; branches: number[]; functions: number[]; lines: number[] };
        testCount: number[];
        passRate: number[];
        flakyRate: number[];
    } {
        if (!fs.existsSync(this.metricsFile)) {
            return {
                coverage: { statements: [], branches: [], functions: [], lines: [] },
                testCount: [],
                passRate: [],
                flakyRate: [],
            };
        }

        const allMetrics: TestMetrics[] = JSON.parse(fs.readFileSync(this.metricsFile, 'utf8'));

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const recentMetrics = allMetrics.filter((m) => new Date(m.timestamp) >= cutoffDate);

        return {
            coverage: {
                statements: recentMetrics.map((m) => m.coverage.statements),
                branches: recentMetrics.map((m) => m.coverage.branches),
                functions: recentMetrics.map((m) => m.coverage.functions),
                lines: recentMetrics.map((m) => m.coverage.lines),
            },
            testCount: recentMetrics.map((m) => m.totalTests),
            passRate: recentMetrics.map((m) => (m.passedTests / m.totalTests) * 100),
            flakyRate: recentMetrics.map((m) => (m.flakyTests.length / m.totalTests) * 100),
        };
    }

    /**
     * Generate metrics report
     */
    generateReport(): string {
        const trends = this.getTrends(30);
        const latest = this.getLatestMetrics();

        if (!latest) {
            return 'No metrics available';
        }

        let report = '# Test Metrics Report\n\n';
        report += `**Generated:** ${new Date().toISOString()}\n\n`;

        report += '## Current Metrics\n\n';
        report += `- Total Tests: ${latest.totalTests}\n`;
        report += `- Passed: ${latest.passedTests} (${((latest.passedTests / latest.totalTests) * 100).toFixed(1)}%)\n`;
        report += `- Failed: ${latest.failedTests}\n`;
        report += `- Skipped: ${latest.skippedTests}\n`;
        report += `- Duration: ${latest.duration}s\n\n`;

        report += '## Coverage\n\n';
        report += `- Statements: ${latest.coverage.statements.toFixed(1)}%\n`;
        report += `- Branches: ${latest.coverage.branches.toFixed(1)}%\n`;
        report += `- Functions: ${latest.coverage.functions.toFixed(1)}%\n`;
        report += `- Lines: ${latest.coverage.lines.toFixed(1)}%\n\n`;

        if (latest.flakyTests.length > 0) {
            report += '## Flaky Tests\n\n';
            latest.flakyTests.forEach((test) => {
                report += `- ${test}\n`;
            });
            report += '\n';
        }

        report += '## Trends (30 days)\n\n';
        report += `- Coverage Trend: ${this.calculateTrend(trends.coverage.lines)}%\n`;
        report += `- Pass Rate Trend: ${this.calculateTrend(trends.passRate)}%\n`;
        report += `- Flaky Rate Trend: ${this.calculateTrend(trends.flakyRate)}%\n`;

        return report;
    }

    private getLatestMetrics(): TestMetrics | null {
        if (!fs.existsSync(this.metricsFile)) {
            return null;
        }

        const allMetrics: TestMetrics[] = JSON.parse(fs.readFileSync(this.metricsFile, 'utf8'));

        return allMetrics[allMetrics.length - 1] || null;
    }

    private calculateTrend(values: number[]): string {
        if (values.length < 2) return 'N/A';
        const first = values[0];
        const last = values[values.length - 1];
        const change = ((last - first) / first) * 100;
        return change >= 0 ? `+${change.toFixed(1)}` : change.toFixed(1);
    }
}

export default TestMetricsCollector;




