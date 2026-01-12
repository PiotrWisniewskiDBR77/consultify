/**
 * Tests for useConversationStore display mode extensions
 * Part of Unified AI Chat System
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useConversationStore } from '../../store/useConversationStore';
import { AppView } from '../../types';
import { createWorkspaceContext, getDefaultWorkspaceType } from '../../types/workspace';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useConversationStore - Display Mode Extensions', () => {
    beforeEach(() => {
        localStorageMock.clear();
        // Reset the store state
        const { result } = renderHook(() => useConversationStore());
        act(() => {
            result.current.setDisplayMode('full');
            result.current.setWorkspaceContext(null);
            result.current.setPreviousView(null);
        });
    });

    describe('setDisplayMode', () => {
        it('should set display mode to full', () => {
            const { result } = renderHook(() => useConversationStore());
            
            act(() => {
                result.current.setDisplayMode('full');
            });
            
            expect(result.current.displayMode).toBe('full');
        });

        it('should set display mode to split', () => {
            const { result } = renderHook(() => useConversationStore());
            
            act(() => {
                result.current.setDisplayMode('split');
            });
            
            expect(result.current.displayMode).toBe('split');
        });

        it('should set display mode to collapsed', () => {
            const { result } = renderHook(() => useConversationStore());
            
            act(() => {
                result.current.setDisplayMode('collapsed');
            });
            
            expect(result.current.displayMode).toBe('collapsed');
        });
    });

    describe('setWorkspaceContext', () => {
        it('should set workspace context', () => {
            const { result } = renderHook(() => useConversationStore());
            
            const context = createWorkspaceContext(AppView.MY_WORK, 'task', {
                entityId: 'task-123'
            });
            
            act(() => {
                result.current.setWorkspaceContext(context);
            });
            
            expect(result.current.workspaceContext).toBeDefined();
            expect(result.current.workspaceContext?.view).toBe(AppView.MY_WORK);
            expect(result.current.workspaceContext?.type).toBe('task');
            expect(result.current.workspaceContext?.entityId).toBe('task-123');
        });

        it('should clear workspace context when null is passed', () => {
            const { result } = renderHook(() => useConversationStore());
            
            // First set a context
            const context = createWorkspaceContext(AppView.MY_WORK, 'task');
            act(() => {
                result.current.setWorkspaceContext(context);
            });
            
            // Then clear it
            act(() => {
                result.current.setWorkspaceContext(null);
            });
            
            expect(result.current.workspaceContext).toBeNull();
        });
    });

    describe('updateWorkspaceFromView', () => {
        it('should create workspace context from view and set split mode', () => {
            const { result } = renderHook(() => useConversationStore());
            
            act(() => {
                result.current.updateWorkspaceFromView(AppView.MY_WORK, 'task-456');
            });
            
            expect(result.current.displayMode).toBe('split');
            expect(result.current.workspaceContext).toBeDefined();
            expect(result.current.workspaceContext?.view).toBe(AppView.MY_WORK);
            expect(result.current.workspaceContext?.entityId).toBe('task-456');
        });

        it('should infer workspace type from view', () => {
            const { result } = renderHook(() => useConversationStore());
            
            act(() => {
                result.current.updateWorkspaceFromView(AppView.FULL_STEP2_INITIATIVES);
            });
            
            expect(result.current.workspaceContext?.type).toBe('initiative');
        });
    });

    describe('expandToFullScreen', () => {
        it('should set display mode to full and save previous view', () => {
            const { result } = renderHook(() => useConversationStore());
            
            // Start in split mode with context
            const context = createWorkspaceContext(AppView.MY_WORK, 'task');
            act(() => {
                result.current.setWorkspaceContext(context);
                result.current.setDisplayMode('split');
            });
            
            act(() => {
                result.current.expandToFullScreen();
            });
            
            expect(result.current.displayMode).toBe('full');
            expect(result.current.previousView).toBe(AppView.MY_WORK);
        });
    });

    describe('collapseToSplit', () => {
        it('should set display mode to split', () => {
            const { result } = renderHook(() => useConversationStore());
            
            act(() => {
                result.current.setDisplayMode('full');
            });
            
            act(() => {
                result.current.collapseToSplit();
            });
            
            expect(result.current.displayMode).toBe('split');
        });

        it('should update workspace context if partial context provided', () => {
            const { result } = renderHook(() => useConversationStore());
            
            act(() => {
                result.current.collapseToSplit({
                    view: AppView.ASSESSMENT_DRD,
                    type: 'assessment'
                });
            });
            
            expect(result.current.workspaceContext?.view).toBe(AppView.ASSESSMENT_DRD);
            expect(result.current.workspaceContext?.type).toBe('assessment');
        });
    });

    describe('isSplitMode', () => {
        it('should return true when in split mode', () => {
            const { result } = renderHook(() => useConversationStore());
            
            act(() => {
                result.current.setDisplayMode('split');
            });
            
            expect(result.current.isSplitMode()).toBe(true);
        });

        it('should return false when in full mode', () => {
            const { result } = renderHook(() => useConversationStore());
            
            act(() => {
                result.current.setDisplayMode('full');
            });
            
            expect(result.current.isSplitMode()).toBe(false);
        });
    });
});

describe('Workspace Type Helpers', () => {
    describe('getDefaultWorkspaceType', () => {
        it('should return task for MY_WORK view', () => {
            expect(getDefaultWorkspaceType(AppView.MY_WORK)).toBe('task');
        });

        it('should return initiative for FULL_STEP2_INITIATIVES view', () => {
            expect(getDefaultWorkspaceType(AppView.FULL_STEP2_INITIATIVES)).toBe('initiative');
        });

        it('should return assessment for ASSESSMENT_DRD view', () => {
            expect(getDefaultWorkspaceType(AppView.ASSESSMENT_DRD)).toBe('assessment');
        });

        it('should return roadmap for PORTFOLIO_ROADMAP view', () => {
            expect(getDefaultWorkspaceType(AppView.PORTFOLIO_ROADMAP)).toBe('roadmap');
        });

        it('should return dashboard for DASHBOARD view', () => {
            expect(getDefaultWorkspaceType(AppView.DASHBOARD)).toBe('dashboard');
        });

        it('should return empty for unknown views', () => {
            expect(getDefaultWorkspaceType(AppView.AUTH)).toBe('empty');
        });
    });

    describe('createWorkspaceContext', () => {
        it('should create a complete workspace context', () => {
            const context = createWorkspaceContext(AppView.MY_WORK, 'task', {
                entityId: 'task-123',
                entityName: 'Important Task',
                projectId: 'proj-456'
            });

            expect(context.view).toBe(AppView.MY_WORK);
            expect(context.type).toBe('task');
            expect(context.entityId).toBe('task-123');
            expect(context.entityName).toBe('Important Task');
            expect(context.projectId).toBe('proj-456');
            expect(context.timestamp).toBeInstanceOf(Date);
        });

        it('should work with minimal parameters', () => {
            const context = createWorkspaceContext(AppView.DASHBOARD, 'dashboard');

            expect(context.view).toBe(AppView.DASHBOARD);
            expect(context.type).toBe('dashboard');
            expect(context.entityId).toBeUndefined();
            expect(context.timestamp).toBeInstanceOf(Date);
        });
    });
});

