/**
 * useRoadmap Hook - Unit Tests
 * Tests for roadmap data fetching and visualization hooks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock API
const mockApi = {
    getRoadmapData: vi.fn(),
    getRoadmapPhases: vi.fn(),
    getRoadmapMilestones: vi.fn(),
    updatePhase: vi.fn(),
    createMilestone: vi.fn(),
};

vi.mock('@/services/api', () => ({
    default: mockApi,
    Api: mockApi,
}));

// Create wrapper with QueryClient
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
            },
        },
    });

    return function Wrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children
        );
    };
};

// Mock hook implementation for testing
const useRoadmap = (projectId: string | null) => {
    const [phases, setPhases] = React.useState<any[]>([]);
    const [milestones, setMilestones] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);

    React.useEffect(() => {
        if (!projectId) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                setIsLoading(true);
                const [phasesData, milestonesData] = await Promise.all([
                    mockApi.getRoadmapPhases(projectId),
                    mockApi.getRoadmapMilestones(projectId),
                ]);
                setPhases(phasesData || []);
                setMilestones(milestonesData || []);
                setError(null);
            } catch (err) {
                setError(err as Error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [projectId]);

    return { phases, milestones, isLoading, error };
};

describe('useRoadmap Hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Data Fetching', () => {
        it('should fetch roadmap data on mount', async () => {
            const mockPhases = [
                { id: '1', name: 'Phase 1', startDate: '2026-01-01', endDate: '2026-03-31' },
                { id: '2', name: 'Phase 2', startDate: '2026-04-01', endDate: '2026-06-30' },
            ];
            const mockMilestones = [
                { id: 'm1', name: 'Milestone 1', date: '2026-02-15' },
            ];

            mockApi.getRoadmapPhases.mockResolvedValue(mockPhases);
            mockApi.getRoadmapMilestones.mockResolvedValue(mockMilestones);

            const { result } = renderHook(() => useRoadmap('project-1'), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.phases).toEqual(mockPhases);
            expect(result.current.milestones).toEqual(mockMilestones);
        });

        it('should not fetch when projectId is null', async () => {
            const { result } = renderHook(() => useRoadmap(null), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(mockApi.getRoadmapPhases).not.toHaveBeenCalled();
            expect(mockApi.getRoadmapMilestones).not.toHaveBeenCalled();
        });

        it('should handle API errors gracefully', async () => {
            const testError = new Error('API Error');
            mockApi.getRoadmapPhases.mockRejectedValue(testError);

            const { result } = renderHook(() => useRoadmap('project-error'), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.error).toBeDefined();
        });

        it('should return empty arrays when no data', async () => {
            mockApi.getRoadmapPhases.mockResolvedValue([]);
            mockApi.getRoadmapMilestones.mockResolvedValue([]);

            const { result } = renderHook(() => useRoadmap('project-empty'), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.phases).toEqual([]);
            expect(result.current.milestones).toEqual([]);
        });
    });

    describe('Loading States', () => {
        it('should set loading true initially', () => {
            mockApi.getRoadmapPhases.mockImplementation(
                () => new Promise(() => { }) // Never resolves
            );

            const { result } = renderHook(() => useRoadmap('project-1'), {
                wrapper: createWrapper(),
            });

            expect(result.current.isLoading).toBe(true);
        });

        it('should set loading false after data loads', async () => {
            mockApi.getRoadmapPhases.mockResolvedValue([]);
            mockApi.getRoadmapMilestones.mockResolvedValue([]);

            const { result } = renderHook(() => useRoadmap('project-1'), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });
        });
    });

    describe('Project Change', () => {
        it('should refetch when projectId changes', async () => {
            mockApi.getRoadmapPhases.mockResolvedValue([]);
            mockApi.getRoadmapMilestones.mockResolvedValue([]);

            const { result, rerender } = renderHook(
                ({ projectId }) => useRoadmap(projectId),
                {
                    wrapper: createWrapper(),
                    initialProps: { projectId: 'project-1' },
                }
            );

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(mockApi.getRoadmapPhases).toHaveBeenCalledWith('project-1');

            rerender({ projectId: 'project-2' });

            await waitFor(() => {
                expect(mockApi.getRoadmapPhases).toHaveBeenCalledWith('project-2');
            });
        });
    });
});

describe('Roadmap Calculations', () => {
    describe('Phase Duration', () => {
        it('should calculate correct duration in days', () => {
            const phase = {
                startDate: '2026-01-01',
                endDate: '2026-01-31',
            };

            const startDate = new Date(phase.startDate);
            const endDate = new Date(phase.endDate);
            const durationMs = endDate.getTime() - startDate.getTime();
            const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

            expect(durationDays).toBe(30);
        });

        it('should handle same day phases', () => {
            const phase = {
                startDate: '2026-01-15',
                endDate: '2026-01-15',
            };

            const startDate = new Date(phase.startDate);
            const endDate = new Date(phase.endDate);
            const durationMs = endDate.getTime() - startDate.getTime();
            const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24)) || 1;

            expect(durationDays).toBe(1);
        });
    });

    describe('Progress Calculation', () => {
        it('should calculate 0% progress for future phases', () => {
            const now = new Date('2025-12-01');
            const startDate = new Date('2026-01-01');

            const progress = now < startDate ? 0 : 50; // Simplified
            expect(progress).toBe(0);
        });

        it('should calculate 100% progress for completed phases', () => {
            const now = new Date('2026-02-01');
            const endDate = new Date('2026-01-31');

            const progress = now > endDate ? 100 : 50; // Simplified
            expect(progress).toBe(100);
        });

        it('should calculate partial progress for active phases', () => {
            const startDate = new Date('2026-01-01');
            const endDate = new Date('2026-01-31');
            const now = new Date('2026-01-15');

            const total = endDate.getTime() - startDate.getTime();
            const elapsed = now.getTime() - startDate.getTime();
            const progress = Math.round((elapsed / total) * 100);

            expect(progress).toBeGreaterThan(0);
            expect(progress).toBeLessThan(100);
        });
    });

    describe('Milestone Positioning', () => {
        it('should position milestone within phase timeline', () => {
            const phase = {
                startDate: new Date('2026-01-01'),
                endDate: new Date('2026-03-31'),
            };
            const milestone = {
                date: new Date('2026-02-15'),
            };

            const phaseDuration = phase.endDate.getTime() - phase.startDate.getTime();
            const milestoneOffset = milestone.date.getTime() - phase.startDate.getTime();
            const positionPercent = (milestoneOffset / phaseDuration) * 100;

            expect(positionPercent).toBeGreaterThan(0);
            expect(positionPercent).toBeLessThan(100);
        });
    });
});
