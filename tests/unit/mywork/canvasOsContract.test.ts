import { describe, expect, it } from 'vitest';

import { getCanvasOsActions } from '../../../src/components/MyWork/canvas/canvasOsContract';

describe('canvasOsContract', () => {
  it('exposes real template starters for process flow', () => {
    const actions = getCanvasOsActions('templates', 'process_flow');

    expect(actions.find((action) => action.id === 'tpl-process-improvement')).toMatchObject({
      kind: 'apply_template',
      templateId: 'pf-process-improvement',
      capability: 'real',
    });
    expect(actions.find((action) => action.id === 'tpl-bpmn')).toMatchObject({
      kind: 'apply_template',
      templateId: 'pf-bpmn-approval',
      capability: 'real',
    });
  });

  it('routes process-flow structured brief through governed AI proposals', () => {
    const actions = getCanvasOsActions('ai', 'process_flow');
    const briefAction = actions.find((action) => action.id === 'ai-brief');

    expect(briefAction).toMatchObject({
      kind: 'generate_ai',
      generatorType: 'process_brief',
      capability: 'real',
    });
  });
});
