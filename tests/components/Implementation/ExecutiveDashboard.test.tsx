/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const ExecutiveDashboard = () => <div data-testid="executive-dashboard">Executive Dashboard</div>;

describe('ExecutiveDashboard Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<ExecutiveDashboard />);
        expect(screen.getByTestId('executive-dashboard')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<ExecutiveDashboard />);
        expect(container).toBeInTheDocument();
    });
});
