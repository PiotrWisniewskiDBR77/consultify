/**
 * Template Graph Service Tests
 * Step 13: Visual Playbook Editor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock uuid
vi.mock('uuid', () => ({
    v4: () => 'test-uuid-1234'
}));

// Import after mocking
const templateGraphService = require('../../server/ai/templateGraphService');

describe('templateGraphService', () => {
    const { NODE_TYPES, EDGE_LABELS, stepsToGraph, graphToSteps, validateDAG, findDeadEnds, findBranchesWithoutElse, createEmptyGraph } = templateGraphService;

    describe('createEmptyGraph', () => {
        it('creates a graph with START and END nodes connected', () => {
            const graph = createEmptyGraph('TEST_SIGNAL');

            expect(graph.nodes).toHaveLength(2);
            expect(graph.edges).toHaveLength(1);
            expect(graph.meta.trigger_signal).toBe('TEST_SIGNAL');

            const startNode = graph.nodes.find(n => n.type === NODE_TYPES.START);
            const endNode = graph.nodes.find(n => n.type === NODE_TYPES.END);

            expect(startNode).toBeDefined();
            expect(endNode).toBeDefined();
            expect(graph.edges[0].from).toBe(startNode.id);
            expect(graph.edges[0].to).toBe(endNode.id);
        });
    });

    describe('stepsToGraph', () => {
        it('converts empty steps to START → END graph', () => {
            const graph = stepsToGraph([], 'TRIGGER');

            expect(graph.nodes).toHaveLength(2);
            expect(graph.nodes[0].type).toBe(NODE_TYPES.START);
            expect(graph.nodes[1].type).toBe(NODE_TYPES.END);
            expect(graph.edges).toHaveLength(1);
            expect(graph.meta.trigger_signal).toBe('TRIGGER');
        });

        it('converts steps array to linear graph', () => {
            const steps = [
                { id: 'step1', step_order: 1, action_type: 'TASK_CREATE', title: 'Create Task' },
                { id: 'step2', step_order: 2, action_type: 'EMAIL_SEND', title: 'Send Email' }
            ];

            const graph = stepsToGraph(steps, 'USER_AT_RISK');

            // START + 2 actions + END
            expect(graph.nodes).toHaveLength(4);
            expect(graph.edges).toHaveLength(3); // START→step1, step1→step2, step2→END

            const actionNodes = graph.nodes.filter(n => n.type === NODE_TYPES.ACTION);
            expect(actionNodes).toHaveLength(2);
        });

        it('preserves step data in nodes', () => {
            const steps = [
                {
                    id: 'step1',
                    step_order: 1,
                    action_type: 'TASK_CREATE',
                    title: 'Create Task',
                    description: 'Create a follow-up task',
                    payload_template: '{"assignee": "{{user.id}}"}'
                }
            ];

            const graph = stepsToGraph(steps, 'SIGNAL');
            const actionNode = graph.nodes.find(n => n.type === NODE_TYPES.ACTION);

            expect(actionNode.title).toBe('Create Task');
            expect(actionNode.data.actionType).toBe('TASK_CREATE');
            expect(actionNode.data.description).toBe('Create a follow-up task');
            expect(actionNode.data.payloadTemplate).toEqual({ assignee: '{{user.id}}' });
        });
    });

    describe('graphToSteps', () => {
        it('returns empty array for invalid graph', () => {
            expect(graphToSteps(null)).toEqual([]);
            expect(graphToSteps({})).toEqual([]);
            expect(graphToSteps({ nodes: [] })).toEqual([]);
        });

        it('skips START and END nodes in output', () => {
            const graph = createEmptyGraph('SIGNAL');
            const steps = graphToSteps(graph);

            expect(steps).toEqual([]);
        });

        it('converts linear graph to ordered steps', () => {
            const graph = {
                nodes: [
                    { id: 'start', type: NODE_TYPES.START, title: 'Start', data: {}, position: { x: 0, y: 0 } },
                    { id: 'action1', type: NODE_TYPES.ACTION, title: 'Action 1', data: { actionType: 'TASK_CREATE' }, position: { x: 0, y: 100 } },
                    { id: 'action2', type: NODE_TYPES.ACTION, title: 'Action 2', data: { actionType: 'EMAIL_SEND' }, position: { x: 0, y: 200 } },
                    { id: 'end', type: NODE_TYPES.END, title: 'End', data: {}, position: { x: 0, y: 300 } }
                ],
                edges: [
                    { id: 'e1', from: 'start', to: 'action1' },
                    { id: 'e2', from: 'action1', to: 'action2' },
                    { id: 'e3', from: 'action2', to: 'end' }
                ],
                meta: { trigger_signal: 'TEST' }
            };

            const steps = graphToSteps(graph);

            expect(steps).toHaveLength(2);
            expect(steps[0].title).toBe('Action 1');
            expect(steps[0].stepOrder).toBe(1);
            expect(steps[1].title).toBe('Action 2');
            expect(steps[1].stepOrder).toBe(2);
        });
    });

    describe('validateDAG', () => {
        it('returns valid for acyclic graph', () => {
            const graph = {
                nodes: [
                    { id: 'a', type: NODE_TYPES.START },
                    { id: 'b', type: NODE_TYPES.ACTION },
                    { id: 'c', type: NODE_TYPES.END }
                ],
                edges: [
                    { id: 'e1', from: 'a', to: 'b' },
                    { id: 'e2', from: 'b', to: 'c' }
                ]
            };

            const result = validateDAG(graph);
            expect(result.isValid).toBe(true);
            expect(result.cycles).toHaveLength(0);
        });

        it('detects simple cycle', () => {
            const graph = {
                nodes: [
                    { id: 'a', type: NODE_TYPES.ACTION },
                    { id: 'b', type: NODE_TYPES.ACTION }
                ],
                edges: [
                    { id: 'e1', from: 'a', to: 'b' },
                    { id: 'e2', from: 'b', to: 'a' }
                ]
            };

            const result = validateDAG(graph);
            expect(result.isValid).toBe(false);
            expect(result.cycles.length).toBeGreaterThan(0);
        });

        it('returns invalid for null graph', () => {
            const result = validateDAG(null);
            expect(result.isValid).toBe(false);
        });
    });

    describe('findDeadEnds', () => {
        it('returns empty for valid graph', () => {
            const graph = {
                nodes: [
                    { id: 'a', type: NODE_TYPES.START },
                    { id: 'b', type: NODE_TYPES.END }
                ],
                edges: [{ id: 'e1', from: 'a', to: 'b' }]
            };

            const deadEnds = findDeadEnds(graph);
            expect(deadEnds).toHaveLength(0);
        });

        it('finds nodes without outgoing edges', () => {
            const graph = {
                nodes: [
                    { id: 'a', type: NODE_TYPES.START },
                    { id: 'b', type: NODE_TYPES.ACTION },
                    { id: 'c', type: NODE_TYPES.END }
                ],
                edges: [
                    { id: 'e1', from: 'a', to: 'c' }
                    // b has no outgoing edge
                ]
            };

            const deadEnds = findDeadEnds(graph);
            expect(deadEnds).toContain('b');
        });
    });

    describe('findBranchesWithoutElse', () => {
        it('returns empty when no BRANCH nodes', () => {
            const graph = {
                nodes: [
                    { id: 'a', type: NODE_TYPES.START },
                    { id: 'b', type: NODE_TYPES.ACTION },
                    { id: 'c', type: NODE_TYPES.END }
                ],
                edges: [
                    { id: 'e1', from: 'a', to: 'b' },
                    { id: 'e2', from: 'b', to: 'c' }
                ]
            };

            expect(findBranchesWithoutElse(graph)).toHaveLength(0);
        });

        it('finds BRANCH node without else path', () => {
            const graph = {
                nodes: [
                    { id: 'a', type: NODE_TYPES.START },
                    { id: 'b', type: NODE_TYPES.BRANCH },
                    { id: 'c', type: NODE_TYPES.END }
                ],
                edges: [
                    { id: 'e1', from: 'a', to: 'b' },
                    { id: 'e2', from: 'b', to: 'c', label: 'if' } // No else
                ]
            };

            const result = findBranchesWithoutElse(graph);
            expect(result).toContain('b');
        });

        it('passes when BRANCH has else path', () => {
            const graph = {
                nodes: [
                    { id: 'a', type: NODE_TYPES.START },
                    { id: 'b', type: NODE_TYPES.BRANCH },
                    { id: 'c', type: NODE_TYPES.ACTION },
                    { id: 'd', type: NODE_TYPES.END }
                ],
                edges: [
                    { id: 'e1', from: 'a', to: 'b' },
                    { id: 'e2', from: 'b', to: 'c', label: 'if' },
                    { id: 'e3', from: 'b', to: 'd', label: 'else' },
                    { id: 'e4', from: 'c', to: 'd' }
                ]
            };

            expect(findBranchesWithoutElse(graph)).toHaveLength(0);
        });
    });

    describe('roundtrip: steps → graph → steps', () => {
        it('preserves data through roundtrip', () => {
            const originalSteps = [
                {
                    id: 'step1',
                    step_order: 1,
                    action_type: 'TASK_CREATE',
                    title: 'Create Task',
                    description: 'Test description',
                    is_optional: false
                },
                {
                    id: 'step2',
                    step_order: 2,
                    action_type: 'EMAIL_SEND',
                    title: 'Send Email'
                }
            ];

            const graph = stepsToGraph(originalSteps, 'TRIGGER');
            const resultSteps = graphToSteps(graph);

            expect(resultSteps).toHaveLength(2);
            expect(resultSteps[0].actionType).toBe('TASK_CREATE');
            expect(resultSteps[1].actionType).toBe('EMAIL_SEND');
        });
    });
});
