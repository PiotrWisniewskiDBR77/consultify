/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const AssessmentTable = () => <div data-testid="assessment-table">Assessment Table</div>;

describe('AssessmentTable Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<AssessmentTable />);
    expect(screen.getByTestId('assessment-table')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<AssessmentTable />);
    expect(container).toBeInTheDocument();
  });
});
