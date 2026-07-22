/**
 * Consultify Document Studio — pure structure operations on a template
 * section blueprint (robota C1, 2026-07-22).
 *
 * The Template Architect lets an author reshape a draft blueprint before it
 * is saved: add / remove / move up / move down / rename a section. Those four
 * mutations are extracted here as PURE, immutable array operations so they can
 * be unit-tested in isolation and reused by any surface (Architect view,
 * future Mode-3 review). No React, no I/O, no mutation of the input array.
 *
 * Out-of-range indices are treated as no-ops (return the same array) so a
 * stale click after a re-render can never throw. `renameSection` trims and,
 * on an empty title, leaves the previous title untouched — the server-side
 * revise validation is the authoritative "no empty titles" guard; this keeps
 * the client resilient without silently blanking a heading.
 */

import type { TemplateSectionBlueprint } from './types';

function inRange(sections: readonly TemplateSectionBlueprint[], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < sections.length;
}

/** Move the section at `index` one slot toward the start or end of the list. */
export function reorderSection(
  sections: readonly TemplateSectionBlueprint[],
  index: number,
  direction: 'up' | 'down'
): TemplateSectionBlueprint[] {
  if (!inRange(sections, index)) return [...sections];
  const target = direction === 'up' ? index - 1 : index + 1;
  if (!inRange(sections, target)) return [...sections];
  const next = [...sections];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Replace the title of the section at `index`. Empty/blank title is ignored. */
export function renameSection(
  sections: readonly TemplateSectionBlueprint[],
  index: number,
  title: string
): TemplateSectionBlueprint[] {
  if (!inRange(sections, index)) return [...sections];
  const trimmed = title.trim();
  if (trimmed.length === 0) return [...sections];
  const next = [...sections];
  next[index] = { ...next[index], title: trimmed };
  return next;
}

/** Default shape for a freshly inserted, author-authored section. */
export function makeBlankSection(title = 'New section'): TemplateSectionBlueprint {
  return {
    title,
    level: 1,
    purpose: '',
    required: false,
    expectedLengthHint: 'medium',
  };
}

/**
 * Insert `section` after `index` (or at the end when `index` is undefined /
 * out of range). Returns a new array; the input is never mutated.
 */
export function insertSection(
  sections: readonly TemplateSectionBlueprint[],
  index?: number,
  section: TemplateSectionBlueprint = makeBlankSection()
): TemplateSectionBlueprint[] {
  const next = [...sections];
  if (index === undefined || !inRange(sections, index)) {
    next.push(section);
    return next;
  }
  next.splice(index + 1, 0, section);
  return next;
}

/** Remove the section at `index`. Out-of-range index is a no-op. */
export function removeSection(
  sections: readonly TemplateSectionBlueprint[],
  index: number
): TemplateSectionBlueprint[] {
  if (!inRange(sections, index)) return [...sections];
  const next = [...sections];
  next.splice(index, 1);
  return next;
}
