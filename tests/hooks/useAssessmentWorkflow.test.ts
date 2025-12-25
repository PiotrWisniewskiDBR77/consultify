/**
 * Hook Tests: useAssessmentWorkflow
 * Complete test coverage for the assessment workflow hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAssessmentWorkflow } from '../../hooks/useAssessmentWorkflow';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
    getItem: vi.fn(() => 'mock-token'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage
});

describe('useAssessmentWorkflow', () => {
    const mockWorkflowStatus = {
        id: 'workflow-123',
        assessmentId: 'assessment-123',
        projectId: 'project-456',
        organizationId: 'org-789',
        status: 'DRAFT',
        currentVersion: 1,
        createdBy: 'user-001',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-15',
        completedReviews: 0,
        totalReviews: 0,
        reviewProgress: 0,
        canSubmitForReview: true,
        canApprove: false
    };

    const mockReviews = [
        {
            id: 'review-1',
            workflowId: 'workflow-123',
            assessmentId: 'assessment-123',
            reviewerId: 'reviewer-1',
            reviewerName: 'John Reviewer',
            status: 'PENDING',
            assignedAt: '2024-01-10'
        }
    ];

    const mockVersions = [
        {
            id: 'version-1',
            assessmentId: 'assessment-123',
            version: 1,
            data: {},
            createdAt: '2024-01-01',
            createdBy: 'user-001'
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();

        // Default success response
        mockFetch.mockImplementation((url: string) => {
            if (url.includes('/status')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockWorkflowStatus)
                });
            }
            if (url.includes('/pending-reviews')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ reviews: mockReviews })
                });
            }
            if (url.includes('/versions')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ versions: mockVersions })
                });
            }
            if (url.includes('/history')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ history: [] })
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({})
            });
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // INITIALIZATION TESTS
    // =========================================================================

    describe('Initialization', () => {
        it('should initialize with null workflow status', () => {
            const { result } = renderHook(() => useAssessmentWorkflow(null));

            expect(result.current.workflowStatus).toBeNull();
            expect(result.current.isLoading).toBe(false);
        });

        it('should fetch workflow status on mount when assessmentId provided', async () => {
            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.workflowStatus).not.toBeNull();
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/assessment-123/status'),
                expect.any(Object)
            );
        });

        it('should not fetch when assessmentId is null', () => {
            renderHook(() => useAssessmentWorkflow(null));

            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // WORKFLOW STATUS TESTS
    // =========================================================================

    describe('Workflow Status', () => {
        it('should set workflow status after fetch', async () => {
            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.workflowStatus?.status).toBe('DRAFT');
            });
        });

        it('should expose canSubmitForReview from status', async () => {
            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.canSubmitForReview).toBe(true);
            });
        });

        it('should expose canApprove from status', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    ...mockWorkflowStatus,
                    status: 'AWAITING_APPROVAL',
                    canApprove: true
                })
            }));

            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.canApprove).toBe(true);
            });
        });

        it('should calculate canReject correctly', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    ...mockWorkflowStatus,
                    status: 'IN_REVIEW'
                })
            }));

            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.canReject).toBe(true);
            });
        });
    });

    // =========================================================================
    // LOADING AND ERROR STATES
    // =========================================================================

    describe('Loading and Error States', () => {
        it('should set isLoading during fetch', async () => {
            let resolvePromise: Function;
            mockFetch.mockImplementation(() => new Promise(resolve => {
                resolvePromise = () => resolve({
                    ok: true,
                    json: () => Promise.resolve(mockWorkflowStatus)
                });
            }));

            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            // Initially loading
            expect(result.current.isLoading).toBe(true);

            // Resolve and wait
            act(() => {
                resolvePromise!();
            });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });
        });

        it('should set error on fetch failure', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: false,
                statusText: 'Not Found',
                json: () => Promise.resolve({ error: 'Workflow not found' })
            }));

            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.error).toBe('Workflow not found');
            });
        });

        it('should clear error with clearError', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: false,
                json: () => Promise.resolve({ error: 'Test error' })
            }));

            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.error).toBeTruthy();
            });

            act(() => {
                result.current.clearError();
            });

            expect(result.current.error).toBeNull();
        });
    });

    // =========================================================================
    // FETCH FUNCTIONS TESTS
    // =========================================================================

    describe('Fetch Functions', () => {
        it('should fetch reviews', async () => {
            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.workflowStatus).not.toBeNull();
            });

            await act(async () => {
                await result.current.fetchReviews();
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/pending-reviews'),
                expect.any(Object)
            );
        });

        it('should fetch versions', async () => {
            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.workflowStatus).not.toBeNull();
            });

            await act(async () => {
                await result.current.fetchVersions();
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/versions'),
                expect.any(Object)
            );
        });

        it('should fetch history', async () => {
            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.workflowStatus).not.toBeNull();
            });

            await act(async () => {
                await result.current.fetchHistory();
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/history'),
                expect.any(Object)
            );
        });
    });

    // =========================================================================
    // INITIALIZE WORKFLOW TESTS
    // =========================================================================

    describe('initializeWorkflow', () => {
        it('should call initialize endpoint', async () => {
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                if (options?.method === 'POST' && url.includes('/initialize')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve(mockWorkflowStatus)
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(null)
                });
            });

            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            let initResult;
            await act(async () => {
                initResult = await result.current.initializeWorkflow();
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/initialize'),
                expect.objectContaining({ method: 'POST' })
            );
            expect(initResult).toMatchObject(mockWorkflowStatus);
        });

        it('should return null when assessmentId is null', async () => {
            const { result } = renderHook(() => useAssessmentWorkflow(null));

            let initResult;
            await act(async () => {
                initResult = await result.current.initializeWorkflow();
            });

            expect(initResult).toBeNull();
        });
    });

    // =========================================================================
    // SUBMIT FOR REVIEW TESTS
    // =========================================================================

    describe('submitForReview', () => {
        it('should call submit-for-review endpoint', async () => {
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                if (url.includes('/submit-for-review')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            success: true,
                            workflow: { ...mockWorkflowStatus, status: 'IN_REVIEW' }
                        })
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockWorkflowStatus)
                });
            });

            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.workflowStatus).not.toBeNull();
            });

            let submitResult;
            await act(async () => {
                submitResult = await result.current.submitForReview(['reviewer-1', 'reviewer-2']);
            });

            expect(submitResult).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/submit-for-review'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('reviewer-1')
                })
            );
        });

        it('should return false when assessmentId is null', async () => {
            const { result } = renderHook(() => useAssessmentWorkflow(null));

            let submitResult;
            await act(async () => {
                submitResult = await result.current.submitForReview(['reviewer-1']);
            });

            expect(submitResult).toBe(false);
        });
    });

    // =========================================================================
    // APPROVE TESTS
    // =========================================================================

    describe('approve', () => {
        it('should call approve endpoint', async () => {
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                if (url.includes('/approve') && options?.method === 'POST') {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            success: true,
                            workflow: { ...mockWorkflowStatus, status: 'APPROVED' }
                        })
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockWorkflowStatus)
                });
            });

            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.workflowStatus).not.toBeNull();
            });

            let approveResult;
            await act(async () => {
                approveResult = await result.current.approve('Looks good!');
            });

            expect(approveResult).toBe(true);
        });

        it('should include comments in request body', async () => {
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                if (url.includes('/approve')) {
                    const body = JSON.parse(options?.body as string);
                    expect(body.comments).toBe('Approval comments');
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ success: true, workflow: mockWorkflowStatus })
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockWorkflowStatus)
                });
            });

            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.workflowStatus).not.toBeNull();
            });

            await act(async () => {
                await result.current.approve('Approval comments');
            });
        });
    });

    // =========================================================================
    // REJECT TESTS
    // =========================================================================

    describe('reject', () => {
        it('should call reject endpoint', async () => {
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                if (url.includes('/reject')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            success: true,
                            workflow: { ...mockWorkflowStatus, status: 'REJECTED' }
                        })
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockWorkflowStatus)
                });
            });

            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.workflowStatus).not.toBeNull();
            });

            let rejectResult;
            await act(async () => {
                rejectResult = await result.current.reject('Missing justifications');
            });

            expect(rejectResult).toBe(true);
        });
    });

    // =========================================================================
    // SUBMIT REVIEW TESTS
    // =========================================================================

    describe('submitReview', () => {
        it('should call reviews submit endpoint', async () => {
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                if (url.includes('/reviews/') && url.includes('/submit')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ success: true })
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockWorkflowStatus)
                });
            });

            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.workflowStatus).not.toBeNull();
            });

            let reviewResult;
            await act(async () => {
                reviewResult = await result.current.submitReview('review-1', 'Looks good', 4);
            });

            expect(reviewResult).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/reviews/review-1/submit'),
                expect.any(Object)
            );
        });
    });

    // =========================================================================
    // RESTORE VERSION TESTS
    // =========================================================================

    describe('restoreVersion', () => {
        it('should call restore endpoint', async () => {
            mockFetch.mockImplementation((url: string, options?: RequestInit) => {
                if (url.includes('/restore/1')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ success: true })
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockWorkflowStatus)
                });
            });

            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.workflowStatus).not.toBeNull();
            });

            let restoreResult;
            await act(async () => {
                restoreResult = await result.current.restoreVersion(1);
            });

            expect(restoreResult).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/restore/1'),
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('should return false when assessmentId is null', async () => {
            const { result } = renderHook(() => useAssessmentWorkflow(null));

            let restoreResult;
            await act(async () => {
                restoreResult = await result.current.restoreVersion(1);
            });

            expect(restoreResult).toBe(false);
        });
    });

    // =========================================================================
    // COMPUTED PROPERTIES TESTS
    // =========================================================================

    describe('Computed Properties', () => {
        it('should compute reviewProgress', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    ...mockWorkflowStatus,
                    reviewProgress: 50
                })
            }));

            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.reviewProgress).toBe(50);
            });
        });

        it('should compute isOverdue', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    ...mockWorkflowStatus,
                    isOverdue: true
                })
            }));

            const { result } = renderHook(() => useAssessmentWorkflow('assessment-123'));

            await waitFor(() => {
                expect(result.current.isOverdue).toBe(true);
            });
        });
    });

    // =========================================================================
    // ASSESSMENT ID CHANGE TESTS
    // =========================================================================

    describe('Assessment ID Change', () => {
        it('should refetch when assessmentId changes', async () => {
            const { result, rerender } = renderHook(
                ({ id }) => useAssessmentWorkflow(id),
                { initialProps: { id: 'assessment-123' } }
            );

            await waitFor(() => {
                expect(result.current.workflowStatus).not.toBeNull();
            });

            // Clear and change ID
            mockFetch.mockClear();

            rerender({ id: 'assessment-456' });

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.stringContaining('/assessment-456/status'),
                    expect.any(Object)
                );
            });
        });
    });
});

