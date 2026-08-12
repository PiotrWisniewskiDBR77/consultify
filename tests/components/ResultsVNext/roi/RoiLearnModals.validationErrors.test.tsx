/**
 * P1 nr 1 (RN-G5 platform lane, 2026-08-12) — cicha awaria zapisu w
 * `RoiFinanceLinkFormModal`/`RoiFinanceReconciliationFormModal`
 * (`src/components/ResultsVNext/roi/RoiLearnModals.tsx`) i
 * `RoiActualEntryFormModal` (`RoiRealizeValueModals.tsx`): formularz z
 * niepełnymi wymaganymi polami przy kliknięciu "zapisz" nie robił NIC —
 * brak zapisu, brak komunikatu, brak wskazania pola. `aria-invalid`
 * ustawiał się (czerwona ramka), ale nigdy nie renderował się tekst błędu
 * — w przeciwieństwie do `RoiCaseCreateModal.tsx` (wzorzec, naprawiony już
 * w RN-G2), który dla każdego pola ma widoczny `<p>` z komunikatem.
 *
 * Handbook §12: zakaz "fake success i silent failure". Ten test dowodzi
 * naprawy: klik zapisu z pustymi wymaganymi polami → onSubmit NIE
 * wywołane, widoczny komunikat PRZY KAŻDYM brakującym polu. Potem
 * uzupełnienie i klik → onSubmit wywołane z poprawnymi wartościami.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  RoiFinanceLinkFormModal,
  RoiFinanceReconciliationFormModal,
} from '../../../../src/components/ResultsVNext/roi/RoiLearnModals';
import { RoiActualEntryFormModal } from '../../../../src/components/ResultsVNext/roi/RoiRealizeValueModals';

const stripMotionProps = (props: Record<string, unknown>) => {
  const { initial, animate, exit, variants, transition, whileTap, whileHover, whileFocus, whileDrag, ...rest } = props;
  return rest;
};
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...stripMotionProps(props)}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...stripMotionProps(props)}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('RoiFinanceLinkFormModal · walidacja przy zapisie (P1 nr 1)', () => {
  it('klik "Powiąż" z pustymi wymaganymi polami: onSubmit NIE jest wołane, widoczny komunikat przy KAŻDYM brakującym polu', () => {
    const onSubmit = vi.fn();
    render(
      <RoiFinanceLinkFormModal
        open
        onClose={vi.fn()}
        onSubmit={onSubmit}
        isPolish
        defaultCurrency="PLN"
      />
    );

    fireEvent.click(screen.getByTestId('roi-finance-link-submit'));

    expect(onSubmit).not.toHaveBeenCalled();
    // Six required fields — every one must have its own visible message,
    // not just an aria-invalid border nobody notices.
    expect(screen.getByText('Typ artefaktu jest wymagany')).toBeInTheDocument();
    expect(screen.getByText('ID artefaktu jest wymagane')).toBeInTheDocument();
    expect(screen.getByText('ID wersji jest wymagane')).toBeInTheDocument();
    expect(screen.getByText('Źródło jest wymagane')).toBeInTheDocument();
    expect(screen.getByText('Data jest wymagana')).toBeInTheDocument();
    expect(screen.getByText('Cel powiązania jest wymagany')).toBeInTheDocument();
  });

  it('po uzupełnieniu wymaganych pól klik "Powiąż" faktycznie zapisuje', () => {
    const onSubmit = vi.fn();
    render(
      <RoiFinanceLinkFormModal
        open
        onClose={vi.fn()}
        onSubmit={onSubmit}
        isPolish
        defaultCurrency="PLN"
      />
    );

    fireEvent.change(screen.getByTestId('roi-finance-artifact-type'), { target: { value: 'model' } });
    fireEvent.change(screen.getByTestId('roi-finance-artifact-id'), { target: { value: 'art-1' } });
    fireEvent.change(screen.getByTestId('roi-finance-version-id'), { target: { value: 'v-1' } });
    fireEvent.change(screen.getByTestId('roi-finance-source'), { target: { value: 'Finance system' } });
    fireEvent.change(screen.getByTestId('roi-finance-as-of'), { target: { value: '2026-08-12T10:00' } });
    fireEvent.change(screen.getByTestId('roi-finance-purpose'), { target: { value: 'valuation' } });

    fireEvent.click(screen.getByTestId('roi-finance-link-submit'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      financeArtifactType: 'model',
      financeArtifactId: 'art-1',
      financeVersionId: 'v-1',
      source: 'Finance system',
      linkPurpose: 'valuation',
    });
  });
});

describe('RoiFinanceReconciliationFormModal · walidacja przy zapisie (P1 nr 1)', () => {
  it('klik "Otwórz" z pustymi wymaganymi polami: onSubmit NIE jest wołane, widoczny komunikat przy KAŻDYM brakującym polu', () => {
    const onSubmit = vi.fn();
    render(
      <RoiFinanceReconciliationFormModal
        open
        financeLinks={[{ linkId: 'link-1', financeArtifactType: 'model', financeArtifactId: 'art-1' } as any]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        isPolish
      />
    );

    fireEvent.click(screen.getByTestId('roi-finance-reconciliation-submit'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Wartość ROI jest wymagana')).toBeInTheDocument();
    expect(screen.getByText('Wartość Finance jest wymagana')).toBeInTheDocument();
  });
});

describe('RoiActualEntryFormModal · walidacja przy zapisie (P1 nr 1)', () => {
  it('klik "Zarejestruj" z pustymi wymaganymi polami: onSubmit NIE jest wołane, widoczny komunikat dla okresu i źródła', () => {
    const onSubmit = vi.fn();
    render(
      <RoiActualEntryFormModal
        open
        costLines={[]}
        benefitLines={[]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        isPolish
        defaultCurrency="PLN"
      />
    );

    fireEvent.click(screen.getByTestId('roi-actual-entry-submit'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Początek okresu jest wymagany')).toBeInTheDocument();
    expect(screen.getByText('Koniec okresu jest wymagany')).toBeInTheDocument();
    expect(screen.getByText('Źródło jest wymagane')).toBeInTheDocument();
  });
});
