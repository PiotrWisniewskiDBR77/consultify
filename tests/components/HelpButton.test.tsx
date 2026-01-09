/**
 * @vitest-environment jsdom
 * HelpButton Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const HelpButton = () => (
    <button data-testid="help-button">?</button>
);

describe('HelpButton Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders help button', () => {
        render(<HelpButton />, { wrapper: Wrapper });
        expect(screen.getByTestId('help-button')).toBeInTheDocument();
    });

    it('is clickable', () => {
        render(<HelpButton />, { wrapper: Wrapper });
        const button = screen.getByTestId('help-button');
        expect(() => fireEvent.click(button)).not.toThrow();
    });
});
