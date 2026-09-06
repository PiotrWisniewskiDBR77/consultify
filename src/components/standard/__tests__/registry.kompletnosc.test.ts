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
  'tool-document',
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
  'plan',
  'capacity_analysis',
  'kpi-scorecard',
  'kpi-deviation',
  'okr-report',
  'okr-set-tool',
  'roi-case-tool',
  'document',
  'sheet',
  'presentation',
  'template',
  'template-architect-doc',
  'template-architect-deck',
  'vault-document',
  'report-builder',
  'management-report',
  'reporting-automation',
  'governed-context',
  'chat-artifact',
  'finance-statement-pack',
  'finance-analysis',
  'execution-report',
  'execution-work-doc',
] as const;

const JAWNE_WYJATKI = {
  note: 'NotebookContent ma własny dokumentowy model poza rejestrem',
  idea: 'IdeaMapWorkspace jest warsztatem płótnowym poza rejestrem',
  'audit-criterion': 'CriterionWorkspaceV2 jest rekordem audytu poza rejestrem',
  'audit-report': 'AuditReportDocumentView jest dokumentem raportu poza rejestrem',
  'assessment-report': 'AssessmentReportContractView ma osobny kontrakt raportu',
  meeting: 'MeetingObjectPage jest rekordem spotkania poza rejestrem',
} as const;

describe('P10 — kompletność rejestru kart N', () => {
  it('zawiera wszystkie 35 kart wskazanych przez KartaNKey (scalenie P13-B tool-document DEC-439 + P13-C Wyniki/Materiały/Finanse/Realizacja DEC-434)', () => {
    expect(Object.keys(REJESTR_KART_N).sort()).toEqual([...OCZEKIWANE_W_REJESTRZE].sort());
  });

  it('ma jawny, niepusty powód dla każdej z 6 kart poza rejestrem', () => {
    expect(Object.keys(JAWNE_WYJATKI)).toHaveLength(6);
    for (const powod of Object.values(JAWNE_WYJATKI)) expect(powod.trim()).not.toBe('');
  });

  it('pokrywa cały inwentarz P10 bez anonimowych pozycji', () => {
    const pokryte = new Set([...OCZEKIWANE_W_REJESTRZE, ...Object.keys(JAWNE_WYJATKI)]);
    // 19 → 20 (DEC-422): `metric` i `objective` PRZESZŁY z wyjątków do
    // rejestru (bilans zerowy), a karta analizy ROI (`roi_case`) doszła jako
    // dwudziesta pozycja inwentarza — wcześniej nie było jej nigdzie;
    // 20 → 22 (DEC-421, P11): karty `plan` i `capacity_analysis`.
    // 22 → 41 (scalenie P13-B×P13-C): P13-B przeniósł `tool-document` z wyjątków
    // do rejestru (9→8 wyjątków, DEC-439); P13-C, nieświadom tej zmiany, osobno
    // przeniósł `presentation` i `vault-document` z wyjątków do rejestru i dodał
    // 19 nowych kart Wyników/Materiałów/Finansów/Realizacji (DEC-432–441) — u niego
    // rejestr 13→34, wyjątki 9→7 (wciąż z `tool-document` jako wyjątkiem, bo nie
    // widział pracy B). Scalenie sumuje oba rejestry (13 wspólnych + tool-document
    // z B + 21 nowych z C = 35) i usuwa z wyjątków WSZYSTKO, co po sumowaniu trafiło
    // do rejestru po którejkolwiek stronie (`tool-document`, `presentation`,
    // `vault-document`) — zostaje 6 prawdziwych wyjątków, więc 35 + 6 = 41.
    expect(pokryte.size).toBe(41);
  });
});
