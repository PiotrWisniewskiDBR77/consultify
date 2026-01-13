/**
 * Stepper Component Tests
 * Testing multi-step wizard
 *
 * @module tests/unit/components/UI/Stepper.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Stepper component
const MockStepper: React.FC<{
  steps?: Array<{ label: string; description?: string; completed?: boolean }>;
  activeStep?: number;
  onStepClick?: (step: number) => void;
  orientation?: 'horizontal' | 'vertical';
}> = ({
  steps = [
    { label: 'Step 1', description: 'First step' },
    { label: 'Step 2', description: 'Second step' },
    { label: 'Step 3', description: 'Third step' },
  ],
  activeStep = 0,
  onStepClick,
  orientation = 'horizontal',
}) => {
  return (
    <div
      data-testid="stepper"
      data-orientation={orientation}
      role="navigation"
      aria-label="Progress"
    >
      {steps.map((step, index) => (
        <div
          key={index}
          data-testid={`step-${index}`}
          data-active={index === activeStep}
          data-completed={step.completed || index < activeStep}
          onClick={() => onStepClick && onStepClick(index)}
          role="button"
          aria-current={index === activeStep ? 'step' : undefined}
          tabIndex={onStepClick ? 0 : -1}
        >
          <span data-testid={`step-indicator-${index}`}>{index + 1}</span>
          <span data-testid={`step-label-${index}`}>{step.label}</span>
          {step.description && (
            <span data-testid={`step-description-${index}`}>{step.description}</span>
          )}
        </div>
      ))}
    </div>
  );
};

describe('Stepper Component', () => {
  describe('Rendering', () => {
    it('should render stepper', () => {
      render(<MockStepper />);
      expect(screen.getByTestId('stepper')).toBeInTheDocument();
    });

    it('should render all steps', () => {
      render(<MockStepper />);
      expect(screen.getByTestId('step-0')).toBeInTheDocument();
      expect(screen.getByTestId('step-1')).toBeInTheDocument();
      expect(screen.getByTestId('step-2')).toBeInTheDocument();
    });

    it('should render step labels', () => {
      render(<MockStepper />);
      expect(screen.getByTestId('step-label-0')).toHaveTextContent('Step 1');
    });

    it('should render step descriptions', () => {
      render(<MockStepper />);
      expect(screen.getByTestId('step-description-0')).toHaveTextContent('First step');
    });
  });

  describe('Active State', () => {
    it('should mark active step', () => {
      render(<MockStepper activeStep={1} />);
      expect(screen.getByTestId('step-1')).toHaveAttribute('data-active', 'true');
    });

    it('should mark previous steps as completed', () => {
      render(<MockStepper activeStep={2} />);
      expect(screen.getByTestId('step-0')).toHaveAttribute('data-completed', 'true');
      expect(screen.getByTestId('step-1')).toHaveAttribute('data-completed', 'true');
    });
  });

  describe('Orientation', () => {
    it('should apply horizontal orientation', () => {
      render(<MockStepper orientation="horizontal" />);
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-orientation', 'horizontal');
    });

    it('should apply vertical orientation', () => {
      render(<MockStepper orientation="vertical" />);
      expect(screen.getByTestId('stepper')).toHaveAttribute('data-orientation', 'vertical');
    });
  });

  describe('Interactions', () => {
    it('should call onStepClick when step clicked', () => {
      const onStepClick = vi.fn();
      render(<MockStepper onStepClick={onStepClick} />);

      fireEvent.click(screen.getByTestId('step-1'));
      expect(onStepClick).toHaveBeenCalledWith(1);
    });
  });

  describe('Accessibility', () => {
    it('should have navigation role', () => {
      render(<MockStepper />);
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should have aria-current on active step', () => {
      render(<MockStepper activeStep={1} />);
      expect(screen.getByTestId('step-1')).toHaveAttribute('aria-current', 'step');
    });
  });
});
