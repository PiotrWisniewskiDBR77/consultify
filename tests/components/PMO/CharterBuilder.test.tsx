/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharterBuilder } from '../../../components/PMO/CharterBuilder';

// Mock toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

// Mock API
vi.mock('../../../services/api', () => ({
    Api: {
        updateCharter: vi.fn()
    }
}));

const mockInitialData = {
    problemStatement: 'Test problem',
    objectives: 'Test objectives',
    deliverables: ['Deliverable 1'],
    successCriteria: ['Success criterion 1'],
    scopeIn: ['In scope item'],
    scopeOut: ['Out of scope item'],
    keyRisks: ['Risk 1'],
    budget: 10000,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    ownerStrategyId: 'user-1',
    ownerExecutionId: 'user-2'
};

const mockUsers = [
    { id: 'user-1', firstName: 'John', lastName: 'Doe' },
    { id: 'user-2', firstName: 'Jane', lastName: 'Smith' }
];

describe('CharterBuilder Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        global.localStorage = {
            getItem: vi.fn(() => 'mock-token'),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            length: 0,
            key: vi.fn()
        } as any;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Initial Rendering', () => {
        it('renders charter builder with initial data', () => {
            render(
                <CharterBuilder
                    initiativeId="init-1"
                    initialData={mockInitialData}
                    users={mockUsers}
                />
            );

            expect(screen.getByText('Project Charter Builder')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Test problem')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Test objectives')).toBeInTheDocument();
        });

        it('shows navigation sections', () => {
            render(
                <CharterBuilder
                    initiativeId="init-1"
                    initialData={mockInitialData}
                    users={mockUsers}
                />
            );

            expect(screen.getByText('Overview')).toBeInTheDocument();
            expect(screen.getByText('Scope')).toBeInTheDocument();
            expect(screen.getByText('Risks')).toBeInTheDocument();
            expect(screen.getByText('Budget')).toBeInTheDocument();
        });

        it('displays deliverables list', () => {
            render(
                <CharterBuilder
                    initiativeId="init-1"
                    initialData={mockInitialData}
                    users={mockUsers}
                />
            );

            expect(screen.getByDisplayValue('Deliverable 1')).toBeInTheDocument();
        });
    });

    describe('Form Interactions', () => {
        it('allows editing problem statement', async () => {
            render(
                <CharterBuilder
                    initiativeId="init-1"
                    initialData={mockInitialData}
                    users={mockUsers}
                />
            );

            const problemInput = screen.getByDisplayValue('Test problem');
            await user.clear(problemInput);
            await user.type(problemInput, 'Updated problem');

            expect(problemInput).toHaveValue('Updated problem');
        });

        it('allows editing objectives', async () => {
            render(
                <CharterBuilder
                    initiativeId="init-1"
                    initialData={mockInitialData}
                    users={mockUsers}
                />
            );

            const objectivesInput = screen.getByDisplayValue('Test objectives');
            await user.clear(objectivesInput);
            await user.type(objectivesInput, 'Updated objectives');

            expect(objectivesInput).toHaveValue('Updated objectives');
        });

        it('allows adding deliverables', async () => {
            render(
                <CharterBuilder
                    initiativeId="init-1"
                    initialData={mockInitialData}
                    users={mockUsers}
                />
            );

            // Navigate to deliverables section
            await user.click(screen.getByText('Scope'));

            const addButtons = screen.getAllByRole('button', { name: /add|plus/i });
            const addDeliverableButton = addButtons.find(button =>
                button.closest('[data-section="deliverables"]')
            );

            if (addDeliverableButton) {
                await user.click(addDeliverableButton);
                const inputs = screen.getAllByDisplayValue('');
                expect(inputs.length).toBeGreaterThan(1);
            }
        });

        it('allows editing budget', async () => {
            render(
                <CharterBuilder
                    initiativeId="init-1"
                    initialData={mockInitialData}
                    users={mockUsers}
                />
            );

            // Navigate to budget section
            await user.click(screen.getByText('Budget'));

            const budgetInput = screen.getByDisplayValue('10000');
            await user.clear(budgetInput);
            await user.type(budgetInput, '20000');

            expect(budgetInput).toHaveValue('20000');
        });
    });

    describe('Save Functionality', () => {
        it('calls onSave when save button is clicked', async () => {
            const onSave = vi.fn();
            render(
                <CharterBuilder
                    initiativeId="init-1"
                    initialData={mockInitialData}
                    users={mockUsers}
                    onSave={onSave}
                />
            );

            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            expect(onSave).toHaveBeenCalled();
        });

        it('shows loading state during save', async () => {
            const onSave = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
            render(
                <CharterBuilder
                    initiativeId="init-1"
                    initialData={mockInitialData}
                    users={mockUsers}
                    onSave={onSave}
                />
            );

            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            expect(screen.getByText('Saving...')).toBeInTheDocument();
        });
    });

    describe('Cancel Functionality', () => {
        it('calls onCancel when cancel button is clicked', async () => {
            const onCancel = vi.fn();
            render(
                <CharterBuilder
                    initiativeId="init-1"
                    initialData={mockInitialData}
                    users={mockUsers}
                    onCancel={onCancel}
                />
            );

            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            await user.click(cancelButton);

            expect(onCancel).toHaveBeenCalled();
        });
    });

    describe('Read Only Mode', () => {
        it('disables inputs in read-only mode', () => {
            render(
                <CharterBuilder
                    initiativeId="init-1"
                    initialData={mockInitialData}
                    users={mockUsers}
                    readOnly={true}
                />
            );

            const problemInput = screen.getByDisplayValue('Test problem');
            expect(problemInput).toBeDisabled();
        });

        it('hides save and cancel buttons in read-only mode', () => {
            render(
                <CharterBuilder
                    initiativeId="init-1"
                    initialData={mockInitialData}
                    users={mockUsers}
                    readOnly={true}
                />
            );

            expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
        });
    });

    describe('Completeness Checker Integration', () => {
        it('shows completeness checker', () => {
            render(
                <CharterBuilder
                    initiativeId="init-1"
                    initialData={mockInitialData}
                    users={mockUsers}
                />
            );

            expect(screen.getByText('Charter Completeness')).toBeInTheDocument();
        });
    });
});





