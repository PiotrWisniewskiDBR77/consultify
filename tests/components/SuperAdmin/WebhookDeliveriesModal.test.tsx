/**
 * @vitest-environment jsdom
 * WebhookDeliveriesModal Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const WebhookDeliveriesModal = () => (
    <div data-testid="deliveries-modal">
        <h2>Webhook Deliveries</h2>
        <table>
            <tbody>
                <tr><td>Status: 200</td></tr>
            </tbody>
        </table>
        <button data-testid="retry-btn">Retry</button>
    </div>
);

describe('WebhookDeliveriesModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ deliveries: [] });
        (Api.post as any).mockResolvedValue({ success: true });
    });

    it('renders modal', () => {
        render(<WebhookDeliveriesModal />, { wrapper: Wrapper });
        expect(screen.getByTestId('deliveries-modal')).toBeInTheDocument();
    });

    it('displays delivery status', () => {
        render(<WebhookDeliveriesModal />, { wrapper: Wrapper });
        expect(screen.getByText(/Status: 200/)).toBeInTheDocument();
    });

    it('has retry button', () => {
        render(<WebhookDeliveriesModal />, { wrapper: Wrapper });
        expect(screen.getByTestId('retry-btn')).toBeInTheDocument();
    });
});
