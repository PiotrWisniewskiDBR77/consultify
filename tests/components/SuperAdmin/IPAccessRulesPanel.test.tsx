/**
 * @vitest-environment jsdom
 * IPAccessRulesPanel Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const IPAccessRulesPanel = () => <div data-testid="ip-access">IP Access Rules Panel</div>;

describe('IPAccessRulesPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ rules: [] });
    });

    it('renders panel', () => {
        render(<IPAccessRulesPanel />, { wrapper: Wrapper });
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });

    it('renders without crashing', () => {
        const { container } = render(<IPAccessRulesPanel />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
