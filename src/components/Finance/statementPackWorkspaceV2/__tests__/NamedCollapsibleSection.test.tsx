/**
 * @vitest-environment jsdom
 *
 * `NamedCollapsibleSection` (OWN-FIN-006) — dowodzi, że KAŻDY trigger niesie
 * nazwę + stan/licznik (nie tylko strzałkę), realnie reaguje na klik, i że
 * zmiana propa `state` faktycznie zmienia DOM (kontrola negatywna).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { NamedCollapsibleSection } from '../NamedCollapsibleSection';

function Harness({ initialOpen = false, state = '5/5' }: { initialOpen?: boolean; state?: string }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <NamedCollapsibleSection
      id="quality"
      title="Kontrole jakości"
      state={state}
      tone="ok"
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      <div data-testid="panel-content">Treść panelu</div>
    </NamedCollapsibleSection>
  );
}

describe('NamedCollapsibleSection', () => {
  it('renders a named trigger with a state label — never a bare arrow', () => {
    render(<Harness />);
    const trigger = screen.getByTestId('named-collapsible-trigger-quality');
    expect(trigger).toHaveTextContent('Kontrole jakości');
    expect(screen.getByTestId('named-collapsible-state-quality')).toHaveTextContent('5/5');
  });

  it('toggles the panel open/closed on click and updates aria-expanded', () => {
    render(<Harness />);
    const trigger = screen.getByTestId('named-collapsible-trigger-quality');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('panel-content')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('panel-content')).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('panel-content')).not.toBeInTheDocument();
  });

  // KONTROLA NEGATYWNA: rerender z innym `state` musi zmienić DOM.
  it('NEGATIVE CONTROL — rerender with a different state prop changes the DOM', () => {
    const { rerender } = render(<Harness state="5/5" />);
    expect(screen.getByTestId('named-collapsible-state-quality')).toHaveTextContent('5/5');
    rerender(<Harness state="3/5 — uwaga" />);
    expect(screen.getByTestId('named-collapsible-state-quality')).toHaveTextContent('3/5 — uwaga');
    expect(screen.getByTestId('named-collapsible-state-quality')).not.toHaveTextContent('5/5 —');
  });

  it('wires aria-controls/aria-labelledby between trigger and panel', () => {
    render(<Harness initialOpen />);
    const trigger = screen.getByTestId('named-collapsible-trigger-quality');
    const panel = screen.getByTestId('named-collapsible-panel-quality');
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(trigger.id);
  });
});
