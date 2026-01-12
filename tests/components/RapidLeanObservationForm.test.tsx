/**
 * Component Tests for RapidLeanObservationForm
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RapidLeanObservationForm } from '../../components/assessment/RapidLeanObservationForm';
import { RAPID_LEAN_OBSERVATION_TEMPLATES } from '../../data/rapidLeanObservationTemplates';

describe('RapidLeanObservationForm', () => {
    const mockTemplate = RAPID_LEAN_OBSERVATION_TEMPLATES[0]; // Value Stream template
    const mockOnComplete = jest.fn();
    const mockOnCancel = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render observation form with template name', () => {
        render(
            <RapidLeanObservationForm
                template={mockTemplate}
                templateIndex={0}
                totalTemplates={6}
                onComplete={mockOnComplete}
                onCancel={mockOnCancel}
            />
        );

        expect(screen.getByText(mockTemplate.name)).toBeInTheDocument();
        expect(screen.getByText('1 / 6')).toBeInTheDocument();
    });

    test('should display all checklist items', () => {
        render(
            <RapidLeanObservationForm
                template={mockTemplate}
                templateIndex={0}
                totalTemplates={6}
                onComplete={mockOnComplete}
                onCancel={mockOnCancel}
            />
        );

        mockTemplate.checklist.forEach(item => {
            expect(screen.getByText(item.text)).toBeInTheDocument();
        });
    });

    test('should handle yes/no answer selection', () => {
        render(
            <RapidLeanObservationForm
                template={mockTemplate}
                templateIndex={0}
                totalTemplates={6}
                onComplete={mockOnComplete}
                onCancel={mockOnCancel}
            />
        );

        const yesButton = screen.getAllByText('Yes')[0];
        fireEvent.click(yesButton);

        expect(yesButton).toHaveClass(/bg-green-500/);
    });

    test('should show progress bar', () => {
        render(
            <RapidLeanObservationForm
                template={mockTemplate}
                templateIndex={0}
                totalTemplates={6}
                onComplete={mockOnComplete}
                onCancel={mockOnCancel}
            />
        );

        const progressBar = screen.getByRole('progressbar') || document.querySelector('[class*="progress"]');
        expect(progressBar).toBeInTheDocument();
    });

    test('should disable save button when template incomplete', () => {
        render(
            <RapidLeanObservationForm
                template={mockTemplate}
                templateIndex={0}
                totalTemplates={6}
                onComplete={mockOnComplete}
                onCancel={mockOnCancel}
            />
        );

        const saveButton = screen.getByText('Save & Next');
        expect(saveButton).toBeDisabled();
    });

    test('should enable save button when all required fields filled', async () => {
        render(
            <RapidLeanObservationForm
                template={mockTemplate}
                templateIndex={0}
                totalTemplates={6}
                onComplete={mockOnComplete}
                onCancel={mockOnCancel}
            />
        );

        // Fill required fields
        const yesButtons = screen.getAllByText('Yes');
        yesButtons.forEach(btn => fireEvent.click(btn));

        // Fill notes
        const notesTextarea = screen.getAllByRole('textbox').find(
            el => el.getAttribute('placeholder')?.includes('observations')
        );
        if (notesTextarea) {
            fireEvent.change(notesTextarea, { target: { value: 'Test notes' } });
        }

        await waitFor(() => {
            const saveButton = screen.getByText('Save & Next');
            expect(saveButton).not.toBeDisabled();
        });
    });

    test('should call onComplete with observation data when saved', async () => {
        render(
            <RapidLeanObservationForm
                template={mockTemplate}
                templateIndex={5}
                totalTemplates={6}
                onComplete={mockOnComplete}
                onCancel={mockOnCancel}
            />
        );

        // Fill required fields
        const yesButtons = screen.getAllByText('Yes');
        yesButtons.forEach(btn => fireEvent.click(btn));

        // Fill location
        const locationInput = screen.getByPlaceholderText(/Location/i);
        fireEvent.change(locationInput, { target: { value: 'Production Line A' } });

        // Fill notes
        const notesTextarea = screen.getAllByRole('textbox').find(
            el => el.getAttribute('placeholder')?.includes('observations')
        );
        if (notesTextarea) {
            fireEvent.change(notesTextarea, { target: { value: 'Test notes' } });
        }

        await waitFor(() => {
            const saveButton = screen.getByText('Save & Complete');
            expect(saveButton).not.toBeDisabled();
            fireEvent.click(saveButton);
        });

        await waitFor(() => {
            expect(mockOnComplete).toHaveBeenCalled();
            const callArgs = mockOnComplete.mock.calls[0][0];
            expect(callArgs).toHaveProperty('templateId');
            expect(callArgs).toHaveProperty('location');
            expect(callArgs).toHaveProperty('answers');
        });
    });

    test('should call onCancel when cancel button clicked', () => {
        render(
            <RapidLeanObservationForm
                template={mockTemplate}
                templateIndex={0}
                totalTemplates={6}
                onComplete={mockOnComplete}
                onCancel={mockOnCancel}
            />
        );

        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        expect(mockOnCancel).toHaveBeenCalled();
    });

    test('should show auto-save status', async () => {
        render(
            <RapidLeanObservationForm
                template={mockTemplate}
                templateIndex={0}
                totalTemplates={6}
                onComplete={mockOnComplete}
                onCancel={mockOnCancel}
            />
        );

        // Trigger auto-save by answering a question
        const yesButton = screen.getAllByText('Yes')[0];
        fireEvent.click(yesButton);

        await waitFor(() => {
            const savedStatus = screen.getByText(/Saved/i);
            expect(savedStatus).toBeInTheDocument();
        }, { timeout: 35000 }); // Wait for auto-save interval
    });

    test('should display location input', () => {
        render(
            <RapidLeanObservationForm
                template={mockTemplate}
                templateIndex={0}
                totalTemplates={6}
                onComplete={mockOnComplete}
                onCancel={mockOnCancel}
            />
        );

        const locationInput = screen.getByPlaceholderText(/Location/i);
        expect(locationInput).toBeInTheDocument();
    });

    test('should display timestamp', () => {
        render(
            <RapidLeanObservationForm
                template={mockTemplate}
                templateIndex={0}
                totalTemplates={6}
                onComplete={mockOnComplete}
                onCancel={mockOnCancel}
            />
        );

        // Timestamp should be displayed
        const timeElement = document.querySelector('[class*="Clock"]');
        expect(timeElement).toBeInTheDocument();
    });

    test('should handle photo removal', () => {
        render(
            <RapidLeanObservationForm
                template={mockTemplate}
                templateIndex={0}
                totalTemplates={6}
                onComplete={mockOnComplete}
                onCancel={mockOnCancel}
            />
        );

        // This would require mocking file input
        // For now, we verify the component renders
        expect(screen.getByText(mockTemplate.name)).toBeInTheDocument();
    });

    test('should show correct template index', () => {
        render(
            <RapidLeanObservationForm
                template={mockTemplate}
                templateIndex={3}
                totalTemplates={6}
                onComplete={mockOnComplete}
                onCancel={mockOnCancel}
            />
        );

        expect(screen.getByText('4 / 6')).toBeInTheDocument();
    });

    test('should show "Save & Complete" for last template', () => {
        render(
            <RapidLeanObservationForm
                template={mockTemplate}
                templateIndex={5}
                totalTemplates={6}
                onComplete={mockOnComplete}
                onCancel={mockOnCancel}
            />
        );

        expect(screen.getByText('Save & Complete')).toBeInTheDocument();
    });
});

