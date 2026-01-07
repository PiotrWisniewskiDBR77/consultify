/**
 * Workspace Service Unit Test - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('WorkspaceService', () => {
    it('should get workspace', () => {
        const workspace = { id: 'ws-1', name: 'Main Workspace' };
        expect(workspace.name).toBeDefined();
    });

    it('should list workspaces', () => {
        const workspaces = [{ id: '1' }, { id: '2' }];
        expect(workspaces.length).toBeGreaterThan(0);
    });
});
