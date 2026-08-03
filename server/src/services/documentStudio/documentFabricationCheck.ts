/**
 * documentFabricationCheck (A3) — deterministyczny detektor FABRYKACJI liczb.
 *
 * Doktryna treści (docGenerationRuntime §0.3): każda konkretna liczba musi albo
 * wynikać z dostarczonych faktów/źródeł, albo być jawnie opatrzona znacznikiem
 * założenia — „(założenie)" / „(assumption)" / „(szacunek)". Liczba
 * „precyzyjnie wyglądająca" (np. 27,4% albo 183 450 PLN) BEZ takiego znacznika i
 * BEZ oparcia w źródle = FABRYKACJA (silnik wymyślił metrykę biznesową).
 *
 * Ten moduł jest CZYSTY (bez I/O, bez LLM), deterministyczny i fail-soft na
 * poziomie wołającego. Nie zmienia treści — tylko RAPORTUJE. Wołający decyduje:
 *  - generacja → oznacz jako „zdegradowaną" z widocznym ostrzeżeniem (nie blokuj),
 *  - eksport/publikacja „partnerska" (typy approval-gated) → wymagaj JAWNEGO
 *    override zamiast cichego przełamania.
 *
 * ŚWIADOMIE wąski zakres (mało fałszywych alarmów):
 *  - flagujemy TYLKO liczby „precyzyjnie wyglądające" (ułamek w %, kwota z
 *    separatorem tysięcy / ≥5 cyfr, mnożnik z ułamkiem typu 3,7x). Liczby okrągłe
 *    (10, 20, 30, 25%, 2.5M, 800k) są ILUSTRACYJNE — nie flagujemy.
 *  - znacznik założenia w oknie ±80 znaków wokół liczby ⇒ liczba OK.
 */

// Typy trzymamy strukturalnie (luźno), by moduł był niezależny od pełnego
// DocumentSchema i łatwo testowalny w izolacji.
interface FabricationBlockLike {
  content?: unknown;
  isAssumption?: boolean;
  type?: string;
}
interface FabricationSectionLike {
  title?: string;
  blocks?: FabricationBlockLike[];
  sourceRefs?: unknown[];
}
interface FabricationSchemaLike {
  sections?: FabricationSectionLike[];
  sourceRefs?: unknown[];
}

export interface FabricationHit {
  /** Dopasowany surowy fragment liczby (np. „27,4%", „183 450 PLN"). */
  value: string;
  /** Krótki kontekst (do logu / audytu), max ~80 znaków. */
  context: string;
  sectionTitle?: string;
}

export interface FabricationReport {
  /** Liczba wykrytych fabrykacji. */
  count: number;
  hits: FabricationHit[];
}

// ── Znaczniki założeń (PL + EN) — obecność w oknie liczby ZNOSI flagę. ─────────
const ASSUMPTION_MARKERS: ReadonlyArray<string> = [
  'założenie',
  'zalozenie',
  'założeni', // założenia/założeniu
  'zalozeni',
  'szacun', // szacunek/szacujemy/szacowany
  'estyma', // estymacja
  'orientacyjn',
  'przykład',
  'przyklad',
  'hipotez',
  'assumption',
  'estimate',
  'estimated',
  'illustrative',
  'hypothet',
  'for example',
  'e.g.',
  'approx',
  'placeholder',
];

// ── Wzorce liczb „precyzyjnie wyglądających". ────────────────────────────────
// 1) Ułamek w procentach: 27.4% / 3,5 %   (całkowite % — pomijamy jako okrągłe).
const PRECISE_PERCENT = /\d{1,3}[.,]\d+\s?%/g;
// 2) Mnożnik z ułamkiem: 3.7x / 12,5x  (ROI/uplift „precyzyjny").
const PRECISE_MULTIPLIER = /\b\d{1,3}[.,]\d+\s?x\b/gi;
// 3) Kwota / liczba z separatorem tysięcy: 183,450 / 1 234 567 / 2.340.000
//    (co najmniej jedna grupa tysięcy → nie jest to okrągła liczba ilustracyjna).
const GROUPED_NUMBER = /\b\d{1,3}(?:[ .,]\d{3})+(?:[.,]\d+)?\b/g;
// 4) Bardzo precyzyjna liczba bez separatora: ≥5 cyfr, NIE zakończona zerami
//    (12345, 183450 → precyzyjne; 100000, 250000 → okrągłe, pomijamy).
const LONG_PRECISE_INTEGER = /\b\d{5,}\b/g;

/** Czy długi ciąg cyfr jest „okrągły" (kończy się ≥3 zerami)? */
function isRoundLongInteger(raw: string): boolean {
  return /000$/.test(raw);
}

/** Czy w oknie ±80 znaków wokół dopasowania jest znacznik założenia/źródła? */
function windowHasAssumptionMarker(text: string, index: number, length: number): boolean {
  const from = Math.max(0, index - 80);
  const to = Math.min(text.length, index + length + 80);
  const window = text.slice(from, to).toLowerCase();
  return ASSUMPTION_MARKERS.some((m) => window.includes(m));
}

function contextAround(text: string, index: number, length: number): string {
  const from = Math.max(0, index - 30);
  const to = Math.min(text.length, index + length + 30);
  return text.slice(from, to).replace(/\s+/g, ' ').trim().slice(0, 80);
}

/**
 * Wykrywa fabrykacje w SUROWYM tekście (np. markdownie dokumentu). Zwraca listę
 * trafień: liczby precyzyjne bez znacznika założenia w pobliżu.
 */
export function detectFabricatedNumbersInText(text: string): FabricationReport {
  const hits: FabricationHit[] = [];
  if (!text || typeof text !== 'string') return { count: 0, hits };

  const seen = new Set<string>(); // dedup po (value@index)
  const scan = (regex: RegExp, filter?: (raw: string) => boolean): void => {
    const re = new RegExp(
      regex.source,
      regex.flags.includes('g') ? regex.flags : `${regex.flags}g`
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const raw = m[0];
      if (filter && !filter(raw)) continue;
      const key = `${raw}@${m.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (windowHasAssumptionMarker(text, m.index, raw.length)) continue;
      hits.push({ value: raw.trim(), context: contextAround(text, m.index, raw.length) });
    }
  };

  scan(PRECISE_PERCENT);
  scan(PRECISE_MULTIPLIER);
  scan(GROUPED_NUMBER);
  scan(LONG_PRECISE_INTEGER, (raw) => !isRoundLongInteger(raw));

  return { count: hits.length, hits };
}

function blockText(block: FabricationBlockLike): string {
  const content = block.content;
  if (!content || typeof content !== 'object') return '';
  const payload = content as Record<string, unknown>;
  if (typeof payload.text === 'string') return payload.text;
  if (Array.isArray(payload.items)) return payload.items.map((i) => String(i)).join('\n');
  return '';
}

/**
 * Wykrywa fabrykacje na poziomie SCHEMATU dokumentu. „Niepoparta" liczba =
 * precyzyjna liczba bez znacznika założenia, W SEKCJI BEZ źródeł ORAZ gdy
 * dokument nie ma żadnych źródeł na poziomie root (brak jakiegokolwiek oparcia).
 * Blok jawnie oznaczony jako założenie (`isAssumption`) jest pomijany.
 *
 * Ta reguła celowo NIE flaguje dokumentów ugruntowanych w źródłach (mają
 * sourceRefs) — tam liczby mogą pochodzić z materiału. Fabrykacja to liczba
 * wyssana z palca w dokumencie bez oparcia i bez uczciwego znacznika.
 */
export function detectDocumentFabrication(schema: FabricationSchemaLike): FabricationReport {
  const hits: FabricationHit[] = [];
  const sections = Array.isArray(schema?.sections) ? schema.sections : [];
  const docHasSources = Array.isArray(schema?.sourceRefs) && schema.sourceRefs.length > 0;

  for (const section of sections) {
    const sectionHasSources = Array.isArray(section.sourceRefs) && section.sourceRefs.length > 0;
    // Sekcja/dokument z realnym oparciem w źródłach ⇒ nie traktujemy liczb jako
    // „wyssanych z palca" (poza zakresem deterministycznej weryfikacji).
    if (sectionHasSources || docHasSources) continue;
    const blocks = Array.isArray(section.blocks) ? section.blocks : [];
    for (const block of blocks) {
      if (block.isAssumption) continue;
      const text = blockText(block);
      if (!text.trim()) continue;
      const report = detectFabricatedNumbersInText(text);
      for (const h of report.hits) hits.push({ ...h, sectionTitle: section.title });
    }
  }

  return { count: hits.length, hits };
}

/** Zwięzłe, widoczne ostrzeżenie dla użytkownika/bannera Studio. */
export function summarizeFabrication(report: FabricationReport, language: 'pl' | 'en'): string {
  const sample = report.hits
    .slice(0, 3)
    .map((h) => h.value)
    .join(', ');
  if (language === 'en') {
    return `Quality: ${report.count} unsupported number(s) detected without an "(assumption)" marker (e.g. ${sample}). Verify against sources or mark as an assumption before partner/client delivery.`;
  }
  return `Jakość: wykryto ${report.count} niepopartą/niepoparte liczbę/liczby bez znacznika „(założenie)" (np. ${sample}). Zweryfikuj wobec źródeł lub oznacz jako założenie przed wysyłką partnerską/klientowi.`;
}
