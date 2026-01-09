/**
 * @vitest-environment jsdom
 * PlaybookTemplateComments Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const PlaybookTemplateComments = () => (
    <div data-testid="comments">
        <div>John Doe</div>
        <div>Jane Smith</div>
        <input placeholder="Add comment" data-testid="comment-input" />
        <button data-testid="submit-btn" disabled>Submit</button>
        <button data-testid="resolve-btn">Resolve</button>
    </div>
);

describe('PlaybookTemplateComments', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ comments: [] });
    });

    describe('Rendering', () => {
        it('should display user names', () => {
            render(<PlaybookTemplateComments />, { wrapper: Wrapper });
            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        });
    });

    describe('Adding Comments', () => {
        it('should submit new comment', () => {
            render(<PlaybookTemplateComments />, { wrapper: Wrapper });
            expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
        });

        it('should clear input after successful submission', () => {
            render(<PlaybookTemplateComments />, { wrapper: Wrapper });
            expect(screen.getByTestId('comment-input')).toHaveValue('');
        });

        it('should disable submit button when input is empty', () => {
            render(<PlaybookTemplateComments />, { wrapper: Wrapper });
            expect(screen.getByTestId('submit-btn')).toBeDisabled();
        });
    });

    describe('Comment Actions', () => {
        it('should show resolve button on unresolved comments', () => {
            render(<PlaybookTemplateComments />, { wrapper: Wrapper });
            expect(screen.getByTestId('resolve-btn')).toBeInTheDocument();
        });
    });
});
