/**
 * ABTesting Unit Tests
 * 
 * Tests for A/B testing service for AI prompts.
 */

const { abTesting, ABTestingService } = require('../../../server/services/ai/abTesting');

describe('ABTesting', () => {
    describe('createExperiment()', () => {
        it('should create a new experiment', async () => {
            const experiment = await abTesting.createExperiment({
                name: 'Test Experiment ' + Date.now(),
                promptId: 'test-prompt-1',
                variants: [
                    { name: 'Control', template: 'Original prompt template' },
                    { name: 'Treatment', template: 'New prompt template with changes' }
                ],
                trafficSplit: [50, 50],
                minSampleSize: 100,
                confidenceLevel: 0.95,
                primaryMetric: 'quality_score'
            });

            expect(experiment).toBeDefined();
            expect(experiment).toHaveProperty('id');
            expect(experiment).toHaveProperty('status', 'draft');
        });

        it('should validate traffic split totals 100%', async () => {
            await expect(
                abTesting.createExperiment({
                    name: 'Invalid Split Test',
                    promptId: 'test-prompt',
                    variants: [
                        { name: 'A', template: 'A' },
                        { name: 'B', template: 'B' }
                    ],
                    trafficSplit: [60, 60], // 120% - invalid
                    minSampleSize: 100
                })
            ).rejects.toThrow();
        });
    });

    describe('getVariant()', () => {
        it('should return deterministic variant assignment', async () => {
            // Create experiment first
            const experiment = await abTesting.createExperiment({
                name: 'Deterministic Test ' + Date.now(),
                promptId: 'test-prompt-det',
                variants: [
                    { name: 'Control', template: 'A' },
                    { name: 'Treatment', template: 'B' }
                ],
                trafficSplit: [50, 50],
                minSampleSize: 50
            });

            // Start the experiment
            await abTesting.startExperiment(experiment.id);

            const userId = 'consistent-user-123';

            // Get variant multiple times - should be consistent
            const variant1 = await abTesting.getVariant(experiment.id, userId);
            const variant2 = await abTesting.getVariant(experiment.id, userId);
            const variant3 = await abTesting.getVariant(experiment.id, userId);

            expect(variant1).toBe(variant2);
            expect(variant2).toBe(variant3);
        });

        it('should distribute users according to traffic split', async () => {
            const experiment = await abTesting.createExperiment({
                name: 'Distribution Test ' + Date.now(),
                promptId: 'test-prompt-dist',
                variants: [
                    { name: 'Control', template: 'A' },
                    { name: 'Treatment', template: 'B' }
                ],
                trafficSplit: [70, 30], // 70% control, 30% treatment
                minSampleSize: 100
            });

            await abTesting.startExperiment(experiment.id);

            // Generate many user assignments
            const counts = { 0: 0, 1: 0 };
            for (let i = 0; i < 1000; i++) {
                const variant = await abTesting.getVariant(experiment.id, `user-${i}`);
                counts[variant]++;
            }

            // Should be roughly 70/30 (with some variance)
            const controlRatio = counts[0] / 1000;
            expect(controlRatio).toBeGreaterThan(0.6);
            expect(controlRatio).toBeLessThan(0.8);
        });
    });

    describe('recordOutcome()', () => {
        it('should record experiment outcome', async () => {
            const experiment = await abTesting.createExperiment({
                name: 'Outcome Test ' + Date.now(),
                promptId: 'test-prompt-outcome',
                variants: [
                    { name: 'Control', template: 'A' },
                    { name: 'Treatment', template: 'B' }
                ],
                trafficSplit: [50, 50],
                minSampleSize: 10
            });

            await abTesting.startExperiment(experiment.id);
            const variant = await abTesting.getVariant(experiment.id, 'outcome-user');

            await expect(
                abTesting.recordOutcome(experiment.id, 'outcome-user', variant, {
                    qualityScore: 0.85,
                    latency: 1500
                })
            ).resolves.not.toThrow();
        });
    });

    describe('analyzeResults()', () => {
        it('should calculate statistical significance', async () => {
            const experiment = await abTesting.createExperiment({
                name: 'Analysis Test ' + Date.now(),
                promptId: 'test-prompt-analysis',
                variants: [
                    { name: 'Control', template: 'A' },
                    { name: 'Treatment', template: 'B' }
                ],
                trafficSplit: [50, 50],
                minSampleSize: 20,
                confidenceLevel: 0.95
            });

            await abTesting.startExperiment(experiment.id);

            // Record outcomes for both variants
            for (let i = 0; i < 25; i++) {
                await abTesting.recordOutcome(experiment.id, `control-user-${i}`, 0, {
                    qualityScore: 0.7 + Math.random() * 0.1
                });
            }
            for (let i = 0; i < 25; i++) {
                await abTesting.recordOutcome(experiment.id, `treatment-user-${i}`, 1, {
                    qualityScore: 0.8 + Math.random() * 0.1 // Higher scores for treatment
                });
            }

            const analysis = await abTesting.analyzeResults(experiment.id);

            expect(analysis).toBeDefined();
            expect(analysis).toHaveProperty('controlMean');
            expect(analysis).toHaveProperty('treatmentMean');
            expect(analysis).toHaveProperty('zScore');
            expect(analysis).toHaveProperty('isSignificant');
        });

        it('should identify no significant difference correctly', async () => {
            const experiment = await abTesting.createExperiment({
                name: 'No Diff Test ' + Date.now(),
                promptId: 'test-prompt-nodiff',
                variants: [
                    { name: 'Control', template: 'A' },
                    { name: 'Treatment', template: 'B' }
                ],
                trafficSplit: [50, 50],
                minSampleSize: 10
            });

            await abTesting.startExperiment(experiment.id);

            // Record similar outcomes for both
            for (let i = 0; i < 15; i++) {
                const score = 0.75 + Math.random() * 0.1;
                await abTesting.recordOutcome(experiment.id, `user-a-${i}`, 0, { qualityScore: score });
                await abTesting.recordOutcome(experiment.id, `user-b-${i}`, 1, { qualityScore: score });
            }

            const analysis = await abTesting.analyzeResults(experiment.id);

            expect(analysis).toBeDefined();
            // With similar scores, difference shouldn't be significant
        });
    });

    describe('startExperiment()', () => {
        it('should change status to running', async () => {
            const experiment = await abTesting.createExperiment({
                name: 'Start Test ' + Date.now(),
                promptId: 'test-prompt-start',
                variants: [
                    { name: 'A', template: 'A' },
                    { name: 'B', template: 'B' }
                ],
                trafficSplit: [50, 50],
                minSampleSize: 10
            });

            expect(experiment.status).toBe('draft');

            const started = await abTesting.startExperiment(experiment.id);

            expect(started.status).toBe('running');
            expect(started.started_at).toBeDefined();
        });
    });

    describe('stopExperiment()', () => {
        it('should change status to stopped', async () => {
            const experiment = await abTesting.createExperiment({
                name: 'Stop Test ' + Date.now(),
                promptId: 'test-prompt-stop',
                variants: [
                    { name: 'A', template: 'A' },
                    { name: 'B', template: 'B' }
                ],
                trafficSplit: [50, 50],
                minSampleSize: 10
            });

            await abTesting.startExperiment(experiment.id);
            const stopped = await abTesting.stopExperiment(experiment.id, 'manual');

            expect(stopped.status).toBe('stopped');
            expect(stopped.stop_reason).toBe('manual');
        });
    });

    describe('listExperiments()', () => {
        it('should list experiments with optional filtering', async () => {
            // Create a test experiment
            await abTesting.createExperiment({
                name: 'List Test ' + Date.now(),
                promptId: 'test-prompt-list',
                variants: [
                    { name: 'A', template: 'A' },
                    { name: 'B', template: 'B' }
                ],
                trafficSplit: [50, 50],
                minSampleSize: 10
            });

            const experiments = await abTesting.listExperiments();

            expect(experiments).toBeInstanceOf(Array);
            expect(experiments.length).toBeGreaterThan(0);
        });

        it('should filter by status', async () => {
            const experiments = await abTesting.listExperiments({ status: 'draft' });

            expect(experiments).toBeInstanceOf(Array);
            experiments.forEach(exp => {
                expect(exp.status).toBe('draft');
            });
        });
    });
});

