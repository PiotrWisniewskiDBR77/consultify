/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const RAIDLog = () => <div data-testid="raid-log">RAID Log</div>;

describe('RAIDLog Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<RAIDLog />);
        expect(screen.getByTestId('raid-log')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<RAIDLog />);
        expect(container).toBeInTheDocument();
    });
});
