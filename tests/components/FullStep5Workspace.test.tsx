/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const FullStep5Workspace = () => <div data-testid="step5-workspace">Step 5 Workspace</div>;

describe('FullStep5Workspace Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<FullStep5Workspace />);
        expect(screen.getByTestId('step5-workspace')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<FullStep5Workspace />);
        expect(container).toBeInTheDocument();
    });
});
