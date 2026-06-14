/**
 * Detects if a chat message is a document creation intent (Wordy / Dokumenty module).
 * Targets reports, briefs, analyses, articles, and business documents.
 */

const DOCUMENT_INTENT_PATTERNS = [
  // EN — report/brief/article/document generation
  // Uwaga: dopuszczamy 0-2 przymiotniki/kwalifikatory między czasownikiem a
  // rzeczownikiem (np. "write a detailed report") — wcześniej "detailed"
  // rozrywało dopasowanie i request szczegółowego raportu trafiał do backendu,
  // gdzie był błędnie klasyfikowany jako propozycja Initiatives·create.
  /\b(create|write|generate|prepare|draft)\s+(a\s+|an\s+|the\s+)?(\w+\s+){0,2}(report|brief|article|document|paper|analysis|memo|whitepaper)\b/i,
  /\b(weekly|monthly|quarterly|annual)\s+(report|update|summary)\b/i,
  /\bdue\s+diligence\b/i,
  /\bmarket\s+(analysis|research|report)\b/i,
  /\bexecutive\s+(summary|brief)\b/i,
  /\bsteering\s+committee\s+(brief|report|document)\b/i,
  /\bproject\s+kickoff\s+(document|report)\b/i,
  /\brisk\s+assessment\s+(report|document)\b/i,
  /\bbenefits?\s+track(ing|er)\s+(report)?\b/i,
  // PL — raport/brief/artykuł/dokument
  // Uwaga: JS \b nie działa po polskich znakach (ę/ł nie są word-charami),
  // więc po odmienionych formach NIE dajemy \b — dopasowujemy rdzeń.
  // Dopuszczamy 0-2 przymiotniki (np. "napisz szczegółowy raport",
  // "przygotuj obszerny raport kwartalny") między czasownikiem a rdzeniem.
  /\b(napisz|stwórz|sporządź|przygotuj|wygeneruj|opracuj)\s+(mi\s+)?([\wąćęłńóśźż]+\s+){0,2}(raport|brief|artykuł|dokument|analiz|memo|notatk)/i,
  /\b(tygodniowy|miesięczny|kwartalny|roczny)\s+(raport|przegląd|podsumowanie)\b/i,
  /\braport\s+(z\s+)?(due\s+diligence|oceny\s+ryzyk|analizy\s+rynku)\b/i,
  /\bdokument\s+(startu|kickoff)\s+(projektu)?\b/i,
];

const PRESENTATION_INTENT_PATTERNS = [
  // EN — deck/presentation/slides
  /\b(create|build|make|generate|prepare)\s+(a\s+)?(presentation|deck|slides?|pptx)\b/i,
  /\b(pitch\s+deck|investor\s+deck)\b/i,
  /\b(status\s+update|project\s+status)\s+(presentation|deck|slides)\b/i,
  /\bsteering\s+committee\s+(deck|presentation|slides)\b/i,
  /\bquarterly\s+(business\s+)?review\s+(deck|presentation|slides)?\b/i,
  /\bworkshop\s+(deck|presentation|slides|facilitation)\b/i,
  /\bstrategy\s+roadmap\s+(presentation|deck)?\b/i,
  // PL — prezentacja/deck/slajdy
  // Uwaga: JS \b nie działa po polskich znakach (ę nie jest word-charem) —
  // "prezentację\b" nigdy nie matchowało; dopasowujemy rdzeń bez \b.
  /\b(stwórz|przygotuj|wygeneruj|zbuduj|zrób)\s+(mi\s+)?(prezentacj|deck|slajd)/i,
  /\bpitch\s*deck\b/i,
  /\b(status\s+update|przegląd\s+kwartalny)\s+(prezentacj[aęi])?/i,
  /\bdeck\s+(zarządczy|warsztatowy|inwestycyjny)\b/i,
];

export function detectDocumentIntent(message: string): boolean {
  return DOCUMENT_INTENT_PATTERNS.some((pattern) => pattern.test(message));
}

// ── N-12: document-vs-table collision precedence ─────────────────────────────
// When a prompt carries an explicit "document noun" (raport, dokument, analiza,
// memo, report, …) together with a creation verb, the intent is a DOCUMENT that
// MAY contain a table — the table is a content element, not the deliverable.
// Chat orchestration uses this to (a) suppress standalone Table/Excel routing
// and (b) let such prompts fall into the Document gate, even when the
// document-noun sits after a colon and so escapes the verb-adjacent
// DOCUMENT_INTENT_PATTERNS above (e.g. "Zrób krótki raport: tabela …").
// Deliberately requires BOTH a creation verb AND a document noun anywhere, so
// ordinary chat that merely mentions "raport" ("co sądzisz o tym raporcie?") is
// NOT hijacked. Diacritic-tolerant: no trailing \b after Polish stems
// (ó/ż/ą are non-word chars for JS \b). Document nouns only — presentation /
// mindmap / spreadsheet nouns are intentionally excluded so those paths route
// normally.
const STRONG_DOCUMENT_CREATION_VERB =
  /\b(create|write|generate|prepare|draft|make|build|compose|napisz|stw[óo]rz|sporz[ąa]d[źz]|przygotuj|wygeneruj|opracuj|zr[óo]b|sklej|z[łl][óo][żz])\w*/i;
const STRONG_DOCUMENT_NOUN =
  /\b(report|document|memo|brief|write-?up|analysis|raport|dokument|sprawozdani|analiz|notatk|opracowani|memo|brief)\w*/i;

/**
 * True when the prompt names an explicit document deliverable (creation verb +
 * document noun). Used to give "document-with-a-table" precedence over
 * standalone Table/Excel routing in chat orchestration.
 */
export function hasStrongDocumentNoun(message: string): boolean {
  const text = String(message || '');
  return STRONG_DOCUMENT_CREATION_VERB.test(text) && STRONG_DOCUMENT_NOUN.test(text);
}

export function detectPresentationIntent(message: string): boolean {
  return PRESENTATION_INTENT_PATTERNS.some((pattern) => pattern.test(message));
}
