/**
 * [ODMROZENIE 16_GLOBAL_STANDARDS DEC-411]
 * P10: jawny licznik wszystkich kart N. Poza-rejestrowe ekrany pozostają
 * wyjątkami tylko do decyzji właściciela; powód nie może być pusty.
 */
import { describe, expect, it } from 'vitest';
import { REJESTR_KART_N } from '../registry';

const OCZEKIWANE_W_REJESTRZE = [
  'action',
  'tool',
  'notification',
  'interview',
  'decision',
  'insight',
  'task',
  'initiative',
  // [ODMROZENIE 16_GLOBAL_STANDARDS DEC-422] Trzy karty modułu Wyniki weszły
  // do rejestru 06.09.2026 — do tego dnia `metric` i `objective` stały wśród
  // „jawnych wyjątków" niżej, a analizy ROI nie było nigdzie. Właściciel
  // ocenił je jako pełne karty N („To normalne N-type narzędzie"), a wpis
  // w rejestrze jest warunkiem, żeby mogły wołać silnik „Analizuj z AI".
  'metric',
  'objective',
  'roi_case',
] as const;

const JAWNE_WYJATKI = {
  note: 'NotebookContent ma własny dokumentowy model poza rejestrem',
  idea: 'IdeaMapWorkspace jest warsztatem płótnowym poza rejestrem',
  'audit-criterion': 'CriterionWorkspaceV2 jest rekordem audytu poza rejestrem',
  'audit-report': 'AuditReportDocumentView jest dokumentem raportu poza rejestrem',
  'assessment-report': 'AssessmentReportContractView ma osobny kontrakt raportu',
  'tool-document': 'ToolDocumentView jest dokumentem wyniku narzędzia',
  presentation: 'DeckBuilder jest dokumentem prezentacji poza rejestrem',
  meeting: 'MeetingObjectPage jest rekordem spotkania poza rejestrem',
  'vault-document': 'VaultDocumentPanel jest dokumentem sejfu poza rejestrem',
} as const;

describe('P10 — kompletność rejestru kart N', () => {
  it('zawiera wszystkie 11 kart wskazanych przez KartaNKey', () => {
    expect(Object.keys(REJESTR_KART_N).sort()).toEqual([...OCZEKIWANE_W_REJESTRZE].sort());
  });

  it('ma jawny, niepusty powód dla każdej z 9 kart poza rejestrem', () => {
    expect(Object.keys(JAWNE_WYJATKI)).toHaveLength(9);
    for (const powod of Object.values(JAWNE_WYJATKI)) expect(powod.trim()).not.toBe('');
  });

  it('pokrywa cały inwentarz P10 bez anonimowych pozycji', () => {
    const pokryte = new Set([...OCZEKIWANE_W_REJESTRZE, ...Object.keys(JAWNE_WYJATKI)]);
    // 19 → 20 (DEC-422): `metric` i `objective` PRZESZŁY z wyjątków do
    // rejestru (bilans zerowy), a karta analizy ROI (`roi_case`) doszła jako
    // dwudziesta pozycja inwentarza — wcześniej nie było jej nigdzie.
    expect(pokryte.size).toBe(20);
  });
});
