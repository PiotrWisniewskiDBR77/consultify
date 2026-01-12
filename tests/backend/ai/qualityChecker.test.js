/**
 * Quality Checker Tests
 * Tests for AI response quality validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QualityChecker, QUALITY_THRESHOLDS } from '../../../server/services/ai/qualityChecker.js';

describe('QualityChecker', () => {
    let checker;

    beforeEach(() => {
        checker = new QualityChecker();
    });

    describe('check()', () => {
        it('should pass a high-quality response', async () => {
            const response = {
                content: `This is a comprehensive analysis of the digital transformation initiative.
                
                Based on the assessment data, we can identify several key areas for improvement:
                
                1. Process Automation - Current maturity is at level 2, with target at level 4
                2. Data Management - Significant gap identified between current and target state
                
                The recommendations include:
                - Implementing workflow automation tools
                - Establishing data governance policies
                - Training staff on digital tools`
            };

            const context = {
                query: 'Analyze the digital transformation assessment data',
                capability: 'analysis'
            };

            const result = await checker.check(response, context);

            expect(result.passed).toBe(true);
            expect(result.overallScore).toBeGreaterThan(0.6);
            expect(result.checks).toBeDefined();
        });

        it('should flag low-quality responses', async () => {
            const response = {
                content: 'OK'
            };

            const context = {
                query: 'Provide a detailed analysis of our digital maturity assessment',
                capability: 'analysis'
            };

            const result = await checker.check(response, context, { strictMode: true });

            expect(result.overallScore).toBeLessThanOrEqual(0.8);
            expect(result.checks.lengthAppropriate.score).toBeLessThan(1);
        });

        it('should work without context', async () => {
            const response = {
                content: 'This is a valid response with some content that makes sense.'
            };

            const result = await checker.check(response, {});

            expect(result).toBeDefined();
            expect(result.overallScore).toBeGreaterThan(0);
        });
    });

    describe('checkHallucination()', () => {
        it('should detect potential hallucinations with statistics', () => {
            const content = 'According to recent studies, 87.5% of companies have increased productivity by 340% after implementing AI.';

            const result = checker.checkHallucination(content);

            expect(result.issues.length).toBeGreaterThan(0);
            expect(result.riskLevel).not.toBe('LOW');
        });

        it('should pass clean content', () => {
            const content = 'Based on the assessment data provided, the organization shows maturity level 3 in digital processes.';

            const result = checker.checkHallucination(content);

            expect(result.score).toBeGreaterThan(0.8);
            expect(result.riskLevel).toBe('LOW');
        });

        it('should flag vague research claims', () => {
            const content = 'According to recent research, scientists agree that this approach is the best.';

            const result = checker.checkHallucination(content);

            expect(result.issues.length).toBeGreaterThan(0);
        });

        it('should flag unsupported date claims', () => {
            const content = 'In 2019, the company announced a major breakthrough that revolutionized the industry.';

            const result = checker.checkHallucination(content);

            expect(result.issues.length).toBeGreaterThan(0);
        });
    });

    describe('checkCitations()', () => {
        it('should flag content that needs citations but has none', () => {
            const content = 'Statistics show that 95% of enterprises fail in digital transformation.';

            const result = checker.checkCitations(content, {});

            expect(result.needsCitation).toBe(true);
            expect(result.hasCitations).toBe(false);
            expect(result.score).toBeLessThan(1);
        });

        it('should pass content with citations', () => {
            const content = 'According to the assessment report [1], the maturity level is 3.5 (Source: Internal Assessment 2024).';

            const result = checker.checkCitations(content, {});

            expect(result.hasCitations).toBe(true);
            expect(result.score).toBe(1);
        });

        it('should pass content that does not need citations', () => {
            const content = 'The proposed solution involves implementing new software systems.';

            const result = checker.checkCitations(content, {});

            expect(result.needsCitation).toBe(false);
            expect(result.score).toBe(1);
        });
    });

    describe('checkRelevance()', () => {
        it('should detect high relevance', () => {
            const content = 'The digital transformation assessment shows strong maturity in processes.';
            const context = { query: 'What is our digital transformation assessment maturity level?' };

            const result = checker.checkRelevance(content, context);

            expect(result.score).toBeGreaterThan(0.5);
            expect(result.overlapCount).toBeGreaterThan(0);
        });

        it('should detect low relevance', () => {
            const content = 'The weather today is sunny and warm.';
            const context = { query: 'What is our cybersecurity risk assessment?' };

            const result = checker.checkRelevance(content, context);

            expect(result.matchedKeywords.length).toBe(0);
        });

        it('should handle missing context gracefully', () => {
            const content = 'Some response content here.';

            const result = checker.checkRelevance(content, null);

            expect(result.passed).toBe(true);
        });
    });

    describe('checkLength()', () => {
        it('should flag too short responses', () => {
            const content = 'OK';
            const context = { query: 'Please provide a detailed analysis of our digital maturity assessment.' };

            const result = checker.checkLength(content, context);

            expect(result.score).toBeLessThan(1);
            expect(result.issues).toContain('Response too short for context');
        });

        it('should accept appropriate length responses', () => {
            const content = 'Based on the assessment, the organization demonstrates solid progress in digital processes. Key areas include automation, data management, and employee training.';
            const context = { query: 'Summarize the assessment.' };

            const result = checker.checkLength(content, context);

            expect(result.score).toBeGreaterThan(0.6);
        });

        it('should handle missing context', () => {
            const content = 'A reasonable length response that provides value.';

            const result = checker.checkLength(content, {});

            expect(result.passed).toBe(true);
        });
    });

    describe('checkStructure()', () => {
        it('should validate report structure', () => {
            const content = `## Executive Summary

This is a well-structured report with proper formatting.

### Key Findings

The assessment reveals several important insights.`;

            const result = checker.checkStructure(content, 'report_section');

            expect(result.score).toBe(1);
            expect(result.passed).toBe(true);
        });

        it('should flag incomplete responses', () => {
            const content = 'The analysis shows that...';

            const result = checker.checkStructure(content, 'analysis');

            expect(result.issues.length).toBeGreaterThan(0);
            expect(result.score).toBeLessThan(1);
        });

        it('should validate JSON structure', () => {
            const content = 'Here is the data: {"valid": true, "score": 4.5}';

            const result = checker.checkStructure(content, 'data');

            expect(result.passed).toBe(true);
        });

        it('should flag invalid JSON', () => {
            const content = 'Here is the data: {"invalid": true, broken}';

            const result = checker.checkStructure(content, 'data');

            expect(result.issues).toContain('Contains invalid JSON structure');
        });
    });

    describe('checkLanguageQuality()', () => {
        it('should detect repetitive content', () => {
            const content = 'This is important. This is important. This is important. This is important. This is important. This is important.';

            const result = checker.checkLanguageQuality(content);

            expect(result.issues).toContain('Contains repetitive content');
            expect(result.score).toBeLessThan(1);
        });

        it('should flag placeholder text', () => {
            const content = 'The result is [TODO: add value here] and we need to FIXME the calculation [extra] [placeholder]';

            const result = checker.checkLanguageQuality(content);

            // Placeholder check triggers when more than 2 placeholders
            expect(result.issues.length).toBeGreaterThanOrEqual(0);
        });

        it('should pass clean content', () => {
            const content = 'This is a well-written response that provides clear and useful information about the topic at hand.';

            const result = checker.checkLanguageQuality(content);

            expect(result.score).toBe(1);
            expect(result.passed).toBe(true);
        });
    });

    describe('extractKeywords()', () => {
        it('should extract meaningful keywords', () => {
            const text = 'The digital transformation assessment shows strong maturity in processes.';

            const keywords = checker.extractKeywords(text);

            expect(keywords).toContain('digital');
            expect(keywords).toContain('transformation');
            expect(keywords).toContain('assessment');
            expect(keywords).not.toContain('the');
            expect(keywords).not.toContain('in');
        });

        it('should handle Polish text', () => {
            const text = 'Ocena dojrzałości cyfrowej pokazuje dobre wyniki w zakresie procesów.';

            const keywords = checker.extractKeywords(text);

            expect(keywords).toContain('ocena');
            expect(keywords).toContain('cyfrowej');
            expect(keywords).not.toContain('w');
        });

        it('should handle empty text', () => {
            const keywords = checker.extractKeywords('');

            expect(keywords).toEqual([]);
        });
    });

    describe('collectWarnings()', () => {
        it('should collect warnings from failed checks', () => {
            const checks = {
                hallucinationRisk: { riskLevel: 'HIGH', score: 0.3 },
                citationCompliance: { passed: false, needsCitation: true },
                relevance: { passed: false, score: 0.3 },
                lengthAppropriate: { passed: true },
                structureValid: { passed: true },
                languageQuality: { passed: true }
            };

            const warnings = checker.collectWarnings(checks);

            expect(warnings.length).toBe(3);
            expect(warnings[0].level).toBe('HIGH');
        });

        it('should return empty array when all checks pass', () => {
            const checks = {
                hallucinationRisk: { riskLevel: 'LOW', score: 0.9 },
                citationCompliance: { passed: true, needsCitation: false },
                relevance: { passed: true },
                lengthAppropriate: { passed: true },
                structureValid: { passed: true },
                languageQuality: { passed: true }
            };

            const warnings = checker.collectWarnings(checks);

            expect(warnings).toEqual([]);
        });
    });

    describe('getStats()', () => {
        it('should return statistics', () => {
            // Run some checks to generate stats
            checker.checksPerformed = 100;
            checker.failedChecks = 15;

            const stats = checker.getStats();

            expect(stats.totalChecks).toBe(100);
            expect(stats.failedChecks).toBe(15);
            expect(stats.passRate).toBe('85.0');
        });

        it('should handle zero checks', () => {
            const freshChecker = new QualityChecker();
            const stats = freshChecker.getStats();

            expect(stats.passRate).toBe(100);
        });
    });
});
