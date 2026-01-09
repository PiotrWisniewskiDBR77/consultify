/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const FullStep1Workspace = () => <div data-testid="step1-workspace">Step 1 Workspace</div>;

describe('FullStep1Workspace Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<FullStep1Workspace />);
        expect(screen.getByTestId('step1-workspace')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<FullStep1Workspace />);
        expect(container).toBeInTheDocument();
    });
});
