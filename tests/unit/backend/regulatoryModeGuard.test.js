/**
 * RegulatoryModeGuard Tests
 * 
 * Tests for regulatory mode enforcement service.
 */

const { describe, it, expect, beforeEach, afterEach, beforeAll } = require('vitest');
const { initTestDb, cleanTables, dbAll, dbRun } = require('../../helpers/dbHelper.cjs');
const RegulatoryModeGuard = require('../../../server/services/regulatoryModeGuard');
const { v4: uuidv4 } = require('uuid');

describe('RegulatoryModeGuard', () => {
    let testProjectId;

    beforeAll(async () => {
        await initTestDb();
    });

    beforeEach(async () => {
        testProjectId = uuidv4();
    });

    afterEach(async () => {
        await cleanTables(['projects']);
    });

    describe('isEnabled', () => {
        it('should return false when no project ID', async () => {
            const enabled = await RegulatoryModeGuard.isEnabled(null);

            expect(enabled).toBe(false);
        });

        it('should return true when regulatory mode enabled', async () => {
            await dbRun(
                `INSERT INTO projects (id, name, organization_id, regulatory_mode_enabled, created_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [testProjectId, 'Test Project', uuidv4(), 1]
            );

            const enabled = await RegulatoryModeGuard.isEnabled(testProjectId);

            expect(enabled).toBe(true);
        });

        it('should return false when regulatory mode disabled', async () => {
            await dbRun(
                `INSERT INTO projects (id, name, organization_id, regulatory_mode_enabled, created_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [testProjectId, 'Test Project', uuidv4(), 0]
            );

            const enabled = await RegulatoryModeGuard.isEnabled(testProjectId);

            expect(enabled).toBe(false);
        });

        it('should default to enabled when column is null', async () => {
            await dbRun(
                `INSERT INTO projects (id, name, organization_id, created_at)
                 VALUES (?, ?, ?, datetime('now'))`,
                [testProjectId, 'Test Project', uuidv4()]
            );

            const enabled = await RegulatoryModeGuard.isEnabled(testProjectId);

            expect(enabled).toBe(true); // Fail-safe default
        });
    });

    describe('canPerformAction', () => {
        it('should allow EXPLAIN_CONTEXT in regulatory mode', () => {
            const canPerform = RegulatoryModeGuard.canPerformAction(
                'EXPLAIN_CONTEXT',
                true // regulatory mode enabled
            );

            expect(canPerform).toBe(true);
        });

        it('should block CREATE_DRAFT_TASK in regulatory mode', () => {
            const canPerform = RegulatoryModeGuard.canPerformAction(
                'CREATE_DRAFT_TASK',
                true // regulatory mode enabled
            );

            expect(canPerform).toBe(false);
        });

        it('should allow all actions when regulatory mode disabled', () => {
            const canPerform = RegulatoryModeGuard.canPerformAction(
                'CREATE_DRAFT_TASK',
                false // regulatory mode disabled
            );

            expect(canPerform).toBe(true);
        });

        it('should allow all allowed actions', () => {
            RegulatoryModeGuard.ALLOWED_ACTIONS.forEach(action => {
                const canPerform = RegulatoryModeGuard.canPerformAction(action, true);
                expect(canPerform).toBe(true);
            });
        });

        it('should block all blocked actions', () => {
            RegulatoryModeGuard.BLOCKED_ACTIONS.forEach(action => {
                const canPerform = RegulatoryModeGuard.canPerformAction(action, true);
                expect(canPerform).toBe(false);
            });
        });
    });

    describe('filterPrompt', () => {
        it('should remove forbidden verbs from prompt', () => {
            const prompt = 'Create a new task and execute it';
            const filtered = RegulatoryModeGuard.filterPrompt(prompt, true);

            expect(filtered).not.toContain('create');
            expect(filtered).not.toContain('execute');
        });

        it('should add advisory language', () => {
            const prompt = 'Create a new task';
            const filtered = RegulatoryModeGuard.filterPrompt(prompt, true);

            // Should contain advisory phrases
            const hasAdvisory = RegulatoryModeGuard.ADVISORY_PHRASES.some(phrase =>
                filtered.toLowerCase().includes(phrase.toLowerCase())
            );
            expect(hasAdvisory).toBe(true);
        });

        it('should not modify prompt when regulatory mode disabled', () => {
            const prompt = 'Create a new task';
            const filtered = RegulatoryModeGuard.filterPrompt(prompt, false);

            expect(filtered).toBe(prompt);
        });
    });

    describe('setEnabled', () => {
        it('should enable regulatory mode for project', async () => {
            await dbRun(
                `INSERT INTO projects (id, name, organization_id, created_at)
                 VALUES (?, ?, ?, datetime('now'))`,
                [testProjectId, 'Test Project', uuidv4()]
            );

            await RegulatoryModeGuard.setEnabled(testProjectId, true);

            const enabled = await RegulatoryModeGuard.isEnabled(testProjectId);
            expect(enabled).toBe(true);
        });

        it('should disable regulatory mode for project', async () => {
            await dbRun(
                `INSERT INTO projects (id, name, organization_id, regulatory_mode_enabled, created_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [testProjectId, 'Test Project', uuidv4(), 1]
            );

            await RegulatoryModeGuard.setEnabled(testProjectId, false);

            const enabled = await RegulatoryModeGuard.isEnabled(testProjectId);
            expect(enabled).toBe(false);
        });
    });
});
