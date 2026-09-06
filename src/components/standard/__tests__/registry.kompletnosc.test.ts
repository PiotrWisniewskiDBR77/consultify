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
  'plan',
  'capacity_analysis',
] as const;

const JAWNE_WYJATKI = {
  note: 'NotebookContent ma własny dokumentowy model poza rejestrem',
  idea: 'IdeaMapWorkspace jest warsztatem płótnowym poza rejestrem',
  metric: 'ResultsVNext ma osobną kartę miernika',
  objective: 'ResultsVNext ma osobną kartę celu OKR',
  'audit-criterion': 'CriterionWorkspaceV2 jest rekordem audytu poza rejestrem',
  'audit-report': 'AuditReportDocumentView jest dokumentem raportu poza rejestrem',
  'assessment-report': 'AssessmentReportContractView ma osobny kontrakt raportu',
  'tool-document': 'ToolDocumentView jest dokumentem wyniku narzędzia',
  presentation: 'DeckBuilder jest dokumentem prezentacji poza rejestrem',
  meeting: 'MeetingObjectPage jest rekordem spotkania poza rejestrem',
  'vault-document': 'VaultDocumentPanel jest dokumentem sejfu poza rejestrem',
} as const;

describe('P10 — kompletność rejestru kart N', () => {
  it('zawiera wszystkie 10 kart wskazanych przez KartaNKey, w tym plan i analizę obciążenia', () => {
    expect(Object.keys(REJESTR_KART_N).sort()).toEqual([...OCZEKIWANE_W_REJESTRZE].sort());
  });

  it('ma jawny, niepusty powód dla każdej z 11 kart poza rejestrem', () => {
    expect(Object.keys(JAWNE_WYJATKI)).toHaveLength(11);
    for (const powod of Object.values(JAWNE_WYJATKI)) expect(powod.trim()).not.toBe('');
  });

  it('pokrywa cały inwentarz P10 bez anonimowych pozycji', () => {
    const pokryte = new Set([...OCZEKIWANE_W_REJESTRZE, ...Object.keys(JAWNE_WYJATKI)]);
    expect(pokryte.size).toBe(21);
  });
});
