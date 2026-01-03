/**
 * PlaybookTemplateComments Tests
 * Tests for the comments component on playbook templates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaybookTemplateComments } from '../../../components/SuperAdmin/PlaybookTemplateComments';
import '@testing-library/jest-dom';

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn().mockReturnValue('mock-token'),
    setItem: vi.fn(),
    clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('PlaybookTemplateComments', () => {
    const mockComments = [
        {
            id: 'cmt-1',
            commentText: 'This playbook looks great!',
            userId: 'user-1',
            isResolved: false,
            createdAt: '2024-01-15T10:00:00Z',
            user: {
                id: 'user-1',
                firstName: 'John',
                lastName: 'Doe',
                avatar: null
            },
            replies: []
        },
        {
            id: 'cmt-2',
            commentText: 'Fixed the issue mentioned above',
            userId: 'user-2',
            isResolved: true,
            resolvedBy: 'user-1',
            resolvedAt: '2024-01-16T09:00:00Z',
            createdAt: '2024-01-15T14:00:00Z',
            user: {
                id: 'user-2',
                firstName: 'Jane',
                lastName: 'Smith',
                avatar: null
            },
            replies: [
                {
                    id: 'cmt-3',
                    commentText: 'Thanks for fixing it!',
                    userId: 'user-1',
                    parentCommentId: 'cmt-2',
                    createdAt: '2024-01-15T15:00:00Z',
                    user: {
                        id: 'user-1',
                        firstName: 'John',
                        lastName: 'Doe'
                    }
                }
            ]
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ comments: mockComments })
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render comments section title', async () => {
            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getByText(/Comments/i)).toBeInTheDocument();
            });
        });

        it('should display all comments', async () => {
            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getByText('This playbook looks great!')).toBeInTheDocument();
                expect(screen.getByText('Fixed the issue mentioned above')).toBeInTheDocument();
            });
        });

        it('should display user names', async () => {
            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getByText(/John Doe/)).toBeInTheDocument();
                expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
            });
        });

        it('should show resolved badge on resolved comments', async () => {
            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getByText(/Resolved/i)).toBeInTheDocument();
            });
        });

        it('should display replies nested under parent comments', async () => {
            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getByText('Thanks for fixing it!')).toBeInTheDocument();
            });
        });

        it('should show empty state when no comments', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ comments: [] })
            });

            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getByText(/No comments/i) || screen.getByText(/Be the first/i)).toBeInTheDocument();
            });
        });
    });

    describe('Adding Comments', () => {
        it('should show comment input field', async () => {
            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getByPlaceholderText(/Add a comment|Write a comment/i)).toBeInTheDocument();
            });
        });

        it('should submit new comment', async () => {
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ comments: mockComments })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({
                        comment: {
                            id: 'cmt-new',
                            commentText: 'New comment text',
                            userId: 'current-user'
                        }
                    })
                });

            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getByText('This playbook looks great!')).toBeInTheDocument();
            });

            const input = screen.getByPlaceholderText(/Add a comment|Write a comment/i);
            await userEvent.type(input, 'New comment text');

            const submitButton = screen.getByRole('button', { name: /Post|Submit|Send/i });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/comments'),
                    expect.objectContaining({
                        method: 'POST',
                        body: expect.stringContaining('New comment text')
                    })
                );
            });
        });

        it('should clear input after successful submission', async () => {
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ comments: mockComments })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ comment: { id: 'cmt-new' } })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ comments: mockComments })
                });

            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getByText('This playbook looks great!')).toBeInTheDocument();
            });

            const input = screen.getByPlaceholderText(/Add a comment|Write a comment/i);
            await userEvent.type(input, 'Test comment');

            const submitButton = screen.getByRole('button', { name: /Post|Submit|Send/i });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(input).toHaveValue('');
            });
        });

        it('should disable submit button when input is empty', async () => {
            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                const submitButton = screen.getByRole('button', { name: /Post|Submit|Send/i });
                expect(submitButton).toBeDisabled();
            });
        });
    });

    describe('Comment Actions', () => {
        it('should show reply button on comments', async () => {
            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getAllByRole('button', { name: /Reply/i }).length).toBeGreaterThan(0);
            });
        });

        it('should show resolve button on unresolved comments', async () => {
            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Resolve/i })).toBeInTheDocument();
            });
        });

        it('should handle resolve action', async () => {
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ comments: mockComments })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ comment: { isResolved: true } })
                });

            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getByText('This playbook looks great!')).toBeInTheDocument();
            });

            const resolveButton = screen.getByRole('button', { name: /Resolve/i });
            fireEvent.click(resolveButton);

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/resolve'),
                    expect.objectContaining({ method: 'POST' })
                );
            });
        });

        it('should show reply input when reply button clicked', async () => {
            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getByText('This playbook looks great!')).toBeInTheDocument();
            });

            const replyButtons = screen.getAllByRole('button', { name: /Reply/i });
            fireEvent.click(replyButtons[0]);

            await waitFor(() => {
                expect(screen.getByPlaceholderText(/Reply|response/i)).toBeInTheDocument();
            });
        });
    });

    describe('Filtering', () => {
        it('should filter resolved comments when toggle clicked', async () => {
            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getByText('This playbook looks great!')).toBeInTheDocument();
            });

            // Find filter toggle
            const filterToggle = screen.getByRole('checkbox', { name: /Hide resolved|Show resolved/i }) ||
                                 screen.getByLabelText(/resolved/i);
            
            if (filterToggle) {
                fireEvent.click(filterToggle);

                await waitFor(() => {
                    expect(global.fetch).toHaveBeenCalledWith(
                        expect.stringContaining('includeResolved'),
                        expect.any(Object)
                    );
                });
            }
        });
    });

    describe('Error Handling', () => {
        it('should show error message on load failure', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: 'Server error' })
            });

            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
            });
        });

        it('should show error when comment submission fails', async () => {
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ comments: mockComments })
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 400,
                    json: () => Promise.resolve({ error: 'Invalid comment' })
                });

            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getByText('This playbook looks great!')).toBeInTheDocument();
            });

            const input = screen.getByPlaceholderText(/Add a comment|Write a comment/i);
            await userEvent.type(input, 'Test');

            const submitButton = screen.getByRole('button', { name: /Post|Submit|Send/i });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
            });
        });
    });

    describe('Timestamps', () => {
        it('should display relative timestamps', async () => {
            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                // Should show relative time like "2 days ago" or formatted date
                expect(screen.getByText(/ago|Jan|2024/i)).toBeInTheDocument();
            });
        });
    });

    describe('User Avatars', () => {
        it('should display user initials when no avatar', async () => {
            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                // Should show initials like "JD" for John Doe
                expect(screen.getByText('JD') || screen.getByText('J')).toBeInTheDocument();
            });
        });
    });

    describe('Accessibility', () => {
        it('should have accessible input labels', async () => {
            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                const input = screen.getByPlaceholderText(/Add a comment|Write a comment/i);
                expect(input).toHaveAccessibleName();
            });
        });

        it('should have proper heading structure', async () => {
            render(<PlaybookTemplateComments templateId="pb-123" />);
            
            await waitFor(() => {
                expect(screen.getByRole('heading', { name: /Comments/i })).toBeInTheDocument();
            });
        });
    });
});






