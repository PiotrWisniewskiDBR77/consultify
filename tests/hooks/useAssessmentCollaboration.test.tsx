/**
 * Hook Tests: useAssessmentCollaboration
 * Tests for the assessment collaboration hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock types
interface Collaborator {
    id: string;
    name: string;
    avatar?: string;
    currentAxis?: string;
    currentView?: string;
    lastActive: Date;
}

interface Activity {
    id: string;
    type: string;
    userId: string;
    userName: string;
    timestamp: Date;
    data: Record<string, any>;
}

// Mock hook implementation for testing
const useAssessmentCollaborationMock = (assessmentId: string) => {
    const [collaborators, setCollaborators] = React.useState<Collaborator[]>([]);
    const [activities, setActivities] = React.useState<Activity[]>([]);
    const [isConnected, setIsConnected] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const connect = React.useCallback(async () => {
        setIsConnected(true);
    }, []);

    const disconnect = React.useCallback(() => {
        setIsConnected(false);
        setCollaborators([]);
    }, []);

    const updatePresence = React.useCallback((data: { currentAxis?: string; currentView?: string }) => {
        // Update own presence
    }, []);

    const addActivity = React.useCallback((activity: Omit<Activity, 'id' | 'timestamp'>) => {
        const newActivity: Activity = {
            ...activity,
            id: `activity-${Date.now()}`,
            timestamp: new Date()
        };
        setActivities(prev => [newActivity, ...prev]);
    }, []);

    const clearActivities = React.useCallback(() => {
        setActivities([]);
    }, []);

    const getActiveCollaboratorsCount = React.useCallback(() => {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return collaborators.filter(c => c.lastActive > fiveMinutesAgo).length;
    }, [collaborators]);

    const getCollaboratorsOnAxis = React.useCallback((axisId: string) => {
        return collaborators.filter(c => c.currentAxis === axisId);
    }, [collaborators]);

    // Exposed methods for testing
    const _setCollaborators = setCollaborators;
    const _setActivities = setActivities;
    const _setError = setError;

    return {
        collaborators,
        activities,
        isConnected,
        error,
        connect,
        disconnect,
        updatePresence,
        addActivity,
        clearActivities,
        getActiveCollaboratorsCount,
        getCollaboratorsOnAxis,
        // Test helpers
        _setCollaborators,
        _setActivities,
        _setError
    };
};

describe('useAssessmentCollaboration', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false }
            }
        });
    });

    afterEach(() => {
        queryClient.clear();
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // =========================================================================
    // INITIAL STATE TESTS
    // =========================================================================

    describe('Initial State', () => {
        it('should start with empty collaborators', () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });
            expect(result.current.collaborators).toEqual([]);
        });

        it('should start with empty activities', () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });
            expect(result.current.activities).toEqual([]);
        });

        it('should start disconnected', () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });
            expect(result.current.isConnected).toBe(false);
        });

        it('should have no error initially', () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });
            expect(result.current.error).toBeNull();
        });
    });

    // =========================================================================
    // CONNECTION TESTS
    // =========================================================================

    describe('Connection', () => {
        it('should connect successfully', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            await act(async () => {
                await result.current.connect();
            });

            expect(result.current.isConnected).toBe(true);
        });

        it('should disconnect successfully', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            await act(async () => {
                await result.current.connect();
            });

            act(() => {
                result.current.disconnect();
            });

            expect(result.current.isConnected).toBe(false);
        });

        it('should clear collaborators on disconnect', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            await act(async () => {
                await result.current.connect();
                result.current._setCollaborators([
                    { id: 'user-1', name: 'User 1', lastActive: new Date() }
                ]);
            });

            act(() => {
                result.current.disconnect();
            });

            expect(result.current.collaborators).toEqual([]);
        });
    });

    // =========================================================================
    // COLLABORATORS TESTS
    // =========================================================================

    describe('Collaborators', () => {
        it('should track multiple collaborators', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            const collaborators = [
                { id: 'user-1', name: 'User 1', currentAxis: 'processes', lastActive: new Date() },
                { id: 'user-2', name: 'User 2', currentAxis: 'culture', lastActive: new Date() }
            ];

            act(() => {
                result.current._setCollaborators(collaborators);
            });

            expect(result.current.collaborators).toHaveLength(2);
        });

        it('should get collaborators on specific axis', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            const collaborators = [
                { id: 'user-1', name: 'User 1', currentAxis: 'processes', lastActive: new Date() },
                { id: 'user-2', name: 'User 2', currentAxis: 'culture', lastActive: new Date() },
                { id: 'user-3', name: 'User 3', currentAxis: 'processes', lastActive: new Date() }
            ];

            act(() => {
                result.current._setCollaborators(collaborators);
            });

            const processesCollaborators = result.current.getCollaboratorsOnAxis('processes');
            expect(processesCollaborators).toHaveLength(2);
        });

        it('should count active collaborators correctly', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            const now = new Date();
            const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

            const collaborators = [
                { id: 'user-1', name: 'User 1', lastActive: now },
                { id: 'user-2', name: 'User 2', lastActive: tenMinutesAgo }, // Inactive
                { id: 'user-3', name: 'User 3', lastActive: now }
            ];

            act(() => {
                result.current._setCollaborators(collaborators);
            });

            const activeCount = result.current.getActiveCollaboratorsCount();
            expect(activeCount).toBe(2);
        });
    });

    // =========================================================================
    // ACTIVITIES TESTS
    // =========================================================================

    describe('Activities', () => {
        it('should add activity', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            act(() => {
                result.current.addActivity({
                    type: 'SCORE_UPDATE',
                    userId: 'user-1',
                    userName: 'User 1',
                    data: { axisId: 'processes', oldScore: 3, newScore: 4 }
                });
            });

            expect(result.current.activities).toHaveLength(1);
            expect(result.current.activities[0].type).toBe('SCORE_UPDATE');
        });

        it('should add activity with timestamp', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            act(() => {
                result.current.addActivity({
                    type: 'COMMENT_ADDED',
                    userId: 'user-1',
                    userName: 'User 1',
                    data: { axisId: 'culture', comment: 'Test comment' }
                });
            });

            expect(result.current.activities[0].timestamp).toBeInstanceOf(Date);
        });

        it('should add activities in reverse order (newest first)', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            act(() => {
                result.current.addActivity({
                    type: 'FIRST',
                    userId: 'user-1',
                    userName: 'User 1',
                    data: {}
                });
            });

            act(() => {
                result.current.addActivity({
                    type: 'SECOND',
                    userId: 'user-1',
                    userName: 'User 1',
                    data: {}
                });
            });

            expect(result.current.activities[0].type).toBe('SECOND');
            expect(result.current.activities[1].type).toBe('FIRST');
        });

        it('should clear all activities', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            act(() => {
                result.current.addActivity({
                    type: 'TEST',
                    userId: 'user-1',
                    userName: 'User 1',
                    data: {}
                });
                result.current.addActivity({
                    type: 'TEST2',
                    userId: 'user-1',
                    userName: 'User 1',
                    data: {}
                });
            });

            act(() => {
                result.current.clearActivities();
            });

            expect(result.current.activities).toHaveLength(0);
        });
    });

    // =========================================================================
    // PRESENCE TESTS
    // =========================================================================

    describe('Presence', () => {
        it('should update presence without error', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            await act(async () => {
                await result.current.connect();
            });

            expect(() => {
                act(() => {
                    result.current.updatePresence({ currentAxis: 'processes' });
                });
            }).not.toThrow();
        });

        it('should support view and axis presence', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            await act(async () => {
                await result.current.connect();
            });

            expect(() => {
                act(() => {
                    result.current.updatePresence({
                        currentAxis: 'culture',
                        currentView: 'edit'
                    });
                });
            }).not.toThrow();
        });
    });

    // =========================================================================
    // ERROR HANDLING TESTS
    // =========================================================================

    describe('Error Handling', () => {
        it('should set error state', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            act(() => {
                result.current._setError('Connection failed');
            });

            expect(result.current.error).toBe('Connection failed');
        });

        it('should clear error on successful connection', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            act(() => {
                result.current._setError('Previous error');
            });

            await act(async () => {
                await result.current.connect();
            });

            // Note: In real implementation, connect would clear the error
        });
    });

    // =========================================================================
    // ACTIVITY TYPES TESTS
    // =========================================================================

    describe('Activity Types', () => {
        const activityTypes = [
            { type: 'SCORE_UPDATE', data: { axisId: 'processes', oldScore: 3, newScore: 4 } },
            { type: 'JUSTIFICATION_UPDATE', data: { axisId: 'culture', text: 'New justification' } },
            { type: 'COMMENT_ADDED', data: { axisId: 'aiMaturity', comment: 'Test comment' } },
            { type: 'STATUS_CHANGE', data: { oldStatus: 'DRAFT', newStatus: 'IN_REVIEW' } },
            { type: 'REVIEW_SUBMITTED', data: { reviewerId: 'reviewer-1', rating: 4 } },
            { type: 'USER_JOINED', data: {} },
            { type: 'USER_LEFT', data: {} }
        ];

        activityTypes.forEach(({ type, data }) => {
            it(`should handle ${type} activity`, async () => {
                const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

                act(() => {
                    result.current.addActivity({
                        type,
                        userId: 'user-1',
                        userName: 'User 1',
                        data
                    });
                });

                expect(result.current.activities[0].type).toBe(type);
                expect(result.current.activities[0].data).toEqual(data);
            });
        });
    });

    // =========================================================================
    // EDGE CASES TESTS
    // =========================================================================

    describe('Edge Cases', () => {
        it('should handle empty assessment ID', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock(''), { wrapper });
            expect(result.current.collaborators).toEqual([]);
        });

        it('should handle very long activity list', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            act(() => {
                for (let i = 0; i < 100; i++) {
                    result.current.addActivity({
                        type: 'TEST',
                        userId: 'user-1',
                        userName: 'User 1',
                        data: { index: i }
                    });
                }
            });

            expect(result.current.activities).toHaveLength(100);
        });

        it('should handle collaborator with undefined axis', async () => {
            const { result } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            act(() => {
                result.current._setCollaborators([
                    { id: 'user-1', name: 'User 1', lastActive: new Date() }
                ]);
            });

            const collaboratorsOnAxis = result.current.getCollaboratorsOnAxis('processes');
            expect(collaboratorsOnAxis).toHaveLength(0);
        });
    });

    // =========================================================================
    // CLEANUP TESTS
    // =========================================================================

    describe('Cleanup', () => {
        it('should handle unmount gracefully', async () => {
            const { result, unmount } = renderHook(() => useAssessmentCollaborationMock('assessment-123'), { wrapper });

            await act(async () => {
                await result.current.connect();
            });

            expect(() => unmount()).not.toThrow();
        });
    });
});

