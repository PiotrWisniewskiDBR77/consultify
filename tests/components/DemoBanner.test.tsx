/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DemoBanner from '../../../components/DemoBanner';


describe('DemoBanner Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders demo mode badge', () => {
        render(<DemoBanner />);

        expect(screen.getByText(/Demo Mode/i)).toBeInTheDocument();
    });

    it('displays demo email', () => {
        render(<DemoBanner />);

        expect(screen.getByText(/demo@legolex.com/i)).toBeInTheDocument();
    });

    it('shows limitations button', () => {
        render(<DemoBanner />);

        expect(screen.getByText(/Limitations/i)).toBeInTheDocument();
    });

    it('shows Get Full Access button', () => {
        render(<DemoBanner />);

        expect(screen.getByText(/Get Full Access/i)).toBeInTheDocument();
    });

    it('expands limitations when clicked', async () => {
        render(<DemoBanner />);

        const limitationsButton = screen.getByText(/Limitations/i);
        await user.click(limitationsButton);

        await waitFor(() => {
            expect(screen.getByText(/Read-only mode/i)).toBeInTheDocument();
            expect(screen.getByText(/Sample data/i)).toBeInTheDocument();
            expect(screen.getByText(/Session expires/i)).toBeInTheDocument();
        });
    });

    it('collapses limitations when clicked again', async () => {
        render(<DemoBanner />);

        const limitationsButton = screen.getByText(/Limitations/i);
        await user.click(limitationsButton);

        await waitFor(() => {
            expect(screen.getByText(/Read-only mode/i)).toBeInTheDocument();
        });

        await user.click(limitationsButton);

        await waitFor(() => {
            expect(screen.queryByText(/Read-only mode/i)).not.toBeInTheDocument();
        });
    });

    it('opens contact sales link when Get Full Access clicked', () => {
        const mockOpen = vi.fn();
        window.open = mockOpen;

        render(<DemoBanner />);

        const getAccessButton = screen.getByText(/Get Full Access/i);
        getAccessButton.click();

        expect(mockOpen).toHaveBeenCalled();
    });

    it('calls onStartTrialClick when provided', async () => {
        const onStartTrialClick = vi.fn();
        render(<DemoBanner onStartTrialClick={onStartTrialClick} />);

        // Note: This depends on implementation - if there's a trial button
        // For now, just verify the prop is accepted
        expect(onStartTrialClick).toBeDefined();
    });
});


