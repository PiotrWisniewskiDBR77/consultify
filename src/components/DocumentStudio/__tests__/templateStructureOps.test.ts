import { describe, expect, it } from 'vitest';

import {
  insertSection,
  makeBlankSection,
  removeSection,
  renameSection,
  reorderSection,
} from '../templateStructureOps';
import type { TemplateSectionBlueprint } from '../types';

function section(title: string): TemplateSectionBlueprint {
  return {
    title,
    level: 1,
    purpose: `${title} purpose`,
    required: true,
    expectedLengthHint: 'medium',
  };
}

const base = (): TemplateSectionBlueprint[] => [section('A'), section('B'), section('C')];

describe('templateStructureOps', () => {
  it('reorderSection moves up and down without mutating the input', () => {
    const input = base();
    const up = reorderSection(input, 2, 'up');
    expect(up.map((s) => s.title)).toEqual(['A', 'C', 'B']);
    const down = reorderSection(input, 0, 'down');
    expect(down.map((s) => s.title)).toEqual(['B', 'A', 'C']);
    // Input array untouched.
    expect(input.map((s) => s.title)).toEqual(['A', 'B', 'C']);
  });

  it('reorderSection is a no-op at the boundaries and for bad indices', () => {
    expect(reorderSection(base(), 0, 'up').map((s) => s.title)).toEqual(['A', 'B', 'C']);
    expect(reorderSection(base(), 2, 'down').map((s) => s.title)).toEqual(['A', 'B', 'C']);
    expect(reorderSection(base(), 9, 'up').map((s) => s.title)).toEqual(['A', 'B', 'C']);
  });

  it('renameSection trims and preserves the rest of the section', () => {
    const out = renameSection(base(), 1, '  Renamed  ');
    expect(out[1].title).toBe('Renamed');
    expect(out[1].purpose).toBe('B purpose');
    expect(out[1].required).toBe(true);
  });

  it('renameSection ignores an empty/blank title', () => {
    expect(renameSection(base(), 1, '   ').map((s) => s.title)).toEqual(['A', 'B', 'C']);
  });

  it('insertSection appends when index is omitted or out of range', () => {
    const appended = insertSection(base());
    expect(appended.map((s) => s.title)).toEqual(['A', 'B', 'C', 'New section']);
    expect(insertSection(base(), 99).map((s) => s.title)).toEqual(['A', 'B', 'C', 'New section']);
  });

  it('insertSection places the new section right after the given index', () => {
    const out = insertSection(base(), 0, makeBlankSection('X'));
    expect(out.map((s) => s.title)).toEqual(['A', 'X', 'B', 'C']);
  });

  it('removeSection drops the target and is a no-op for bad indices', () => {
    expect(removeSection(base(), 1).map((s) => s.title)).toEqual(['A', 'C']);
    expect(removeSection(base(), 9).map((s) => s.title)).toEqual(['A', 'B', 'C']);
  });

  it('makeBlankSection returns a safe author default', () => {
    const s = makeBlankSection();
    expect(s.title).toBe('New section');
    expect(s.required).toBe(false);
    expect(s.level).toBe(1);
    expect(s.expectedLengthHint).toBe('medium');
  });
});
