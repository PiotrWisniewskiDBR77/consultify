/**
 * Component Tests: AssessmentWorkflowPanel
 * Complete test coverage for the workflow management panel
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { AssessmentWorkflowPanel } from '../../components/assessment/AssessmentWorkflowPanel';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

// Mock store
vi.mock('../../store/useAppStore', () => ({
    useAppStore: () => ({
        currentUser: {
            id: 'user-123',
            role: 'PROJECT_MANAGER',
            email: 'test@example.com'
        }
    })
}));

describe('AssessmentWorkflowPanel', () => {
    const defaultProps = {
        assessmentId: 'assessment-123',
        projectId: 'project-456',
        onStatusChange: vi.fn()
    };

    const mockWorkflowStatus = {
        id: 'workflow-123',
        status: 'DRAFT',
        current_version: 1,
        completed_reviews: 0,
        total_reviews: 0,
        canSubmitForReview: true,
        canApprove: false,
        reviewProgress: 0
    };

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Default mock responses
        mockedAxios.get.mockImplementation((url) => {
            if (url.includes('/status')) {
                return Promise.resolve({ data: mockWorkflowStatus });
            }
            if (url.includes('/versions')) {
                return Promise.resolve({ data: { versions: [] } });
            }
            if (url.includes('/pending-reviews')) {
                return Promise.resolve({ data: { reviews: [] } });
            }
            return Promise.resolve({ data: {} });
        });

        mockedAxios.post.mockResolvedValue({ data: { success: true } });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // LOADING STATE TESTS
    // =========================================================================

    describe('Loading State', () => {
        it('should show loading skeleton initially', () => {
            render(<AssessmentWorkflowPanel {...defaultProps} />);

            expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
        });

        it('should hide loading skeleton after data loads', async () => {
            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // STATUS DISPLAY TESTS
    // =========================================================================

    describe('Status Display', () => {
        it('should display DRAFT status correctly', async () => {
            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Draft/i)).toBeInTheDocument();
            });
        });

        it('should display IN_REVIEW status correctly', async () => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/status')) {
                    return Promise.resolve({ 
                        data: { ...mockWorkflowStatus, status: 'IN_REVIEW' } 
                    });
                }
                return Promise.resolve({ data: {} });
            });

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/In Review/i)).toBeInTheDocument();
            });
        });

        it('should display AWAITING_APPROVAL status correctly', async () => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/status')) {
                    return Promise.resolve({ 
                        data: { ...mockWorkflowStatus, status: 'AWAITING_APPROVAL', canApprove: true } 
                    });
                }
                return Promise.resolve({ data: {} });
            });

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Awaiting Approval/i)).toBeInTheDocument();
            });
        });

        it('should display APPROVED status correctly', async () => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/status')) {
                    return Promise.resolve({ 
                        data: { ...mockWorkflowStatus, status: 'APPROVED' } 
                    });
                }
                return Promise.resolve({ data: {} });
            });

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Approved/i)).toBeInTheDocument();
            });
        });

        it('should display REJECTED status with reason', async () => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/status')) {
                    return Promise.resolve({ 
                        data: { 
                            ...mockWorkflowStatus, 
                            status: 'REJECTED',
                            rejection_reason: 'Missing justifications'
                        } 
                    });
                }
                return Promise.resolve({ data: {} });
            });

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Rejected/i)).toBeInTheDocument();
                expect(screen.getByText(/Missing justifications/i)).toBeInTheDocument();
            });
        });

        it('should display version number', async () => {
            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/v1/i)).toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // REVIEW PROGRESS TESTS
    // =========================================================================

    describe('Review Progress', () => {
        it('should show review progress bar when IN_REVIEW', async () => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/status')) {
                    return Promise.resolve({ 
                        data: { 
                            ...mockWorkflowStatus, 
                            status: 'IN_REVIEW',
                            completed_reviews: 1,
                            total_reviews: 3,
                            reviewProgress: 33
                        } 
                    });
                }
                return Promise.resolve({ data: {} });
            });

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/1\/3 reviews completed/i)).toBeInTheDocument();
            });
        });

        it('should update progress bar width based on progress', async () => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/status')) {
                    return Promise.resolve({ 
                        data: { 
                            ...mockWorkflowStatus, 
                            status: 'IN_REVIEW',
                            reviewProgress: 50
                        } 
                    });
                }
                return Promise.resolve({ data: {} });
            });

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                const progressBar = document.querySelector('[style*="width: 50%"]');
                expect(progressBar).toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // ACTION BUTTONS TESTS
    // =========================================================================

    describe('Action Buttons', () => {
        it('should show Submit for Review button in DRAFT status', async () => {
            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Submit for Review/i)).toBeInTheDocument();
            });
        });

        it('should show Approve and Reject buttons when canApprove is true', async () => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/status')) {
                    return Promise.resolve({ 
                        data: { 
                            ...mockWorkflowStatus, 
                            status: 'AWAITING_APPROVAL',
                            canApprove: true
                        } 
                    });
                }
                return Promise.resolve({ data: {} });
            });

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Approve/i)).toBeInTheDocument();
                expect(screen.getByText(/Reject/i)).toBeInTheDocument();
            });
        });

        it('should not show Submit button when not in DRAFT', async () => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/status')) {
                    return Promise.resolve({ 
                        data: { 
                            ...mockWorkflowStatus, 
                            status: 'APPROVED',
                            canSubmitForReview: false
                        } 
                    });
                }
                return Promise.resolve({ data: {} });
            });

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.queryByText(/Submit for Review/i)).not.toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // SUBMIT FOR REVIEW MODAL TESTS
    // =========================================================================

    describe('Submit for Review Modal', () => {
        it('should open modal when Submit button clicked', async () => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/teams/members')) {
                    return Promise.resolve({ data: { members: [] } });
                }
                if (url.includes('/status')) {
                    return Promise.resolve({ data: mockWorkflowStatus });
                }
                return Promise.resolve({ data: {} });
            });

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Submit for Review/i)).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText(/Submit for Review/i));

            await waitFor(() => {
                expect(screen.getByText(/Select stakeholders/i)).toBeInTheDocument();
            });
        });

        it('should close modal on Cancel', async () => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/teams/members')) {
                    return Promise.resolve({ data: { members: [] } });
                }
                return Promise.resolve({ data: mockWorkflowStatus });
            });

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Submit for Review/i)).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText(/Submit for Review/i));

            await waitFor(() => {
                expect(screen.getByText(/Cancel/i)).toBeInTheDocument();
            });

            // Find the Cancel button in the modal
            const cancelButtons = screen.getAllByText(/Cancel/i);
            await userEvent.click(cancelButtons[cancelButtons.length - 1]);

            await waitFor(() => {
                expect(screen.queryByText(/Select stakeholders/i)).not.toBeInTheDocument();
            });
        });

        it('should disable Submit button when no reviewers selected', async () => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/teams/members')) {
                    return Promise.resolve({ data: { members: [] } });
                }
                return Promise.resolve({ data: mockWorkflowStatus });
            });

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Submit for Review/i)).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText(/Submit for Review/i));

            await waitFor(() => {
                const submitButtons = screen.getAllByText(/Submit for Review/i);
                const modalSubmitButton = submitButtons[submitButtons.length - 1];
                expect(modalSubmitButton).toBeDisabled();
            });
        });
    });

    // =========================================================================
    // APPROVAL MODAL TESTS
    // =========================================================================

    describe('Approval Modal', () => {
        beforeEach(() => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/status')) {
                    return Promise.resolve({ 
                        data: { 
                            ...mockWorkflowStatus, 
                            status: 'AWAITING_APPROVAL',
                            canApprove: true
                        } 
                    });
                }
                return Promise.resolve({ data: {} });
            });
        });

        it('should open approval modal when Approve clicked', async () => {
            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/^Approve$/)).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText(/^Approve$/));

            await waitFor(() => {
                expect(screen.getByText(/Approve Assessment/i)).toBeInTheDocument();
            });
        });

        it('should allow entering approval notes', async () => {
            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/^Approve$/)).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText(/^Approve$/));

            await waitFor(() => {
                const textarea = screen.getByPlaceholderText(/notes/i);
                expect(textarea).toBeInTheDocument();
            });
        });

        it('should call API when approval confirmed', async () => {
            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/^Approve$/)).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText(/^Approve$/));

            await waitFor(() => {
                const approveButtons = screen.getAllByText(/Approve/i);
                const confirmButton = approveButtons[approveButtons.length - 1];
                await userEvent.click(confirmButton);
            });

            expect(mockedAxios.post).toHaveBeenCalledWith(
                expect.stringContaining('/approve'),
                expect.any(Object)
            );
        });
    });

    // =========================================================================
    // REJECTION MODAL TESTS
    // =========================================================================

    describe('Rejection Modal', () => {
        beforeEach(() => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/status')) {
                    return Promise.resolve({ 
                        data: { 
                            ...mockWorkflowStatus, 
                            status: 'AWAITING_APPROVAL',
                            canApprove: true
                        } 
                    });
                }
                return Promise.resolve({ data: {} });
            });
        });

        it('should open rejection modal when Reject clicked', async () => {
            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Reject/i)).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText(/Reject/i));

            await waitFor(() => {
                expect(screen.getByText(/Reject Assessment/i)).toBeInTheDocument();
            });
        });

        it('should require rejection reason', async () => {
            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Reject/i)).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText(/Reject/i));

            await waitFor(() => {
                const rejectButtons = screen.getAllByText(/Reject/i);
                const confirmButton = rejectButtons[rejectButtons.length - 1];
                expect(confirmButton).toBeDisabled();
            });
        });

        it('should enable reject button when reason provided', async () => {
            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Reject/i)).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText(/Reject/i));

            await waitFor(() => {
                const textarea = screen.getByPlaceholderText(/revision/i);
                await userEvent.type(textarea, 'Missing justifications for axes');
            });

            await waitFor(() => {
                const rejectButtons = screen.getAllByText(/Reject/i);
                const confirmButton = rejectButtons[rejectButtons.length - 1];
                expect(confirmButton).not.toBeDisabled();
            });
        });
    });

    // =========================================================================
    // TABS TESTS
    // =========================================================================

    describe('Tabs', () => {
        it('should render all tabs', async () => {
            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Status/i)).toBeInTheDocument();
                expect(screen.getByText(/Reviews/i)).toBeInTheDocument();
                expect(screen.getByText(/History/i)).toBeInTheDocument();
            });
        });

        it('should switch to Reviews tab on click', async () => {
            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Reviews/i)).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText(/Reviews/i));

            await waitFor(() => {
                expect(screen.getByText(/No reviews assigned/i)).toBeInTheDocument();
            });
        });

        it('should switch to History tab on click', async () => {
            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/History/i)).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText(/History/i));

            await waitFor(() => {
                expect(screen.getByText(/No version history/i)).toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // VERSION HISTORY TESTS
    // =========================================================================

    describe('Version History', () => {
        it('should display version list', async () => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/versions')) {
                    return Promise.resolve({ 
                        data: { 
                            versions: [
                                { id: 'v1', version: 1, created_at: '2024-01-01' },
                                { id: 'v2', version: 2, created_at: '2024-01-15' }
                            ]
                        } 
                    });
                }
                return Promise.resolve({ data: mockWorkflowStatus });
            });

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/History/i)).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText(/History/i));

            await waitFor(() => {
                expect(screen.getByText(/Version 1/i)).toBeInTheDocument();
                expect(screen.getByText(/Version 2/i)).toBeInTheDocument();
            });
        });

        it('should show restore button for non-current versions', async () => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/versions')) {
                    return Promise.resolve({ 
                        data: { 
                            versions: [
                                { id: 'v1', version: 1, created_at: '2024-01-01' }
                            ]
                        } 
                    });
                }
                if (url.includes('/status')) {
                    return Promise.resolve({ 
                        data: { ...mockWorkflowStatus, current_version: 2 }
                    });
                }
                return Promise.resolve({ data: {} });
            });

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/History/i)).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText(/History/i));

            await waitFor(() => {
                expect(screen.getByText(/Restore/i)).toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // NO WORKFLOW INITIALIZED TESTS
    // =========================================================================

    describe('No Workflow Initialized', () => {
        it('should show Initialize button when no workflow', async () => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/status')) {
                    return Promise.resolve({ data: null });
                }
                return Promise.resolve({ data: {} });
            });

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Initialize Workflow/i)).toBeInTheDocument();
            });
        });

        it('should call API to initialize workflow', async () => {
            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/status')) {
                    return Promise.resolve({ data: null });
                }
                return Promise.resolve({ data: {} });
            });

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Initialize Workflow/i)).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText(/Initialize Workflow/i));

            expect(mockedAxios.post).toHaveBeenCalledWith(
                expect.stringContaining('/initialize'),
                expect.objectContaining({ projectId: 'project-456' })
            );
        });
    });

    // =========================================================================
    // CALLBACK TESTS
    // =========================================================================

    describe('Callbacks', () => {
        it('should call onStatusChange when status changes', async () => {
            mockedAxios.post.mockResolvedValue({ data: { success: true } });

            mockedAxios.get.mockImplementation((url) => {
                if (url.includes('/status')) {
                    return Promise.resolve({ 
                        data: { 
                            ...mockWorkflowStatus, 
                            status: 'AWAITING_APPROVAL',
                            canApprove: true
                        } 
                    });
                }
                return Promise.resolve({ data: {} });
            });

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/^Approve$/)).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText(/^Approve$/));

            await waitFor(() => {
                const approveButtons = screen.getAllByText(/Approve/i);
                await userEvent.click(approveButtons[approveButtons.length - 1]);
            });

            await waitFor(() => {
                expect(defaultProps.onStatusChange).toHaveBeenCalledWith('APPROVED');
            });
        });
    });

    // =========================================================================
    // ERROR HANDLING TESTS
    // =========================================================================

    describe('Error Handling', () => {
        it('should handle API errors gracefully', async () => {
            mockedAxios.get.mockRejectedValue(new Error('Network error'));

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            // Should not crash
            await waitFor(() => {
                expect(document.body).toBeInTheDocument();
            });
        });

        it('should log errors to console', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockedAxios.get.mockRejectedValue(new Error('API error'));

            render(<AssessmentWorkflowPanel {...defaultProps} />);

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalled();
            });

            consoleSpy.mockRestore();
        });
    });
});



