import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemHealth } from '../../components/SystemHealth';
import { Api } from '../../services/api';

vi.mock('../../services/api');

describe('Component Test: SystemHealth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not render while loading', () => {
        (Api.checkSystemHealth as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => { }));

        const { container } = render(<SystemHealth />);
        expect(container.firstChild).toBeNull();
    });

    it('displays online status when system is healthy', async () => {
        (Api.checkSystemHealth as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'ok', latency: 50 });

        render(<SystemHealth />);

        await waitFor(() => {
            expect(screen.getByText(/System Online/i)).toBeInTheDocument();
        });
    });

    it('displays latency when online', async () => {
        (Api.checkSystemHealth as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'ok', latency: 100 });

        render(<SystemHealth />);

        await waitFor(() => {
            expect(screen.getByText(/100ms latency/i)).toBeInTheDocument();
        });
    });

    it('displays offline status when system is down', async () => {
        (Api.checkSystemHealth as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Connection failed'));

        render(<SystemHealth />);

        await waitFor(() => {
            expect(screen.getByText(/System Offline/i)).toBeInTheDocument();
        });
    });

    it('polls health status periodically', async () => {
        vi.useFakeTimers();
        const checkSystemHealthMock = vi.fn().mockResolvedValue({ status: 'ok', latency: 50 });
        (Api.checkSystemHealth as ReturnType<typeof vi.fn>).mockImplementation(checkSystemHealthMock);

        render(<SystemHealth />);

        // Initial call should happen immediately on mount
        expect(checkSystemHealthMock).toHaveBeenCalledTimes(1);

        // Wait for initial promise to resolve
        await vi.runAllTimersAsync();

        // Advance time by 30 seconds to trigger interval
        await React.act(async () => {
            vi.advanceTimersByTime(30000);
            await vi.runAllTimersAsync();
        });

        // Should have called again after interval
        expect(checkSystemHealthMock).toHaveBeenCalledTimes(2);

        vi.useRealTimers();
    });
});
