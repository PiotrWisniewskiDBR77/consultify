/**
 * Template Validation Service Tests
 * Step 13: Visual Playbook Editor
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import the real modules
// We use 'require' to ensure we get the same CJS module instances as the implementation
const templateValidationService = require('../../server/ai/templateValidationService');
const templateGraphService = require('../../server/ai/templateGraphService');

describe('templateValidationService', () => {
    const { validate, validateGraph, ERROR_CODES } = templateValidationService;

    // Spies
    let validateDAGSpy;
    let findDeadEndsSpy;
    let findBranchesWithoutElseSpy;

    beforeEach(() => {
        // Create spies on the real service methods
        validateDAGSpy = vi.spyOn(templateGraphService, 'validateDAG')
            .mockReturnValue({ isValid: true, cycles: [] });

        findDeadEndsSpy = vi.spyOn(templateGraphService, 'findDeadEnds')
            .mockReturnValue([]);

        findBranchesWithoutElseSpy = vi.spyOn(templateGraphService, 'findBranchesWithoutElse')
            .mockReturnValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('validate', () => {
        it('returns error for missing template graph', () => {
            const template = { title: 'Test' };
            const result = validate(template);

            expect(result.ok).toBe(false);
            expect(result.errors[0].code).toBe('MISSING_GRAPH');
        });

        it('returns error for invalid JSON in graph', () => {
            const template = { template_graph: 'invalid json{' };
            const result = validate(template);

            expect(result.ok).toBe(false);
            expect(result.errors[0].code).toBe('INVALID_GRAPH_JSON');
        });

        it('validates empty trigger_signal', () => {
            const template = {
                templateGraph: {
                    nodes: [
                        { id: 'start', type: 'START' },
                        { id: 'end', type: 'END' }
                    ],
                    edges: [{ id: 'e1', from: 'start', to: 'end' }],
                    meta: { trigger_signal: '' }
                }
            };

            const result = validate(template);

            expect(result.ok).toBe(false);
            const triggerError = result.errors.find(e => e.code === ERROR_CODES.EMPTY_TRIGGER_SIGNAL);
            expect(triggerError).toBeDefined();
        });
    });

    describe('validateGraph', () => {
        it('returns error for missing nodes array', () => {
            const errors = validateGraph({});
            expect(errors.some(e => e.code === 'INVALID_NODES')).toBe(true);
        });

        it('returns error for missing edges array', () => {
            const errors = validateGraph({ nodes: [] });
            expect(errors.some(e => e.code === 'INVALID_EDGES')).toBe(true);
        });

        it('returns error when no START node exists', () => {
            const graph = {
                nodes: [
                    { id: 'a', type: 'ACTION' },
                    { id: 'b', type: 'END' }
                ],
                edges: [{ id: 'e1', from: 'a', to: 'b' }]
            };

            const errors = validateGraph(graph);
            expect(errors.some(e => e.code === ERROR_CODES.NO_START_NODE)).toBe(true);
        });

        it('calls validateDAG and reports cycles', () => {
            // Setup the cyclic failure response via SPY
            validateDAGSpy.mockReturnValue({
                isValid: false,
                cycles: [['a', 'b', 'a']]
            });

            const graph = {
                nodes: [
                    { id: 'start', type: 'START' },
                    { id: 'a', type: 'ACTION', title: 'A', data: { actionType: 'LOG' } },
                    { id: 'b', type: 'ACTION', title: 'B', data: { actionType: 'LOG' } },
                    { id: 'end', type: 'END' }
                ],
                edges: [
                    { id: 'e1', from: 'start', to: 'a' },
                    { id: 'e2', from: 'a', to: 'b' },
                    { id: 'e3', from: 'b', to: 'a' },
                    { id: 'e4', from: 'a', to: 'end' }
                ]
            };

            const errors = validateGraph(graph);

            expect(errors.some(e => e.code === ERROR_CODES.CYCLIC_GRAPH)).toBe(true);
            expect(validateDAGSpy).toHaveBeenCalled();
        });

        it('calls findDeadEnds and reports dead-end nodes', () => {
            findDeadEndsSpy.mockReturnValue(['orphan']);

            const graph = {
                nodes: [
                    { id: 'start', type: 'START' },
                    { id: 'orphan', type: 'ACTION', title: 'Orphan', data: { actionType: 'LOG' } },
                    { id: 'end', type: 'END' }
                ],
                edges: [{ id: 'e1', from: 'start', to: 'end' }]
            };

            const errors = validateGraph(graph);
            expect(errors.some(e => e.code === ERROR_CODES.DEAD_END_NODE)).toBe(true);
            expect(findDeadEndsSpy).toHaveBeenCalled();
        });

        it('calls findBranchesWithoutElse and reports missing else', () => {
            findBranchesWithoutElseSpy.mockReturnValue(['branch1']);

            const graph = {
                nodes: [
                    { id: 'start', type: 'START' },
                    { id: 'branch1', type: 'BRANCH', title: 'Check condition' },
                    { id: 'end', type: 'END' }
                ],
                edges: [
                    { id: 'e1', from: 'start', to: 'branch1' },
                    { id: 'e2', from: 'branch1', to: 'end', label: 'if' }
                ]
            };

            const errors = validateGraph(graph);
            expect(errors.some(e => e.code === ERROR_CODES.BRANCH_MISSING_ELSE)).toBe(true);
            expect(findBranchesWithoutElseSpy).toHaveBeenCalled();
        });
    });
});
