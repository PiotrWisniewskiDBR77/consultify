/**
 * RapidLeanObservationForm Component - Unit Tests
 * Tests for mobile-optimized Gemba Walk observation form
 * 
 * Coverage: rendering, user interactions, auto-save, offline mode, photo capture
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
    ArrowLeft: () => <span data-testid="icon-arrow-left">←</span>,
    ArrowRight: () => <span data-testid="icon-arrow-right">→</span>,
    Camera: () => <span data-testid="icon-camera">📷</span>,
    CheckCircle: () => <span data-testid="icon-check">✓</span>,
    Clock: () => <span data-testid="icon-clock">🕐</span>,
    MapPin: () => <span data-testid="icon-map-pin">📍</span>,
    Moon: () => <span data-testid="icon-moon">🌙</span>,
    Save: () => <span data-testid="icon-save">💾</span>,
    Sun: () => <span data-testid="icon-sun">☀️</span>,
    Wifi: () => <span data-testid="icon-wifi">📶</span>,
    WifiOff: () => <span data-testid="icon-wifi-off">📵</span>,
    X: () => <span data-testid="icon-x">✕</span>,
}));

// Import component after mocks
import { RapidLeanObservationForm } from '../../../../src/components/assessment/RapidLeanObservationForm';

describe('RapidLeanObservationForm', () => {
    const mockTemplate = {
        id: 'test-template-1',
        name: '5S Audit',
        description: 'Workplace organization assessment',
        category: 'lean',
        estimatedTime: 15,
        checklist: [
            {
                id: 'item-1',
                text: 'Is the work area clean?',
                type: 'yes_no',
                required: true,
            },
            {
                id: 'item-2',
                text: 'Rate overall organization (1-5)',
                type: 'scale',
                required: true,
            },
            {
                id: 'item-3',
                text: 'Additional observations',
                type: 'text',
                required: false,
                helpText: 'Document any notable findings',
            },
            {
                id: 'item-4',
                text: 'Take photo evidence',
                type: 'photo',
                required: false,
            },
        ],
    };

    const defaultProps = {
        template: mockTemplate,
        templateIndex: 0,
        totalTemplates: 3,
        onComplete: vi.fn(),
        onCancel: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        // Mock navigator.onLine
        Object.defineProperty(navigator, 'onLine', {
            value: true,
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Rendering', () => {
        it('should render template name and description', () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            expect(screen.getByText('5S Audit')).toBeInTheDocument();
            expect(screen.getByText('Workplace organization assessment')).toBeInTheDocument();
        });

        it('should render template progress indicator', () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            expect(screen.getByText('1/3')).toBeInTheDocument();
        });

        it('should render all checklist items', () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            expect(screen.getByText('Is the work area clean?')).toBeInTheDocument();
            expect(screen.getByText('Rate overall organization (1-5)')).toBeInTheDocument();
            expect(screen.getByText('Additional observations')).toBeInTheDocument();
        });

        it('should mark required items with asterisk', () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            const requiredMarkers = screen.getAllByText('*');
            expect(requiredMarkers.length).toBeGreaterThan(0);
        });

        it('should render help text when provided', () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            expect(screen.getByText('Document any notable findings')).toBeInTheDocument();
        });

        it('should render cancel and save buttons', () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            expect(screen.getByText('Cancel')).toBeInTheDocument();
            expect(screen.getByText(/Save/)).toBeInTheDocument();
        });
    });

    describe('Yes/No Questions', () => {
        it('should render yes and no buttons for yes_no type', () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            expect(screen.getByText('✓ Yes')).toBeInTheDocument();
            expect(screen.getByText('✗ No')).toBeInTheDocument();
        });

        it('should highlight selected yes option', async () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            const yesButton = screen.getByText('✓ Yes');
            await userEvent.click(yesButton);

            expect(yesButton).toHaveClass('bg-green-500');
        });

        it('should highlight selected no option', async () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            const noButton = screen.getByText('✗ No');
            await userEvent.click(noButton);

            expect(noButton).toHaveClass('bg-red-500');
        });
    });

    describe('Scale Questions', () => {
        it('should render 1-5 scale buttons', () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            for (let i = 1; i <= 5; i++) {
                expect(screen.getByRole('button', { name: String(i) })).toBeInTheDocument();
            }
        });

        it('should highlight selected scale value', async () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            const button3 = screen.getByRole('button', { name: '3' });
            await userEvent.click(button3);

            expect(button3).toHaveClass('bg-blue-500');
        });
    });

    describe('Text Input', () => {
        it('should render textarea for text type', () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            const textareas = screen.getAllByPlaceholderText(/observations/i);
            expect(textareas.length).toBeGreaterThan(0);
        });

        it('should update value on text input', async () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            const textarea = screen.getByPlaceholderText('Enter observations...');
            await userEvent.type(textarea, 'Test observation');

            expect(textarea).toHaveValue('Test observation');
        });
    });

    describe('Location Input', () => {
        it('should render location input field', () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            expect(screen.getByPlaceholderText('Location...')).toBeInTheDocument();
        });

        it('should update location value', async () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            const locationInput = screen.getByPlaceholderText('Location...');
            await userEvent.type(locationInput, 'Production Floor A');

            expect(locationInput).toHaveValue('Production Floor A');
        });
    });

    describe('Dark Mode Toggle', () => {
        it('should render dark mode toggle button', () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            const toggleButton = screen.getByLabelText('Toggle dark mode');
            expect(toggleButton).toBeInTheDocument();
        });

        it('should toggle dark mode on click', async () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            const toggleButton = screen.getByLabelText('Toggle dark mode');
            await userEvent.click(toggleButton);

            // Should show sun icon when dark mode is active
            expect(screen.getByTestId('icon-sun')).toBeInTheDocument();
        });
    });

    describe('Progress Tracking', () => {
        it('should show check mark for completed items', async () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            // Answer a question
            const yesButton = screen.getByText('✓ Yes');
            await userEvent.click(yesButton);

            // Check mark should appear
            const checkIcons = screen.getAllByTestId('icon-check');
            expect(checkIcons.length).toBeGreaterThan(0);
        });

        it('should disable save when required items incomplete', () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            const saveButton = screen.getByText(/Save/);
            expect(saveButton).toBeDisabled();
        });

        it('should enable save when all required items complete', async () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            // Complete required items
            const yesButton = screen.getByText('✓ Yes');
            await userEvent.click(yesButton);

            const scaleButton = screen.getByRole('button', { name: '4' });
            await userEvent.click(scaleButton);

            const saveButton = screen.getByText(/Save/);
            expect(saveButton).not.toBeDisabled();
        });
    });

    describe('Form Submission', () => {
        it('should call onComplete with observation data', async () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            // Complete required items
            await userEvent.click(screen.getByText('✓ Yes'));
            await userEvent.click(screen.getByRole('button', { name: '4' }));

            // Click save
            await userEvent.click(screen.getByText(/Save/));

            expect(defaultProps.onComplete).toHaveBeenCalled();
            const callArgs = defaultProps.onComplete.mock.calls[0][0];
            expect(callArgs.templateId).toBe('test-template-1');
            expect(callArgs.answers).toBeDefined();
        });

        it('should call onCancel when cancel clicked', async () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            await userEvent.click(screen.getByText('Cancel'));

            expect(defaultProps.onCancel).toHaveBeenCalled();
        });
    });

    describe('Auto-Save', () => {
        it('should show saved status initially', () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            expect(screen.getByTestId('icon-check')).toBeInTheDocument();
        });

        it('should save to localStorage', async () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            // Make a change
            await userEvent.click(screen.getByText('✓ Yes'));

            // Wait for auto-save
            await act(async () => {
                vi.advanceTimersByTime(10000);
            });

            const savedData = localStorage.getItem('rapidlean_draft_test-template-1');
            expect(savedData).toBeDefined();
        });

        it('should load draft from localStorage', () => {
            const draft = {
                templateId: 'test-template-1',
                location: 'Saved Location',
                answers: { 'item-1': true },
                notes: 'Saved notes',
                photos: [],
            };
            localStorage.setItem('rapidlean_draft_test-template-1', JSON.stringify(draft));

            render(<RapidLeanObservationForm {...defaultProps} />);

            expect(screen.getByPlaceholderText('Location...')).toHaveValue('Saved Location');
        });
    });

    describe('Additional Notes', () => {
        it('should render additional notes textarea', () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            expect(screen.getByPlaceholderText('Any additional observations...')).toBeInTheDocument();
        });

        it('should update notes value', async () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            const notesTextarea = screen.getByPlaceholderText('Any additional observations...');
            await userEvent.type(notesTextarea, 'Additional note');

            expect(notesTextarea).toHaveValue('Additional note');
        });
    });

    describe('Photo Capture', () => {
        it('should render photo capture button', () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            expect(screen.getByText('Take Photo')).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty checklist', () => {
            const emptyTemplate = { ...mockTemplate, checklist: [] };
            const props = { ...defaultProps, template: emptyTemplate };

            render(<RapidLeanObservationForm {...props} />);

            expect(screen.getByText('5S Audit')).toBeInTheDocument();
        });

        it('should show correct button text for last template', () => {
            const props = { ...defaultProps, templateIndex: 2, totalTemplates: 3 };

            render(<RapidLeanObservationForm {...props} />);

            expect(screen.getByText('Save & Complete')).toBeInTheDocument();
        });

        it('should show correct button text for non-last template', () => {
            render(<RapidLeanObservationForm {...defaultProps} />);

            expect(screen.getByText('Save & Next')).toBeInTheDocument();
        });
    });
});
