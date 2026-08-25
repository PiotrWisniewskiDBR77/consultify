/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

function setReducedTransparency(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches,
      media: '(prefers-reduced-transparency: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

beforeEach(() => setReducedTransparency(false));

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

  it('renders the four fixed creator bands at the accepted heights', () => {
    render(
      <WizardModal
        {...baseProps}
        activeStepIndex={0}
        geometry="creator"
        creatorScopeSummary="Scope"
      />
    );

    expect(document.querySelector('[data-creator-band="header"]')).toHaveClass('h-[60px]');
    expect(document.querySelector('[data-creator-band="steps"]')).toHaveClass('h-[70px]');
    expect(document.querySelector('[data-creator-band="scope"]')).toHaveClass('h-[36px]');
    expect(document.querySelector('[data-creator-band="footer"]')).toHaveClass('h-[70px]');
  });

  it('keeps the creator content crystalline and delegates scrolling to its body', () => {
    render(<WizardModal {...baseProps} activeStepIndex={0} geometry="creator" />);
    expect(document.querySelector('[data-creator-scroll="content"]')).toHaveClass(
      'overflow-hidden',
      'bg-c-surface'
    );
    expect(document.querySelector('[data-creator-scroll="content"]')).not.toHaveClass(
      'creator-glass-band'
    );
  });

  it('switches every glass band to opaque fallback for reduced transparency', () => {
    setReducedTransparency(true);
    render(<WizardModal {...baseProps} activeStepIndex={0} geometry="creator" />);
    const bands = document.querySelectorAll('[data-creator-band]');
    expect(bands).toHaveLength(4);
    bands.forEach((band) => expect(band).toHaveAttribute('data-transparency', 'opaque'));
  });

  it('does not add creator bands to the legacy variant', () => {
    render(<WizardModal {...baseProps} activeStepIndex={0} />);
    expect(document.querySelector('[data-creator-band]')).toBeNull();
  });

  it('expands scope details on demand and resets them when the step changes', () => {
    const { rerender } = render(
      <WizardModal
        {...baseProps}
        activeStepIndex={0}
        geometry="creator"
        creatorScopeSummary="Scope"
        creatorScopeDetails="Calculated details"
        creatorScopeExpandLabel="Expand"
        creatorScopeCollapseLabel="Collapse"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Expand/i }));
    expect(screen.getByText('Calculated details')).toBeInTheDocument();

    rerender(
      <WizardModal
        {...baseProps}
        activeStepIndex={1}
        geometry="creator"
        creatorScopeSummary="Scope"
        creatorScopeDetails="Calculated details"
        creatorScopeExpandLabel="Expand"
        creatorScopeCollapseLabel="Collapse"
      />
    );
    expect(screen.queryByText('Calculated details')).toBeNull();
  });
});
