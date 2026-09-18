/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BlockCard } from '../BlockCard';
import type { BlockConfig } from '../ReportEditor';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue || key,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../blocks/SmartBlockRenderer', () => ({
  SmartBlockRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

const reportBlock = {
  id: 'summary',
  type: 'summary',
  length: 'medium',
  includeVisuals: false,
  enabled: true,
  orderIndex: 0,
  isGenerated: true,
} as BlockConfig;
reportBlock.title = String(1);
reportBlock.content = String(2);

describe('RB-3 D-95 BlockCard navigation v2 contract', () => {
  it('keeps one active Regenerate action and Configure/AI/Comments in one kebab', () => {
    render(
      <BlockCard
        block={reportBlock}
        workspaceNavV2
        isSelected
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onAddBelow={vi.fn()}
        onRegenerate={vi.fn().mockResolvedValue(undefined)}
        onGenerateBlock={vi.fn().mockResolvedValue(undefined)}
        onSaveContent={vi.fn().mockResolvedValue(undefined)}
        canMoveUp={false}
        canMoveDown={false}
        isPl={false}
      />
    );

    const regenerate = screen.getAllByRole('button', { name: 'Regenerate' });
    expect(regenerate).toHaveLength(1);
    expect(regenerate[0]).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Block actions' }));
    expect(screen.getByRole('button', { name: 'Configure' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AI' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comments' })).toBeInTheDocument();
  });
});
