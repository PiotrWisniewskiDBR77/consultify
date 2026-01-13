/**
 * Pagination Component Tests
 * Testing pagination controls
 * 
 * @module tests/unit/components/UI/Pagination.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Pagination component
const MockPagination: React.FC<{
    currentPage?: number;
    totalPages?: number;
    onPageChange?: (page: number) => void;
    showFirstLast?: boolean;
    siblingCount?: number;
}> = ({
    currentPage = 1,
    totalPages = 10,
    onPageChange = () => { },
    showFirstLast = true,
    siblingCount = 1
}) => {
        const getPageNumbers = () => {
            const pages: (number | string)[] = [];
            const start = Math.max(1, currentPage - siblingCount);
            const end = Math.min(totalPages, currentPage + siblingCount);

            if (start > 1) {
                pages.push(1);
                if (start > 2) pages.push('...');
            }

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (end < totalPages) {
                if (end < totalPages - 1) pages.push('...');
                pages.push(totalPages);
            }

            return pages;
        };

        return (
            <nav data-testid="pagination" aria-label="Pagination">
                {showFirstLast && (
                    <button
                        data-testid="pagination-first"
                        disabled={currentPage === 1}
                        onClick={() => onPageChange(1)}
                    >
                        First
                    </button>
                )}
                <button
                    data-testid="pagination-prev"
                    disabled={currentPage === 1}
                    onClick={() => onPageChange(currentPage - 1)}
                    aria-label="Previous page"
                >
                    Prev
                </button>
                <div data-testid="pagination-pages">
                    {getPageNumbers().map((page, index) => (
                        typeof page === 'number' ? (
                            <button
                                key={index}
                                data-testid={`pagination-page-${page}`}
                                aria-current={page === currentPage ? 'page' : undefined}
                                onClick={() => onPageChange(page)}
                            >
                                {page}
                            </button>
                        ) : (
                            <span key={index} data-testid="pagination-ellipsis">{page}</span>
                        )
                    ))}
                </div>
                <button
                    data-testid="pagination-next"
                    disabled={currentPage === totalPages}
                    onClick={() => onPageChange(currentPage + 1)}
                    aria-label="Next page"
                >
                    Next
                </button>
                {showFirstLast && (
                    <button
                        data-testid="pagination-last"
                        disabled={currentPage === totalPages}
                        onClick={() => onPageChange(totalPages)}
                    >
                        Last
                    </button>
                )}
            </nav>
        );
    };

describe('Pagination Component', () => {
    describe('Rendering', () => {
        it('should render pagination', () => {
            render(<MockPagination />);
            expect(screen.getByTestId('pagination')).toBeInTheDocument();
        });

        it('should render page buttons', () => {
            render(<MockPagination currentPage={5} totalPages={10} />);
            expect(screen.getByTestId('pagination-page-5')).toBeInTheDocument();
        });

        it('should render prev/next buttons', () => {
            render(<MockPagination />);
            expect(screen.getByTestId('pagination-prev')).toBeInTheDocument();
            expect(screen.getByTestId('pagination-next')).toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        it('should call onPageChange on click', () => {
            const onPageChange = vi.fn();
            render(<MockPagination currentPage={5} totalPages={10} onPageChange={onPageChange} />);

            fireEvent.click(screen.getByTestId('pagination-page-6'));
            expect(onPageChange).toHaveBeenCalledWith(6);
        });

        it('should navigate to prev page', () => {
            const onPageChange = vi.fn();
            render(<MockPagination currentPage={5} totalPages={10} onPageChange={onPageChange} />);

            fireEvent.click(screen.getByTestId('pagination-prev'));
            expect(onPageChange).toHaveBeenCalledWith(4);
        });

        it('should navigate to next page', () => {
            const onPageChange = vi.fn();
            render(<MockPagination currentPage={5} totalPages={10} onPageChange={onPageChange} />);

            fireEvent.click(screen.getByTestId('pagination-next'));
            expect(onPageChange).toHaveBeenCalledWith(6);
        });
    });

    describe('Disabled States', () => {
        it('should disable prev on first page', () => {
            render(<MockPagination currentPage={1} totalPages={10} />);
            expect(screen.getByTestId('pagination-prev')).toBeDisabled();
        });

        it('should disable next on last page', () => {
            render(<MockPagination currentPage={10} totalPages={10} />);
            expect(screen.getByTestId('pagination-next')).toBeDisabled();
        });
    });

    describe('Accessibility', () => {
        it('should have aria-label', () => {
            render(<MockPagination />);
            expect(screen.getByLabelText('Pagination')).toBeInTheDocument();
        });

        it('should have aria-current on current page', () => {
            render(<MockPagination currentPage={1} />);
            expect(screen.getByTestId('pagination-page-1')).toHaveAttribute('aria-current', 'page');
        });
    });
});
