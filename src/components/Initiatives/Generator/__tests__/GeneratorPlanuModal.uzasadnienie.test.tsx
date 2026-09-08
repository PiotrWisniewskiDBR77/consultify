/** @vitest-environment jsdom */

/**
 * DEFEKT 2 (przejscie CTO 08.09, DEC-453) — kolumna „Uzasadnienie" w generatorze
 * planu pokazywala surowy kod solvera (`SOLVER-1:SELECTED;period=Tydzie%C5%84%203;…`)
 * zamiast zdania po polsku. `PlanCard.tsx` juz podpinal slownik
 * `formatPlanSolverReason` (P15-K3, DEC-421) do WLASNEJ sekcji propozycji —
 * generator (`GeneratorPlanuModal.tsx`) omijal ten sam slownik i renderowal
 * `row.rationale` / `row.conflict` / pozycje `proposalConflicts` doslownie.
 *
 * Ten test pilnuje, ze generator uzywa TEGO SAMEGO dekodera co karta planu
 * (zero duplikacji — import z `../planSolverReason`), rozumie kodowanie
 * procentowe polskich znakow w okresie, i nie pokazuje NIC surowego nawet dla
 * kodu, ktorego dekoder nie zna.
 *
 * MUTACJA (dowod RED): cofnij `formatPlanSolverReason(...)` na `row.rationale`
 * w `GeneratorPlanuModal.tsx` (powrot do goleg `{row.rationale}`) — ten test
 * pada, bo w tabeli zostaje surowy `SOLVER-1:…`.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import plCatalog from '../../../../../public/locales/pl/translation.json';
import { GeneratorPlanuModal, type GeneratorProposalRow } from '../GeneratorPlanuModal';

const zKatalogu = (katalog: unknown, key: string) =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      katalog
    );

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => {
      const zasob = zKatalogu(plCatalog, key);
      const wzorzec =
        typeof zasob === 'string'
          ? zasob
          : typeof options.defaultValue === 'string'
            ? options.defaultValue
            : key;
      return wzorzec.replace(/\{\{(\w+)\}\}/g, (_match: string, name: string) =>
        options[name] !== undefined ? String(options[name]) : `{{${name}}}`
      );
    },
  }),
}));

const baseProps = {
  open: true,
  plannable: [
    {
      id: 'init-cyber',
      name: 'Program wzmocnienia cyberbezpieczeństwa',
      status: 'APPROVED' as const,
      conditional: false,
      plannedStartDate: null,
      plannedEndDate: null,
    },
  ],
  onClose: vi.fn(),
  onGenerate: vi.fn(),
  onReview: vi.fn(),
};

const renderModal = (proposal: GeneratorProposalRow[], proposalConflicts: string[] = []) =>
  render(
    <GeneratorPlanuModal
      {...baseProps}
      proposal={proposal}
      proposalConflicts={proposalConflicts}
      resolveName={(id) => (id === 'init-cyber' ? 'Program wzmocnienia cyberbezpieczeństwa' : id)}
    />
  );

describe('GeneratorPlanuModal — kolumna Uzasadnienie', () => {
  it('dekoduje kod SELECTED z procentowo zakodowanym polskim okresem na zdanie po polsku', () => {
    const row: GeneratorProposalRow = {
      initiativeId: 'init-cyber',
      name: 'Program wzmocnienia cyberbezpieczeństwa',
      from: '2026-09-06',
      to: '2026-09-13',
      rationale:
        'SOLVER-1:SELECTED;period=Tydzie%C5%84%203;dep=NO_PREDECESSOR;cap=NO_CAPACITY_SCENARIO',
      conflict: null,
    };
    renderModal([row]);
    expect(screen.getByText(/Solver wybrał Tydzień 3/)).toBeInTheDocument();
    expect(screen.queryByText(/SOLVER-1:/)).not.toBeInTheDocument();
  });

  it('dekoduje kod konfliktu DEPENDENCY_CYCLE (kolumna Konflikt) na zdanie po polsku', () => {
    const row: GeneratorProposalRow = {
      initiativeId: 'init-cyber',
      name: 'Program wzmocnienia cyberbezpieczeństwa',
      from: '2026-09-06',
      to: '2026-09-13',
      rationale: 'SOLVER-1:ONE_FEASIBLE_PERIOD',
      conflict: 'SOLVER-1:DEPENDENCY_CYCLE;path=a,b,a',
    };
    renderModal([row]);
    expect(screen.getByText(/Cykl zależności/)).toBeInTheDocument();
    expect(screen.queryByText(/SOLVER-1:/)).not.toBeInTheDocument();
  });

  it('dekoduje kod DEMAND_UNKNOWN_FOR_INITIATIVE w liście proposalConflicts', () => {
    const row: GeneratorProposalRow = {
      initiativeId: 'init-cyber',
      name: 'Program wzmocnienia cyberbezpieczeństwa',
      from: '2026-09-06',
      to: '2026-09-13',
      rationale: 'SOLVER-1:ONE_FEASIBLE_PERIOD',
      conflict: null,
    };
    renderModal(
      [row],
      ['SOLVER-1:DEMAND_UNKNOWN_FOR_INITIATIVE;initiativeId=init-cyber;period=Tydzie%C5%84%202']
    );
    expect(screen.getByText(/Popyt nieznany dla „Program wzmocnienia cyberbezpieczeństwa"/)).toBeInTheDocument();
    expect(screen.queryByText(/SOLVER-1:/)).not.toBeInTheDocument();
  });

  it('kod, ktorego dekoder nie zna, dostaje uczciwy tekst zamiast surowego ciagu', () => {
    const row: GeneratorProposalRow = {
      initiativeId: 'init-cyber',
      name: 'Program wzmocnienia cyberbezpieczeństwa',
      from: '2026-09-06',
      to: '2026-09-13',
      rationale: 'SOLVER-1:FUTURE_CODE_Z_KOLEJNEJ_PACZKI;foo=bar',
      conflict: null,
    };
    renderModal([row]);
    expect(screen.getByText('Uzasadnienie: kod FUTURE_CODE_Z_KOLEJNEJ_PACZKI')).toBeInTheDocument();
    expect(screen.queryByText(/SOLVER-1:/)).not.toBeInTheDocument();
  });

  it('uzasadnienie napisane przez czlowieka (bez prefiksu) zostaje doslownie', () => {
    const row: GeneratorProposalRow = {
      initiativeId: 'init-cyber',
      name: 'Program wzmocnienia cyberbezpieczeństwa',
      from: '2026-09-06',
      to: '2026-09-13',
      rationale: 'Zakres zatwierdzony w przepływie P11.',
      conflict: null,
    };
    renderModal([row]);
    expect(screen.getByText('Zakres zatwierdzony w przepływie P11.')).toBeInTheDocument();
  });

  it('bez resolveName spada na identity (surowe id) — nie na SOLVER-1:', () => {
    const row: GeneratorProposalRow = {
      initiativeId: 'init-cyber',
      name: 'Program wzmocnienia cyberbezpieczeństwa',
      from: '2026-09-06',
      to: '2026-09-13',
      rationale: 'SOLVER-1:NO_FEASIBLE_PERIOD;initiativeId=init-cyber',
      conflict: null,
    };
    render(<GeneratorPlanuModal {...baseProps} proposal={[row]} proposalConflicts={[]} />);
    expect(screen.getByText(/Brak możliwego okresu dla „init-cyber"/)).toBeInTheDocument();
    expect(screen.queryByText(/SOLVER-1:/)).not.toBeInTheDocument();
  });
});
