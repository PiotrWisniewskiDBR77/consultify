/**
 * IS-3b v2 (Wpis 123 pkt 1, DEC-510/U-08) — front helpers for the generated
 * Executive Summary prose.
 *
 * The server prompt now asks the model for THREE named sections ("What we heard"
 * / "What it means" / "What to do", in the user's locale) separated by a blank
 * line (`\n\n`). The viewer renders each `\n\n` chunk as a paragraph; these
 * helpers keep that split in one tested place and let the viewer style a chunk
 * that is exactly a known section header as a label, so the three parts read as
 * three named sections instead of six uniform paragraphs.
 *
 * BACKWARD COMPAT: a legacy single-paragraph record (no `\n\n`) splits to exactly
 * one paragraph and never matches a header, so it renders as one body paragraph
 * with no empty labels and no crash.
 */

/** Section headers the generator may emit, across the supported locales. */
const SECTION_HEADERS: ReadonlySet<string> = new Set(
  [
    // en
    'what we heard',
    'what it means',
    'what to do',
    // pl
    'co usłyszeliśmy',
    'co usłyszelismy',
    'co to znaczy',
    'co zrobić',
    'co zrobic',
    // de
    'was wir gehört haben',
    'was es bedeutet',
    'was zu tun ist',
    // es
    'lo que escuchamos',
    'lo que significa',
    'lo que hay que hacer',
    // ja
    '聞こえたこと',
    'その意味',
    '次の一手',
    // ar
    'ما سمعناه',
    'ماذا يعني',
    'ما يجب فعله',
  ].map((header) => header.toLowerCase())
);

/** Split the generated prose into renderable paragraphs on blank lines. */
export function splitExecutiveSummaryParagraphs(prose: string | null | undefined): string[] {
  if (typeof prose !== 'string') return [];
  return prose
    .split('\n\n')
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/** True when a paragraph is exactly a known section header (a label, not prose). */
export function isExecutiveSummarySectionHeader(paragraph: string): boolean {
  const normalized = paragraph.trim().replace(/[:.]$/, '').toLowerCase();
  return SECTION_HEADERS.has(normalized);
}
