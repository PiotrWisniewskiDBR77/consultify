/**
 * @vitest-environment jsdom
 *
 * Trasa prezentacji `/assessment/outputs/:outputId/presentation` dla oceny z
 * magazynu ZASTANEGO — przed tą naprawą ekran pokazywał „Nie znaleziono
 * Outputu o podanym identyfikatorze" dla KAŻDEJ z 4 realnych ocen na
 * stanowisku lokalnym (żadna nie jest zamrożona), bo pytał wyłącznie jądro
 * method-core, tak jak `AssessmentReportView` przed swoją naprawą —
 * `RAPORT_A3.md`, defekt WAŻNY #1. Naprawa dokłada TĘ SAMĄ projekcję, która
 * już naprawiła `/report` (`../report/reportApi.ts:fetchOutputForReport`,
 * `../assessmentOutputProjection.ts`).
 *
 * DOWÓD MUTACYJNY: usuń w `AssessmentPresentationView.tsx` gałąź
 * `idOcenyZWierszaZastanego` + fallback po 404 na `fetchLegacyOutput`
 * (albo cofnij domyślny parametr `fetchLegacyOutput = fetchOutputForReport`
 * do braku fallbacku) → oba testy poniżej padają z „Nie znaleziono Outputu".
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import ocenaZastana from '../../__tests__/fixtures/ocena-zastana-drd.json';
import raportZastany from '../../__tests__/fixtures/raport-zastany-drd.json';

import { AssessmentPresentationView } from '../AssessmentPresentationView';

function odpowiedz(body: unknown, status = 200): Response {
  const res: Record<string, unknown> = {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
  // `baseClient.fetchWithRetry` klonuje odpowiedź przed odczytem.
  res.clone = () => odpowiedz(body, status);
  return res as unknown as Response;
}

function zamontujAtrapeSieci(): void {
  global.fetch = (async (input: RequestInfo | URL) => {
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

describe('prezentacja oceny z magazynu zastanego', () => {
  it('id z prefiksem "ocena~" renderuje treść raportu (macierz DRD) zamiast "Nie znaleziono Outputu"', async () => {
    zamontujAtrapeSieci();
    render(<AssessmentPresentationView outputId="ocena~assess-drd-manufacturing-01" />);

    await waitFor(() =>
      expect(screen.getByTestId('presentation-legacy-report')).toBeInTheDocument()
    );

    expect(screen.queryByText(/Nie znaleziono Outputu/i)).not.toBeInTheDocument();
    // Macierz DRD — identyfikatory obszarów muszą być na ekranie.
    expect(screen.getAllByText('1A').length).toBeGreaterThan(0);
    // Baner uczciwości źródła — ta ocena nie jest zamrożona.
    expect(screen.getByText(/z zapisu sesji — jeszcze nie\s*\n?\s*zamrożone/i)).toBeInTheDocument();
  });

  it('stare id BEZ prefiksu też otwiera prezentację po 404 z jądra (fallback do magazynu zastanego)', async () => {
    zamontujAtrapeSieci();
    render(<AssessmentPresentationView outputId="assess-drd-manufacturing-01" />);

    await waitFor(() =>
      expect(screen.getByTestId('presentation-legacy-report')).toBeInTheDocument()
    );
    expect(screen.queryByText(/Nie znaleziono Outputu/i)).not.toBeInTheDocument();
  });
});
