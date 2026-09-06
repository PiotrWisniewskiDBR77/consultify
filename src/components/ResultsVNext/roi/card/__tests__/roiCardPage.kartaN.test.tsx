/**
 * DEC-422 — karty Wyników jako pełne karty N. Trzy obietnice, które właściciel
 * zgłosił jako BRAKUJĄCE 06.09.2026 („nie ma drugiego, trzeciego menu; nie
 * otwiera się ta karta w trzecim menu; nie ma przycisku Work with AI"),
 * sprawdzone na REALNEJ karcie analizy ROI — najmniejszej z trzech, więc
 * mockujemy tylko jej własne API, a nie całą warstwę HTTP.
 *
 * Każdy `it` jest napisany tak, żeby padał po SKASOWANIU ZABEZPIECZENIA,
 * a nie po zepsuciu mechanizmu obok (lekcja „test scenariusza nie broni
 * zabezpieczenia"):
 *   (a) `moznaEdytowac` → `true` na sztywno  ⇒ czerwony test 2b,
 *   (b) `zastosuj` wołane poza „Zatwierdź"   ⇒ czerwony test zgody,
 *   (c) zdjęcie `KartaWynikowChrome`         ⇒ czerwony test paska modułu.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoiCaseCard } from '../roiCardApi';

vi.mock('../../../resultsVNextFeatureFlags', () => ({
  isResultsVNextFlagEnabled: () => true,
}));

vi.mock('@/hooks/useOrganizationMemberNames', () => ({
  useOrganizationMemberNames: () => (id: string | null | undefined) => id ?? '—',
  memberNameOrUnknown: (_r: unknown, id: string | null | undefined) => id ?? '—',
}));

vi.mock('../roiCardApi', async (importOriginal) => {
  const oryginal = await importOriginal<typeof import('../roiCardApi')>();
  return { ...oryginal, getRoiCaseCard: vi.fn() };
});

vi.mock('../../roiCaseFullToolApi', () => ({
  getRoiPostInvestmentReview: vi.fn(),
  updateRoiPostInvestmentReviewDraft: vi.fn(),
}));

vi.mock('@/services/ai/generujTrescPola', () => ({
  generujTrescPola: vi.fn(),
}));

import { generujTrescPola } from '@/services/ai/generujTrescPola';

import { getRoiCaseCard } from '../roiCardApi';
import {
  getRoiPostInvestmentReview,
  updateRoiPostInvestmentReviewDraft,
} from '../../roiCaseFullToolApi';
import { RoiCaseCardPage } from '../RoiCaseCardPage';

const CASE_ID = 'case-dec422';

const PIR_SZKIC = {
  pirId: 'pir-1',
  sequenceNumber: 1,
  milestoneMonths: 12,
  status: 'draft',
  outcome: null,
  lessonsLearned: null,
  recommendation: null,
  realizedRoiPct: null,
  realizedNpv: null,
  realizedPaybackYears: null,
  startedAt: '2026-09-01T08:00:00.000Z',
  finalizedAt: null,
};

function zbudujKarte(pirs: RoiCaseCard['pirs']): RoiCaseCard {
  return {
    caseId: CASE_ID,
    organizationId: 'org-1',
    initiativeId: 'init-1',
    title: 'Automatyzacja pakowania — linia 2',
    status: 'in_review',
    ownerUserId: 'u-1',
    currency: 'PLN',
    granularity: 'annual',
    analysisStart: '2026-01-01',
    analysisEnd: '2030-12-31',
    updatedAt: '2026-09-05T10:00:00.000Z',
    phase: 'realization',
    subjectType: 'Inwestycja',
    optionVariant: 2,
    optionVariantLabel: 'Wariant 2',
    problemStatement: 'Pakowanie ręczne jest wąskim gardłem.',
    scopeSummary: 'Cobot + przenośnik.',
    bauOptionLabel: 'Bez zmian',
    recommendation: 'conditional_go',
    recommendationCondition: null,
    baseline: {
      currentMeasuredValue: 3,
      currentMeasuredUnit: 'osoby',
      currentMeasuredAsOf: '2026-05-31',
      interventionComparisonNotes: null,
      source: 'Pomiar czasu pracy',
      confidence: 'medium',
    },
    calculationPolicy: {
      discountRatePct: 8,
      taxTreatment: 'pre_tax',
      inflationRatePct: 3,
      requiredMetrics: null,
      notes: null,
    },
    assumptions: [],
    costLines: [],
    benefitLines: [],
    risks: [],
    indicators: {
      capex: 480000,
      horizonYears: 5,
      npv: 612000,
      irrPct: 24,
      piRatio: 1.52,
      bcr: 2,
    } as RoiCaseCard['indicators'],
    storedRun: null,
    cashFlow: [],
    sensitivity: [],
    scenarios: [],
    variances: [],
    pirs,
  };
}

async function wyrenderuj(pirs: RoiCaseCard['pirs']) {
  vi.mocked(getRoiCaseCard).mockResolvedValue(zbudujKarte(pirs));
  const widok = render(
    <MemoryRouter initialEntries={[`/results/roi/${CASE_ID}`]}>
      <Routes>
        <Route path="/results/roi/:roiCaseId" element={<RoiCaseCardPage />} />
      </Routes>
    </MemoryRouter>
  );
  await screen.findByTestId('results-vnext-roi-card-page');
  return widok;
}

/** Otwiera listę „Pracuj z AI" i zwraca jej element. */
async function otworzPracujZAI(): Promise<HTMLElement> {
  fireEvent.click(screen.getByTestId('pracuj-z-ai'));
  return screen.findByTestId('pracuj-z-ai-menu');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DEC-422 — karta analizy ROI jest pełną kartą N', () => {
  it('(c) otwarcie karty NIE zdejmuje paska modułu: zostaje Menu 2 i pigułka otwartej karty w Menu 3', async () => {
    await wyrenderuj([PIR_SZKIC]);

    // Pasek modułu Wyniki nad kartą (Menu 1/2/3) — to jest to, czego
    // właściciel nie widział: „nie otwiera się ta karta w trzecim menu".
    expect(screen.getByTestId('results-vnext-roi-card-chrome')).toBeInTheDocument();
    // Menu 3 = wiersz otwartych kart: wejście „Lista" + pigułka tej karty.
    expect(screen.getByRole('button', { name: /back to list|wróć do listy|lista/i })).toBeInTheDocument();
    // Tytuł występuje DWA razy i to jest poprawne: raz jako pigułka Menu 3,
    // raz jako nagłówek Menu 4 karty.
    expect(screen.getAllByText('Automatyzacja pakowania — linia 2').length).toBeGreaterThan(1);
    expect(screen.getAllByText('ROI').length).toBeGreaterThan(0);
  });

  it('Menu 5 istnieje i niesie „Pracuj z AI"', async () => {
    await wyrenderuj([PIR_SZKIC]);
    const menu5 = screen.getByTestId('nmode-menu2');
    expect(within(menu5).getByTestId('pracuj-z-ai')).toBeInTheDocument();
  });

  it('(a) BEZ prawa edycji (brak szkicu PIR) pozycje „Uzupełnij…" NIE renderują się, zostaje „Analizuj"', async () => {
    await wyrenderuj([]);
    const lista = await otworzPracujZAI();
    expect(within(lista).getByText(/Analizuj|Analyze/)).toBeInTheDocument();
    expect(within(lista).queryByText(/Uzupełnij tę sekcję|Fill in this section/)).toBeNull();
    expect(
      within(lista).queryByText(/Uzupełnij cały dokument|Fill in the whole document/)
    ).toBeNull();
    // Przełącznika „Edycja | Podgląd" też nie ma (Zasada 2b).
    expect(screen.queryByTestId('nmode-menu2')?.querySelector('[data-menu2-slot="mode"]')).toBeFalsy();
  });

  it('(a) Z prawem edycji (szkic PIR) obie pozycje „Uzupełnij…" są dostępne', async () => {
    await wyrenderuj([PIR_SZKIC]);
    const lista = await otworzPracujZAI();
    expect(within(lista).getByText(/Uzupełnij tę sekcję|Fill in this section/)).toBeInTheDocument();
    expect(
      within(lista).getByText(/Uzupełnij cały dokument|Fill in the whole document/)
    ).toBeInTheDocument();
  });

  it('(b) „Uzupełnij cały dokument" NIE zapisuje niczego przed kliknięciem „Zatwierdź"', async () => {
    vi.mocked(generujTrescPola).mockResolvedValue('Propozycja treści od AI.');
    vi.mocked(getRoiPostInvestmentReview).mockResolvedValue({
      ...PIR_SZKIC,
      caseId: CASE_ID,
      organizationId: 'org-1',
      startedBy: 'u-1',
      reviewSnapshotHash: 'h',
      openVarianceWaiverReason: null,
      teresaDraftLessonsPayload: null,
      teresaDraftGeneratedAt: null,
      teresaDraftDisposition: null,
      teresaDraftDispositionBy: null,
      teresaDraftDispositionAt: null,
      finalizedBy: null,
      rowVersion: 7,
      createdBy: 'u-1',
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedBy: null,
      updatedAt: '2026-09-01T08:00:00.000Z',
    } as Awaited<ReturnType<typeof getRoiPostInvestmentReview>>);
    vi.mocked(updateRoiPostInvestmentReviewDraft).mockResolvedValue({
      outcome: 'applied',
    } as Awaited<ReturnType<typeof updateRoiPostInvestmentReviewDraft>>);

    await wyrenderuj([PIR_SZKIC]);
    const lista = await otworzPracujZAI();
    fireEvent.click(within(lista).getByText(/Uzupełnij cały dokument|Fill in the whole document/));

    // Propozycja się zbiera i pojawia — ale zapis NIE poszedł.
    await waitFor(() => expect(vi.mocked(generujTrescPola)).toHaveBeenCalled());
    await screen.findByTestId('pracuj-z-ai-zatwierdz');
    expect(vi.mocked(updateRoiPostInvestmentReviewDraft)).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('pracuj-z-ai-zatwierdz'));
    await waitFor(() =>
      expect(vi.mocked(updateRoiPostInvestmentReviewDraft)).toHaveBeenCalledTimes(2)
    );
  });
});
