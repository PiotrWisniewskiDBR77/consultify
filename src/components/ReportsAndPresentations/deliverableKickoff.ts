/**
 * deliverableKickoff — seed „paczki kontekstu" dla wspólnego wejścia (E3).
 *
 * „Nowy (typ+template) → uruchamia Teresę": launcher otwiera czat z pre-wypełnionym
 * openerem (pendingPrompt), który jest deterministycznie dopasowany do detektorów
 * intencji Tryb B (documentIntentDetector / tableIntentDetector) — żeby Teresa od
 * razu wiedziała, jaki TYP deliverable ma powstać. Użytkownik dopisuje temat i wysyła.
 *
 * Zero kodu BE — reużywa istniejącego kanału kickoff/pendingPrompt + Tryb B.
 * Konsumpcja templateId (szkielet) = seria T + rozszerzenie plan*Generation o templateId.
 */

import type { DeliverableType } from './OutputsLauncherModal';

type Lang = 'pl' | 'en';

// Openery dobrane tak, by trafiać w odpowiedni detektor i NIE w precedencję doc:
//  - prezentacja → detectPresentationIntent
//  - raport      → detectDocumentIntent
//  - tabela      → detectTableIntent (bez „document noun" → nie wpada w doc-precedence)
// PL: unikamy końcówki „ę" przed dwukropkiem (JS \b nie działa po polskich znakach);
// dla tabeli używamy formy „tabelę do:" (łapie wzorzec „tabel[eęa] (do|dla|z|ze)").
const SEEDS: Record<DeliverableType, Record<Lang, string>> = {
  report: {
    pl: 'Przygotuj raport: ',
    en: 'Create a report: ',
  },
  presentation: {
    pl: 'Przygotuj prezentację: ',
    en: 'Create a presentation: ',
  },
  table: {
    pl: 'Stwórz tabelę do: ',
    en: 'Create a table for: ',
  },
};

export function deliverableKickoffSeed(type: DeliverableType, language: Lang): string {
  return SEEDS[type][language];
}

/** Etykieta typu do tytułu konwersacji (entityName). */
export function deliverableTypeLabel(type: DeliverableType, language: Lang): string {
  const map: Record<DeliverableType, Record<Lang, string>> = {
    report: { pl: 'Raport', en: 'Report' },
    presentation: { pl: 'Prezentacja', en: 'Presentation' },
    table: { pl: 'Tabela', en: 'Table' },
  };
  return map[type][language];
}
