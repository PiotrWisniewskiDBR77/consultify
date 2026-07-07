/**
 * Teresa routing-N — keyword pre-classification for chat CREATION intents.
 *
 * BUG (live): on RICH prompts ("Stwórz inicjatywę: <200-word brief>") the model
 * increasingly picks generate_deliverable(type:'doc') instead of the object tool
 * (generate_initiative / create_task / create_decision). The longer/denser the
 * brief, the more the model treats it as "write me a document". Tool descriptions
 * already steer strongly, but description-only steering is probabilistic and
 * breaks down under long context.
 *
 * This deterministic classifier detects an explicit "create an OBJECT" intent from
 * the user's own words. When it fires, AIPipeline REMOVES generate_deliverable from
 * the tool set for that single turn, so the model *cannot* fall back to a document —
 * it can only call the matching object tool (or answer in plain text). The rich
 * detail then lands in the OBJECT's fields (problem/description), never a separate doc.
 *
 * Intentionally conservative: only fires on an explicit create-verb + an object
 * noun. Ambiguous phrasings ("napisz dokument o inicjatywie X") do NOT match a
 * create-verb+noun pair and fall through to normal model routing.
 */

export type ChatCreationIntent = 'initiative' | 'task' | 'decision' | null;

/**
 * Create verbs (PL + EN). PL forms cover imperative + common inflections.
 * We match on word-start to tolerate inflection tails (stwórz, stworzyć, utwórz,
 * utworzyć, załóż, załóż mi, dodaj, create, add, log, record, make…).
 */
const CREATE_VERBS = [
  // Polish
  'stwórz',
  'stworz',
  'utwórz',
  'utworz',
  'zrób',
  'zrob',
  'załóż',
  'zaloz',
  'dodaj',
  'zapisz', // "zapisz decyzję" → decision
  'zarejestruj',
  'zaplanuj', // "zaplanuj zadanie" → task
  // English
  'create',
  'add',
  'make',
  'log',
  'record',
  'register',
  'start',
];

/**
 * Object nouns → intent. Word-start match tolerates PL inflection
 * (inicjatywę/inicjatywa/inicjatywy, zadanie/zadania, decyzję/decyzja).
 */
const OBJECT_NOUNS: Array<{ intent: Exclude<ChatCreationIntent, null>; roots: string[] }> = [
  { intent: 'initiative', roots: ['inicjatyw', 'initiative'] },
  { intent: 'task', roots: ['zadani', 'task', 'to-do', 'todo', 'action item'] },
  { intent: 'decision', roots: ['decyzj', 'decision'] },
];

/** Normalize: lowercase + collapse whitespace. Keeps PL diacritics. */
function normalize(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns the create-object intent if the message explicitly asks to create one of
 * the supported OBJECTS (initiative / task / decision), else null.
 *
 * Heuristic: a create-verb and an object-noun must BOTH appear, and the noun must
 * appear at/after the verb within a short window (so "stwórz X" but not
 * "przypomnij o zadaniu, potem stwórz dokument"). We scan the FIRST create-verb and
 * require an object noun within the next ~60 chars (covers "stwórz nową inicjatywę
 * dotyczącą…"). This keeps false positives low on long briefs where the object noun
 * is stated up front.
 */
export function classifyChatCreationIntent(message: string): ChatCreationIntent {
  const text = normalize(message);
  if (!text) return null;

  // Find earliest create-verb occurrence (word-start).
  let verbIdx = -1;
  for (const verb of CREATE_VERBS) {
    const re = new RegExp(`(^|[^a-ząćęłńóśźż])${escapeRe(verb)}`, 'i');
    const m = re.exec(text);
    if (m) {
      const idx = m.index + (m[1] ? m[1].length : 0);
      if (verbIdx === -1 || idx < verbIdx) verbIdx = idx;
    }
  }
  if (verbIdx === -1) return null;

  // Window after the verb where the object noun is expected.
  const WINDOW = 60;
  const window = text.slice(verbIdx, verbIdx + verb_len(text, verbIdx) + WINDOW);

  for (const { intent, roots } of OBJECT_NOUNS) {
    for (const root of roots) {
      // Word-start match of the root inside the window.
      const re = new RegExp(`(^|[^a-ząćęłńóśźż])${escapeRe(root)}`, 'i');
      if (re.test(window)) return intent;
    }
  }
  return null;
}

/** Length of the matched verb token starting at idx (up to next space). */
function verb_len(text: string, idx: number): number {
  const rest = text.slice(idx);
  const sp = rest.indexOf(' ');
  return sp === -1 ? rest.length : sp;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Maps a classified intent to the single object tool that must handle it. */
export const INTENT_TO_TOOL: Record<Exclude<ChatCreationIntent, null>, string> = {
  initiative: 'generate_initiative',
  task: 'create_task',
  decision: 'create_decision',
};

export default { classifyChatCreationIntent, INTENT_TO_TOOL };
