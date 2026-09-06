/**
 * Detects whether a chat message asks Teresa to WRITE INTO the open Canvas
 * document (vs. just chat about it). Returns the streaming mode to use, or null.
 *
 * Gated by the caller on an open canvas (activeCanvasDocument): the dispatched
 * 'canvas-stream-request' event is only meaningful while the rich editor is
 * mounted. Patterns require an explicit write verb + a document/canvas target
 * so ordinary chat ("what do you think about this?") is not hijacked.
 */

export type CanvasStreamMode = 'append' | 'replace' | 'generate' | 'patch';

// ── B3 patch-mode ────────────────────────────────────────────────────
// Instructions that reference a SPECIFIC document target (section/heading/
// paragraph/title + an ordinal, number, quoted name, or proper name) get a
// surgical anchor-based patch instead of a full streaming rewrite.
// Conservative by design: ALL THREE signals (edit verb + target noun +
// locator) must be present; otherwise we fall through to the existing modes.
// NOTE: no trailing \b after the alternation — JS \b never matches after a
// Polish diacritic ('zmień', 'tytuł': ń/ł are non-word chars), and the open
// end also accepts inflected forms (zmienić, poprawisz, sections, …).
const PATCH_VERB =
  /\b(zmie[ńn]|popraw|przepisz|zamie[ńn]|zaktualizuj|skr[óo][ćc]|rozwi[ńn]|usu[ńn]|rewrite|change|update|fix|edit|replace|revise|shorten|expand|remove|delete)/i;
const PATCH_TARGET =
  /\b(tytu[łl]|nag[łl][óo]w|sekcj|akapit|rozdzia[łl]|podtytu[łl]|section|heading|header|paragraph|title|chapter|subtitle)/i;
const PATCH_LOCATORS: RegExp[] = [
  // Numbered: "sekcji 2", "paragraph 3"
  /\d+/,
  // PL ordinals (inflected stems): pierwszy/drugiego/trzecią…
  /\b(pierwsz|drug|trzec|czwart|pi[ąa]t|sz[óo]st|si[óo]dm|[óo]sm|dziewi[ąa]t|dziesi[ąa]t|ostatn|przedostatn)\w*/i,
  // EN ordinals
  /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last)\b/i,
  // Quoted name: sekcji „Finanse", section "Overview" (typographic single
  // quotes only — ASCII apostrophes would false-positive on contractions)
  /["„“«‚'][^"„“”«»‚'’]{1,80}["“”»’']/,
  // Proper name right after the target noun: "sekcji Finanse"
  /\b(sekcj\w*|rozdzia[łl]\w*|nag[łl][óo]w\w*|section|chapter|heading)\s+["„«]?[A-ZĄĆĘŁŃÓŚŹŻ]/,
];

function isPatchInstruction(text: string): boolean {
  return (
    PATCH_VERB.test(text) &&
    PATCH_TARGET.test(text) &&
    PATCH_LOCATORS.some((locator) => locator.test(text))
  );
}

const PATTERNS: Array<{ pattern: RegExp; mode: CanvasStreamMode }> = [
  // ── Replace the current selection / a specific part ──────────────
  // EN
  {
    pattern:
      /\b(rewrite|replace|revise)\b[^.]*\b(this|the)?\s*(selection|selected|paragraph|section|text|fragment)\b/i,
    mode: 'replace',
  },
  // PL — B3 fix: the previous trailing \b after the verb group silently
  // disabled 'zamień'/'zmień' (JS \b cannot match after 'ń', a non-word
  // char), so those verbs NEVER triggered replace. Open-ended verb match
  // also covers inflected forms (zmienić, zamieniłabyś…).
  {
    pattern:
      /\b(przepisz|zamie[ńn]|zmie[ńn]|popraw)[^.]*\b(to|zaznaczenie|zaznaczony|akapit|fragment|sekcj|tekst)/i,
    mode: 'replace',
  },

  // ── Write/append into the document ───────────────────────────────
  // EN
  {
    pattern:
      /\b(write|draft|compose|add|append|continue|expand|insert|put|fill)\b[^.]*\b(in|into|to|on)?\s*(the\s+)?(document|canvas|doc|here|page)\b/i,
    mode: 'append',
  },
  {
    pattern:
      /\b(write|draft|generate|compose)\s+(me\s+)?(a\s+|an\s+|the\s+)?(document|draft|section|paragraph|summary|outline|report)\b/i,
    mode: 'append',
  },
  // PL — same \b-after-diacritic fix as above ('rozwiń' never matched).
  {
    pattern:
      /\b(napisz|dopisz|wpisz|dodaj|kontynuuj|rozwi[ńn]|uzupełnij|wstaw)[^.]*\b(w|do|na)?\s*(dokumen|canvas|kanw|tutaj|stron)/i,
    mode: 'append',
  },
  {
    pattern:
      /\b(napisz|stwórz|utwórz|wygeneruj|przygotuj)\s+(mi\s+)?(dokument|szkic|sekcj|akapit|podsumowanie|raport|konspekt)/i,
    mode: 'append',
  },
];

// ── 1.1-A (06.09) — „Zrob mi plan w okni obok" ───────────────────────
// Defekt zmierzony przez właściciela: żadna z reguł wyżej nie łapała tej
// prośby (czasownik „zrób" nie występował na żadnej liście, a „w okni obok"
// nie jest ani „dokumentem", ani „canvasem"). Wiadomość szła na backend,
// gdzie regex Teresy trafiał w słowo „plan" i tworzył propozycję
// `Initiatives · create` — intencja „napisz w oknie obok" była rutowana na
// „utwórz inicjatywę". Dwie dopisane reguły (obie na KOŃCU, żeby nie ruszyć
// zachowania istniejących trybów replace/patch):
//   R1 — czasownik wytwórczy + wskazanie miejsca „obok / w dokumencie /
//        tutaj / w kanwie" (łapie też literówkę „w okni obok" — kotwicą
//        jest „obok", nie „oknie");
//   R2 — czasownik wytwórczy + rzeczownik-wytwór („plan", „harmonogram",
//        „agenda", „lista", „konspekt"…), bo przy OTWARTYM dokumencie obok
//        naturalnym miejscem takiej treści jest ten dokument.
// Obie są bezpieczne dopiero od momentu, gdy skutkiem jest PROPOZYCJA z
// podglądem („Wstaw do dokumentu"), a nie cichy zapis: fałszywe trafienie
// kosztuje jedno kliknięcie „Odrzuć", nie zepsuty dokument.
const PRODUCE_VERB =
  /\b(zr[oó]b|zrobisz|napisz|napisała?by[sś]|stw[oó]rz|utw[oó]rz|wygeneruj|przygotuj|opracuj|sporz[ąa]d[zź]|rozpisz|rozpisała?by[sś]|dopisz|wpisz|wstaw|uzupe[łl]nij|write|draft|create|make|generate|prepare|compose|outline|sketch)/i;

const DOC_PLACE =
  /(\bobok\b|\btutaj\b|\bhere\b|\bdokumen\w*|\bkanw\w*|\bcanvas\w*|\bnotatc\w*|\bnotatk\w*|\bdocument\b|\bdoc\b|\bpage\b|\bside panel\b|\bpanel\w*\s+obok)/i;

const PRODUCE_NOUN =
  /\b(plan\w*|harmonogram\w*|agend\w*|list[eęa]\b|list[eę]\s|konspekt\w*|szkic\w*|podsumowani\w*|raport\w*|analiz\w*|propozycj\w*|roadmap\w*|checklist\w*|instrukcj\w*|scenariusz\w*|plan|schedule|agenda|checklist|outline|summary|report|analysis)/i;

// Weto: gdy prośba nazywa OBIEKT innego modułu („zrób inicjatywę z tego
// planu", „załóż zadanie"), nowa reguła stoi. Wiadomość ma iść na ścieżkę
// Teresy, gdzie powstaje propozycja z przyciskiem „Zatwierdź" — tam człowiek
// decyduje, czy obiekt ma powstać. Weto działa tylko na TĘ regułę: jawne
// „napisz w dokumencie…" złapały już wcześniejsze, węższe wzorce.
const MODULE_OBJECT =
  /\b(inicjatyw\w*|zadani\w*|zadanie\b|decyzj\w*|ryzyk\w*|sygna[łl]\w*|kamie[nń]\w*\s+milow\w*|spotkani\w*|initiative|task|decision|risk|signal|milestone|meeting|ticket)/i;

function isDocumentProduceRequest(text: string): boolean {
  if (!PRODUCE_VERB.test(text)) return false;
  if (MODULE_OBJECT.test(text)) return false;
  return DOC_PLACE.test(text) || PRODUCE_NOUN.test(text);
}

export function detectCanvasWriteIntent(message: string): CanvasStreamMode | null {
  const text = String(message || '').trim();
  if (!text) return null;
  // B3 — patch BEFORE the generic patterns: "zmień tytuł sekcji 2" would
  // otherwise match the PL replace pattern and lose its surgical target.
  if (isPatchInstruction(text)) return 'patch';
  for (const { pattern, mode } of PATTERNS) {
    if (pattern.test(text)) return mode;
  }
  // 1.1-A — ostatnia szansa: prośba o wytworzenie treści przy otwartym
  // dokumencie obok. Celowo NA KOŃCU: nie może wyprzedzić trybu patch ani
  // replace, których reguły są węższe i bardziej precyzyjne.
  if (isDocumentProduceRequest(text)) return 'append';
  return null;
}
