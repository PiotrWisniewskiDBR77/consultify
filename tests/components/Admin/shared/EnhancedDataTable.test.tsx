import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EnhancedDataTable, type EnhancedDataTableProps } from '../../../../components/admin/shared/EnhancedDataTable';

/**
 * EnhancedDataTable Component Tests
 * Tests for the enhanced data table with bulk selection, column visibility,
 * row actions, inline editing, and export functionality
 * CRITICAL FOR ENTERPRISE DATA MANAGEMENT
 */
describe('EnhancedDataTable', () => {
    const mockData = [
        { id: '1', name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'active' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'User', status: 'active' },
        { id: '3', name: 'Bob Wilson', email: 'bob@example.com', role: 'User', status: 'inactive' },
    ];

    const mockColumns = [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'email', label: 'Email', sortable: true },
        { key: 'role', label: 'Role', sortable: true },
        { key: 'status', label: 'Status', sortable: false },
    ];

    const defaultProps: EnhancedDataTableProps<typeof mockData[0]> = {
        data: mockData,
        columns: mockColumns,
        onRowClick: vi.fn(),
        onBulkAction: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render all data rows', () => {
            renderWithProviders(<EnhancedDataTable {...defaultProps} />);

            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('Jane Smith')).toBeInTheDocument();
            expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
        });

        it('should render column headers', () => {
            renderWithProviders(<EnhancedDataTable {...defaultProps} />);

            expect(screen.getByText('Name')).toBeInTheDocument();
            expect(screen.getByText('Email')).toBeInTheDocument();
            expect(screen.getByText('Role')).toBeInTheDocument();
        });

        it('should render checkbox column when bulk selection is enabled', () => {
            renderWithProviders(
                <EnhancedDataTable {...defaultProps} enableBulkSelection />
            );

            const checkboxes = screen.getAllByRole('checkbox');
            expect(checkboxes.length).toBeGreaterThan(0);
        });

        it('should render actions column when row actions are provided', () => {
            const rowActions = [
                { label: 'Edit', onClick: vi.fn() },
                { label: 'Delete', onClick: vi.fn() },
            ];

            renderWithProviders(
                <EnhancedDataTable {...defaultProps} rowActions={rowActions} />
            );

            expect(screen.getByText('Actions')).toBeInTheDocument();
        });

        it('should show empty state when no data', () => {
            renderWithProviders(
                <EnhancedDataTable {...defaultProps} data={[]} />
            );

            expect(screen.getByText(/no data/i)).toBeInTheDocument();
        });
    });

    describe('Bulk Selection', () => {
        it('should select all rows when header checkbox is clicked', async () => {
            const user = userEvent.setup();
            renderWithProviders(
                <EnhancedDataTable {...defaultProps} enableBulkSelection />
            );

            const headerCheckbox = screen.getByLabelText(/select all/i);
            await user.click(headerCheckbox);

            const rowCheckboxes = screen.getAllByRole('checkbox');
            rowCheckboxes.forEach(checkbox => {
                expect(checkbox).toBeChecked();
            });
        });

        it('should deselect all when header checkbox is clicked again', async () => {
            const user = userEvent.setup();
            renderWithProviders(
                <EnhancedDataTable {...defaultProps} enableBulkSelection />
            );

            const headerCheckbox = screen.getByLabelText(/select all/i);
            await user.click(headerCheckbox);
            await user.click(headerCheckbox);

            const rowCheckboxes = screen.getAllByRole('checkbox').slice(1);
            rowCheckboxes.forEach(checkbox => {
                expect(checkbox).not.toBeChecked();
            });
        });

        it('should show bulk action toolbar when items selected', async () => {
            const user = userEvent.setup();
            renderWithProviders(
                <EnhancedDataTable {...defaultProps} enableBulkSelection />
            );

            const firstRowCheckbox = screen.getAllByRole('checkbox')[1];
            await user.click(firstRowCheckbox);

            expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
        });

        it('should call onBulkAction when bulk action is triggered', async () => {
            const user = userEvent.setup();
            const onBulkAction = vi.fn();

            renderWithProviders(
                <EnhancedDataTable
                    {...defaultProps}
                    enableBulkSelection
                    onBulkAction={onBulkAction}
                    bulkActions={[{ id: 'delete', label: 'Delete' }]}
                />
            );

            const firstRowCheckbox = screen.getAllByRole('checkbox')[1];
            await user.click(firstRowCheckbox);

            const deleteButton = screen.getByRole('button', { name: /delete/i });
            await user.click(deleteButton);

            expect(onBulkAction).toHaveBeenCalledWith('delete', ['1']);
        });
    });

    describe('Column Visibility', () => {
        it('should show column visibility toggle', () => {
            renderWithProviders(
                <EnhancedDataTable {...defaultProps} enableColumnVisibility />
            );

            expect(screen.getByRole('button', { name: /columns/i })).toBeInTheDocument();
        });

        it('should toggle column visibility', async () => {
            const user = userEvent.setup();
            renderWithProviders(
                <EnhancedDataTable {...defaultProps} enableColumnVisibility />
            );

            const columnsButton = screen.getByRole('button', { name: /columns/i });
            await user.click(columnsButton);

            const emailToggle = screen.getByLabelText(/email/i);
            await user.click(emailToggle);

            // Email column should be hidden
            expect(screen.queryByText('john@example.com')).not.toBeInTheDocument();
        });

        it('should persist column preferences', async () => {
            const user = userEvent.setup();
            const onColumnVisibilityChange = vi.fn();

            renderWithProviders(
                <EnhancedDataTable
                    {...defaultProps}
                    enableColumnVisibility
                    onColumnVisibilityChange={onColumnVisibilityChange}
                />
            );

            const columnsButton = screen.getByRole('button', { name: /columns/i });
            await user.click(columnsButton);

            const emailToggle = screen.getByLabelText(/email/i);
            await user.click(emailToggle);

            expect(onColumnVisibilityChange).toHaveBeenCalledWith(
                expect.objectContaining({ email: false })
            );
        });
    });

    describe('Row Actions', () => {
        it('should show actions dropdown on row hover', async () => {
            const user = userEvent.setup();
            const rowActions = [
                { label: 'Edit', onClick: vi.fn() },
                { label: 'Delete', onClick: vi.fn() },
            ];

            renderWithProviders(
                <EnhancedDataTable {...defaultProps} rowActions={rowActions} />
            );

            const firstRow = screen.getByText('John Doe').closest('tr')!;
            await user.hover(firstRow);

            const actionsButton = within(firstRow).getByRole('button', { name: /actions/i });
            await user.click(actionsButton);

            expect(screen.getByText('Edit')).toBeInTheDocument();
            expect(screen.getByText('Delete')).toBeInTheDocument();
        });

        it('should call action handler with row data', async () => {
            const user = userEvent.setup();
            const editAction = vi.fn();
            const rowActions = [{ label: 'Edit', onClick: editAction }];

            renderWithProviders(
                <EnhancedDataTable {...defaultProps} rowActions={rowActions} />
            );

            const firstRow = screen.getByText('John Doe').closest('tr')!;
            await user.hover(firstRow);

            const actionsButton = within(firstRow).getByRole('button', { name: /actions/i });
            await user.click(actionsButton);

            const editButton = screen.getByText('Edit');
            await user.click(editButton);

            expect(editAction).toHaveBeenCalledWith(mockData[0]);
        });
    });

    describe('Inline Editing', () => {
        it('should enable inline editing when cell is double-clicked', async () => {
            const user = userEvent.setup();
            const onCellEdit = vi.fn();

            renderWithProviders(
                <EnhancedDataTable
                    {...defaultProps}
                    enableInlineEdit
                    editableColumns={['name']}
                    onCellEdit={onCellEdit}
                />
            );

            const nameCell = screen.getByText('John Doe');
            await user.dblClick(nameCell);

            const input = screen.getByDisplayValue('John Doe');
            expect(input).toBeInTheDocument();
        });

        it('should save edit on Enter', async () => {
            const user = userEvent.setup();
            const onCellEdit = vi.fn();

            renderWithProviders(
                <EnhancedDataTable
                    {...defaultProps}
                    enableInlineEdit
                    editableColumns={['name']}
                    onCellEdit={onCellEdit}
                />
            );

            const nameCell = screen.getByText('John Doe');
            await user.dblClick(nameCell);

            const input = screen.getByDisplayValue('John Doe');
            await user.clear(input);
            await user.type(input, 'John Updated');
            await user.keyboard('{Enter}');

            expect(onCellEdit).toHaveBeenCalledWith('1', 'name', 'John Updated');
        });

        it('should cancel edit on Escape', async () => {
            const user = userEvent.setup();
            const onCellEdit = vi.fn();

            renderWithProviders(
                <EnhancedDataTable
                    {...defaultProps}
                    enableInlineEdit
                    editableColumns={['name']}
                    onCellEdit={onCellEdit}
                />
            );

            const nameCell = screen.getByText('John Doe');
            await user.dblClick(nameCell);

            const input = screen.getByDisplayValue('John Doe');
            await user.clear(input);
            await user.type(input, 'John Updated');
            await user.keyboard('{Escape}');

            expect(onCellEdit).not.toHaveBeenCalled();
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });
    });

    describe('Sorting', () => {
        it('should sort column when header is clicked', async () => {
            const user = userEvent.setup();
            renderWithProviders(<EnhancedDataTable {...defaultProps} />);

            const nameHeader = screen.getByText('Name');
            await user.click(nameHeader);

            // First row should now be Bob Wilson (alphabetical)
            const rows = screen.getAllByRole('row');
            expect(within(rows[1]).getByText('Bob Wilson')).toBeInTheDocument();
        });

        it('should toggle sort direction on second click', async () => {
            const user = userEvent.setup();
            renderWithProviders(<EnhancedDataTable {...defaultProps} />);

            const nameHeader = screen.getByText('Name');
            await user.click(nameHeader);
            await user.click(nameHeader);

            // First row should now be John Doe (reverse alphabetical)
            const rows = screen.getAllByRole('row');
            expect(within(rows[1]).getByText('John Doe')).toBeInTheDocument();
        });

        it('should show sort indicator', async () => {
            const user = userEvent.setup();
            renderWithProviders(<EnhancedDataTable {...defaultProps} />);

            const nameHeader = screen.getByText('Name');
            await user.click(nameHeader);

            const sortIcon = within(nameHeader.parentElement!).getByTestId('sort-icon');
            expect(sortIcon).toBeInTheDocument();
        });
    });

    describe('Export', () => {
        it('should show export button when enabled', () => {
            renderWithProviders(
                <EnhancedDataTable {...defaultProps} enableExport />
            );

            expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
        });

        it('should export selected rows when items selected', async () => {
            const user = userEvent.setup();
            const onExport = vi.fn();

            renderWithProviders(
                <EnhancedDataTable
                    {...defaultProps}
                    enableBulkSelection
                    enableExport
                    onExport={onExport}
                />
            );

            const firstRowCheckbox = screen.getAllByRole('checkbox')[1];
            await user.click(firstRowCheckbox);

            const exportButton = screen.getByRole('button', { name: /export/i });
            await user.click(exportButton);

            expect(onExport).toHaveBeenCalledWith([mockData[0]]);
        });

        it('should export all rows when none selected', async () => {
            const user = userEvent.setup();
            const onExport = vi.fn();

            renderWithProviders(
                <EnhancedDataTable {...defaultProps} enableExport onExport={onExport} />
            );

            const exportButton = screen.getByRole('button', { name: /export/i });
            await user.click(exportButton);

            expect(onExport).toHaveBeenCalledWith(mockData);
        });
    });

    describe('Pagination', () => {
        it('should show pagination when enabled', () => {
            const largeData = Array.from({ length: 50 }, (_, i) => ({
                id: String(i),
                name: `User ${i}`,
                email: `user${i}@example.com`,
                role: 'User',
                status: 'active',
            }));

            renderWithProviders(
                <EnhancedDataTable
                    {...defaultProps}
                    data={largeData}
                    enablePagination
                    pageSize={10}
                />
            );

            expect(screen.getByText(/showing 1-10 of 50/i)).toBeInTheDocument();
        });

        it('should navigate between pages', async () => {
            const user = userEvent.setup();
            const largeData = Array.from({ length: 50 }, (_, i) => ({
                id: String(i),
                name: `User ${i}`,
                email: `user${i}@example.com`,
                role: 'User',
                status: 'active',
            }));

            renderWithProviders(
                <EnhancedDataTable
                    {...defaultProps}
                    data={largeData}
                    enablePagination
                    pageSize={10}
                />
            );

            const nextButton = screen.getByRole('button', { name: /next/i });
            await user.click(nextButton);

            expect(screen.getByText('User 10')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper table semantics', () => {
            renderWithProviders(<EnhancedDataTable {...defaultProps} />);

            expect(screen.getByRole('table')).toBeInTheDocument();
            expect(screen.getAllByRole('row').length).toBeGreaterThan(0);
            expect(screen.getAllByRole('columnheader').length).toBe(mockColumns.length);
        });

        it('should support keyboard navigation', async () => {
            const user = userEvent.setup();
            renderWithProviders(<EnhancedDataTable {...defaultProps} />);

            await user.keyboard('{Tab}');

            const table = screen.getByRole('table');
            expect(table.contains(document.activeElement)).toBe(true);
        });

        it('should announce sort changes to screen readers', async () => {
            const user = userEvent.setup();
            renderWithProviders(<EnhancedDataTable {...defaultProps} />);

            const nameHeader = screen.getByText('Name');
            await user.click(nameHeader);

            const liveRegion = screen.getByRole('status');
            expect(liveRegion).toHaveTextContent(/sorted by name/i);
        });
    });

    describe('Loading State', () => {
        it('should show loading skeleton when loading', () => {
            renderWithProviders(<EnhancedDataTable {...defaultProps} isLoading />);

            expect(screen.getByTestId('table-skeleton')).toBeInTheDocument();
        });

        it('should disable interactions when loading', () => {
            renderWithProviders(
                <EnhancedDataTable {...defaultProps} isLoading enableBulkSelection />
            );

            const checkboxes = screen.getAllByRole('checkbox');
            checkboxes.forEach(checkbox => {
                expect(checkbox).toBeDisabled();
            });
        });
    });

    describe('Error Handling', () => {
        it('should show error message on error', () => {
            renderWithProviders(
                <EnhancedDataTable {...defaultProps} error="Failed to load data" />
            );

            expect(screen.getByText(/failed to load data/i)).toBeInTheDocument();
        });

        it('should show retry button on error', () => {
            const onRetry = vi.fn();
            renderWithProviders(
                <EnhancedDataTable
                    {...defaultProps}
                    error="Failed to load data"
                    onRetry={onRetry}
                />
            );

            expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
        });
    });
});

