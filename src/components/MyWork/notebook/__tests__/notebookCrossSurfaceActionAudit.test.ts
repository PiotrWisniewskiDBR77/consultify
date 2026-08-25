import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildNotebookCrossSurfaceActionAudit,
  NOTEBOOK_BUBBLE_TOOLBAR_ACTION_IDS,
  NOTEBOOK_EXPORT_ACTION_IDS,
  NOTEBOOK_STATIC_TOOLBAR_ACTION_IDS,
} from '../notebookActionRegistry';

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

describe('Notebook cross-surface action audit', () => {
  const actions = buildNotebookCrossSurfaceActionAudit();

  it('has a unique, machine-counted contract for every retained action surface', () => {
    // FIX-4 (Day 3 acceptance): B.6 registered 'note:version-history'
    // (notebookActionRegistry.ts, commit fba02fef05) but this count stayed at
    // the pre-B.6 104 — a real, already-wired action (NotebookHamburgerMenu.tsx
    // id 'version-history', panel in NotebookContent.tsx) was under-counted.
    expect(actions.some((action) => action.id === 'note:version-history')).toBe(true);
    expect(actions).toHaveLength(105);
    expect(new Set(actions.map((action) => action.id)).size).toBe(actions.length);
    expect(new Set(actions.map((action) => action.surface))).toEqual(
      new Set([
        'format-toolbar',
        'format-bubble',
        'export-menu',
        'note-menu',
        'block-menu',
        'inline-ai',
        'work-rail',
      ])
    );
  });

  it('never classifies a durable mutation as local visible state', () => {
    const durable = actions.filter((action) => action.effect === 'server-mutation');
    expect(durable.length).toBeGreaterThan(0);
    expect(durable.every((action) => action.availability === 'server-capability')).toBe(true);
    expect(durable.every((action) => action.requiredEvidence === 'server-receipt')).toBe(true);
    expect(
      durable.every(
        (action) =>
          action.implementation !== 'implemented' || action.observedEvidence === 'server-receipt'
      )
    ).toBe(true);
  });

  it('covers the rendered format, slash/block and inline-AI command IDs', () => {
    const ids = new Set(actions.map((action) => action.id));
    const toolbar = read('NotebookToolbar.tsx');
    const bubble = read('NotebookBubbleToolbar.tsx');
    const exportMenu = read('NotebookExportMenu.tsx');
    const slash = read('SlashMenu.tsx');
    const inlineAi = read('NotebookInlineAIMenu.tsx');
    const inlinePrompts = fs.readFileSync(
      path.resolve(__dirname, '../../../DocumentStudio/inline-ai/inlineActionPrompts.ts'),
      'utf8'
    );
    const rail = read('NotebookRightRail.tsx');
    const noteMenu = read('NotebookHamburgerMenu.tsx');
    const content = fs.readFileSync(path.resolve(__dirname, '../../NotebookContent.tsx'), 'utf8');

    const renderedStaticIds = [...toolbar.matchAll(/<Btn\s+actionId="([^"]+)"/g)].map(
      (match) => match[1]
    );
    const renderedBubbleIds = [...bubble.matchAll(/<MarkBtn\s+actionId="([^"]+)"/g)].map(
      (match) => match[1]
    );
    expect(renderedStaticIds).toEqual([...NOTEBOOK_STATIC_TOOLBAR_ACTION_IDS]);
    expect(renderedBubbleIds).toEqual([...NOTEBOOK_BUBBLE_TOOLBAR_ACTION_IDS]);
    for (const id of renderedStaticIds) expect(ids.has(`format:toolbar:${id}`), id).toBe(true);
    for (const id of renderedBubbleIds) expect(ids.has(`format:bubble:${id}`), id).toBe(true);
    for (const id of NOTEBOOK_EXPORT_ACTION_IDS) {
      expect(exportMenu).toContain(`export:${id}`);
      expect(ids.has(`export:${id}`), id).toBe(true);
    }
    expect(exportMenu).toContain('role="alert"');
    expect(exportMenu).toContain("i18n.t('common.retry', 'Retry')");
    const renderedSlashIds = [...slash.matchAll(/^\s+id: '([^']+)',/gm)].map(
      (match) => `block:${match[1]}`
    );
    expect(renderedSlashIds).toHaveLength(35);
    expect(
      actions.filter((action) => action.surface === 'block-menu').map((action) => action.id)
    ).toEqual(renderedSlashIds);
    expect(slash).toContain('data-notebook-action-id={`block:${cmd.id}`}');

    const renderedInlineActionIds = [
      'inline-ai:trigger',
      ...[...inlinePrompts.matchAll(/^\s+id: '([^']+)',/gm)].map(
        (match) => `inline-ai:${match[1]}`
      ),
      'inline-ai:approve',
      'inline-ai:reject',
      'inline-ai:retry',
      'inline-ai:close',
    ];
    expect(
      actions.filter((action) => action.surface === 'inline-ai').map((action) => action.id)
    ).toEqual(renderedInlineActionIds);
    for (const id of ['shorten', 'expand', 'improve', 'formal', 'explain']) {
      expect(inlineAi).toContain('INLINE_ACTIONS.map');
      expect(ids.has(`inline-ai:${id}`), id).toBe(true);
    }
    expect(inlineAi).toContain('data-notebook-action-id={`inline-ai:${action.id}`}');
    expect(noteMenu).toContain('data-notebook-action-id={action.contract.id}');
    expect(
      actions.filter((action) => action.surface === 'work-rail').map((action) => action.id)
    ).toEqual([
      'rail:tab-work',
      'rail:tab-context',
      'rail:close',
      'rail:retry-save',
      'rail:load-theirs',
      'rail:keep-mine',
      'rail:visibility-private',
      'rail:visibility-project',
      'rail:verification-status',
      'rail:review-cadence',
      'rail:mark-reviewed',
      'rail:open-teresa',
    ]);
    expect(rail).toContain('data-notebook-action-id={`rail:tab-${tab}`}');
    expect(rail).toContain('data-notebook-action-id={`rail:visibility-${visibility}`}');
    for (const id of [
      'close',
      'retry-save',
      'load-theirs',
      'keep-mine',
      'verification-status',
      'review-cadence',
      'mark-reviewed',
      'open-teresa',
    ]) {
      expect(rail).toContain(`data-notebook-action-id="rail:${id}"`);
    }
    expect(toolbar).toContain('NotebookToolbar');
    expect(content).toContain('receiptCapableActionIds={[]}');
    // DEC-25: the note-menu's receiptCapableActionIds now folds in
    // 'expand-document' alongside 'delete' (both governed-api /
    // server-receipt-required — see notebookActionRegistry.ts), backed by the
    // same real capability fetch instead of a single-action ternary.
    expect(content).toContain("...(isDeleteReceiptCapable ? ['delete'] : [])");
    expect(content).toContain(
      "...(isExpandDocumentReceiptCapable ? ['expand-document'] : [])"
    );
  });

  it('keeps every governed menu conversion and rail mutation receipt-bound', () => {
    const ids = new Map(actions.map((action) => [action.id, action]));
    for (const id of [
      'note:expand-document',
      'note:delete',
      'note:convert-initiative',
      'note:convert-task',
      'note:convert-decision',
      'rail:retry-save',
      'rail:load-theirs',
      'rail:keep-mine',
      'rail:visibility-private',
      'rail:visibility-project',
      'rail:verification-status',
      'rail:review-cadence',
      'rail:mark-reviewed',
    ]) {
      expect(ids.get(id), id).toMatchObject({
        effect: 'server-mutation',
        availability: 'server-capability',
        requiredEvidence: 'server-receipt',
      });
    }
  });
});
