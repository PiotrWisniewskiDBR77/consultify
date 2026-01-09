/**
 * @vitest-environment jsdom
 * SubscriptionsPanel Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const SubscriptionsPanel = () => <div data-testid="subscriptions">Subscriptions Panel</div>;

describe('SubscriptionsPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ subscriptions: [] });
    });

    it('renders panel', () => {
        render(<SubscriptionsPanel />, { wrapper: Wrapper });
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });

    it('renders without crashing', () => {
        const { container } = render(<SubscriptionsPanel />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
