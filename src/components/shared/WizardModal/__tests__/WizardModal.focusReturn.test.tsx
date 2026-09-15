/** @vitest-environment jsdom
 *
 * F10 / P-J02 pkt 2 — fokus MUSI wrócić do elementu, który modal otworzył.
 *
 * ZMIERZONE, nie założone: na żywym stagingu (`/interview?tab=insights` →
 * „New insight") modal „AI Insight Creator" otwierał się i zamykał na Escape
 * poprawnie, ale po zamknięciu `document.activeElement` = `BODY`. Użytkownik
 * klawiatury lądował na początku strony — stąd „część okien się nie otwiera"
 * przy kolejnej próbie. Kontrakt był spisany od początku
 * (`InsightCreatorModal.a11y.test.tsx`: „close on Escape, and return focus to
 * the trigger"), brakowało implementacji w domyślnej powłoce `WizardModal`.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WizardModal, type WizardStep } from '..';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en', getFixedT: () => (key: string) => key },
  }),
}));

const steps: WizardStep[] = [{ id: 'one', label: { en: 'One', pl: 'Jeden' } }];

const base = {
  onClose: vi.fn(),
  title: { en: 'Creator', pl: 'Kreator' },
  steps,
  onStepChange: vi.fn(),
  onComplete: vi.fn(),
};

function Gospodarz({ open }: { open: boolean }) {
  return (
    <>
      <button type="button" data-testid="wyzwalacz">
        New insight
      </button>
      <WizardModal {...base} open={open} />
    </>
  );
}

describe('WizardModal — powrót fokusu', () => {
  it('oddaje fokus przyciskowi, który otworzył modal', () => {
    const { rerender } = render(<Gospodarz open={false} />);
    const wyzwalacz = screen.getByTestId('wyzwalacz') as HTMLButtonElement;
    wyzwalacz.focus();
    expect(document.activeElement).toBe(wyzwalacz);

    rerender(<Gospodarz open />);
    // Fokus wchodzi do panelu — nie zostaje na przycisku pod spodem.
    expect(document.activeElement).not.toBe(wyzwalacz);

    rerender(<Gospodarz open={false} />);
    // ★ Mutacja: bez przywracania fokusu tu jest BODY (dokładnie to zmierzono na żywo).
    expect(document.activeElement).toBe(wyzwalacz);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('nie wymusza fokusu, gdy wyzwalacz zniknął z drzewa', () => {
    const { rerender } = render(<Gospodarz open={false} />);
    (screen.getByTestId('wyzwalacz') as HTMLButtonElement).focus();
    rerender(<Gospodarz open />);
    // Wyzwalacz znika razem z zamknięciem modala.
    rerender(<WizardModal {...base} open={false} />);
    expect(() => screen.getByTestId('wyzwalacz')).toThrow();
  });
});
