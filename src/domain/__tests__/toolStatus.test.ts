import { describe, expect, it } from 'vitest';

import {
  KNOWN_TOOL_STATUS_RAW_VALUES,
  resolveToolStatus,
  toolStatusLabel,
  type ToolStatusDomain,
} from '../toolStatus';

/**
 * Table-driven fixture covering every raw backend status this stream's
 * inventory found in play (docs/program/METHOD_TOOLS_2026-08-13/STATUS_CANON.md):
 *  - tool_sessions.status (uppercase canonical, ToolController.ts writes) plus
 *    the legacy COMPLETED alias handled by useToolStore's
 *    normalizeCanonicalStatus().
 *  - tool_outputs.status (lowercase, src/toolOutputs/types.ts).
 * Deliberately NO hand-picked subset — this drives the round-trip test below
 * off `KNOWN_TOOL_STATUS_RAW_VALUES`, the mapper's own vocabulary, so a future
 * added/removed key is exercised automatically.
 */
const EXPECTED_DOMAIN_BY_RAW: Record<string, ToolStatusDomain> = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  EXECUTING: 'in_progress',
  GENERATING: 'in_progress',
  REVIEW: 'in_review',
  IN_REVIEW: 'in_review',
  PENDING_REVIEW: 'in_review',
  PENDING_APPROVAL: 'in_review',
  APPROVED: 'approved',
  GENERATED: 'generated',
  FINALIZED: 'finalized',
  COMPLETED: 'finalized',
  DONE: 'finalized',
  FINAL: 'finalized',
  UTILIZED: 'finalized',
  SUPERSEDED: 'superseded',
  ARCHIVED: 'superseded',
  FAILED: 'failed',
  REJECTED: 'failed',
  ERROR: 'failed',
  CANCELLED: 'failed',
};

describe('resolveToolStatus — table-driven round-trip over ALL known values', () => {
  it('the fixture exactly matches the mapper vocabulary (no drift either direction)', () => {
    expect(new Set(KNOWN_TOOL_STATUS_RAW_VALUES)).toEqual(new Set(Object.keys(EXPECTED_DOMAIN_BY_RAW)));
  });

  for (const raw of KNOWN_TOOL_STATUS_RAW_VALUES) {
    it(`maps raw "${raw}" (uppercase) to domain "${EXPECTED_DOMAIN_BY_RAW[raw]}", never silently to draft`, () => {
      const info = resolveToolStatus(raw);
      expect(info.domain).toBe(EXPECTED_DOMAIN_BY_RAW[raw]);
      expect(info.isUnknown).toBe(false);
    });

    it(`maps raw "${raw.toLowerCase()}" (lowercase, tool_outputs casing) to the same domain`, () => {
      const info = resolveToolStatus(raw.toLowerCase());
      expect(info.domain).toBe(EXPECTED_DOMAIN_BY_RAW[raw]);
      expect(info.isUnknown).toBe(false);
    });

    it(`"${raw}" has a non-empty PL and EN label distinct from the raw enum key`, () => {
      const info = resolveToolStatus(raw);
      expect(info.labelPl.length).toBeGreaterThan(0);
      expect(info.labelEn.length).toBeGreaterThan(0);
      expect(info.labelPl).not.toBe(raw);
      expect(info.labelEn).not.toBe(raw);
    });
  }
});

describe('resolveToolStatus — the confirmed defect: approved/GENERATED must never resolve to draft', () => {
  it('APPROVED resolves to the approved domain, not draft', () => {
    expect(resolveToolStatus('APPROVED').domain).toBe('approved');
    expect(resolveToolStatus('approved').domain).toBe('approved');
  });

  it('GENERATED resolves to the generated domain, not draft', () => {
    expect(resolveToolStatus('GENERATED').domain).toBe('generated');
  });

  it('IN_PROGRESS and FAILED (present in tool_sessions but missing from the old ad-hoc maps) do not fall back to draft', () => {
    expect(resolveToolStatus('IN_PROGRESS').domain).toBe('in_progress');
    expect(resolveToolStatus('FAILED').domain).toBe('failed');
  });

  it('SUPERSEDED (tool_outputs-only value) does not fall back to draft', () => {
    expect(resolveToolStatus('superseded').domain).toBe('superseded');
  });
});

describe('resolveToolStatus — unknown input: explicit fallback, never silent Draft', () => {
  it('an unrecognized raw value resolves to the unknown domain', () => {
    const info = resolveToolStatus('SOME_MADE_UP_STATUS');
    expect(info.domain).toBe('unknown');
    expect(info.isUnknown).toBe(true);
  });

  it('the unknown label names the raw value in both languages, and is never "Draft"/"Szkic"', () => {
    const info = resolveToolStatus('SOME_MADE_UP_STATUS');
    expect(info.labelPl).toBe('nieznany status: SOME_MADE_UP_STATUS');
    expect(info.labelEn).toBe('unknown status: SOME_MADE_UP_STATUS');
    expect(info.labelPl.toLowerCase()).not.toBe('szkic');
    expect(info.labelEn.toLowerCase()).not.toBe('draft');
  });

  it('null/undefined/empty input resolves to unknown, not draft', () => {
    expect(resolveToolStatus(null).domain).toBe('unknown');
    expect(resolveToolStatus(undefined).domain).toBe('unknown');
    expect(resolveToolStatus('').domain).toBe('unknown');
    expect(resolveToolStatus('   ').domain).toBe('unknown');
  });

  it('whitespace-only input still names something in the fallback label rather than being blank', () => {
    const info = resolveToolStatus('   ');
    expect(info.labelPl).toBe('nieznany status: (brak)');
    expect(info.labelEn).toBe('unknown status: (brak)');
  });
});

describe('toolStatusLabel — language selection', () => {
  it('returns the Polish label for lang=pl', () => {
    expect(toolStatusLabel('APPROVED', 'pl')).toBe('Zatwierdzone');
  });

  it('returns the English label for lang=en', () => {
    expect(toolStatusLabel('APPROVED', 'en')).toBe('Approved');
  });

  it('is case- and whitespace-insensitive on the raw value', () => {
    expect(toolStatusLabel('  generated  ', 'en')).toBe('Generated');
    expect(toolStatusLabel('Generated', 'pl')).toBe('Wygenerowane');
  });
});
