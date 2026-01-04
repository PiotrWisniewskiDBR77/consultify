/**
 * Template Validation Service Tests
 * Step 13: Visual Playbook Editor
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock templateGraphService to include default export with NODE_TYPES and methods
vi.mock('../../server/ai/templateGraphService', () => {
    return {
        default: {
            NODE_TYPES: {
                START: 'START',
                END: 'END',
                ACTION: 'ACTION',
                BRANCH: 'BRANCH'
            },
            validateDAG: vi.fn(),
            findDeadEnds: vi.fn(),
            findBranchesWithoutElse: vi.fn()
        }
    };
});

// Import modules
import * as templateValidationService from '../../server/ai/templateValidationService';
import templateGraphService from '../../server/ai/templateGraphService'; // Default import


describe('templateValidationService', () => {
    const { validate, validateGraph, ERROR_CODES } = templateValidationService;

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock implementations
        vi.mocked(templateGraphService.validateDAG).mockReturnValue({ isValid: true, cycles: [] });
        vi.mocked(templateGraphService.findDeadEnds).mockReturnValue([]);
        vi.mocked(templateGraphService.findBranchesWithoutElse).mockReturnValue([]);
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
            // Setup the cyclic failure response
            vi.mocked(templateGraphService.validateDAG).mockReturnValue({
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
            expect(templateGraphService.validateDAG).toHaveBeenCalled();
        });

        it('calls findDeadEnds and reports dead-end nodes', () => {
            vi.mocked(templateGraphService.findDeadEnds).mockReturnValue(['orphan']);

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
            expect(templateGraphService.findDeadEnds).toHaveBeenCalled();
        });

        it('calls findBranchesWithoutElse and reports missing else', () => {
            vi.mocked(templateGraphService.findBranchesWithoutElse).mockReturnValue(['branch1']);

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
            expect(templateGraphService.findBranchesWithoutElse).toHaveBeenCalled();
        });
    });
});
