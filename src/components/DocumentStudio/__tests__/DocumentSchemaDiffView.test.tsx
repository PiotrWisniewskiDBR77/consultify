/**
 * @vitest-environment jsdom
 *
 * B3 — render specs for the shared visual diff view (DocumentSchemaDiffView).
 */

import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { DocumentSchemaDiffView, InlineTextDiff } from '../DocumentSchemaDiffView';
import type { DocumentSchemaDiff } from '../types';

function makeDiff(overrides: Partial<DocumentSchemaDiff> = {}): DocumentSchemaDiff {
  return {
    hasChanges: true,
    stats: {
      addedSectionCount: 0,
      removedSectionCount: 0,
      modifiedSectionCount: 1,
      reorderedSectionCount: 0,
      unchangedSectionCount: 0,
      addedBlockCount: 0,
      removedBlockCount: 0,
      modifiedBlockCount: 1,
      unchangedBlockCount: 0,
    },
    sectionDiffs: [
      {
        kind: 'modified',
        sectionId: 'sec-1',
        beforeTitle: 'Executive summary',
        afterTitle: 'Executive summary',
        beforeOrderIndex: 0,
        afterOrderIndex: 0,
        blockDiffs: [
          {
            kind: 'modified',
            blockId: 'blk-1',
            blockType: 'paragraph',
            beforeText: 'The quick brown fox',
            afterText: 'The slow brown fox',
            beforePositionIndex: 0,
            afterPositionIndex: 0,
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('InlineTextDiff', () => {
  it('renders added tokens as <ins> and removed tokens as <del>', () => {
    const { container } = render(
      <InlineTextDiff before="The quick brown fox" after="The slow brown fox" />
    );
    const ins = container.querySelector('ins');
    const del = container.querySelector('del');
    expect(ins?.textContent).toContain('slow');
    expect(del?.textContent).toContain('quick');
    expect(del?.className).toContain('line-through');
    expect(container.textContent).toContain('brown fox');
  });
});

describe('DocumentSchemaDiffView', () => {
  it('renders a changed section with an inline word diff for textual blocks', () => {
    render(<DocumentSchemaDiffView diff={makeDiff()} />);
    expect(screen.getByText('Executive summary')).toBeInTheDocument();
    const block = screen.getByTestId('diff-block-blk-1');
    expect(within(block).getByText('slow')).toBeInTheDocument();
    expect(within(block).getByText('quick')).toBeInTheDocument();
    // Modified badge on the section card.
    expect(screen.getByText('Modified')).toBeInTheDocument();
  });

  it('renders a structural label for non-textual blocks instead of a word diff', () => {
    const diff = makeDiff({
      sectionDiffs: [
        {
          kind: 'modified',
          sectionId: 'sec-1',
          beforeTitle: 'KPIs',
          afterTitle: 'KPIs',
          beforeOrderIndex: 0,
          afterOrderIndex: 0,
          blockDiffs: [
            {
              kind: 'modified',
              blockId: 'blk-chart',
              blockType: 'chart',
              beforeText: 'bar:Revenue|2024=1',
              afterText: 'line:Revenue|2024=2',
              beforePositionIndex: 0,
              afterPositionIndex: 0,
            },
          ],
        },
      ],
    });
    render(<DocumentSchemaDiffView diff={diff} />);
    const block = screen.getByTestId('diff-block-blk-chart');
    // "Changed block: {{type}}" — the test i18n mock keeps single-brace
    // placeholders, so assert on the stable prefix + metadata rows instead.
    expect(within(block).getByText(/Changed block:/)).toBeInTheDocument();
    expect(within(block).getByText('bar:Revenue|2024=1')).toBeInTheDocument();
    expect(within(block).getByText('line:Revenue|2024=2')).toBeInTheDocument();
    // No word-level diff markers for structural blocks.
    expect(block.querySelector('ins')).toBeNull();
    expect(block.querySelector('del')).toBeNull();
  });

  it('renders whole added blocks as inserted text and removed blocks struck through', () => {
    const diff = makeDiff({
      sectionDiffs: [
        {
          kind: 'modified',
          sectionId: 'sec-1',
          beforeTitle: 'Body',
          afterTitle: 'Body',
          beforeOrderIndex: 0,
          afterOrderIndex: 0,
          blockDiffs: [
            {
              kind: 'added',
              blockId: 'blk-new',
              blockType: 'paragraph',
              beforeText: null,
              afterText: 'Brand new paragraph.',
              beforePositionIndex: null,
              afterPositionIndex: 1,
            },
            {
              kind: 'removed',
              blockId: 'blk-old',
              blockType: 'paragraph',
              beforeText: 'Obsolete paragraph.',
              afterText: null,
              beforePositionIndex: 0,
              afterPositionIndex: null,
            },
          ],
        },
      ],
    });
    render(<DocumentSchemaDiffView diff={diff} />);
    const added = screen.getByTestId('diff-block-blk-new');
    expect(added.querySelector('ins')?.textContent).toBe('Brand new paragraph.');
    const removed = screen.getByTestId('diff-block-blk-old');
    expect(removed.querySelector('del')?.textContent).toBe('Obsolete paragraph.');
  });

  it('renders reordered sections with a position note', () => {
    const diff = makeDiff({
      sectionDiffs: [
        {
          kind: 'reordered',
          sectionId: 'sec-2',
          beforeTitle: 'Risks',
          afterTitle: 'Risks',
          beforeOrderIndex: 2,
          afterOrderIndex: 0,
          blockDiffs: [],
        },
      ],
    });
    render(<DocumentSchemaDiffView diff={diff} />);
    expect(screen.getByText('Reordered')).toBeInTheDocument();
    // Interpolated "Position {{from}} → {{to}}" note (mock keeps single braces).
    expect(screen.getByText(/Position .*→/)).toBeInTheDocument();
  });

  it('renders the no-changes note when the diff is empty', () => {
    const diff = makeDiff({
      hasChanges: false,
      sectionDiffs: [],
    });
    render(<DocumentSchemaDiffView diff={diff} />);
    expect(screen.getByText('No changes to display.')).toBeInTheDocument();
    expect(screen.queryByTestId('document-schema-diff-view')).toBeNull();
  });
});
