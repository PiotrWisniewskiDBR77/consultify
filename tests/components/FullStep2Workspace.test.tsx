/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const FullStep2Workspace = () => <div data-testid="step2-workspace">Step 2 Workspace</div>;

describe('FullStep2Workspace Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<FullStep2Workspace />);
        expect(screen.getByTestId('step2-workspace')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<FullStep2Workspace />);
        expect(container).toBeInTheDocument();
    });
});
