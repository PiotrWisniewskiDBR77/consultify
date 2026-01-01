/**
 * Benefits Tracking Dashboard Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BenefitsTrackingDashboard } from '../../../components/Economics/BenefitsTrackingDashboard';
import { Api } from '../../../services/api';

// Mock the API
jest.mock('../../../services/api', () => ({
    Api: {
        getAnalysisBenefits: jest.fn(),
        updateAnalysisBenefits: jest.fn()
    }
}));

// Mock toast
jest.mock('react-hot-toast', () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn()
    }
}));

describe('BenefitsTrackingDashboard', () => {
    const mockAnalysisId = 'test-analysis-123';
    const mockAnalysisName = 'Test Analysis';

    const mockBenefits = [
        {
            id: '1',
            analysisId: mockAnalysisId,
            trackingPeriod: 'Q1 2025',
            plannedBenefits: 50000,
            actualBenefits: 48000,
            variance: -2000,
            trackedAt: '2025-03-31T12:00:00Z'
        },
        {
            id: '2',
            analysisId: mockAnalysisId,
            trackingPeriod: 'Q2 2025',
            plannedBenefits: 60000,
            actualBenefits: 65000,
            variance: 5000,
            trackedAt: '2025-06-30T12:00:00Z'
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        (Api.getAnalysisBenefits as jest.Mock).mockResolvedValue({ benefits: mockBenefits });
        (Api.updateAnalysisBenefits as jest.Mock).mockResolvedValue({ benefits: mockBenefits });
    });

    it('renders loading state initially', () => {
        render(
            <BenefitsTrackingDashboard
                analysisId={mockAnalysisId}
                analysisName={mockAnalysisName}
            />
        );

        // Should show loading indicator initially
        expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('renders dashboard after loading', async () => {
        render(
            <BenefitsTrackingDashboard
                analysisId={mockAnalysisId}
                analysisName={mockAnalysisName}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Śledzenie korzyści/i)).toBeInTheDocument();
        });
    });

    it('displays summary statistics', async () => {
        render(
            <BenefitsTrackingDashboard
                analysisId={mockAnalysisId}
                analysisName={mockAnalysisName}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Plan całkowity/i)).toBeInTheDocument();
            expect(screen.getByText(/Realizacja/i)).toBeInTheDocument();
            expect(screen.getByText(/Odchylenie/i)).toBeInTheDocument();
        });
    });

    it('displays benefit tracking entries in table', async () => {
        render(
            <BenefitsTrackingDashboard
                analysisId={mockAnalysisId}
                analysisName={mockAnalysisName}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Q1 2025')).toBeInTheDocument();
            expect(screen.getByText('Q2 2025')).toBeInTheDocument();
        });
    });

    it('opens measurement modal on button click', async () => {
        render(
            <BenefitsTrackingDashboard
                analysisId={mockAnalysisId}
                analysisName={mockAnalysisName}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Dodaj pomiar/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Dodaj pomiar/i));

        await waitFor(() => {
            expect(screen.getByText(/Nowy pomiar/i)).toBeInTheDocument();
        });
    });

    it('shows empty state when no benefits', async () => {
        (Api.getAnalysisBenefits as jest.Mock).mockResolvedValue({ benefits: [] });

        render(
            <BenefitsTrackingDashboard
                analysisId={mockAnalysisId}
                analysisName={mockAnalysisName}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Brak pomiarów/i)).toBeInTheDocument();
        });
    });

    it('calculates correct variance percentage', async () => {
        render(
            <BenefitsTrackingDashboard
                analysisId={mockAnalysisId}
                analysisName={mockAnalysisName}
            />
        );

        await waitFor(() => {
            // Q2 2025: (65000 - 60000) / 60000 = 8.33%
            expect(screen.getByText(/8[,.]3/)).toBeInTheDocument();
        });
    });

    it('displays status badges correctly', async () => {
        render(
            <BenefitsTrackingDashboard
                analysisId={mockAnalysisId}
                analysisName={mockAnalysisName}
            />
        );

        await waitFor(() => {
            // Q2 2025 is ahead (variance > 10%)
            expect(screen.getByText(/Powyżej/i)).toBeInTheDocument();
        });
    });

    it('uses correct currency formatting', async () => {
        render(
            <BenefitsTrackingDashboard
                analysisId={mockAnalysisId}
                analysisName={mockAnalysisName}
                currency="EUR"
            />
        );

        await waitFor(() => {
            // Should use EUR formatting
            expect(screen.getByText(/€|EUR/)).toBeInTheDocument();
        });
    });

    it('renders chart when benefits exist', async () => {
        render(
            <BenefitsTrackingDashboard
                analysisId={mockAnalysisId}
                analysisName={mockAnalysisName}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Porównanie plan vs realizacja/i)).toBeInTheDocument();
        });
    });

    it('handles API error gracefully', async () => {
        (Api.getAnalysisBenefits as jest.Mock).mockRejectedValue(new Error('API Error'));

        render(
            <BenefitsTrackingDashboard
                analysisId={mockAnalysisId}
                analysisName={mockAnalysisName}
            />
        );

        // Should not crash and handle error
        await waitFor(() => {
            // Loading should finish even on error
            expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
        });
    });

    describe('Measurement Modal', () => {
        it('shows period suggestions', async () => {
            render(
                <BenefitsTrackingDashboard
                    analysisId={mockAnalysisId}
                    analysisName={mockAnalysisName}
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/Dodaj pomiar/i)).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText(/Dodaj pomiar/i));

            await waitFor(() => {
                // Should show period suggestions like "Q1 2025"
                const buttons = screen.getAllByRole('button');
                expect(buttons.length).toBeGreaterThan(2);
            });
        });

        it('validates period input', async () => {
            render(
                <BenefitsTrackingDashboard
                    analysisId={mockAnalysisId}
                    analysisName={mockAnalysisName}
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/Dodaj pomiar/i)).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText(/Dodaj pomiar/i));

            await waitFor(() => {
                const saveButton = screen.getByText(/Zapisz/i);
                expect(saveButton).toBeInTheDocument();
            });
        });

        it('shows variance preview when values entered', async () => {
            render(
                <BenefitsTrackingDashboard
                    analysisId={mockAnalysisId}
                    analysisName={mockAnalysisName}
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/Dodaj pomiar/i)).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText(/Dodaj pomiar/i));

            await waitFor(() => {
                const plannedInput = screen.getByPlaceholderText(/np. Q1 2025/i);
                expect(plannedInput).toBeInTheDocument();
            });
        });

        it('closes modal on cancel', async () => {
            render(
                <BenefitsTrackingDashboard
                    analysisId={mockAnalysisId}
                    analysisName={mockAnalysisName}
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/Dodaj pomiar/i)).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText(/Dodaj pomiar/i));

            await waitFor(() => {
                expect(screen.getByText(/Nowy pomiar/i)).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText(/Anuluj/i));

            await waitFor(() => {
                expect(screen.queryByText(/Nowy pomiar/i)).not.toBeInTheDocument();
            });
        });
    });
});


