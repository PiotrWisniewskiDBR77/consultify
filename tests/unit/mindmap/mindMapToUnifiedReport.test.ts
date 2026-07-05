/**
 * M06 FALA3 3.4 — mind map → UnifiedReportJSON mapper (REAL CODE)
 *
 * Tests server/src/services/mindmap/mindMapToUnifiedReport.ts, the pure
 * function that feeds ExportPowerPoint's branch data into
 * PptxPipelineService.generateFromUnifiedJson (see pptx-layouts.test.ts for
 * the layout/tokens side of the same pipeline).
 */
import { describe, expect, it } from 'vitest';

import mapMindMapToUnifiedReport, {
  type MindMapBranch,
} from '../../../server/src/services/mindmap/mindMapToUnifiedReport.js';
import { resolveLayout } from '../../../server/src/services/report/pptx/layouts/index.js';
import { validateReport } from '../../../server/src/services/report/pptx/RulesEngine.js';

const BRANCHES: MindMapBranch[] = [
  {
    branchKey: 'problem',
    label: 'Problem',
    nodes: [
      { id: 'n1', label: 'Slow onboarding', status: 'active' },
      { id: 'n2', label: 'Low retention', status: 'blocked' },
    ],
  },
  {
    branchKey: 'goal',
    label: 'Goal',
    nodes: [{ id: 'n3', label: 'Increase activation by 20%' }],
  },
];

describe('mapMindMapToUnifiedReport (REAL)', () => {
  it('builds a cover slide from the idea title', () => {
    const report = mapMindMapToUnifiedReport('My Great Idea', BRANCHES);
    expect(report.slides[0].intent).toBe('cover');
    expect(report.slides[0].content).toMatchObject({ type: 'cover', title: 'My Great Idea' });
    expect(report.meta.project).toBe('My Great Idea');
  });

  it('emits a section_intro + key_messages pair per branch', () => {
    const report = mapMindMapToUnifiedReport('Idea', BRANCHES);
    const intents = report.slides.map((s) => s.intent);
    // cover, section_intro(problem), key_messages(problem), section_intro(goal), key_messages(goal)
    expect(intents).toEqual([
      'cover',
      'section_intro',
      'key_messages',
      'section_intro',
      'key_messages',
    ]);
  });

  it('carries branch node labels into key_messages content', () => {
    const report = mapMindMapToUnifiedReport('Idea', BRANCHES);
    const problemMessages = report.slides[2].content as any;
    expect(problemMessages.type).toBe('key_messages');
    expect(problemMessages.messages.map((m: any) => m.title)).toEqual([
      'Slow onboarding',
      'Low retention',
    ]);
  });

  it('handles an empty branch without throwing', () => {
    const emptyBranches: MindMapBranch[] = [{ branchKey: 'risks', label: 'Risks', nodes: [] }];
    const report = mapMindMapToUnifiedReport('Idea', emptyBranches);
    const messages = report.slides[2].content as any;
    expect(messages.type).toBe('key_messages');
    expect(messages.messages.length).toBe(1);
  });

  it('paginates a branch with more than 5 ideas across multiple key_messages slides', () => {
    const manyNodes = Array.from({ length: 12 }, (_, i) => ({
      id: `n${i}`,
      label: `Idea ${i}`,
    }));
    const report = mapMindMapToUnifiedReport('Idea', [
      { branchKey: 'options', label: 'Options', nodes: manyNodes },
    ]);
    const keyMessageSlides = report.slides.filter((s) => s.intent === 'key_messages');
    // 12 nodes / 5 per slide = 3 slides (5, 5, 2)
    expect(keyMessageSlides.length).toBe(3);
    const totalMessages = keyMessageSlides.reduce(
      (sum, s) => sum + (s.content as any).messages.length,
      0
    );
    expect(totalMessages).toBe(12);
  });

  it('handles zero branches (cover slide only)', () => {
    const report = mapMindMapToUnifiedReport('Empty Idea', []);
    expect(report.slides.length).toBe(1);
    expect(report.slides[0].intent).toBe('cover');
  });

  it('defaults to Polish language and internal confidentiality', () => {
    const report = mapMindMapToUnifiedReport('Idea', BRANCHES);
    expect(report.meta.language).toBe('pl');
    expect(report.meta.confidentiality).toBe('internal');
  });

  it('respects an explicit language/template/confidentiality override', () => {
    const report = mapMindMapToUnifiedReport('Idea', BRANCHES, {
      language: 'en',
      template: 'minimal',
      confidentiality: 'confidential',
    });
    expect(report.meta.language).toBe('en');
    expect(report.meta.template).toBe('minimal');
    expect(report.meta.confidentiality).toBe('confidential');
  });

  it('produces a report that passes RulesEngine validation (no structural errors)', () => {
    const report = mapMindMapToUnifiedReport('Idea', BRANCHES);
    const result = validateReport(report);
    const errors = result.violations.filter((v) => v.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('every emitted slide intent resolves to a real layout (no unsupported intents)', () => {
    const report = mapMindMapToUnifiedReport('Idea', BRANCHES);
    for (const slide of report.slides) {
      expect(() => resolveLayout(slide.intent)).not.toThrow();
    }
  });

  it('falls back to a default title when ideaTitle is empty', () => {
    const report = mapMindMapToUnifiedReport('', BRANCHES);
    expect(report.meta.project.length).toBeGreaterThan(0);
  });

  it('falls back to branchKey when label is missing', () => {
    const report = mapMindMapToUnifiedReport('Idea', [
      { branchKey: 'evidence', label: '', nodes: [] },
    ]);
    const sectionIntro = report.slides[1].content as any;
    expect(sectionIntro.section_title).toBe('evidence');
  });
});
