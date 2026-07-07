/**
 * deliverableContentGuard — shared guards that keep SYSTEM/LAYOUT context out of
 * generated deliverable CONTENT (slides, doc sections, sheet cells).
 *
 * BUG C: the ContextPack template inventory ("Available templates (20): Okresowy raport
 * postępu, Pitch inwestorski, ...") used to be pushed into `key_points`, which the deck
 * generator copies into `_keyFindings` = slide content. The model then pasted the template
 * catalogue verbatim as findings. These helpers (a) detect such leaks so consumers can
 * filter them out, and (b) let the deck validator FAIL a deck whose content contains them.
 */

/** Phrases that only ever appear in the template/layout inventory, never in real content. */
const TEMPLATE_INVENTORY_MARKERS: RegExp[] = [
  /available templates\s*\(/i,
  /\bdeprecated templates\s*:/i,
  // PL equivalents in case inventory is localized in future
  /dostępne szablony\s*\(/i,
  /przestarzałe szablony\s*:/i,
];

/**
 * True when a single string looks like template-inventory system context that leaked into
 * a content field. Used to filter key_points before they become slide/doc findings.
 */
export function isTemplateInventoryLeak(text: unknown): boolean {
  if (typeof text !== 'string' || !text) return false;
  return TEMPLATE_INVENTORY_MARKERS.some((re) => re.test(text));
}

/**
 * Given the list of active/deprecated template NAMES for this org, decide whether a piece
 * of generated content is really the template catalogue pasted verbatim. We require at least
 * two distinct template names present (a single title could legitimately be a section name),
 * OR any of the structural markers above.
 */
export function contentLeaksTemplateInventory(
  text: unknown,
  templateNames: string[] = []
): boolean {
  if (typeof text !== 'string' || !text) return false;
  if (isTemplateInventoryLeak(text)) return true;
  const names = templateNames.map((n) => String(n || '').trim()).filter((n) => n.length >= 4);
  if (names.length === 0) return false;
  let hits = 0;
  for (const name of names) {
    if (text.includes(name)) {
      hits += 1;
      if (hits >= 2) return true;
    }
  }
  return false;
}
