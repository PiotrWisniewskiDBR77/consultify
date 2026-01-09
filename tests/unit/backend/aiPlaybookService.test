// AI Playbook Service Unit Tests
// Tests the AI playbook service for automated workflow execution

import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';



const { initTestDb, cleanTables, dbRun, db } = require('../../helpers/dbHelper.cjs');
const AIPlaybookService = require('../../../server/ai/aiPlaybookService');

describe('AIPlaybookService', () => {

    beforeAll(async () => {
        await initTestDb();
        AIPlaybookService.setDependencies({ db });
    });

    beforeEach(async () => {
        await cleanTables([
            'ai_playbook_run_steps',
            'ai_playbook_runs',
            'ai_playbook_template_steps',
            'ai_playbook_templates',
            'organizations'
        ]);

        // Seed test org
        await dbRun('INSERT INTO organizations (id, name) VALUES (?, ?)', ['org-123', 'Test Org']);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createTemplate', () => {
        it('should create a new playbook template', async () => {
            const templateData = {
                key: 'test_playbook',
                title: 'Test Playbook',
                description: 'A test playbook',
                triggerSignal: 'project_risk_high',
                estimatedDurationMins: 30
            };

            const result = await AIPlaybookService.createTemplate(templateData);

            expect(result).toBeDefined();
            expect(result.id).toMatch(/^apt-/);
            expect(result.key).toBe(templateData.key);

            const saved = await new Promise((resolve) => {
                db.get('SELECT * FROM ai_playbook_templates WHERE id = ?', [result.id], (err, row) => {
                    resolve(row);
                });
            });
            expect(saved).toBeDefined();
            expect(saved.title).toBe(templateData.title);
        });

        it('should validate required fields', async () => {
            const invalidData = {
                title: 'Test Playbook'
                // Missing key
            };

            await expect(AIPlaybookService.createTemplate(invalidData)).rejects.toThrow('key and title are required');
        });

        it('should prevent duplicate keys', async () => {
            const templateData = {
                key: 'unique_key',
                title: 'Unique Template'
            };

            await AIPlaybookService.createTemplate(templateData);
            await expect(AIPlaybookService.createTemplate(templateData)).rejects.toThrow(/already exists/);
        });
    });

    describe('getTemplateById', () => {
        it('should retrieve template by ID with steps', async () => {
            const template = await AIPlaybookService.createTemplate({
                key: 'test_get',
                title: 'Get Test'
            });

            await AIPlaybookService.addTemplateStep({
                templateId: template.id,
                stepOrder: 1,
                actionType: 'notification',
                title: 'Step 1'
            });

            const result = await AIPlaybookService.getTemplateById(template.id);

            expect(result).toBeDefined();
            expect(result.id).toBe(template.id);
            expect(result.steps).toHaveLength(1);
            expect(result.steps[0].title).toBe('Step 1');
        });

        it('should return null for non-existent template', async () => {
            const result = await AIPlaybookService.getTemplateById('non-existent');
            expect(result).toBeNull();
        });
    });

    describe('listTemplates', () => {
        it('should list all active templates', async () => {
            await AIPlaybookService.createTemplate({ key: 't1', title: 'Template 1' });
            await AIPlaybookService.createTemplate({ key: 't2', title: 'Template 2' });

            const results = await AIPlaybookService.listTemplates();
            expect(results).toHaveLength(2);
        });
    });

    describe('initiateRun', () => {
        it('should initiate a new playbook run with steps', async () => {
            const template = await AIPlaybookService.createTemplate({
                key: 'run_test',
                title: 'Run Test'
            });

            await AIPlaybookService.addTemplateStep({
                templateId: template.id,
                stepOrder: 1,
                actionType: 'task',
                title: 'Task Step',
                payloadTemplate: { taskName: 'Do something' }
            });

            const runResult = await AIPlaybookService.initiateRun({
                templateId: template.id,
                organizationId: 'org-123',
                initiatedBy: 'user-123'
            });

            expect(runResult.runId).toMatch(/^apr-/);
            expect(runResult.status).toBe('PENDING');
            expect(runResult.stepCount).toBe(1);

            const run = await AIPlaybookService.getRun(runResult.runId);
            expect(run.steps).toHaveLength(1);
            expect(run.steps[0].title).toBe('Task Step');
            expect(run.steps[0].resolvedPayload.taskName).toBe('Do something');
        });
    });

    describe('versioning and draft', () => {
        it('should create and update draft templates', async () => {
            const draft = await AIPlaybookService.createDraftTemplate({
                key: 'draft-1',
                title: 'Draft Template'
            });

            expect(draft.status).toBe('DRAFT');

            const updated = await AIPlaybookService.updateDraftTemplate(draft.id, {
                title: 'Updated Draft'
            });
            expect(updated).toBe(true);

            const refetched = await AIPlaybookService.getTemplateById(draft.id);
            expect(refetched.title).toBe('Updated Draft');
        });

        it('should publish a draft template', async () => {
            const draft = await AIPlaybookService.createDraftTemplate({
                key: 'publish-test',
                title: 'To Publish'
            });

            const published = await AIPlaybookService.publishTemplate(draft.id, 'user-admin');
            expect(published.status).toBe('PUBLISHED');

            const refetched = await AIPlaybookService.getTemplateById(draft.id);
            expect(refetched.status).toBe('PUBLISHED');
        });
    });

    describe('Payload Resolution', () => {
        it('should resolve full-string placeholders in payload templates', () => {
            const template = {
                userName: '{{ user.name }}',
                orgName: '{{ org.name }}',
                data: {
                    id: '{{ item.id }}'
                }
            };

            const context = {
                user: { name: 'Piotr' },
                org: { name: 'Consultinity' },
                item: { id: 123 }
            };

            const resolved = AIPlaybookService.resolvePayloadTemplate(template, context);

            expect(resolved.userName).toBe('Piotr');
            expect(resolved.orgName).toBe('Consultinity');
            expect(resolved.data.id).toBe(123);
        });
    });
});
