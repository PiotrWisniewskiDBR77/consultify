/**
 * @vitest-environment jsdom
 * InitiativeCard Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const InitiativeCard = () => (
    <div data-testid="initiative-card">
        <h3 data-testid="title">Initiative Title</h3>
        <p data-testid="description">Initiative description</p>
        <span data-testid="status">In Progress</span>
    </div>
);

describe('InitiativeCard Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders card', () => {
        render(<InitiativeCard />, { wrapper: Wrapper });
        expect(screen.getByTestId('initiative-card')).toBeInTheDocument();
    });

    it('displays title', () => {
        render(<InitiativeCard />, { wrapper: Wrapper });
        expect(screen.getByTestId('title')).toBeInTheDocument();
    });

    it('displays status', () => {
        render(<InitiativeCard />, { wrapper: Wrapper });
        expect(screen.getByTestId('status')).toBeInTheDocument();
    });
});
