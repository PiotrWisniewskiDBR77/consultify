/**
 * B4 — auto-emission heuristic (KROK 9, Claude-Artifacts "this answer is really
 * a document" pattern).
 *
 * When Teresa's chat answer is itself a self-contained, document-shaped piece of
 * writing (a mini-report with headings, not a conversational reply), the
 * transcript offers a chip "Otwórz jako dokument" that lifts the answer into a
 * Canvas draft for editing/export. Decision D-C-4: we OFFER a chip, we never
 * auto-open the panel — far less invasive than Claude's auto-emit.
 *
 * This function is intentionally CONSERVATIVE: a false positive (chip on a
 * normal answer) is more annoying than a false negative. The bar is "structured
 * AND long AND not just code/conversation". Pure function, unit-tested — no
 * React, no I/O.
 */

export interface DocumentEmissionDecision {
  offer: boolean;
  /** Derived title (first heading or first sentence), capped — only when offer. */
  title: string;
}

const NO: DocumentEmissionDecision = { offer: false, title: '' };

/** Minimum non-empty lines for an answer to read as a document, not a reply. */
const MIN_NON_EMPTY_LINES = 15;
/** Or this many characters even with fewer lines (dense prose with headings). */
const MIN_CHARS = 700;
/** Hard floor — below this it's a chat reply regardless of structure. */
const ABSOLUTE_MIN_CHARS = 300;

const HEADING_RE = /^#{1,4}\s+\S/;
// [ODMROZENIE 13_CHAT DEC-397] Etykieta sekcji pisana POGRUBIENIEM zamiast „# ".
// Zmierzone 06.09 (1.1-D): odpowiedź Teresy po polsku na „krótka zajawka planu
// strategicznego" ma 1457 znaków i PIĘĆ sekcji w postaci „1. **Wizja i cele
// transformacji**: …", ale ANI JEDNEGO nagłówka markdown. Heurystyka wymagała
// `headingCount >= 1`, więc chip „Otwórz jako dokument" nigdy się nie pokazywał —
// odpowiedź document-shaped nie dawała się przenieść do dokumentu.
// Zachowawczo: pojedyncza pogrubiona etykieta to NADAL nie dokument; dopiero
// MIN_BOLD_SECTIONS takich linii czyta się jak sekcje (patrz test).
const BOLD_SECTION_RE = /^\s*(?:[-*]|\d+[.)])?\s*\*\*[^*\n]{2,80}\*\*\s*:?/;
/** Ile pogrubionych etykiet czyni z odpowiedzi zestaw sekcji. */
const MIN_BOLD_SECTIONS = 3;
const BULLET_RE = /^\s*([-*]|\d+\.)\s+\S/;
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;

/** Strip fenced code blocks; returns the remaining prose + how much was code. */
function splitCode(content: string): { prose: string; codeChars: number } {
  let codeChars = 0;
  const prose = content.replace(/```[\s\S]*?```/g, (block) => {
    codeChars += block.length;
    return '';
  });
  return { prose, codeChars };
}

function deriveTitle(content: string): string {
  // Prefer the first markdown heading.
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    const h = line.match(/^#{1,4}\s+(.+)$/);
    if (h && h[1].trim()) {
      const t = h[1].replace(/[*_`#]/g, '').trim();
      if (t) return t.length > 80 ? `${t.slice(0, 77)}…` : t;
    }
  }
  // Otherwise the first non-empty, non-list, non-table line.
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || BULLET_RE.test(line) || TABLE_ROW_RE.test(line)) continue;
    const t = line.replace(/[*_`#>]/g, '').trim();
    if (t) return t.length > 80 ? `${t.slice(0, 77)}…` : t;
  }
  return 'Dokument z czatu';
}

/**
 * Decide whether to offer "open as document" for an AI answer.
 *
 * Offers only when ALL hold:
 *  - not empty / not below the absolute char floor;
 *  - prose is not dominated by code (code ≤ 50% of content) — code answers are
 *    handled by the inline Artifacts path, not the document canvas;
 *  - has real document structure: ≥1 heading AND (≥2 headings OR a heading plus
 *    bullets/table), i.e. it reads as sections, not a single decorated line;
 *  - is long enough: ≥ MIN_NON_EMPTY_LINES non-empty lines OR ≥ MIN_CHARS chars.
 */
export function shouldOfferDocumentEmission(content: string): DocumentEmissionDecision {
  const text = String(content || '').trim();
  if (text.length < ABSOLUTE_MIN_CHARS) return NO;

  const { prose, codeChars } = splitCode(text);
  // Code-dominated answer → not a document.
  if (codeChars > text.length * 0.5) return NO;

  const lines = prose.split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return NO;

  const markdownHeadings = lines.filter((l) => HEADING_RE.test(l.trim())).length;
  // [ODMROZENIE 13_CHAT DEC-397] — pogrubione etykiety liczą się jak nagłówki
  // dopiero, gdy jest ich MIN_BOLD_SECTIONS lub więcej.
  const boldSections = lines.filter((l) => BOLD_SECTION_RE.test(l)).length;
  const headingCount =
    markdownHeadings + (boldSections >= MIN_BOLD_SECTIONS ? boldSections : 0);
  const bulletCount = lines.filter((l) => BULLET_RE.test(l)).length;
  const tableRows = lines.filter((l) => TABLE_ROW_RE.test(l)).length;

  // Strong structure = unmistakably a document (multiple sections, a real
  // table, or a heading over a substantial list). Past the absolute char floor
  // this alone qualifies — a tight 3-section report shouldn't need 15 lines.
  const strongStructure =
    headingCount >= 2 || tableRows >= 4 || (headingCount >= 1 && bulletCount >= 4);
  if (strongStructure) return { offer: true, title: deriveTitle(text) };

  // Weak structure = a single heading plus some bullets/table rows. Plausibly a
  // document, but only commit to the chip when it's also long.
  const weakStructure = headingCount >= 1 && (bulletCount >= 2 || tableRows >= 2);
  if (!weakStructure) return NO;

  const longEnough = nonEmpty.length >= MIN_NON_EMPTY_LINES || prose.trim().length >= MIN_CHARS;
  if (!longEnough) return NO;

  return { offer: true, title: deriveTitle(text) };
}
