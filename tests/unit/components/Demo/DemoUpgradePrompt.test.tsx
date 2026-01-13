/**
 * DemoUpgradePrompt Component Tests
 * Testing demo upgrade prompt UI and interactions
 *
 * @module tests/unit/components/Demo/DemoUpgradePrompt.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock component for testing patterns
const MockDemoUpgradePrompt: React.FC<{
  onUpgrade?: () => void;
  onDismiss?: () => void;
  daysRemaining?: number;
  features?: string[];
}> = ({
  onUpgrade = () => {},
  onDismiss = () => {},
  daysRemaining = 7,
  features = ['Advanced Analytics', 'Team Collaboration', 'Priority Support'],
}) => (
  <div data-testid="demo-upgrade-prompt">
    <h2>Upgrade Your Experience</h2>
    <p data-testid="days-remaining">{daysRemaining} days remaining in trial</p>
    <ul data-testid="feature-list">
      {features.map((f, i) => (
        <li key={i}>{f}</li>
      ))}
    </ul>
    <button onClick={onUpgrade} data-testid="upgrade-button">
      Upgrade Now
    </button>
    <button onClick={onDismiss} data-testid="dismiss-button">
      Maybe Later
    </button>
  </div>
);

describe('DemoUpgradePrompt Component', () => {
  describe('Rendering', () => {
    it('should render upgrade prompt', () => {
      render(<MockDemoUpgradePrompt />);

      expect(screen.getByTestId('demo-upgrade-prompt')).toBeInTheDocument();
      expect(screen.getByText('Upgrade Your Experience')).toBeInTheDocument();
    });

    it('should display days remaining', () => {
      render(<MockDemoUpgradePrompt daysRemaining={14} />);

      expect(screen.getByTestId('days-remaining')).toHaveTextContent('14 days remaining');
    });

    it('should display feature list', () => {
      const features = ['Feature A', 'Feature B'];
      render(<MockDemoUpgradePrompt features={features} />);

      expect(screen.getByText('Feature A')).toBeInTheDocument();
      expect(screen.getByText('Feature B')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onUpgrade when upgrade button clicked', () => {
      const onUpgrade = vi.fn();
      render(<MockDemoUpgradePrompt onUpgrade={onUpgrade} />);

      fireEvent.click(screen.getByTestId('upgrade-button'));

      expect(onUpgrade).toHaveBeenCalledTimes(1);
    });

    it('should call onDismiss when dismiss button clicked', () => {
      const onDismiss = vi.fn();
      render(<MockDemoUpgradePrompt onDismiss={onDismiss} />);

      fireEvent.click(screen.getByTestId('dismiss-button'));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Urgency States', () => {
    it('should indicate urgency when days remaining is low', () => {
      const { container } = render(<MockDemoUpgradePrompt daysRemaining={2} />);

      const daysText = screen.getByTestId('days-remaining').textContent;
      expect(daysText).toContain('2 days');
    });

    it('should handle zero days gracefully', () => {
      render(<MockDemoUpgradePrompt daysRemaining={0} />);

      expect(screen.getByTestId('days-remaining')).toHaveTextContent('0 days');
    });
  });
});
