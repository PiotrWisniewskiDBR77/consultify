import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  CHAT_HEADER_CONTROL_ACTIVE_CLASS,
  CHAT_HEADER_ICON_CONTROL_CLASS,
  CHAT_HEADER_SELECTOR_CLASS,
} from '../chatHeaderControlStyles';
import { BranchSelector } from '../BranchSelector';

describe('Chat header owner feedback', () => {
  it('shares one measured geometry and Liquid Glass focus contract', () => {
    for (const className of [CHAT_HEADER_ICON_CONTROL_CLASS, CHAT_HEADER_SELECTOR_CLASS]) {
      expect(className).toContain('h-8');
      expect(className).toContain('rounded-xl');
      expect(className).toContain('border-white/30');
      expect(className).toContain('backdrop-blur-xl');
      expect(className).toContain('focus-visible:ring-2');
      expect(className).toContain('focus-visible:ring-c-focus');
    }
  });

  it('keeps icon and selector sizing intentionally distinct without changing radius', () => {
    expect(CHAT_HEADER_ICON_CONTROL_CLASS).toContain('w-8');
    expect(CHAT_HEADER_SELECTOR_CLASS).toContain('px-3');
    expect(CHAT_HEADER_SELECTOR_CLASS).not.toContain('w-8');
  });

  it('uses one geometry-neutral active/open state', () => {
    expect(CHAT_HEADER_CONTROL_ACTIVE_CLASS).toContain('ring-1');
    expect(CHAT_HEADER_CONTROL_ACTIVE_CLASS).toContain('ring-c-border');
    expect(CHAT_HEADER_CONTROL_ACTIVE_CLASS).not.toMatch(/\bh-|\bw-|\bp[xy]-/);
  });

  it('connects stateful header triggers to one shared contract and their controlled surfaces', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const panelSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AIChat/UnifiedChatPanel.tsx'),
      'utf8'
    );
    const branchSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AIChat/BranchSelector.tsx'),
      'utf8'
    );
    expect(panelSource).toContain('aria-expanded={isSidebarOpen}');
    expect(panelSource).toContain('aria-controls="chat-history-panel"');
    expect(panelSource).toContain('aria-expanded={signalsOpen}');
    expect(panelSource).toContain('aria-controls="chat-signals-panel"');
    expect(panelSource).toContain('data-testid="chat-header-right-controls"');
    expect(panelSource).toContain('h-[42px] flex-nowrap');
    expect(panelSource).toContain('max-[520px]:flex-wrap');
    expect(panelSource).toContain('flex-1 flex-wrap');
    expect(panelSource).toContain(
      'className={`${CHAT_HEADER_ICON_CONTROL_CLASS} ${showWorkPanel ? CHAT_HEADER_CONTROL_ACTIVE_CLASS : \'\'}`}'
    );
    expect(panelSource).toContain('aria-pressed={autoReadEnabled}');
    expect(panelSource).toContain(
      'className={`${CHAT_HEADER_ICON_CONTROL_CLASS} ${autoReadEnabled ? CHAT_HEADER_CONTROL_ACTIVE_CLASS : \'\'}`}'
    );
    expect(branchSource).toContain('aria-expanded={isOpen}');
    expect(branchSource).toContain('aria-haspopup="dialog"');
    expect(branchSource).toContain('id="chat-branch-selector-menu"');
    expect(branchSource).toContain('role="dialog"');
    expect(branchSource).toContain('aria-modal="true"');
    expect(branchSource).toContain('dialogRef.current?.focus()');
    expect(branchSource).toContain("event.key === 'Escape'");
    expect(branchSource).toContain('triggerRef.current?.focus()');

    const historySource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AIChat/ChatHistorySidebar.tsx'),
      'utf8'
    );
    const signalsSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AIChat/ChatSignalsPanel.tsx'),
      'utf8'
    );
    expect(historySource).toContain('id="chat-history-panel"');
    expect(historySource).toContain('aria-hidden={!isSidebarOpen}');
    expect(historySource).toContain('inert={!isSidebarOpen}');
    expect(signalsSource).toContain('id="chat-signals-panel"');
    expect(signalsSource).toContain('aria-modal="true"');

    const artifactSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AIChat/V8ArtifactRunControl.tsx'),
      'utf8'
    );
    const contextSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AIChat/V8ContextIndicator.tsx'),
      'utf8'
    );
    const privateSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AIChat/PrivateModeDetails.tsx'),
      'utf8'
    );
    expect(artifactSource).toContain('CHAT_HEADER_ICON_CONTROL_CLASS');
    expect(artifactSource).toContain('data-chat-header-control-variant="icon-action"');
    expect(contextSource).toContain('CHAT_HEADER_SELECTOR_CLASS');
    expect(contextSource).toContain('data-chat-header-control-variant="status-selector"');
    expect(privateSource).toContain('inline-flex h-8 shrink-0');
    expect(privateSource).toContain('data-chat-header-control-variant="status-selector"');
  });

  it('renders a keyboard-contained Branch dialog and restores focus on Escape', async () => {
    const onSelectBranch = vi.fn();
    render(
      React.createElement(BranchSelector, {
        branches: [
          {
            id: 'branch-1',
            conversationId: 'conversation-1',
            forkMessageId: 'message-1',
            name: 'A deliberately long client transformation branch name',
            createdAt: '2026-08-23T10:00:00.000Z',
            messageCount: 4,
          },
        ],
        activeBranchId: 'branch-1',
        onSelectBranch,
        onCreateBranch: vi.fn(),
      })
    );

    const trigger = screen.getByTestId('branch-selector-trigger');
    expect(trigger).toHaveAttribute('title', 'A deliberately long client transformation branch name');
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(dialog).toHaveFocus());
    const branchRow = screen.getByRole('button', {
      name: 'Open branch: A deliberately long client transformation branch name',
    });
    fireEvent.keyDown(branchRow, { key: 'Enter' });
    expect(onSelectBranch).toHaveBeenCalledWith('branch-1');

    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps a failed branch name visible for retry and announces the error', async () => {
    const onCreateBranch = vi.fn();
    const props = {
      branches: [],
      activeBranchId: null,
      onSelectBranch: vi.fn(),
      onCreateBranch,
    };
    const { rerender } = render(React.createElement(BranchSelector, props));

    fireEvent.click(screen.getByTestId('branch-selector-trigger'));
    fireEvent.click(screen.getByTestId('branch-selector-open-create'));
    const input = screen.getByPlaceholderText('Branch name...');
    fireEvent.change(input, { target: { value: 'Alternative path' } });
    fireEvent.click(screen.getByTestId('branch-selector-submit-create'));
    expect(onCreateBranch).toHaveBeenCalledWith('Alternative path');

    rerender(React.createElement(BranchSelector, { ...props, isCreating: true }));
    expect(input).toBeDisabled();
    rerender(
      React.createElement(BranchSelector, {
        ...props,
        isCreating: false,
        error: 'Could not create branch.',
      })
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not create branch.');
    expect(screen.getByPlaceholderText('Branch name...')).toHaveValue('Alternative path');
    expect(screen.getByTestId('branch-selector-submit-create')).toBeEnabled();
  });
});
