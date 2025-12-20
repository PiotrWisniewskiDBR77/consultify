/**
 * HelpService Unit Tests
 * 
 * Tests for the In-App Help + Training + Playbooks system.
 * Step 6: Enterprise+ Ready
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Test the constants and validation logic without needing to mock the database
describe('HelpService Constants and Validation', () => {
    // We'll test the exported constants which don't require DB connection
    let HelpService;

    beforeEach(async () => {
        // Dynamic import to allow mocking
        HelpService = (await import('../../../server/services/helpService')).default;
    });

    describe('EVENT_TYPES', () => {
        it('should define all required event types', () => {
            expect(HelpService.EVENT_TYPES).toBeDefined();
            expect(HelpService.EVENT_TYPES.VIEWED).toBe('VIEWED');
            expect(HelpService.EVENT_TYPES.STARTED).toBe('STARTED');
            expect(HelpService.EVENT_TYPES.COMPLETED).toBe('COMPLETED');
            expect(HelpService.EVENT_TYPES.DISMISSED).toBe('DISMISSED');
        });

        it('should have exactly 4 event types', () => {
            const types = Object.values(HelpService.EVENT_TYPES);
            expect(types).toHaveLength(4);
        });
    });

    describe('TARGET_ROLES', () => {
        it('should define all valid target roles', () => {
            expect(HelpService.TARGET_ROLES).toContain('ADMIN');
            expect(HelpService.TARGET_ROLES).toContain('USER');
            expect(HelpService.TARGET_ROLES).toContain('SUPERADMIN');
            expect(HelpService.TARGET_ROLES).toContain('PARTNER');
            expect(HelpService.TARGET_ROLES).toContain('ANY');
        });

        it('should have exactly 5 roles', () => {
            expect(HelpService.TARGET_ROLES).toHaveLength(5);
        });
    });

    describe('TARGET_ORG_TYPES', () => {
        it('should define all valid org types', () => {
            expect(HelpService.TARGET_ORG_TYPES).toContain('DEMO');
            expect(HelpService.TARGET_ORG_TYPES).toContain('TRIAL');
            expect(HelpService.TARGET_ORG_TYPES).toContain('PAID');
            expect(HelpService.TARGET_ORG_TYPES).toContain('ANY');
        });

        it('should have exactly 4 org types', () => {
            expect(HelpService.TARGET_ORG_TYPES).toHaveLength(4);
        });
    });

    describe('Input Validation', () => {
        it('should reject invalid event types in markEvent', async () => {
            await expect(
                HelpService.markEvent('user-123', 'org-123', 'test', 'INVALID_TYPE')
            ).rejects.toThrow('Invalid event type');
        });

        it('should reject createPlaybook without key', async () => {
            await expect(
                HelpService.createPlaybook({ title: 'No Key' })
            ).rejects.toThrow('key and title are required');
        });

        it('should reject createPlaybook without title', async () => {
            await expect(
                HelpService.createPlaybook({ key: 'no_title' })
            ).rejects.toThrow('key and title are required');
        });

        it('should reject createPlaybook with invalid target role', async () => {
            await expect(
                HelpService.createPlaybook({
                    key: 'test_key',
                    title: 'Test Title',
                    targetRole: 'INVALID_ROLE'
                })
            ).rejects.toThrow('Invalid target_role');
        });

        it('should reject createPlaybook with invalid org type', async () => {
            await expect(
                HelpService.createPlaybook({
                    key: 'test_key',
                    title: 'Test Title',
                    targetOrgType: 'INVALID_TYPE'
                })
            ).rejects.toThrow('Invalid target_org_type');
        });

        it('should reject createStep without required fields', async () => {
            await expect(
                HelpService.createStep({ playbookId: 'pb-123' })
            ).rejects.toThrow('title, and contentMd are required');
        });

        it('should reject createStep with invalid action type', async () => {
            await expect(
                HelpService.createStep({
                    playbookId: 'pb-123',
                    title: 'Test Step',
                    contentMd: 'Content here',
                    actionType: 'INVALID_ACTION'
                })
            ).rejects.toThrow('Invalid action_type');
        });
    });
});
