/**
 * [ODMROZENIE 04_ASSESSMENT DEC-496] Zgłoszenie pilotażu P-P10 (`8e27e4eb`):
 * „DBR77 report opens unrelated empty assessment data".
 *
 * Dane w teście to DOKŁADNIE te, które zmierzyłem na stagingu 2026-09-14:
 * rekord raportu `staging-dbr77-assessment-report` („DBR77 Staging Assessment
 * Executive Report", FINAL) wskazuje ocenę `dbr77-assess-002` o nazwie
 * „Analiza gotowości AI". Obie rzeczy należą do tej samej organizacji.
 */
import { describe, expect, it } from 'vitest';

import { tozsamoscDokumentuRaportu } from '../reportDocumentIdentity';

describe('tozsamoscDokumentuRaportu', () => {
  it('P-P10: tytułem jest nazwa OTWARTEGO raportu, a nazwa oceny źródłowej zostaje pokazana osobno', () => {
    const t = tozsamoscDokumentuRaportu({
      reportName: 'DBR77 Staging Assessment Executive Report',
      reportStatus: 'FINAL',
      scope: 'Analiza gotowości AI',
      methodPackId: 'drd',
      methodPackVersion: '2.0.0-methodpack.2',
    });

    expect(t.title).toBe('DBR77 Staging Assessment Executive Report');
    expect(t.subtitle).toBe('DRD · 2.0.0-methodpack.2');
    expect(t.sourceAssessmentName).toBe('Analiza gotowości AI');
    expect(t.reportStatusLabel).toBe('FINAL');
  });

  it('bez rekordu raportu (zamrożony Output jądra) nic się nie zmienia — tytułem zostaje metodyka', () => {
    const t = tozsamoscDokumentuRaportu({
      reportName: null,
      reportStatus: null,
      scope: 'DRD Manufacturing',
      methodPackId: 'drd',
      methodPackVersion: '2.0.0-methodpack.2',
    });

    expect(t.title).toBe('DRD · 2.0.0-methodpack.2');
    expect(t.subtitle).toBeNull();
    expect(t.sourceAssessmentName).toBe('DRD Manufacturing');
    expect(t.reportStatusLabel).toBeNull();
  });

  it('pusta nazwa raportu jest traktowana jak jej brak (nie tworzy pustego tytułu)', () => {
    const t = tozsamoscDokumentuRaportu({
      reportName: '   ',
      scope: 'Ocena',
      methodPackId: 'drd',
      methodPackVersion: null,
    });

    expect(t.title).toBe('DRD');
    expect(t.subtitle).toBeNull();
  });
});
