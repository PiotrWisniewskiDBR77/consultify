/**
 * DataTable Component Tests
 * Testing data table with sorting and pagination
 * 
 * @module tests/unit/components/UI/DataTable.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock DataTable component
const MockDataTable: React.FC<{
    columns?: Array<{ id: string; label: string; sortable?: boolean }>;
    data?: Array<Record<string, any>>;
    onSort?: (columnId: string, direction: 'asc' | 'desc') => void;
    onRowClick?: (row: Record<string, any>) => void;
    page?: number;
    pageSize?: number;
    totalItems?: number;
    onPageChange?: (page: number) => void;
}> = ({
    columns = [
        { id: 'name', label: 'Name', sortable: true },
        { id: 'email', label: 'Email', sortable: true },
        { id: 'status', label: 'Status' }
    ],
    data = [
        { id: 1, name: 'John', email: 'john@test.com', status: 'Active' },
        { id: 2, name: 'Jane', email: 'jane@test.com', status: 'Inactive' }
    ],
    onSort = () => { },
    onRowClick = () => { },
    page = 1,
    pageSize = 10,
    totalItems = 2,
    onPageChange = () => { }
}) => {
        return (
            <div data-testid="data-table">
                <table>
                    <thead>
                        <tr>
                            {columns.map(col => (
                                <th
                                    key={col.id}
                                    data-testid={`header-${col.id}`}
                                    onClick={() => col.sortable && onSort(col.id, 'asc')}
                                    data-sortable={col.sortable}
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map(row => (
                            <tr
                                key={row.id}
                                data-testid={`row-${row.id}`}
                                onClick={() => onRowClick(row)}
                            >
                                {columns.map(col => (
                                    <td key={col.id} data-testid={`cell-${row.id}-${col.id}`}>
                                        {row[col.id]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div data-testid="pagination">
                    <span data-testid="page-info">Page {page} of {Math.ceil(totalItems / pageSize)}</span>
                    <button
                        data-testid="prev-page"
                        disabled={page === 1}
                        onClick={() => onPageChange(page - 1)}
                    >
                        Previous
                    </button>
                    <button
                        data-testid="next-page"
                        disabled={page * pageSize >= totalItems}
                        onClick={() => onPageChange(page + 1)}
                    >
                        Next
                    </button>
                </div>
            </div>
        );
    };

describe('DataTable Component', () => {
    describe('Rendering', () => {
        it('should render table', () => {
            render(<MockDataTable />);
            expect(screen.getByTestId('data-table')).toBeInTheDocument();
        });

        it('should render column headers', () => {
            render(<MockDataTable />);
            expect(screen.getByTestId('header-name')).toHaveTextContent('Name');
            expect(screen.getByTestId('header-email')).toHaveTextContent('Email');
        });

        it('should render data rows', () => {
            render(<MockDataTable />);
            expect(screen.getByTestId('row-1')).toBeInTheDocument();
            expect(screen.getByTestId('cell-1-name')).toHaveTextContent('John');
        });
    });

    describe('Sorting', () => {
        it('should call onSort when sortable header clicked', () => {
            const onSort = vi.fn();
            render(<MockDataTable onSort={onSort} />);

            fireEvent.click(screen.getByTestId('header-name'));
            expect(onSort).toHaveBeenCalledWith('name', 'asc');
        });

        it('should mark sortable columns', () => {
            render(<MockDataTable />);
            expect(screen.getByTestId('header-name')).toHaveAttribute('data-sortable', 'true');
            expect(screen.getByTestId('header-status')).toHaveAttribute('data-sortable', 'undefined');
        });
    });

    describe('Row Interaction', () => {
        it('should call onRowClick when row clicked', () => {
            const onRowClick = vi.fn();
            render(<MockDataTable onRowClick={onRowClick} />);

            fireEvent.click(screen.getByTestId('row-1'));
            expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: 'John' }));
        });
    });

    describe('Pagination', () => {
        it('should show page info', () => {
            render(<MockDataTable page={1} totalItems={25} pageSize={10} />);
            expect(screen.getByTestId('page-info')).toHaveTextContent('Page 1 of 3');
        });

        it('should disable prev on first page', () => {
            render(<MockDataTable page={1} />);
            expect(screen.getByTestId('prev-page')).toBeDisabled();
        });

        it('should call onPageChange on navigation', () => {
            const onPageChange = vi.fn();
            render(<MockDataTable page={2} totalItems={30} onPageChange={onPageChange} />);

            fireEvent.click(screen.getByTestId('prev-page'));
            expect(onPageChange).toHaveBeenCalledWith(1);
        });
    });
});
