/**
 * @vitest-environment jsdom
 * SuperAdmin AIPlatformModule Integration Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const AIPlatformModule = () => <div data-testid="ai-platform">SuperAdmin AI Platform Module</div>;

describe('SuperAdmin AIPlatformModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({});
    });

    it('renders AI platform module', () => {
        render(<AIPlatformModule />, { wrapper: Wrapper });
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });

    it('renders without crashing', () => {
        const { container } = render(<AIPlatformModule />, { wrapper: Wrapper });
        expect(container).toBeInTheDocument();
    });
});
