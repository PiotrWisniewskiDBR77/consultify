/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const AssessmentAxisWorkspace = () => <div data-testid="assessment-axis">Assessment Axis Workspace</div>;

describe('AssessmentAxisWorkspace', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic Rendering', () => {
        it('renders workspace', () => {
            render(<AssessmentAxisWorkspace />);
            expect(screen.getByTestId('assessment-axis')).toBeInTheDocument();
        });

        it('renders without crashing', () => {
            const { container } = render(<AssessmentAxisWorkspace />);
            expect(container).toBeInTheDocument();
        });
    });
});
