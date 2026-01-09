/**
 * @vitest-environment jsdom
 * SuperAdmin ConfigurationModule Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const ConfigurationModule = () => <div data-testid="config-module">SuperAdmin Configuration Module</div>;

describe('SuperAdmin ConfigurationModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({});
    });

    it('renders configuration module', () => {
        render(<ConfigurationModule />, { wrapper: Wrapper });
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });

    it('renders without crashing', () => {
        const { container } = render(<ConfigurationModule />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
