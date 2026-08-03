/**
 * Decode HTML entities back to plain text.
 *
 * Some legacy rows were stored HTML-entity-encoded by the server input
 * sanitizer (e.g. `"` -> `&quot;`), and a subset were encoded twice
 * (`&quot;` -> `&amp;quot;`). React already escapes text on render, so the
 * stored value should be PLAIN text — otherwise entities show up literally
 * in the UI.
 *
 * This decoder is:
 * - regex-based (no DOM access, safe in any environment / SSR / tests)
 * - idempotent on plain text
 * - iterative, so it unwinds double (or N-times) encoding
 *
 * It does NOT introduce an XSS hole: the decoded value is plain text that
 * React re-escapes at render time. Never feed this into dangerouslySetInnerHTML.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeOnce(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      return match;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named !== undefined ? named : match;
  });
}

export function decodeHtmlEntities(input: unknown): string {
  if (typeof input !== 'string' || input.length === 0) {
    return typeof input === 'string' ? input : '';
  }
  let current = input;
  // Unwind repeated encoding (e.g. `&amp;quot;` -> `&quot;` -> `"`).
  // Bounded iterations to avoid any pathological loop.
  for (let i = 0; i < 5; i += 1) {
    const next = decodeOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

/**
 * Odkodowanie pól WYŚWIETLANYCH użytkownikowi na wierszu z API.
 *
 * PILNE-12 (przegląd 128 zrzutów): w Initiatives → Portfolio, widok kart, na
 * ekranie stało `organization&#x27;s`, `&quot;defense matrix&quot;` oraz
 * `Date &amp;amp; Participants` — to ostatnie z PODWÓJNYM kodowaniem, czyli
 * tekst przeszedł przez sanitizer dwa razy.
 *
 * Dekodowanie było już podpięte, ale WYŁĄCZNIE do idei
 * (`normalizeIdeaDisplayFields` w `services/api.ts`). Inicjatywy szły obok,
 * choć wpadają w ten sam sanitizer serwera — stąd ten helper: jedno miejsce,
 * do którego dopina się kolejne encje, zamiast kopiowania pętli po polach.
 *
 * Mutuje wiersz w miejscu i zwraca go (tak jak wersja dla idei), żeby dało się
 * go wpiąć w `.map()` bez kopiowania obiektu.
 *
 * BEZPIECZEŃSTWO: wynik to zwykły tekst, który React ponownie escapuje przy
 * renderze. Nigdy nie podawaj go do `dangerouslySetInnerHTML`.
 */
export function decodeDisplayFields<T>(row: T, fields: readonly string[]): T {
  if (!row || typeof row !== 'object') return row;
  const rekord = row as Record<string, unknown>;
  for (const field of fields) {
    if (typeof rekord[field] === 'string') {
      rekord[field] = decodeHtmlEntities(rekord[field] as string);
    }
  }
  return row;
}

/** Pola, które użytkownik czyta na liście/karcie inicjatywy. */
export const POLA_TEKSTOWE_INICJATYWY = ['name', 'title', 'description', 'summary'] as const;

export default decodeHtmlEntities;
