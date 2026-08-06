import { describe, expect, it } from 'vitest';

import {
  buildTemplateRuntimeFromRow,
  validatePresentationCustomTemplate,
} from '../presentationTemplateRuntimeService.js';

/**
 * FALA D (2026-07-26, "deck-narrative-depth") — regression pin for a real bug
 * found during the audit: the Template Architect
 * (presentationTemplateDraftService.ts `PresentationTemplateOutlineItem`)
 * drafts per-slide `dataNeeded`/`suggestedVisual` briefing fields into
 * `outline_json`, but `buildTemplateRuntimeFromRow` hand-picked only 5 fields
 * (`intent`/`title`/`keyMessage`/`enabled`/`sourceRef`) when mapping the
 * stored row back into `OutlineItem[]` — silently dropping the rest before
 * the generator ever saw them, even though every downstream consumer
 * (`applyTemplateRuntime`, `applyApprovedTemplateToOutline`,
 * `generateOutlineFromTemplate`) just object-spreads the item through
 * unchanged. This test proves the fields now survive the row → runtime
 * mapping (both camelCase and snake_case DB shapes).
 */
describe('buildTemplateRuntimeFromRow — per-slide briefing fields survive the row mapping', () => {
  it('carries custom template version, theme and layout mapping into generation runtime', () => {
    const customTemplate = {
      version: 4,
      theme: {
        titleFont: 'Aptos',
        bodyFont: 'Arial',
        primaryColor: '112233',
        backgroundColor: 'FFFFFF',
        surfaceColor: 'EEEEEE',
        textColor: '111111',
        accentColor: '445566',
      },
      layouts: { standard: { masterName: 'Client Decision' } },
      layoutMapping: {
        cover: 'standard',
        content: 'standard',
        kpi: 'standard',
        table: 'standard',
        decision: 'standard',
      },
    };
    const runtime = buildTemplateRuntimeFromRow({
      id: 'tmpl-custom',
      outline_json: JSON.stringify([{ intent: 'next_steps', title: 'Decision' }]),
      layout_policy_json: JSON.stringify({ customTemplate }),
    });
    expect(runtime?.templateId).toBe('tmpl-custom');
    expect(runtime?.customTemplate).toEqual(customTemplate);
  });
  it('rejects incomplete custom contracts before runtime generation', () => {
    const result = validatePresentationCustomTemplate({
      version: 1,
      theme: {},
      layouts: {},
      layoutMapping: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'theme.titleFont is required',
          'layouts must contain at least one layout',
          'layoutMapping.cover is required',
        ])
      );
  });
  it('carries dataNeeded/suggestedVisual through (camelCase)', () => {
    const row = {
      id: 'tmpl-1',
      outline_json: JSON.stringify([
        {
          intent: 'risk_management',
          title: 'Risks',
          keyMessage: 'Top 3 risks threaten the Q3 timeline',
          dataNeeded: ['open RAID items', 'mitigation owners'],
          suggestedVisual: 'RAG status table',
        },
      ]),
    };

    const runtime = buildTemplateRuntimeFromRow(row);
    expect(runtime).not.toBeNull();
    const item = runtime!.outline[0];
    expect(item.keyMessage).toBe('Top 3 risks threaten the Q3 timeline');
    expect(item.dataNeeded).toEqual(['open RAID items', 'mitigation owners']);
    expect(item.suggestedVisual).toBe('RAG status table');
  });

  it('also accepts the snake_case shape (data_needed/suggested_visual)', () => {
    const row = {
      id: 'tmpl-2',
      outline_json: JSON.stringify([
        {
          intent: 'roadmap',
          title: 'Roadmap',
          data_needed: ['milestone dates'],
          suggested_visual: 'gantt timeline',
        },
      ]),
    };

    const runtime = buildTemplateRuntimeFromRow(row);
    const item = runtime!.outline[0];
    expect(item.dataNeeded).toEqual(['milestone dates']);
    expect(item.suggestedVisual).toBe('gantt timeline');
  });

  it('is undefined (not dropped-but-present-as-empty) when the template has no briefing', () => {
    const row = {
      id: 'tmpl-3',
      outline_json: JSON.stringify([{ intent: 'cover', title: 'Cover' }]),
    };

    const runtime = buildTemplateRuntimeFromRow(row);
    const item = runtime!.outline[0];
    expect(item.dataNeeded).toBeUndefined();
    expect(item.suggestedVisual).toBeUndefined();
  });

  it('filters non-string/blank entries out of dataNeeded', () => {
    const row = {
      id: 'tmpl-4',
      outline_json: JSON.stringify([
        {
          intent: 'single_insight',
          title: 'Insight',
          dataNeeded: ['real item', '', '   ', 42, null],
        },
      ]),
    };

    const runtime = buildTemplateRuntimeFromRow(row);
    const item = runtime!.outline[0];
    expect(item.dataNeeded).toEqual(['real item']);
  });
});
