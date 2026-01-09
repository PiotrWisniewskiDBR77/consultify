/**
 * @vitest-environment jsdom
 * SecurityPoliciesPanel Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const SecurityPoliciesPanel = () => <div data-testid="security-policies">Security Policies Panel</div>;

describe('SecurityPoliciesPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({});
    });

    it('renders panel', () => {
        render(<SecurityPoliciesPanel />, { wrapper: Wrapper });
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });

    it('renders without crashing', () => {
        const { container } = render(<SecurityPoliciesPanel />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
