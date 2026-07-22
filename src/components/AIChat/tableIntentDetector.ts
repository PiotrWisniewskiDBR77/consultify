/**
 * Detects if a chat message is a table creation/modification intent.
 * Returns true if the message matches known table-related patterns.
 *
 * Also discriminates between Table Builder (structured data / tracker)
 * and Excele (workbook / Excel file / financial model) intents.
 */

const TABLE_INTENT_PATTERNS = [
  // EN patterns
  /\b(create|build|make|generate|set\s*up)\s+(a\s+)?(table|spreadsheet|database|tracker|board)\b/i,
  /\b(table|spreadsheet)\s+(for|to|with)\b/i,
  /\bneed\s+(a\s+)?(table|spreadsheet|tracker)\b/i,
  // PL patterns
  /\b(stwórz|utwórz|zbuduj|zrób|przygotuj|wygeneruj)\s+(mi\s+)?(tabelę|tabele|arkusz|bazę|tracker)\b/i,
  /\b(tabel[eęa]|arkusz)\s+(do|dla|z|ze)\b/i,
  /\bpotrzebuję\s+(tabel[eęi]|arkusz[a]?)\b/i,
  /\b(dodaj|zmień|usuń|modyfikuj)\s+(kolumnę|pole|widok|rekord)\b/i,
  /\b(add|modify|change|remove|delete)\s+(column|field|view|record)\b/i,
];

const EXCELE_INTENT_PATTERNS = [
  // EN — workbook/excel/multi-sheet/financial model
  /\b(create|build|make|generate|prepare)\s+(a\s+)?(workbook|excel\s*file|excel\s*spreadsheet|multi[- ]?sheet)\b/i,
  /\bfinancial\s+(model|plan|forecast|projection)\b/i,
  /\bbudget\s*(plan|spreadsheet|template|model)?\b/i,
  /\b(p&l|profit\s*(and|&)\s*loss|balance\s*sheet|cash\s*flow)\b/i,
  /\b(xlsx|\.xlsx)\b/i,
  /\bcross[- ]?sheet\s+(ref|formula|link)/i,
  // PL — skoroszyt/arkusz Excel/model finansowy
  /\b(stwórz|utwórz|zbuduj|zrób|przygotuj|wygeneruj)\s+(mi\s+)?(skoroszyt|plik\s*excel|arkusz\s*excel)\b/i,
  /\bmodel\s+(finansowy|budżetowy)\b/i,
  /\b(budżet|prognoza|rachunek\s*zysków)\b/i,
];

export function detectTableIntent(message: string): boolean {
  return TABLE_INTENT_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Detects if message targets P23 Excele (workbook generation) rather than Table Builder.
 * Excele handles multi-sheet Excel workbooks with formulas; Table Builder handles
 * structured data tables and trackers.
 */
export function detectExceleIntent(message: string): boolean {
  return EXCELE_INTENT_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * B2 (workstream Excel): within an Excel-intent message, decide the OUTPUT LANE:
 *
 * - `'workbook'` — a COMPUTATIONAL request: a financial model, budget, P&L,
 *   forecast, scenarios, cash flow, valuation, formulas / multi-sheet workbook.
 *   These go to the real 5-phase WorkbookGeneratorService (live .xlsx formulas).
 * - `'gfm'` — a PRESENTATION request: a plain table / list / tracker of items
 *   with no computation. These stay on the flat GFM sheet track (plan/startSheet).
 *
 * Rationale: `detectExceleIntent` already gates on computational-ish keywords, so
 * when neither signal is explicit we DEFAULT to `'workbook'` (the computational
 * engine) — and the caller fail-softs back to the GFM track on any engine error,
 * so a mis-route can never leave the chat without an artifact.
 *
 * Examples: "model 3 scenariusze RZiS" → workbook; "zrób tabelę zadań" → gfm.
 */
const WORKBOOK_LANE_PATTERNS = [
  // EN — computational / financial modelling
  /\bfinancial\s+(model|plan|forecast|projection)\b/i,
  /\b(p&l|profit\s*(and|&)\s*loss|balance\s*sheet|cash\s*flow|income\s*statement)\b/i,
  /\b(forecast|projection|valuation|unit\s*economics|scenario(s)?)\b/i,
  /\b(npv|irr|roi|dcf|wacc|ebitda|cagr)\b/i,
  /\b(workbook|multi[- ]?sheet|cross[- ]?sheet|formula(s)?)\b/i,
  /\b(xlsx|\.xlsx)\b/i,
  // PL — model / rachunkowość / formuły
  /\bmodel\s+(finansowy|budżetowy|biznesowy)\b/i,
  /\b(prognoz[ae]|rachunek\s*zysków|rzis|rzs|bilans|przepływ[yów]*\s*(pieniężn|gotówk)|cash[- ]?flow)\b/i,
  /\b(scenariusz(e|y|ów)?|wariant(y|ów)?\s+finansow)\b/i,
  /\b(wycen[aęy]|kalkulacj[aęi]|formuł[aęy]|skoroszyt)\b/i,
  /\bbudżet(u| owy|owanie)?\b/i,
];

const GFM_LANE_PATTERNS = [
  // EN — plain table / list / tracker of items
  /\b(table|list|tracker|checklist|register|inventory|roster|log)\s+(of|for|with)\b/i,
  /\b(task|todo|to-do|contact|action[- ]?item)\s+(table|list|tracker)\b/i,
  // PL — zwykła tabela / lista / rejestr rzeczy
  /\btabel[aęe]\s+(zadań|kontaktów|rzeczy|pozycji|z\s+listą|do\s+śledzenia)/i,
  /\b(list[aęy]|rejestr|inwentarz|wykaz)\s+(zadań|kontaktów|rzeczy|pozycji|klientów)/i,
];

export function resolveSheetLane(message: string): 'workbook' | 'gfm' {
  if (WORKBOOK_LANE_PATTERNS.some((pattern) => pattern.test(message))) return 'workbook';
  if (GFM_LANE_PATTERNS.some((pattern) => pattern.test(message))) return 'gfm';
  return 'workbook';
}

/**
 * B2-brama (2026-07-22, live-verify): JAWNY sygnał obliczeniowy — bez defaultu.
 * `resolveSheetLane` domyślnie zwraca 'workbook' (bezpieczne WEWNĄTRZ gałęzi
 * excele), więc NIE nadaje się na bramę zewnętrzną — połknąłby każdy tekst.
 * Ten helper zwraca true TYLKO przy realnym dopasowaniu wzorca obliczeniowego
 * (RZiS/scenariusze/prognoza/model finansowy/formuły/…). Użycie: brama w
 * UnifiedChatPanel — „Zrób arkusz finansowy: model 3 scenariusze RZiS" ma
 * wpadać do silnika formuł, mimo że detectExceleIntent go nie łapie
 * (wymaga literalnie „arkusz excel"/„model finansowy").
 */
export function hasWorkbookLaneSignals(message: string): boolean {
  return WORKBOOK_LANE_PATTERNS.some((pattern) => pattern.test(message));
}
