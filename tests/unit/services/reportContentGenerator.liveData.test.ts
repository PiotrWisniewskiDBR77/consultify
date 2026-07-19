/**
 * M14 L-08 / S6 — raporty live-data
 *
 * Verifies that generateReportDocument populates its output exclusively from
 * the supplied ReportDataContext — no hardcoded / fabricated numbers.
 */
import { describe, expect, it } from 'vitest';

import {
  generateReportDocument,
  reportDocumentToMarkdown,
} from '@/components/Reports/reportContentGenerator';
import type { ReportDataContext } from '@/components/Execution/executionReports';

// ── Minimal empty context ─────────────────────────────────────────────────────
function emptyCtx(): ReportDataContext {
  return {
    initiatives: [],
    tasks: [],
    decisions: [],
    blocked: [],
    riskSignals: [],
    delaySignals: [],
    overdueDecisions: [],
    missingDates: [],
    dueSoonTasks: [],
    overspendSignals: [],
    nextMilestones: [],
    priorityAlerts: [],
    timelineWarnings: [],
    capacityAlerts: [],
    capacityTimeline: [],
    phaseLabel: null,
    progressPercent: null,
    totalInitiatives: 0,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('generateReportDocument — live-data contract (M14/S6)', () => {
  it('returns a ReportDocument with typeId, title, and non-empty sections for weekly-exec', () => {
    const doc = generateReportDocument({
      typeId: 'weekly-exec',
      title: 'Weekly Report',
      audience: 'PMO',
      ctx: emptyCtx(),
      isPolish: false,
    });

    expect(doc.typeId).toBe('weekly-exec');
    expect(doc.title).toBe('Weekly Report');
    expect(doc.sections.length).toBeGreaterThan(0);
  });

  it('summary counts come from ctx, not hardcoded', () => {
    const ctx = emptyCtx();
    ctx.totalInitiatives = 7;
    ctx.blocked = [{ id: 'b1', name: 'Initiative B' }];
    ctx.overdueDecisions = [{ id: 'd1', title: 'Decision A' }];
    ctx.riskSignals = [{ title: 'Risk X', severity: 'high' }];

    const doc = generateReportDocument({
      typeId: 'weekly-exec',
      title: 'T',
      audience: 'A',
      ctx,
      isPolish: false,
    });

    expect(doc.summary).toContain('7');
    expect(doc.summary).toContain('1 blocked');
    expect(doc.summary).toContain('1 overdue');
    expect(doc.summary).toContain('1 risk signal');
  });

  it('RAG is red when ctx.blocked is non-empty (blocked initiatives)', () => {
    const ctx = emptyCtx();
    ctx.totalInitiatives = 1;
    ctx.blocked = [{ id: 'i1', name: 'Alpha', reason: 'Budget frozen' }];

    const doc = generateReportDocument({
      typeId: 'program-health',
      title: 'Health Report',
      audience: 'Board',
      ctx,
      isPolish: false,
    });

    expect(doc.rag).toBe('red');
  });

  it('RAG is red when ctx.riskSignals contains a high-severity risk', () => {
    const ctx = emptyCtx();
    ctx.riskSignals = [{ title: 'Regulatory gap', severity: 'high' }];

    const doc = generateReportDocument({
      typeId: 'weekly-exec',
      title: 'T',
      audience: 'A',
      ctx,
      isPolish: false,
    });

    expect(doc.rag).toBe('red');
  });

  it('RAG is green when all initiatives are green / on-track', () => {
    const ctx = emptyCtx();
    ctx.totalInitiatives = 2;
    ctx.initiatives = [
      { id: 'i1', name: 'Alpha', status: 'EXECUTING', health: 'green' },
      { id: 'i2', name: 'Beta', status: 'SCHEDULED', health: 'on_track' },
    ];

    const doc = generateReportDocument({
      typeId: 'weekly-exec',
      title: 'T',
      audience: 'A',
      ctx,
      isPolish: false,
    });

    expect(doc.rag).toBe('green');
  });

  it('blocked items section lists actual blocked initiatives from ctx', () => {
    const ctx = emptyCtx();
    ctx.blocked = [
      { id: 'b1', name: 'Project Alpha', reason: 'Budget frozen' },
      { id: 'b2', name: 'Project Beta' },
    ];

    const doc = generateReportDocument({
      typeId: 'blockers-recovery',
      title: 'Blockers',
      audience: 'PMO',
      ctx,
      isPolish: false,
    });

    const allText = doc.sections.flatMap((s) =>
      s.blocks.flatMap((b) => (b.kind === 'list' ? b.items : [b.kind === 'text' ? b.content : '']))
    );

    const combined = allText.join(' ');
    expect(combined).toContain('Project Alpha');
    expect(combined).toContain('Project Beta');
  });

  it('risks section (table) reflects ctx.riskSignals — not fabricated', () => {
    const ctx = emptyCtx();
    ctx.riskSignals = [
      { title: 'Supplier delay', severity: 'high', description: 'Q3 parts delayed' },
    ];

    const doc = generateReportDocument({
      typeId: 'program-health',
      title: 'T',
      audience: 'A',
      ctx,
      isPolish: false,
    });

    const riskSection = doc.sections.find((s) => s.id === 'risks');
    expect(riskSection).toBeDefined();

    const tableBlock = riskSection!.blocks.find((b) => b.kind === 'table');
    expect(tableBlock).toBeDefined();
    if (tableBlock && tableBlock.kind === 'table') {
      const allCells = tableBlock.rows.flatMap((r) => r.cells).join(' ');
      expect(allCells).toContain('Supplier delay');
    }
  });

  it('Polish isPolish=true produces Polish ragLabel', () => {
    const doc = generateReportDocument({
      typeId: 'weekly-exec',
      title: 'Raport',
      audience: 'Zarząd',
      ctx: emptyCtx(),
      isPolish: true,
    });

    // Polish labels for green = "Zielony" (exact label may vary but should be non-English)
    expect(doc.ragLabel).toBeTruthy();
    // At minimum the document has a label
    expect(typeof doc.ragLabel).toBe('string');
  });

  // T9-2: explicit PL vs EN diff — proves the `tr()` bilingual pattern in
  // reportContentGenerator.ts actually branches on `isPolish`, not just that
  // both calls return *a* string. Same ctx/typeId, only the locale flips.
  it('PL and EN outputs differ (ragLabel, section headings, summary) for the same ctx', () => {
    const ctx = emptyCtx();
    ctx.totalInitiatives = 3;
    ctx.blocked = [{ id: 'b1', name: 'Alpha', reason: 'Budget frozen' }];
    ctx.riskSignals = [{ title: 'Supplier delay', severity: 'high' }];

    const base = {
      typeId: 'weekly-exec' as const,
      title: 'Report',
      audience: 'PMO',
      ctx,
    };

    const en = generateReportDocument({ ...base, isPolish: false });
    const pl = generateReportDocument({ ...base, isPolish: true });

    // Overall RAG bucket is language-independent (computed from ctx, not prose).
    expect(en.rag).toBe(pl.rag);

    // But every rendered string differs by locale.
    expect(en.ragLabel).not.toBe(pl.ragLabel);
    expect(en.ragLabel).toBe('At Risk');
    expect(pl.ragLabel).toBe('Zagrożony');

    expect(en.summary).not.toBe(pl.summary);

    const enHeadings = en.sections.map((s) => s.heading);
    const plHeadings = pl.sections.map((s) => s.heading);
    expect(enHeadings).not.toEqual(plHeadings);
    expect(enHeadings).toContain('Progress Summary');
    expect(plHeadings).toContain('Podsumowanie postępu');
  });

  it('reportDocumentToMarkdown emits the title as H1', () => {
    const doc = generateReportDocument({
      typeId: 'weekly-exec',
      title: 'My PMO Report',
      audience: 'Exec',
      ctx: emptyCtx(),
      isPolish: false,
    });

    const md = reportDocumentToMarkdown(doc);
    expect(md).toMatch(/^# My PMO Report/);
  });

  it('empty decisions section has no phantom items', () => {
    const ctx = emptyCtx();
    ctx.decisions = [];

    const doc = generateReportDocument({
      typeId: 'weekly-exec',
      title: 'T',
      audience: 'A',
      ctx,
      isPolish: false,
    });

    const decisionsSection = doc.sections.find((s) => s.id === 'decisions');
    if (decisionsSection) {
      const listBlock = decisionsSection.blocks.find((b) => b.kind === 'list');
      if (listBlock && listBlock.kind === 'list') {
        expect(listBlock.items.length).toBe(0);
      }
    }
  });
});
