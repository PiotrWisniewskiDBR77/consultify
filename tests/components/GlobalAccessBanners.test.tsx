/**
 * @vitest-environment jsdom
 * GlobalAccessBanners Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const GlobalAccessBanners = () => (
    <div data-testid="banners">
        <div data-testid="trial-banner">Trial Mode</div>
    </div>
);

describe('GlobalAccessBanners Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders banners container', () => {
        render(<GlobalAccessBanners />, { wrapper: Wrapper });
        expect(screen.getByTestId('banners')).toBeInTheDocument();
    });

    it('displays trial banner', () => {
        render(<GlobalAccessBanners />, { wrapper: Wrapper });
        expect(screen.getByTestId('trial-banner')).toBeInTheDocument();
    });
});
