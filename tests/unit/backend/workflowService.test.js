/**
 * Workflow Service Unit Tests
 * Tests workflow creation, execution, and state management
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory workflow service for testing
const createWorkflowService = () => {
    const workflows = new Map();
    const executions = new Map();

    return {
        create: (name, steps, options = {}) => {
            const id = `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const workflow = {
                id,
                name,
                steps: steps.map((step, index) => ({
                    id: `step-${index}`,
                    ...step,
                    order: index
                })),
                status: 'draft',
                createdAt: new Date(),
                ...options
            };
            workflows.set(id, workflow);
            return workflow;
        },

        get: (id) => workflows.get(id) || null,

        list: () => Array.from(workflows.values()),

        update: (id, updates) => {
            const workflow = workflows.get(id);
            if (!workflow) throw new Error('Workflow not found');
            Object.assign(workflow, updates, { updatedAt: new Date() });
            return workflow;
        },

        delete: (id) => workflows.delete(id),

        activate: (id) => {
            const workflow = workflows.get(id);
            if (!workflow) throw new Error('Workflow not found');
            workflow.status = 'active';
            return workflow;
        },

        execute: async (workflowId, context = {}) => {
            const workflow = workflows.get(workflowId);
            if (!workflow) throw new Error('Workflow not found');
            if (workflow.status !== 'active') throw new Error('Workflow not active');

            const executionId = `exec-${Date.now()}`;
            const execution = {
                id: executionId,
                workflowId,
                context,
                status: 'running',
                currentStep: 0,
                results: [],
                startedAt: new Date()
            };
            executions.set(executionId, execution);

            // Simulate step execution
            for (const step of workflow.steps) {
                execution.results.push({
                    stepId: step.id,
                    status: 'completed',
                    completedAt: new Date()
                });
                execution.currentStep++;
            }

            execution.status = 'completed';
            execution.completedAt = new Date();
            return execution;
        },

        getExecution: (executionId) => executions.get(executionId) || null,

        listExecutions: (workflowId) => {
            return Array.from(executions.values())
                .filter(e => e.workflowId === workflowId);
        },

        addStep: (workflowId, step) => {
            const workflow = workflows.get(workflowId);
            if (!workflow) throw new Error('Workflow not found');
            const newStep = {
                id: `step-${workflow.steps.length}`,
                ...step,
                order: workflow.steps.length
            };
            workflow.steps.push(newStep);
            return newStep;
        },

        removeStep: (workflowId, stepId) => {
            const workflow = workflows.get(workflowId);
            if (!workflow) throw new Error('Workflow not found');
            workflow.steps = workflow.steps.filter(s => s.id !== stepId);
            return workflow;
        }
    };
};

describe('WorkflowService', () => {
    let workflowService;

    beforeEach(() => {
        workflowService = createWorkflowService();
    });

    describe('Workflow CRUD', () => {
        it('should create workflow', () => {
            const workflow = workflowService.create('Approval Flow', [
                { name: 'Submit', type: 'action' },
                { name: 'Review', type: 'approval' },
                { name: 'Complete', type: 'action' }
            ]);

            expect(workflow.id).toBeDefined();
            expect(workflow.name).toBe('Approval Flow');
            expect(workflow.steps).toHaveLength(3);
        });

        it('should get workflow by ID', () => {
            const created = workflowService.create('Test Flow', [{ name: 'Step 1' }]);
            const retrieved = workflowService.get(created.id);

            expect(retrieved.id).toBe(created.id);
        });

        it('should list all workflows', () => {
            workflowService.create('Flow 1', []);
            workflowService.create('Flow 2', []);

            const list = workflowService.list();
            expect(list).toHaveLength(2);
        });

        it('should update workflow', () => {
            const workflow = workflowService.create('Original', []);
            workflowService.update(workflow.id, { name: 'Updated' });

            expect(workflowService.get(workflow.id).name).toBe('Updated');
        });

        it('should delete workflow', () => {
            const workflow = workflowService.create('Delete Me', []);
            workflowService.delete(workflow.id);

            expect(workflowService.get(workflow.id)).toBeNull();
        });
    });

    describe('Workflow Execution', () => {
        it('should execute active workflow', async () => {
            const workflow = workflowService.create('Exec Flow', [
                { name: 'Step 1' },
                { name: 'Step 2' }
            ]);
            workflowService.activate(workflow.id);

            const execution = await workflowService.execute(workflow.id, { userId: 'user-1' });

            expect(execution.id).toBeDefined();
            expect(execution.status).toBe('completed');
            expect(execution.results).toHaveLength(2);
        });

        it('should reject inactive workflow execution', async () => {
            const workflow = workflowService.create('Draft Flow', []);

            await expect(workflowService.execute(workflow.id))
                .rejects.toThrow('Workflow not active');
        });

        it('should track execution context', async () => {
            const workflow = workflowService.create('Context Flow', [{ name: 'Step' }]);
            workflowService.activate(workflow.id);

            const execution = await workflowService.execute(workflow.id, {
                projectId: 'proj-1',
                initiatedBy: 'user-1'
            });

            expect(execution.context.projectId).toBe('proj-1');
        });
    });

    describe('Step Management', () => {
        it('should add step to workflow', () => {
            const workflow = workflowService.create('Dynamic Flow', []);
            workflowService.addStep(workflow.id, { name: 'New Step', type: 'action' });

            expect(workflowService.get(workflow.id).steps).toHaveLength(1);
        });

        it('should remove step from workflow', () => {
            const workflow = workflowService.create('Remove Step', [
                { name: 'Keep' },
                { name: 'Remove' }
            ]);
            const stepToRemove = workflow.steps[1].id;
            workflowService.removeStep(workflow.id, stepToRemove);

            expect(workflowService.get(workflow.id).steps).toHaveLength(1);
        });
    });

    describe('Execution History', () => {
        it('should list executions for workflow', async () => {
            const workflow = workflowService.create('History Flow', [{ name: 'Step' }]);
            workflowService.activate(workflow.id);

            await workflowService.execute(workflow.id);

            const executions = workflowService.listExecutions(workflow.id);
            expect(executions.length).toBeGreaterThanOrEqual(1);
        });
    });
});
