/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CREATOR_SHELL_GEOMETRY, WizardModal, type WizardStep } from '..';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en', getFixedT: () => (key: string) => key },
  }),
}));

const steps: WizardStep[] = [
  { id: 'one', label: { en: 'One', pl: 'Jeden' } },
  { id: 'two', label: { en: 'Two', pl: 'Dwa' } },
  { id: 'three', label: { en: 'Three', pl: 'Trzy' } },
];

const baseProps = {
  open: true,
  onClose: vi.fn(),
  title: { en: 'Creator', pl: 'Kreator' },
  steps,
  onStepChange: vi.fn(),
  onComplete: vi.fn(),
};

describe('WizardModal creator geometry', () => {
  it('exports the accepted stepped, compact placeholder and legacy dimensions', () => {
    expect(CREATOR_SHELL_GEOMETRY.stepped).toMatchObject({ width: 1040, height: 840 });
    expect(CREATOR_SHELL_GEOMETRY.compact).toEqual({ width: 840, height: 680 });
    expect(CREATOR_SHELL_GEOMETRY.legacy).toMatchObject({ width: 720, height: 560 });
  });

  it('keeps legacy geometry as the default for existing consumers', () => {
    render(<WizardModal {...baseProps} activeStepIndex={0} />);
    expect(screen.getByRole('dialog')).toHaveClass('h-[560px]', 'w-[720px]');
  });

  it('uses the accepted 1040x840 token only for the opt-in creator variant', () => {
    render(<WizardModal {...baseProps} activeStepIndex={0} geometry="creator" />);
    expect(screen.getByRole('dialog')).toHaveClass(
      'h-[min(840px,calc(100vh-48px))]',
      'w-[min(1040px,calc(100vw-64px))]'
    );
  });

  it('does not change creator geometry between steps', () => {
    const { rerender } = render(
      <WizardModal {...baseProps} activeStepIndex={0} geometry="creator" />
    );
    const initialClasses = screen.getByRole('dialog').className;

    rerender(<WizardModal {...baseProps} activeStepIndex={2} geometry="creator" />);
    expect(screen.getByRole('dialog').className).toBe(initialClasses);
  });
});
