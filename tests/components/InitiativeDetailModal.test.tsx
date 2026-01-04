/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InitiativeDetailModal } from '../../components/InitiativeDetailModal';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

const mockInitiative = {
    id: 'init-1',
    name: 'Test Initiative',
    description: 'Test description',
    status: 'PLANNING',
    priority: 'High',
    strategicIntent: 'Grow',
    applicantOneLiner: 'Achieve growth by implementing X so that Y improves significantly.',
    summary: 'This is a detailed executive summary that is long enough to pass the validation check. It describes the initiative in detail.',
    killCriteria: 'Stop if budget exceeds 10% variance or timeline delays > 2 weeks.',
    // Add required fields to prevent validation errors/crash
    problemStructured: {
        symptom: 'Symptom',
        rootCause: 'Root Cause',
        costOfInaction: 'Cost'
    },
    effortProfile: { analytical: 1, operational: 1, change: 1 },
    strategicFit: { axisAlign: true, goalAlign: true, painPointAlign: true },
    targetState: { process: [], behavior: [], capability: [] },
    attachments: [],
    changeLog: [],
    teamMembers: [],
    relatedInitiatives: [],
    comments: [],
    versions: [],
    successCriteria: []
} as any;

describe('InitiativeDetailModal Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        window.alert = vi.fn();
    });

    it('renders modal when open', () => {
        render(<InitiativeDetailModal initiative={mockInitiative} isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />);
        // The name is in an input field
        expect(screen.getByDisplayValue('Test Initiative')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        const { container } = render(<InitiativeDetailModal initiative={mockInitiative} isOpen={false} onClose={vi.fn()} onSave={vi.fn()} />);
        expect(container.firstChild).toBeNull();
    });

    it('displays tabs', () => {
        render(<InitiativeDetailModal initiative={mockInitiative} isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />);

        // Find distinct tab buttons
        // Using role button is safe. filtering by text content.
        const buttons = screen.getAllByRole('button');
        const overviewTab = buttons.find(b => b.textContent?.includes('initiative.tabs.overview'));
        const tasksTab = buttons.find(b => b.textContent?.includes('initiative.tabs.tasks'));

        expect(overviewTab).toBeInTheDocument();
        expect(tasksTab).toBeInTheDocument();
    });

    it('switches tabs', async () => {
        render(<InitiativeDetailModal initiative={mockInitiative} isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />);

        const buttons = screen.getAllByRole('button');
        const tasksTab = buttons.find(b => b.textContent?.includes('initiative.tabs.tasks'));

        if (tasksTab) {
            await user.click(tasksTab);
            // After clicking tasks, we should see tasks content. 
            // The Tasks tab renders InitiativeTasksTab. 
            // We can check for a specific element from that tab or just that no error occurred.
        } else {
            throw new Error('Tasks tab not found');
        }
    });

    it('calls onClose when close clicked', async () => {
        const onClose = vi.fn();
        render(<InitiativeDetailModal initiative={mockInitiative} isOpen={true} onClose={onClose} onSave={vi.fn()} />);

        // The modal has a Cancel button in the footer
        const cancelButton = screen.getByText('Cancel');
        await user.click(cancelButton);

        expect(onClose).toHaveBeenCalled();
    });

    it('calls onSave when save clicked', async () => {
        const onSave = vi.fn();
        render(<InitiativeDetailModal initiative={mockInitiative} isOpen={true} onClose={vi.fn()} onSave={onSave} />);

        // The save button is in the footer with text "Save Initiative Charter"
        // It might be inside a Button component which renders a button
        const saveButton = screen.getByText('Save Initiative Charter');

        // If getting by text finds the span inside the button, we need to click it.
        // If it's the button itself, great.
        await user.click(saveButton);

        expect(onSave).toHaveBeenCalled();
    });
});



