/**
 * Unit Tests for RapidLean Observation Templates Data
 * Tests template structure and mappings
 */

const { 
    RAPID_LEAN_OBSERVATION_TEMPLATES,
    OBSERVATION_TO_SCORE_MAPPING,
    OBSERVATION_TO_DRD_MAPPING,
    getTemplateById,
    getTemplatesByDimension,
    getAllTemplates
} = require('../../../server/data/rapidLeanObservationTemplates');

describe('RapidLean Observation Templates Data', () => {
    describe('Template Structure', () => {
        test('should have 6 templates', () => {
            expect(RAPID_LEAN_OBSERVATION_TEMPLATES.length).toBe(6);
        });

        test('each template should have required fields', () => {
            RAPID_LEAN_OBSERVATION_TEMPLATES.forEach(template => {
                expect(template).toHaveProperty('id');
                expect(template).toHaveProperty('dimension');
                expect(template).toHaveProperty('drdAxis');
                expect(template).toHaveProperty('name');
                expect(template).toHaveProperty('description');
                expect(template).toHaveProperty('checklist');
                expect(template).toHaveProperty('photoRequired');
                expect(template).toHaveProperty('notesRequired');
                expect(template).toHaveProperty('estimatedTime');
                expect(Array.isArray(template.checklist)).toBe(true);
            });
        });

        test('should have correct dimensions', () => {
            const dimensions = RAPID_LEAN_OBSERVATION_TEMPLATES.map(t => t.dimension);
            expect(dimensions).toContain('value_stream');
            expect(dimensions).toContain('waste_elimination');
            expect(dimensions).toContain('flow_pull');
            expect(dimensions).toContain('quality_source');
            expect(dimensions).toContain('continuous_improvement');
            expect(dimensions).toContain('visual_management');
        });

        test('should map to correct DRD axes', () => {
            const processesTemplates = RAPID_LEAN_OBSERVATION_TEMPLATES.filter(t => t.drdAxis === 'processes');
            const cultureTemplates = RAPID_LEAN_OBSERVATION_TEMPLATES.filter(t => t.drdAxis === 'culture');
            
            expect(processesTemplates.length).toBe(4); // Value Stream, Waste, Flow, Quality
            expect(cultureTemplates.length).toBe(2); // CI, Visual
        });
    });

    describe('Checklist Items', () => {
        test('each checklist item should have required fields', () => {
            RAPID_LEAN_OBSERVATION_TEMPLATES.forEach(template => {
                template.checklist.forEach(item => {
                    expect(item).toHaveProperty('id');
                    expect(item).toHaveProperty('text');
                    expect(item).toHaveProperty('type');
                    expect(item).toHaveProperty('required');
                    expect(['yes_no', 'scale', 'text', 'photo', 'measurement']).toContain(item.type);
                });
            });
        });

        test('should have at least one required item per template', () => {
            RAPID_LEAN_OBSERVATION_TEMPLATES.forEach(template => {
                const requiredItems = template.checklist.filter(item => item.required);
                expect(requiredItems.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Score Mapping', () => {
        test('should have mappings for all dimensions', () => {
            expect(OBSERVATION_TO_SCORE_MAPPING).toHaveProperty('value_stream');
            expect(OBSERVATION_TO_SCORE_MAPPING).toHaveProperty('waste_elimination');
            expect(OBSERVATION_TO_SCORE_MAPPING).toHaveProperty('flow_pull');
            expect(OBSERVATION_TO_SCORE_MAPPING).toHaveProperty('quality_source');
            expect(OBSERVATION_TO_SCORE_MAPPING).toHaveProperty('continuous_improvement');
            expect(OBSERVATION_TO_SCORE_MAPPING).toHaveProperty('visual_management');
        });

        test('score mappings should return valid scores (1-5)', () => {
            Object.values(OBSERVATION_TO_SCORE_MAPPING).forEach(dimensionMapping => {
                Object.values(dimensionMapping).forEach(score => {
                    expect(score).toBeGreaterThanOrEqual(1);
                    expect(score).toBeLessThanOrEqual(5);
                });
            });
        });
    });

    describe('DRD Mapping', () => {
        test('should have DRD mappings for all dimensions', () => {
            expect(OBSERVATION_TO_DRD_MAPPING).toHaveProperty('value_stream');
            expect(OBSERVATION_TO_DRD_MAPPING).toHaveProperty('waste_elimination');
            expect(OBSERVATION_TO_DRD_MAPPING).toHaveProperty('flow_pull');
            expect(OBSERVATION_TO_DRD_MAPPING).toHaveProperty('quality_source');
            expect(OBSERVATION_TO_DRD_MAPPING).toHaveProperty('continuous_improvement');
            expect(OBSERVATION_TO_DRD_MAPPING).toHaveProperty('visual_management');
        });

        test('DRD mappings should have valid axis and level', () => {
            Object.values(OBSERVATION_TO_DRD_MAPPING).forEach(dimensionMapping => {
                Object.values(dimensionMapping).forEach(mapping => {
                    expect(mapping).toHaveProperty('axis');
                    expect(mapping).toHaveProperty('level');
                    expect([1, 5]).toContain(mapping.axis); // Only Axis 1 (Processes) and 5 (Culture)
                    expect(mapping.level).toBeGreaterThanOrEqual(1);
                    expect(mapping.level).toBeLessThanOrEqual(7);
                });
            });
        });
    });

    describe('Helper Functions', () => {
        test('getTemplateById should return correct template', () => {
            const template = getTemplateById('value_stream_template');
            expect(template).toBeDefined();
            expect(template.id).toBe('value_stream_template');
            expect(template.dimension).toBe('value_stream');
        });

        test('getTemplateById should return undefined for invalid ID', () => {
            const template = getTemplateById('invalid_template');
            expect(template).toBeUndefined();
        });

        test('getTemplatesByDimension should return correct templates', () => {
            const templates = getTemplatesByDimension('value_stream');
            expect(templates.length).toBe(1);
            expect(templates[0].dimension).toBe('value_stream');
        });

        test('getAllTemplates should return all templates', () => {
            const templates = getAllTemplates();
            expect(templates.length).toBe(6);
        });
    });
});

