/**
 * P15-K2 (DEC-421) — generator planu: wybór, parametry, propozycja, zapis.
 *
 * POMIAR 07.09: `PlanCard.tsx:38` miał `onGenerate={(input) => onAnalyze(input.mode)}`
 * — zaznaczenia i horyzont z modala szły do kosza; krok 5 renderował „Zatwierdź"
 * bez ani jednego wiersza propozycji; `saveState:'saved'` było na sztywno.
 *
 * MUTACJE (dowód RED — wykonane ręcznie i cofnięte, evidence/p15-k2/mutacje.txt):
 *  (d) `GeneratorPlanuModal` → usuń blok `<table>` propozycji: test „propozycja
 *      widoczna przed Zatwierdź" pada;
 *  Przewód karta -> powierzchnia -> serwer ma wlasny plik:
 *  `planGeneratorPrzewod.test.tsx`.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n', () => ({ default: { language: 'pl' } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'pl' },
    t: (key: string, options?: string | Record<string, unknown>) => {
      const fallback =
        typeof options === 'string'
          ? options
          : typeof options?.defaultValue === 'string'
            ? options.defaultValue
            : key;
      if (!options || typeof options === 'string') return fallback;
      return fallback.replace(/\{\{(\w+)\}\}/g, (_match, name) =>
        options[name] !== undefined ? String(options[name]) : `{{${name}}}`
      );
    },
  }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

import {
  GeneratorPlanuModal,
  type GeneratorInitiative,
  type GeneratorProposalRow,
} from '../../../src/components/Initiatives/Generator/GeneratorPlanuModal';
const plannable: GeneratorInitiative[] = [
  {
    id: 'ini-1',
    name: 'Predictive Maintenance',
    status: 'APPROVED',
    conditional: false,
    plannedStartDate: '2026-09-21T00:00:00.000Z',
    plannedEndDate: null,
  },
  {
    id: 'ini-2',
    name: 'OPC-UA Migration',
    status: 'APPROVED',
    conditional: false,
    plannedStartDate: null,
    plannedEndDate: null,
  },
  {
    id: 'ini-3',
    name: 'Digital Twin',
    status: 'PENDING_APPROVAL',
    conditional: true,
    plannedStartDate: null,
    plannedEndDate: null,
  },
];

const proposalRows: GeneratorProposalRow[] = plannable.map((item, index) => ({
  initiativeId: item.id,
  name: item.name,
  from: '07 wrz 2026',
  to: '30 lis 2026',
  rationale: `Solver wybrał Tydzień ${index + 1}`,
  conflict: null,
}));

describe('P15-K2 — generator planu pokazuje wybór i propozycję', () => {
  it('daje do zaznaczenia wyłącznie kwalifikujące się inicjatywy i przekazuje wybór z parametrami', () => {
    const onGenerate = vi.fn();
    render(
      <GeneratorPlanuModal
        open
        plannable={plannable}
        onClose={() => undefined}
        onGenerate={onGenerate}
        onReview={() => undefined}
      />
    );
    // Domyślnie: zatwierdzone (2). Warunkowa jest niewidoczna do czasu pstryczka.
    expect(screen.getByText('Zatwierdzone inicjatywy (2)')).toBeTruthy();
    expect(screen.queryByText('Digital Twin')).toBeNull();
    fireEvent.click(screen.getByLabelText('+ do zatwierdzenia (1)'));
    expect(screen.getByText('Digital Twin')).toBeTruthy();
    expect(screen.getByText('warunkowa')).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox', { name: /Predictive Maintenance/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Digital Twin/ }));
    fireEvent.change(screen.getByLabelText('Początek horyzontu'), {
      target: { value: '2026-09-07' },
    });
    fireEvent.change(screen.getByLabelText('Liczba okresów'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /Generuj propozycję/ }));

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate.mock.calls[0][0]).toEqual({
      initiativeIds: ['ini-1', 'ini-3'],
      allowConditional: true,
      start: '2026-09-07',
      periods: 12,
      unit: 'WEEK',
      mode: 'DEPENDENCIES',
    });
  });

  it('pokazuje propozycję (inicjatywa · okno · uzasadnienie · konflikt) PRZED „Zatwierdź"', () => {
    render(
      <GeneratorPlanuModal
        open
        plannable={plannable}
        proposal={proposalRows}
        proposalConflicts={[]}
        onClose={() => undefined}
        onGenerate={() => undefined}
        onReview={() => undefined}
      />
    );
    const table = screen.getByRole('table', { name: 'Proponowana kolejność' });
    expect(within(table).getAllByRole('row')).toHaveLength(proposalRows.length + 1);
    expect(within(table).getByText('Solver wybrał Tydzień 1')).toBeTruthy();
    const approve = screen.getByRole('button', { name: /Zatwierdź/ });
    // Kolejność w DOM: tabela propozycji stoi PRZED przyciskiem decyzji.
    expect(table.compareDocumentPosition(approve) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('bez propozycji nie ma czego zatwierdzać', () => {
    render(
      <GeneratorPlanuModal
        open
        plannable={plannable}
        onClose={() => undefined}
        onGenerate={() => undefined}
        onReview={() => undefined}
      />
    );
    expect(screen.queryByRole('table', { name: 'Proponowana kolejność' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Zatwierdź/ })).toBeNull();
  });
});

