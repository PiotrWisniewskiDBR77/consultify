/**
 * @vitest-environment jsdom
 *
 * Trasa raportu `/assessment/outputs/:outputId/report` dla oceny z magazynu
 * ZASTANEGO — dowód, że dokument realnej oceny właściciela w ogóle się otwiera
 * i niesie treść (macierz DRD z obszarami, rozdziały osi, zestawienie).
 *
 * Warstwa sieci jest podmieniona na `global.fetch`, ale ODPOWIEDZI to
 * nieprzerobione fikstury żywego API (patrz `../../__tests__/fixtures/`).
 *
 * DOWÓD MUTACYJNY: usuń w `reportApi.fetchOutputForReport` gałąź
 * `if (idOcenyZastanej) return pobierzRaportZMagazynuZastanego(...)` oraz
 * fallback po 404 → `fetchOutputForReport` zwraca `null`, widok pokazuje
 * „Nie znaleziono zamrożonego Outputu" i oba testy poniżej padają.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ocenaZastana from '../../__tests__/fixtures/ocena-zastana-drd.json';
import raportZastany from '../../__tests__/fixtures/raport-zastany-drd.json';

import { AssessmentReportView } from '../AssessmentReportView';
import { fetchOutputForReport } from '../reportApi';

function odpowiedz(body: unknown, status = 200): Response {
  const res: Record<string, unknown> = {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
  // `baseClient.fetchWithRetry` klonuje odpowiedź przed odczytem — atrapa
  // bez `clone()` wywracała się na „res.clone is not a function".
  res.clone = () => odpowiedz(body, status);
  return res as unknown as Response;
}

function zamontujAtrapeSieci(): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/method/outputs/')) {
      return odpowiedz({ error: 'Output not found' }, 404);
    }
    if (url.includes('/api/v8/assessment/')) {
      return odpowiedz(ocenaZastana);
    }
    if (url.endsWith('/api/assessment-reports')) {
      return odpowiedz({
        reports: [{ id: 'report-drd-test-exec', assessmentId: 'assess-drd-manufacturing-01' }],
      });
    }
    if (url.includes('/api/assessment-reports/')) {
      return odpowiedz(raportZastany);
    }
    return odpowiedz({}, 404);
  }) as unknown as typeof fetch;
}

describe('raport oceny z magazynu zastanego', () => {
  beforeEach(() => {
    zamontujAtrapeSieci();
  });

  it('reportApi wraca do magazynu zastanego i oddaje 39 obszarów', async () => {
    const wynik = await fetchOutputForReport('ocena~assess-drd-manufacturing-01');
    expect(wynik).not.toBeNull();
    expect(wynik?.source).toBe('legacy');
    expect(Object.keys(wynik?.output.current ?? {})).toHaveLength(39);
    expect(wynik?.narrative?.executiveSummary).toBeTruthy();
  });

  it('id BEZ prefiksu też otwiera raport (stare linki nie umierają)', async () => {
    const wynik = await fetchOutputForReport('assess-drd-manufacturing-01');
    expect(wynik?.source).toBe('legacy');
  });

  it('dokument renderuje rozdziały, macierz DRD z obszarami i mówi skąd są dane', async () => {
    render(<AssessmentReportView outputId="ocena~assess-drd-manufacturing-01" />);

    await waitFor(() =>
      expect(screen.getByText(/Jak prowadzono badanie/i)).toBeInTheDocument()
    );

    // Rozdział 2 — siedem osi metodyki.
    expect(screen.getByText(/Siedem osi metodyki/i)).toBeInTheDocument();

    // ★ MACIERZ: identyfikatory obszarów DRD muszą być na ekranie.
    //   Bez projekcji `current`/`target` siatka nie ma żadnej kolumny.
    expect(screen.getAllByText('1A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4A').length).toBeGreaterThan(0);

    // Uczciwość źródła — dokument nie twierdzi, że wynik jest zamrożony.
    expect(screen.getByText(/Zapis sesji oceny — jeszcze nie zamrożony/i)).toBeInTheDocument();
    expect(screen.queryByText('Zamrożony (niezmienny)')).not.toBeInTheDocument();

    // Notatka konsultanta z realnych danych.
    expect(screen.getAllByText(/Notatka z oceny/i).length).toBeGreaterThan(0);

    // Treść raportu zapisanego w module Ocena.
    expect(screen.getByText(/Treść raportu zapisanego w module Ocena/i)).toBeInTheDocument();
  });
});
