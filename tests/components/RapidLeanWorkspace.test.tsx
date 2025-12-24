/**
 * Component Tests for RapidLeanWorkspace
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RapidLeanWorkspace } from '../../components/assessment/RapidLeanWorkspace';

// Mock API calls
jest.mock('axios', () => ({
    get: jest.fn(),
    post: jest.fn()
}));

describe('RapidLeanWorkspace', () => {
    const mockProps = {
        organizationId: 'test-org-id',
        projectId: 'test-project-id'
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render overview view by default', () => {
        render(<RapidLeanWorkspace {...mockProps} />);

        expect(screen.getByText('RapidLean Assessment')).toBeInTheDocument();
        expect(screen.getByText(/Production floor observation/i)).toBeInTheDocument();
    });

    test('should display DRD integration information', () => {
        render(<RapidLeanWorkspace {...mockProps} />);

        expect(screen.getByText('DRD Integration')).toBeInTheDocument();
        expect(screen.getByText(/DRD Axis 1/i)).toBeInTheDocument();
        expect(screen.getByText(/DRD Axis 5/i)).toBeInTheDocument();
    });

    test('should display all 6 observation templates', () => {
        render(<RapidLeanWorkspace {...mockProps} />);

        expect(screen.getByText('Value Stream Observation')).toBeInTheDocument();
        expect(screen.getByText('Waste Identification')).toBeInTheDocument();
        expect(screen.getByText('Flow & Pull Systems')).toBeInTheDocument();
        expect(screen.getByText('Quality at Source')).toBeInTheDocument();
        expect(screen.getByText('Continuous Improvement')).toBeInTheDocument();
        expect(screen.getByText('Visual Management')).toBeInTheDocument();
    });

    test('should show start observation button when no assessment exists', () => {
        render(<RapidLeanWorkspace {...mockProps} />);

        const startButton = screen.getByText(/Start Production Floor Observation/i);
        expect(startButton).toBeInTheDocument();
    });

    test('should navigate to observation view when start button clicked', () => {
        render(<RapidLeanWorkspace {...mockProps} />);

        const startButton = screen.getByText(/Start Production Floor Observation/i);
        fireEvent.click(startButton);

        // Should show observation form
        waitFor(() => {
            expect(screen.getByText('Value Stream Observation')).toBeInTheDocument();
        });
    });

    test('should display estimated time information', () => {
        render(<RapidLeanWorkspace {...mockProps} />);

        expect(screen.getByText(/Estimated time/i)).toBeInTheDocument();
        expect(screen.getByText(/60-90 minutes/i)).toBeInTheDocument();
    });

    test('should show view results button when assessment exists', async () => {
        // Mock existing assessment
        const axios = require('axios');
        axios.get.mockResolvedValueOnce({
            data: {
                assessments: [{
                    id: 'test-assessment-id',
                    overall_score: 3.5,
                    created_at: new Date().toISOString()
                }]
            }
        });

        axios.get.mockResolvedValueOnce({
            data: {
                assessment: {
                    id: 'test-assessment-id',
                    overall_score: 3.5,
                    value_stream_score: 3.7
                }
            }
        });

        render(<RapidLeanWorkspace {...mockProps} />);

        await waitFor(() => {
            const viewResultsButton = screen.getByText(/View Results/i);
            expect(viewResultsButton).toBeInTheDocument();
        });
    });
});

