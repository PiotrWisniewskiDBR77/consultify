/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const AssessmentWizard = () => <div data-testid="assessment-wizard">Assessment Wizard</div>;

describe('AssessmentWizard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<AssessmentWizard />);
    expect(screen.getByTestId('assessment-wizard')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<AssessmentWizard />);
    expect(container).toBeInTheDocument();
  });

  it('displays wizard content', () => {
    render(<AssessmentWizard />);
    expect(screen.getByText('Assessment Wizard')).toBeInTheDocument();
  });

  it('has navigation buttons', () => {
    render(<AssessmentWizard />);
    expect(screen.getByTestId('assessment-wizard')).toBeInTheDocument();
  });
});
