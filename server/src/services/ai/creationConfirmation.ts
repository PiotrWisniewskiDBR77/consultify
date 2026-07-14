/**
 * Teresa creation-confirmation — SINGLE SOURCE OF TRUTH for the sentence Teresa
 * shows after a chat-creation tool runs (naprawa-r2Narr · Problem 1).
 *
 * THE BUG (live, sędzia BCG): on "stwórz inicjatywę" the deliverable event +
 * created object were `initiative`, but the chat text said "Utworzyłem DECYZJĘ …
 * w Moja praca → Decyzje" — Teresa DESCRIBED a different artifact than the one
 * she created. Root cause: the confirmation the user reads was decoupled from the
 * artifact's real `kind` (the model paraphrases freely, and the empty-stream
 * rescue surfaced whichever tool wrote `message` LAST — a different tool when a
 * turn ran more than one creation tool).
 *
 * THE FIX: derive the confirmation from the artifact's real `kind` — the same
 * `kind` the deliverable SSE event carries and the FE navigates on. `kind` is the
 * one authoritative type token, so the words the user reads can never contradict
 * the object that was actually created / the module the FE opens.
 */

/** Kinds any chat-creation tool can emit on its result / deliverable event. */
export type CreationKind =
  | 'initiative'
  | 'task'
  | 'decision'
  | 'note'
  | 'doc'
  | 'sheet'
  | 'deck'
  | 'mindmap'
  | 'process_flow'
  | 'table'
  | 'whiteboard';

type Lang = 'pl' | 'en';

/**
 * Canonical, kind-derived confirmation sentence. Mirrors 1:1 the destination each
 * FE deliverable branch navigates to (UnifiedChatPanel.onDeliverable), so the
 * words and the landing place always agree.
 */
export function buildCreationConfirmation(
  kind: CreationKind,
  title: string,
  language: Lang
): string {
  const t = String(title || '').trim();
  const q = (s: string) => (language === 'en' ? `"${s}"` : `„${s}”`);
  const named = t ? ` ${q(t)}` : '';
  const en = language === 'en';

  switch (kind) {
    case 'initiative':
      return en
        ? `Created a draft initiative${named} and opened it in Initiatives — its sections are being filled by AI now.`
        : `Utworzyłem szkic inicjatywy${named} i otworzyłem ją w module Inicjatywy — jej sekcje są teraz wypełniane przez AI.`;
    case 'task':
      return en
        ? `Created a task${named} in My Work → Tasks.`
        : `Utworzyłem zadanie${named} w Moja praca → Zadania.`;
    case 'decision':
      return en
        ? `Created a decision record${named} in My Work → Decisions.`
        : `Utworzyłem decyzję${named} w Moja praca → Decyzje.`;
    case 'note':
      return en
        ? `Saved a note${named} to the Notebook.`
        : `Zapisałem notatkę${named} w Notatniku.`;
    case 'doc':
      return en
        ? `Created a document${named} and opened it in the canvas — content is being generated now.`
        : `Utworzyłem dokument${named} i otworzyłem go w canvasie — treść jest właśnie generowana.`;
    case 'sheet':
      return en
        ? `Created a spreadsheet${named} and opened it in the canvas — content is being generated now.`
        : `Utworzyłem arkusz${named} i otworzyłem go w canvasie — treść jest właśnie generowana.`;
    case 'deck':
      return en
        ? `Created a presentation${named} and opened it in the canvas — content is being generated now.`
        : `Utworzyłem prezentację${named} i otworzyłem ją w canvasie — treść jest właśnie generowana.`;
    case 'mindmap':
      return en
        ? `Created a mind map${named} and opened it in the Ideas workspace.`
        : `Utworzyłem mapę myśli${named} i otworzyłem ją w module Pomysły.`;
    case 'process_flow':
      return en
        ? `Created a process flow${named} and opened it in the Ideas workspace.`
        : `Utworzyłem przepływ procesu${named} i otworzyłem go w module Pomysły.`;
    case 'table':
      return en
        ? `Created an ideas table${named} and opened it in the Ideas workspace.`
        : `Utworzyłem tabelę pomysłów${named} i otworzyłem ją w module Pomysły.`;
    case 'whiteboard':
      return en
        ? `Created a whiteboard${named} and opened it in the Ideas workspace.`
        : `Utworzyłem tablicę${named} i otworzyłem ją w module Pomysły.`;
    default: {
      // Exhaustiveness guard — a new kind must add a branch above.
      const _never: never = kind;
      void _never;
      return en ? `Created ${named}.`.trim() : `Utworzyłem${named}.`.trim();
    }
  }
}

/**
 * Artifact-type nouns per kind, in PL + EN. Used to DETECT when the model's own
 * free-text confirmation names a DIFFERENT artifact type than the one actually
 * created (the "narracja ≠ kind" contradiction). Roots are word-start fragments so
 * PL inflection is tolerated (decyzj-ę/-a/-i, inicjatyw-ę/-a/-y, zadani-e/-a).
 */
const KIND_NOUN_ROOTS: Record<CreationKind, string[]> = {
  initiative: ['inicjatyw', 'initiative'],
  task: ['zadani', 'task'],
  decision: ['decyzj', 'decision'],
  note: ['notatk', 'note'],
  doc: ['dokument', 'document'],
  sheet: ['arkusz', 'spreadsheet', 'sheet'],
  deck: ['prezentacj', 'presentation', 'deck', 'slajd', 'slide'],
  mindmap: ['mape mysli', 'mapę myśli', 'mapa mysli', 'mind map', 'mindmap'],
  process_flow: ['przeplyw', 'przepływ', 'process flow', 'proces'],
  table: ['tabel', 'table'],
  whiteboard: ['tablic', 'whiteboard'],
};

/** Every other kind's nouns — the ones that would be a CONTRADICTION for `kind`. */
function conflictingRoots(kind: CreationKind): string[] {
  const out: string[] = [];
  for (const k of Object.keys(KIND_NOUN_ROOTS) as CreationKind[]) {
    if (k === kind) continue;
    // Skip roots that also belong to the created kind (avoid false positives on
    // shared tokens, e.g. "table" vs "ideas table").
    for (const r of KIND_NOUN_ROOTS[k]) {
      if (KIND_NOUN_ROOTS[kind].includes(r)) continue;
      out.push(r);
    }
  }
  return out;
}

/**
 * Does the model's visible confirmation `text` NAME a different artifact type than
 * the created `kind`? True only when it mentions a CONFLICTING artifact noun and
 * NOT the correct one — i.e. an actual contradiction, not merely a vague sentence.
 * Deterministic, conservative (only fires on an explicit wrong-noun mention) so it
 * never rewrites a correct confirmation.
 */
export function textContradictsKind(text: string, kind: CreationKind): boolean {
  const hay = String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!hay.trim()) return false;

  const mentionsCorrect = KIND_NOUN_ROOTS[kind].some((r) => hay.includes(r.toLowerCase()));
  if (mentionsCorrect) return false; // already names the right thing → not a contradiction

  return conflictingRoots(kind).some((r) => hay.includes(r.toLowerCase()));
}
