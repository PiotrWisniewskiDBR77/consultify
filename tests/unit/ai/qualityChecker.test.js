/**
 * QualityChecker Unit Tests
 * 
 * Tests for AI response quality validation service.
 */

const { qualityChecker, QualityCheckerService } = require('../../../server/services/ai/qualityChecker');

describe('QualityChecker', () => {
    describe('check()', () => {
        it('should pass a high-quality response', async () => {
            const response = {
                content: `Based on our comprehensive analysis of digital maturity, we recommend:
                
1. Implement cloud-first strategy to improve scalability
2. Establish DevOps practices for faster deployment cycles
3. Invest in employee training for digital skills

These recommendations align with industry best practices from Gartner and McKinsey research.
The expected ROI is 15-20% improvement in operational efficiency within 12 months.`
            };

            const context = {
                query: 'What are the key recommendations for improving digital maturity?',
                capability: 'recommendation'
            };

            const result = await qualityChecker.check(response, context, {});

            expect(result).toBeDefined();
            expect(result.overallScore).toBeGreaterThan(0.5);
            expect(result.passed).toBe(true);
        });

        it('should flag a low-quality response', async () => {
            const response = {
                content: 'I dont know.'
            };

            const context = {
                query: 'Provide detailed analysis of the company digital transformation strategy',
                capability: 'analysis'
            };

            const result = await qualityChecker.check(response, context, { strictMode: true });

            expect(result).toBeDefined();
            expect(result.overallScore).toBeLessThan(0.7);
        });

        it('should detect potential hallucinations', async () => {
            const response = {
                content: `According to research from 2025 (fictional future date), 
                the XYZ Corporation achieved 500% revenue growth using our methodology.
                The CEO stated in our exclusive interview that this is the best approach ever.`
            };

            const context = {
                query: 'What evidence supports this recommendation?',
                capability: 'report'
            };

            const result = await qualityChecker.check(response, context, { strictMode: true });

            expect(result).toBeDefined();
            expect(result.scores).toBeDefined();
            // Should have lower hallucination score due to unverifiable claims
        });

        it('should check relevance to query', async () => {
            const response = {
                content: `The weather today is sunny with a chance of rain.
                Let me tell you about cooking recipes instead.`
            };

            const context = {
                query: 'How can we improve our IT infrastructure security?',
                capability: 'recommendation'
            };

            const result = await qualityChecker.check(response, context, {});

            expect(result).toBeDefined();
            expect(result.scores.relevance).toBeLessThan(0.5);
        });

        it('should handle empty responses', async () => {
            const response = {
                content: ''
            };

            const context = {
                query: 'Test query',
                capability: 'chat'
            };

            const result = await qualityChecker.check(response, context, {});

            expect(result).toBeDefined();
            expect(result.overallScore).toBeLessThan(0.3);
            expect(result.passed).toBe(false);
        });

        it('should validate citation compliance when required', async () => {
            const response = {
                content: `Our analysis shows significant improvements.
                [Source: Internal Assessment 2024]
                ROI projected at 25% based on historical data.`
            };

            const context = {
                query: 'What does the data show?',
                capability: 'analysis'
            };

            const result = await qualityChecker.check(response, context, {
                requireCitations: true
            });

            expect(result).toBeDefined();
            expect(result.scores).toBeDefined();
        });
    });

    describe('calculateOverallScore()', () => {
        it('should calculate weighted average of scores', () => {
            const service = new QualityCheckerService();
            const scores = {
                relevance: 0.8,
                completeness: 0.7,
                hallucination: 0.9,
                coherence: 0.85,
                citation: 0.6
            };

            const overall = service.calculateOverallScore(scores);

            expect(overall).toBeGreaterThan(0);
            expect(overall).toBeLessThanOrEqual(1);
        });

        it('should handle missing scores gracefully', () => {
            const service = new QualityCheckerService();
            const scores = {
                relevance: 0.8
            };

            const overall = service.calculateOverallScore(scores);

            expect(overall).toBeGreaterThan(0);
        });
    });

    describe('getWarnings()', () => {
        it('should generate warnings for low scores', () => {
            const service = new QualityCheckerService();
            const scores = {
                relevance: 0.3,
                completeness: 0.9,
                hallucination: 0.2,
                coherence: 0.8
            };

            const warnings = service.getWarnings(scores);

            expect(warnings).toBeInstanceOf(Array);
            expect(warnings.length).toBeGreaterThan(0);
            expect(warnings.some(w => w.includes('relevance') || w.includes('hallucination'))).toBe(true);
        });

        it('should return empty array for high scores', () => {
            const service = new QualityCheckerService();
            const scores = {
                relevance: 0.9,
                completeness: 0.85,
                hallucination: 0.95,
                coherence: 0.9
            };

            const warnings = service.getWarnings(scores);

            expect(warnings).toBeInstanceOf(Array);
            expect(warnings.length).toBe(0);
        });
    });
});


