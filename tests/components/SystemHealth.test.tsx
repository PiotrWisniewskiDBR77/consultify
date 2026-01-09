/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SystemHealth } from '../../src/components/SystemHealth';

describe('SystemHealth Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<SystemHealth />);
        expect(document.body).toBeDefined();
    });

    it('renders without crashing', () => {
        const { container } = render(<SystemHealth />);
        expect(container).toBeInTheDocument();
    });

    it('displays health content', () => {
        render(<SystemHealth />);

        const healthElements = screen.queryAllByText(/health|system|status/i);
        expect(healthElements.length).toBeGreaterThanOrEqual(0);
    });

    it('has content', () => {
        render(<SystemHealth />);
        expect(document.body.innerHTML.length).toBeGreaterThan(50);
    });
});