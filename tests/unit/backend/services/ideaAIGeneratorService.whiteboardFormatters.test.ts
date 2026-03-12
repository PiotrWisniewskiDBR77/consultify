import { describe, expect, it } from 'vitest';

import { formatIdeaGeneratorOutput } from '../../../../server/src/services/ideaAIGeneratorService';

describe('ideaAIGeneratorService whiteboard formatters', () => {
  it('maps whiteboard_organize to supported moveNodes contract', () => {
    const batch = formatIdeaGeneratorOutput(
      'whiteboard_organize',
      'whiteboard',
      {
        groups: [{ id: 'frame-1', label: 'Theme', nodeIds: ['sticky-1', 'sticky-2'] }],
        repositionedNodes: [
          { id: 'sticky-1', position: { x: 120, y: 180 } },
          { id: 'sticky-2', position: { x: 320, y: 180 } },
        ],
      },
      'batch-1',
      'en'
    );

    const proposal = batch.proposals[0];
    expect(proposal.generatorStatus).toBe('real');
    expect(proposal.patch.moveNodes).toHaveLength(2);
    expect((proposal.patch as any).repositionedNodes).toBeUndefined();
    expect(proposal.patch.addNodes[0].position).toBeDefined();
  });

  it('adds positions for sticky_summarize and wb_find_themes', () => {
    const summaryBatch = formatIdeaGeneratorOutput(
      'sticky_summarize',
      'whiteboard',
      { summary: 'Condensed note', keyThemes: ['Speed'] },
      'batch-2',
      'en'
    );
    const themesBatch = formatIdeaGeneratorOutput(
      'wb_find_themes',
      'whiteboard',
      {
        themes: [
          {
            id: 'theme-1',
            label: 'Operations',
            description: 'Flow issues',
            nodeIds: ['sticky-1'],
            confidence: 0.8,
          },
        ],
      },
      'batch-3',
      'en'
    );

    expect(summaryBatch.proposals[0].patch.addNodes[0].position).toBeDefined();
    expect(themesBatch.proposals[0].patch.addNodes[0].position).toBeDefined();
  });

  it('marks wb_to_map_branches as cross-tool with positioned map nodes', () => {
    const batch = formatIdeaGeneratorOutput(
      'wb_to_map_branches',
      'whiteboard',
      {
        rootLabel: 'Root',
        branches: [
          {
            id: 'branch-1',
            label: 'Theme A',
            children: [{ id: 'leaf-1', label: 'Action 1' }],
          },
        ],
      },
      'batch-4',
      'en'
    );

    const proposal = batch.proposals[0];
    expect(proposal.generatorStatus).toBe('cross-tool');
    expect(proposal.targetTool).toBe('mindmap');
    expect(proposal.focusNodeId).toBeTruthy();
    expect(proposal.patch.addNodes.every((node: any) => node.position)).toBe(true);
  });

  it('marks wb_to_table as cross-tool and generates runtime table rows', () => {
    const batch = formatIdeaGeneratorOutput(
      'wb_to_table',
      'whiteboard',
      {
        columns: [{ key: 'title', header: 'Title' }],
        rows: [{ cells: { title: 'Task 1', owner: 'Ada' }, sourceNodeId: 'sticky-1' }],
      },
      'batch-5',
      'en'
    );

    const proposal = batch.proposals[0];
    expect(proposal.generatorStatus).toBe('cross-tool');
    expect(proposal.targetTool).toBe('table');
    expect(proposal.patch.extensions.table.generatedRowNodes).toHaveLength(1);
    expect(proposal.patch.extensions.table.generatedRowNodes[0].data.title).toBe('Task 1');
  });

  it('normalizes wb_extract_actions metadata for whiteboard renderer', () => {
    const batch = formatIdeaGeneratorOutput(
      'wb_extract_actions',
      'whiteboard',
      {
        actions: [
          {
            id: 'action-1',
            text: 'Follow up with supplier',
            owner: 'Ada',
            priority: 'high',
            sourceNodeId: 'sticky-9',
          },
        ],
      },
      'batch-6',
      'en'
    );

    const node = batch.proposals[0].patch.addNodes[0];
    expect(node.position).toBeDefined();
    expect(node.data.author).toBe('Ada');
    expect(node.data.priority).toBe(80);
    expect(typeof node.data.colorIndex).toBe('number');
  });

  it('keeps every planned whiteboard formatter on supported patch fields only', () => {
    const cases = [
      formatIdeaGeneratorOutput(
        'whiteboard_organize',
        'whiteboard',
        { groups: [], repositionedNodes: [] },
        'batch-7',
        'en'
      ),
      formatIdeaGeneratorOutput(
        'sticky_summarize',
        'whiteboard',
        { summary: 'Summary', keyThemes: [] },
        'batch-8',
        'en'
      ),
      formatIdeaGeneratorOutput(
        'wb_find_themes',
        'whiteboard',
        { themes: [] },
        'batch-9',
        'en'
      ),
      formatIdeaGeneratorOutput(
        'wb_to_map_branches',
        'whiteboard',
        { rootLabel: 'Root', branches: [] },
        'batch-10',
        'en'
      ),
      formatIdeaGeneratorOutput(
        'wb_to_table',
        'whiteboard',
        { columns: [], rows: [] },
        'batch-11',
        'en'
      ),
      formatIdeaGeneratorOutput(
        'wb_extract_actions',
        'whiteboard',
        { actions: [] },
        'batch-12',
        'en'
      ),
    ];

    for (const batch of cases) {
      for (const proposal of batch.proposals) {
        const patchKeys = Object.keys(proposal.patch || {}).sort();
        expect(patchKeys.every((key) => ['addEdges', 'addNodes', 'extensions', 'moveNodes'].includes(key))).toBe(
          true
        );
      }
    }
  });
});
