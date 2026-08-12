/**
 * @vitest-environment jsdom
 *
 * Pakiet I (Dostępność) — `AnalysisCreatorWizard.tsx`.
 *
 * PRZED naprawą: `role="dialog" aria-modal="true"` był deklaratywny bez
 * ŻADNEJ faktycznej semantyki — zero `useEffect`, zero obsługi klawiatury w
 * całym pliku (dowiedzione `grep`-em przed naprawą). Tab mógł uciec pod
 * przyciemnione tło, Escape nic nie robił, fokus nie wracał na wyzwalacz.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AnalysisCreatorWizard, type AnalysisCreatorWizardProps } from '../AnalysisCreatorWizard';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

function baseProps(overrides: Partial<AnalysisCreatorWizardProps> = {}): AnalysisCreatorWizardProps {
  return {
    sourceOptions: [],
    periodOptions: [],
    catalog: [],
    availableLineCodesForPreflight: [],
    onClose: vi.fn(),
    onComplete: vi.fn(),
    ...overrides,
  };
}

function TriggerHarness(props: { onCloseSpy: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      {/* Odtwarza realne okablowanie: `AnalysisWorkspace.tsx` renderuje ten
          przycisk POZA warunkiem `wizardOpen` — nie odmontowuje się pod
          kreatorem, więc jest stabilnym celem przywrócenia fokusa. */}
      <button type="button" data-testid="trigger" onClick={() => setOpen(true)}>
        Konfiguruj KPI
      </button>
      {open ? (
        <AnalysisCreatorWizard
          {...baseProps()}
          onClose={() => {
            props.onCloseSpy();
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

describe('AnalysisCreatorWizard — pułapka fokusa/Escape/przywrócenie (a11y, Pakiet I)', () => {
  it('renderuje się z role=dialog i aria-modal=true', () => {
    render(<AnalysisCreatorWizard {...baseProps()} />);
    const dialog = screen.getByTestId('analysis-creator-wizard');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('fokus wchodzi w dialog przy montażu (nie zostaje na body/poza dialogiem)', async () => {
    render(<AnalysisCreatorWizard {...baseProps()} />);
    const dialog = screen.getByTestId('analysis-creator-wizard');
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('Escape wywołuje onClose', async () => {
    const onClose = vi.fn();
    render(<AnalysisCreatorWizard {...baseProps({ onClose })} />);
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('po zamknięciu (Escape) fokus wraca na przycisk-wyzwalacz z hosta ("Konfiguruj KPI")', async () => {
    const onCloseSpy = vi.fn();
    render(<TriggerHarness onCloseSpy={onCloseSpy} />);
    const trigger = screen.getByTestId('trigger');
    // Wymuszamy fokus jawnie przed klikiem — `fireEvent.click` w
    // jsdom/RTL NIE symuluje pełnej sekwencji wskaźnika (mousedown→focus→
    // click), którą realna przeglądarka wykonuje przy kliknięciu przycisku.
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByTestId('analysis-creator-wizard');
    await waitFor(() => expect(document.activeElement).not.toBe(trigger));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('analysis-creator-wizard')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('przycisk „Zamknij kreator" ma dostępną nazwę (nie jest gołą ikoną)', () => {
    render(<AnalysisCreatorWizard {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Zamknij kreator' })).toBeInTheDocument();
  });

  it('KONTROLA NEGATYWNA: po odmontowaniu (zamknięciu) kreatora Escape przestaje wywoływać onClose — dowód, że listener jest sprzątany, nie wycieka globalnie', async () => {
    const onClose = vi.fn();
    const { unmount } = render(<AnalysisCreatorWizard {...baseProps({ onClose })} />);
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    unmount();
    onClose.mockClear();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });
});
