/**
 * Tests for branchColor helper (color override support).
 */
import { describe, expect, it } from 'vitest';
import { BRANCH_COLORS, branchColor } from '@/components/MyWork/mindmap/useMindMapNodes';

describe('branchColor', () => {
  it('returns base branch color for known key', () => {
    const c = branchColor('strengths');
    expect(c.bg).toBe(BRANCH_COLORS.strengths.bg);
    expect(c.edge).toBe(BRANCH_COLORS.strengths.edge);
  });

  it('returns uncategorized for unknown key', () => {
    const c = branchColor('nonexistent-key');
    expect(c).toEqual(BRANCH_COLORS.uncategorized);
  });

  it('applies color override to bg, edge, and glow', () => {
    const c = branchColor('threats', '#ff00ff');
    expect(c.edge).toBe('#ff00ff');
    expect(c.bg).toBe('#ff00ff20');
    expect(c.glow).toBe('#ff00ff40');
    expect(c.text).toBe(BRANCH_COLORS.threats.text);
  });

  it('returns base when colorOverride is empty string', () => {
    const c = branchColor('strengths', '');
    expect(c).toEqual(BRANCH_COLORS.strengths);
  });
});
