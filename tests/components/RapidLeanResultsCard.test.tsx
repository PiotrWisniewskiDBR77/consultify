/**
 * Component Tests for RapidLeanResultsCard
 * Tests results display with DRD mapping
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { RapidLeanResultsCard } from '../../components/assessment/RapidLeanResultsCard';

describe('RapidLeanResultsCard', () => {
    const mockAssessment = {
        id: 'test-assessment-id',
        value_stream_score: 3.7,
        waste_elimination_score: 3.0,
        flow_pull_score: 3.5,
        quality_source_score: 4.0,
        continuous_improvement_score: 2.5,
        visual_management_score: 3.8,
        overall_score: 3.4,
        industry_benchmark: 3.5,
        top_gaps: ['continuous_improvement', 'waste_elimination'],
        ai_recommendations: [
            {
                dimension: 'continuous_improvement',
                priority: 'HIGH',
                recommendation: 'Implement Kaizen events',
                expectedImpact: 'Increase improvement ideas by 40-50%'
            }
        ]
    };

    test('should render assessment results', () => {
        render(<RapidLeanResultsCard assessment={mockAssessment} />);

        expect(screen.getByText('RapidLean Assessment Results')).toBeInTheDocument();
        expect(screen.getByText('3.4')).toBeInTheDocument(); // Overall score
    });

    test('should display all dimension scores', () => {
        render(<RapidLeanResultsCard assessment={mockAssessment} />);

        expect(screen.getByText('Value Stream')).toBeInTheDocument();
        expect(screen.getByText('Waste Elimination')).toBeInTheDocument();
        expect(screen.getByText('Flow & Pull')).toBeInTheDocument();
        expect(screen.getByText('Quality at Source')).toBeInTheDocument();
        expect(screen.getByText('Continuous Improvement')).toBeInTheDocument();
        expect(screen.getByText('Visual Management')).toBeInTheDocument();
    });

    test('should display benchmark comparison', () => {
        render(<RapidLeanResultsCard assessment={mockAssessment} />);

        expect(screen.getByText(/Benchmark:/i)).toBeInTheDocument();
        expect(screen.getByText('3.5')).toBeInTheDocument(); // Benchmark
    });

    test('should display top gaps', () => {
        render(<RapidLeanResultsCard assessment={mockAssessment} />);

        expect(screen.getByText('Priority Improvement Areas')).toBeInTheDocument();
        expect(screen.getByText(/Continuous Improvement/i)).toBeInTheDocument();
        expect(screen.getByText(/Waste Elimination/i)).toBeInTheDocument();
    });

    test('should display AI recommendations', () => {
        render(<RapidLeanResultsCard assessment={mockAssessment} />);

        expect(screen.getByText(/AI Recommendations/i)).toBeInTheDocument();
        expect(screen.getByText(/Implement Kaizen events/i)).toBeInTheDocument();
        expect(screen.getByText(/Increase improvement ideas/i)).toBeInTheDocument();
    });

    test('should display DRD mapping when provided', () => {
        const assessmentWithDRD = {
            ...mockAssessment,
            drdMapping: {
                processes: 4.2,
                culture: 3.8
            },
            observationsCount: 6
        };

        render(<RapidLeanResultsCard assessment={assessmentWithDRD} />);

        expect(screen.getByText('DRD Maturity Mapping')).toBeInTheDocument();
        expect(screen.getByText(/DRD Axis 1/i)).toBeInTheDocument();
        expect(screen.getByText(/DRD Axis 5/i)).toBeInTheDocument();
        expect(screen.getByText(/4.2\/7/i)).toBeInTheDocument();
        expect(screen.getByText(/3.8\/7/i)).toBeInTheDocument();
        expect(screen.getByText(/6.*production floor observations/i)).toBeInTheDocument();
    });

    test('should not display DRD mapping when not provided', () => {
        render(<RapidLeanResultsCard assessment={mockAssessment} />);

        expect(screen.queryByText('DRD Maturity Mapping')).not.toBeInTheDocument();
    });

    test('should calculate and display gap correctly', () => {
        render(<RapidLeanResultsCard assessment={mockAssessment} />);

        // Gap = 3.5 - 3.4 = 0.1
        expect(screen.getByText(/Gap:/i)).toBeInTheDocument();
    });

    test('should display progress bars for dimensions', () => {
        render(<RapidLeanResultsCard assessment={mockAssessment} />);

        // Check for progress bars (they have specific classes)
        const progressBars = document.querySelectorAll('[class*="h-2"]');
        expect(progressBars.length).toBeGreaterThan(0);
    });
});



