/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EntryFooter } from '../../src/components/Landing/EntryFooter';
import i18n from '../../src/i18n';

function renderFooter(props?: Partial<React.ComponentProps<typeof EntryFooter>>) {
  return render(
    <I18nextProvider i18n={i18n}>
      <EntryFooter {...props} />
    </I18nextProvider>,
  );
}

describe('EntryFooter CTA authority', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('routes demo and trial through shared callbacks when provided', () => {
    const onDemoClick = vi.fn();
    const onTrialClick = vi.fn();
    renderFooter({ onDemoClick, onTrialClick });

    fireEvent.click(screen.getByRole('button', { name: 'Try Demo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Trial' }));

    expect(onDemoClick).toHaveBeenCalledTimes(1);
    expect(onTrialClick).toHaveBeenCalledTimes(1);
  });

  it('keeps safe href fallbacks when shared callbacks are absent', () => {
    renderFooter();

    expect(screen.getByRole('link', { name: 'Try Demo' })).toHaveAttribute('href', '/demo');
    expect(screen.getByRole('link', { name: 'Start Trial' })).toHaveAttribute('href', '/trial');
  });
});
