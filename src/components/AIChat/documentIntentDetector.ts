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

// ── [ODMROZENIE 13_CHAT DEC-397] Dwie bramki zawężające ──────────────────────
// Zgłoszenie właściciela 06.09 (1.1-D): „…żebyś zrobiła taką krótką ZAJAWKĘ jak
// wygląda normalnie plan strategiczny w tym zakresie BEZ GŁĘBSZEJ ANALIZY" trafiło
// w `hasStrongDocumentNoun` i uruchomiło generację dokumentu, choć prośba była
// o krótką odpowiedź W CZACIE. Zmierzone przyczyny (obie realne, obie tu łatane):
//
//  (1) RZECZOWNIK ZANEGOWANY. Reguła szukała czasownika i rzeczownika GDZIEKOLWIEK
//      w zdaniu, więc „bez głębszej analizy" (= wyraźna odmowa analizy) liczyło się
//      jak zamówienie analizy. Rzeczownik po „bez / zamiast / without / instead of /
//      no need for" jest wykluczeniem, nie zamówieniem.
//  (2) PROŚBA O ZAJAWKĘ. Słowa „zajawka / w skrócie / pokrótce / w kilku zdaniach /
//      teaser / in a nutshell" nazywają FORMĘ ODPOWIEDZI (krótko, w rozmowie), a nie
//      artefakt do wygenerowania. Uwaga: samo „krótki" NIE wetuje — „napisz krótki
//      raport" to nadal zamówienie dokumentu (patrz test kontraktowy).
//
// Obie bramki celowo są wąskie: mają zdejmować fałszywe trafienia, nie zawężać
// realnych zamówień dokumentu.

/** Fragmenty zdania, w których rzeczownik-dokument jest WYKLUCZANY, nie zamawiany. */
const DOCUMENT_NOUN_EXCLUSION_SCOPE =
  /\b(bez|zamiast|without|instead\s+of|no\s+need\s+for|nie\s+potrzebuj[ęe]|nie\s+trzeba)\b[^.,;!?]*$/i;

/** Prośba o krótką odpowiedź w rozmowie — nie o artefakt. */
const CHAT_TEASER_REQUEST =
  /(zajawk\w*|w\s+skr[óo]cie|pokr[óo]tce|w\s+kilku\s+zdaniach|w\s+dw[óo]ch\s+zdaniach|teaser|in\s+a\s+nutshell|in\s+short|briefly)/i;

/**
 * True, gdy rzeczownik-dokument stoi w zasięgu wykluczenia („bez … analizy").
 * Sprawdzamy tekst PRZED rzeczownikiem, ucięty do bieżącej frazy (kropka/przecinek
 * kończy zasięg), więc „Napisz raport. Bez wodolejstwa." nie jest wetowane.
 */
function documentNounIsExcluded(text: string): boolean {
  // Skanujemy WSZYSTKIE wystąpienia: wystarczy jedno niewykluczone, żeby prośba
  // dalej była zamówieniem dokumentu („Bez raportu, napisz notatkę" — „notatk"
  // stoi poza zasięgiem „bez"). Kopia regexa z flagą /g, bo `lastIndex` na
  // współdzielonym obiekcie jest pułapką.
  const scanner = new RegExp(STRONG_DOCUMENT_NOUN.source, 'gi');
  let match: RegExpExecArray | null;
  let seen = false;
  while ((match = scanner.exec(text)) !== null) {
    seen = true;
    if (!DOCUMENT_NOUN_EXCLUSION_SCOPE.test(text.slice(0, match.index))) return false;
    if (match.index === scanner.lastIndex) scanner.lastIndex += 1;
  }
  return seen;
}

/**
 * True when the prompt names an explicit document deliverable (creation verb +
 * document noun). Used to give "document-with-a-table" precedence over
 * standalone Table/Excel routing in chat orchestration.
 */
export function hasStrongDocumentNoun(message: string): boolean {
  const text = String(message || '');
  if (!STRONG_DOCUMENT_CREATION_VERB.test(text)) return false;
  if (!STRONG_DOCUMENT_NOUN.test(text)) return false;
  // [ODMROZENIE 13_CHAT DEC-397] — patrz komentarz nad regexami wyżej.
  if (documentNounIsExcluded(text)) return false;
  if (CHAT_TEASER_REQUEST.test(text)) return false;
  return true;
}

/**
 * [ODMROZENIE 13_CHAT DEC-397] True, gdy użytkownik prosi o KRÓTKĄ ODPOWIEDŹ
 * w rozmowie („krótka zajawka", „w skrócie") — wtedy czat odpowiada tekstem,
 * a dokument powstaje dopiero na życzenie („Otwórz jako dokument").
 * Wystawione osobno, żeby orkiestracja czatu mogła to sprawdzić jednym wołaniem
 * i żeby test kontraktowy miał co mierzyć.
 */
export function isChatTeaserRequest(message: string): boolean {
  return CHAT_TEASER_REQUEST.test(String(message || ''));
}

export function detectPresentationIntent(message: string): boolean {
  return PRESENTATION_INTENT_PATTERNS.some((pattern) => pattern.test(message));
}
