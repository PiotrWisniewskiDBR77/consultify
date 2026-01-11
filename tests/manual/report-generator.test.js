/**
 * Manual Test Report Generator Tests
 * Tests for manual test documentation generation
 *
 * @module tests/manual/report-generator.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Report generator implementation
const createReportGenerator = () => {
  const testResults = [];
  const screenshots = [];
  let reportMetadata = {
    title: 'Manual Test Report',
    tester: '',
    date: new Date().toISOString(),
    environment: 'development',
  };

  return {
    setMetadata: (metadata) => {
      reportMetadata = { ...reportMetadata, ...metadata };
    },

    getMetadata: () => ({ ...reportMetadata }),

    addTestResult: (result) => {
      testResults.push({
        id: `test-${testResults.length + 1}`,
        timestamp: new Date().toISOString(),
        ...result,
      });
    },

    addScreenshot: (name, path) => {
      screenshots.push({ name, path, timestamp: new Date().toISOString() });
    },

    getTestResults: () => [...testResults],
    getScreenshots: () => [...screenshots],

    getPassedCount: () => testResults.filter((t) => t.status === 'passed').length,
    getFailedCount: () => testResults.filter((t) => t.status === 'failed').length,
    getSkippedCount: () => testResults.filter((t) => t.status === 'skipped').length,

    getPassRate: () => {
      const total = testResults.length;
      if (total === 0) return 0;
      return (testResults.filter((t) => t.status === 'passed').length / total) * 100;
    },

    getSummary: () => ({
      total: testResults.length,
      passed: testResults.filter((t) => t.status === 'passed').length,
      failed: testResults.filter((t) => t.status === 'failed').length,
      skipped: testResults.filter((t) => t.status === 'skipped').length,
      passRate: testResults.length
        ? (
            (testResults.filter((t) => t.status === 'passed').length / testResults.length) *
            100
          ).toFixed(1) + '%'
        : '0%',
    }),

    getFailedTests: () => testResults.filter((t) => t.status === 'failed'),

    generateMarkdown: () => {
      const summary = {
        total: testResults.length,
        passed: testResults.filter((t) => t.status === 'passed').length,
        failed: testResults.filter((t) => t.status === 'failed').length,
        skipped: testResults.filter((t) => t.status === 'skipped').length,
      };

      let md = `# ${reportMetadata.title}\n\n`;
      md += `**Tester:** ${reportMetadata.tester}\n`;
      md += `**Date:** ${reportMetadata.date}\n`;
      md += `**Environment:** ${reportMetadata.environment}\n\n`;
      md += `## Summary\n\n`;
      md += `- Total: ${summary.total}\n`;
      md += `- Passed: ${summary.passed}\n`;
      md += `- Failed: ${summary.failed}\n`;
      md += `- Skipped: ${summary.skipped}\n\n`;
      md += `## Test Results\n\n`;

      testResults.forEach((t) => {
        const icon = t.status === 'passed' ? '✅' : t.status === 'failed' ? '❌' : '⏭️';
        md += `### ${icon} ${t.name}\n\n`;
        if (t.description) md += `${t.description}\n\n`;
        if (t.notes) md += `**Notes:** ${t.notes}\n\n`;
      });

      return md;
    },

    generateJSON: () => ({
      metadata: reportMetadata,
      summary: {
        total: testResults.length,
        passed: testResults.filter((t) => t.status === 'passed').length,
        failed: testResults.filter((t) => t.status === 'failed').length,
        skipped: testResults.filter((t) => t.status === 'skipped').length,
      },
      results: testResults,
      screenshots,
    }),

    reset: () => {
      testResults.length = 0;
      screenshots.length = 0;
    },
  };
};

describe('Report Generator Tests', () => {
  let generator;

  beforeEach(() => {
    generator = createReportGenerator();
  });

  // ═══════════════════════════════════════════════════════════════════
  // METADATA
  // ═══════════════════════════════════════════════════════════════════

  describe('Metadata', () => {
    it('should have default metadata', () => {
      const meta = generator.getMetadata();

      expect(meta.title).toBe('Manual Test Report');
      expect(meta.environment).toBe('development');
    });

    it('should update metadata', () => {
      generator.setMetadata({ tester: 'John Doe', environment: 'staging' });

      const meta = generator.getMetadata();
      expect(meta.tester).toBe('John Doe');
      expect(meta.environment).toBe('staging');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST RESULTS
  // ═══════════════════════════════════════════════════════════════════

  describe('Test Results', () => {
    it('should add test result', () => {
      generator.addTestResult({
        name: 'Login Test',
        status: 'passed',
      });

      expect(generator.getTestResults().length).toBe(1);
    });

    it('should assign ID to results', () => {
      generator.addTestResult({ name: 'Test 1', status: 'passed' });
      generator.addTestResult({ name: 'Test 2', status: 'failed' });

      const results = generator.getTestResults();
      expect(results[0].id).toBe('test-1');
      expect(results[1].id).toBe('test-2');
    });

    it('should add timestamp to results', () => {
      generator.addTestResult({ name: 'Test', status: 'passed' });

      expect(generator.getTestResults()[0].timestamp).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SCREENSHOTS
  // ═══════════════════════════════════════════════════════════════════

  describe('Screenshots', () => {
    it('should add screenshot', () => {
      generator.addScreenshot('login-page', '/screenshots/login.png');

      expect(generator.getScreenshots().length).toBe(1);
    });

    it('should store screenshot details', () => {
      generator.addScreenshot('error-state', '/screenshots/error.png');

      const screenshot = generator.getScreenshots()[0];
      expect(screenshot.name).toBe('error-state');
      expect(screenshot.path).toBe('/screenshots/error.png');
      expect(screenshot.timestamp).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // COUNTS
  // ═══════════════════════════════════════════════════════════════════

  describe('Counts', () => {
    beforeEach(() => {
      generator.addTestResult({ name: 'T1', status: 'passed' });
      generator.addTestResult({ name: 'T2', status: 'passed' });
      generator.addTestResult({ name: 'T3', status: 'failed' });
      generator.addTestResult({ name: 'T4', status: 'skipped' });
    });

    it('should count passed', () => {
      expect(generator.getPassedCount()).toBe(2);
    });

    it('should count failed', () => {
      expect(generator.getFailedCount()).toBe(1);
    });

    it('should count skipped', () => {
      expect(generator.getSkippedCount()).toBe(1);
    });

    it('should calculate pass rate', () => {
      expect(generator.getPassRate()).toBe(50);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════

  describe('Summary', () => {
    it('should generate summary', () => {
      generator.addTestResult({ name: 'T1', status: 'passed' });
      generator.addTestResult({ name: 'T2', status: 'failed' });

      const summary = generator.getSummary();

      expect(summary.total).toBe(2);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.passRate).toBe('50.0%');
    });

    it('should handle empty results', () => {
      const summary = generator.getSummary();

      expect(summary.total).toBe(0);
      expect(summary.passRate).toBe('0%');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FAILED TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe('Failed Tests', () => {
    it('should get only failed tests', () => {
      generator.addTestResult({ name: 'Pass', status: 'passed' });
      generator.addTestResult({ name: 'Fail 1', status: 'failed' });
      generator.addTestResult({ name: 'Fail 2', status: 'failed' });

      const failed = generator.getFailedTests();

      expect(failed.length).toBe(2);
      expect(failed.every((t) => t.status === 'failed')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MARKDOWN GENERATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Markdown Generation', () => {
    it('should generate markdown report', () => {
      generator.setMetadata({ tester: 'Jane Doe' });
      generator.addTestResult({ name: 'Login Test', status: 'passed' });

      const md = generator.generateMarkdown();

      expect(md).toContain('# Manual Test Report');
      expect(md).toContain('Jane Doe');
      expect(md).toContain('✅ Login Test');
    });

    it('should include failed icon', () => {
      generator.addTestResult({ name: 'Broken Test', status: 'failed' });

      const md = generator.generateMarkdown();

      expect(md).toContain('❌ Broken Test');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // JSON GENERATION
  // ═══════════════════════════════════════════════════════════════════

  describe('JSON Generation', () => {
    it('should generate JSON report', () => {
      generator.addTestResult({ name: 'Test', status: 'passed' });
      generator.addScreenshot('screen', '/path.png');

      const json = generator.generateJSON();

      expect(json.metadata).toBeDefined();
      expect(json.summary).toBeDefined();
      expect(json.results.length).toBe(1);
      expect(json.screenshots.length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════════════════════════════

  describe('Reset', () => {
    it('should reset all data', () => {
      generator.addTestResult({ name: 'Test', status: 'passed' });
      generator.addScreenshot('screen', '/path.png');

      generator.reset();

      expect(generator.getTestResults().length).toBe(0);
      expect(generator.getScreenshots().length).toBe(0);
    });
  });
});
