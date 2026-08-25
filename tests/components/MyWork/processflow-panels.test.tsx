/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';
import plTranslation from '../../../public/locales/pl/translation.json';

// ProcessFlowContextMenu.tsx's getCanvasContextActions/getNodeContextActions call the REAL
// i18next singleton directly (`import i18n from '@/i18n'` → `i18n.t(key, default, { lng })`)
// instead of the react-i18next hook, so the global react-i18next mock in tests/setup.ts does
// not cover it. The real `@/i18n` module loads its translation bundles over HTTP
// (i18next-http-backend); tests/setup.ts globally mocks `fetch` to always return `{ data: [] }`,
// so no locale ever actually loads in tests and `i18n.t(key, default, { lng: 'pl' })` always
// falls back to the English `default` — the Polish-label assertion could never pass. Mock
// `@/i18n`'s default export to resolve real copy from the locale JSON per requested `lng`.
function resolveTranslation(dict: unknown, key: string, fallback: string): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, segment) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined),
      dict
    );
  return typeof value === 'string' ? value : fallback;
}
vi.mock('@/i18n', () => ({
  default: {
    t: (key: string, fallback: string, options?: { lng?: string }) =>
      resolveTranslation(options?.lng === 'pl' ? plTranslation : enTranslation, key, fallback),
  },
}));

import { ValidationResultsPanel } from '../../../src/components/MyWork/processflow/ValidationResultsPanel';
import { AIProposalPanel } from '../../../src/components/MyWork/processflow/AIProposalPanel';
import { ReadbackPanel } from '../../../src/components/MyWork/processflow/ReadbackPanel';
import { ExportDialog } from '../../../src/components/MyWork/processflow/ExportDialog';
import {
  ProcessFlowContextMenu,
  getNodeContextActions,
  getCanvasContextActions,
} from '../../../src/components/MyWork/processflow/ProcessFlowContextMenu';

describe('ValidationResultsPanel', () => {
  it('shows "no result" when result is null', () => {
    render(
      <ValidationResultsPanel
        result={null}
        isValidating={false}
        isPl={false}
        onClickIssue={vi.fn()}
        onValidate={vi.fn()}
      />
    );
    // Should show run validation prompt or "no result" indicator
    expect(screen.getByRole('heading', { name: 'Validation' })).toBeDefined();
    expect(screen.getByText('No result')).toBeDefined();
  });

  it('shows issues grouped by layer', () => {
    const result = {
      valid: false,
      issues: [
        {
          layer: 'semantic_first' as const,
          severity: 'error' as const,
          object_id: 'n1',
          rule: 'missing_start',
          message: 'Missing start node',
        },
        {
          layer: 'structural_bounded' as const,
          severity: 'warning' as const,
          object_id: 'n2',
          rule: 'dangling',
          message: 'Dangling node',
        },
      ],
      validated_at: '2026-04-11T00:00:00Z',
    };
    render(
      <ValidationResultsPanel
        result={result}
        isValidating={false}
        isPl={false}
        onClickIssue={vi.fn()}
        onValidate={vi.fn()}
      />
    );
    expect(screen.getByText(/Missing start node/)).toBeDefined();
    expect(screen.getByText(/Dangling node/)).toBeDefined();
  });

  it('calls onClickIssue when issue with object_id is clicked', () => {
    const onClickIssue = vi.fn();
    const result = {
      valid: false,
      issues: [
        {
          layer: 'semantic_first' as const,
          severity: 'error' as const,
          object_id: 'n1',
          rule: 'r1',
          message: 'Error on n1',
        },
      ],
      validated_at: '2026-04-11',
    };
    render(
      <ValidationResultsPanel
        result={result}
        isValidating={false}
        isPl={false}
        onClickIssue={onClickIssue}
        onValidate={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText(/Error on n1/));
    expect(onClickIssue).toHaveBeenCalledWith('n1');
  });

  it('shows success when valid with no issues', () => {
    render(
      <ValidationResultsPanel
        result={{ valid: true, issues: [], validated_at: '2026-04-11' }}
        isValidating={false}
        isPl={false}
        onClickIssue={vi.fn()}
        onValidate={vi.fn()}
      />
    );
    expect(screen.getByText(/no issues/i)).toBeDefined();
  });
});

describe('ExportDialog', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <ExportDialog open={false} onClose={vi.fn()} onExport={vi.fn()} isExporting={false} isPl={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders export options when open', () => {
    render(
      <ExportDialog open={true} onClose={vi.fn()} onExport={vi.fn()} isExporting={false} isPl={false} />
    );
    expect(screen.getByText('JSON (Machine Export)')).toBeDefined();
    expect(screen.getByText('PNG')).toBeDefined();
  });

  it('calls onExport with format when option clicked', () => {
    const onExport = vi.fn();
    render(
      <ExportDialog open={true} onClose={vi.fn()} onExport={onExport} isExporting={false} isPl={false} />
    );
    fireEvent.click(screen.getByText('JSON (Machine Export)'));
    expect(onExport).toHaveBeenCalledWith('json');
  });
});

describe('ProcessFlowContextMenu', () => {
  it('renders actions', () => {
    render(
      <ProcessFlowContextMenu
        x={100}
        y={200}
        actions={[
          { id: 'edit', label: 'Edit', icon: <span>E</span>, onClick: vi.fn() },
          { id: 'delete', label: 'Delete', icon: <span>D</span>, onClick: vi.fn(), danger: true },
        ]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Edit')).toBeDefined();
    expect(screen.getByText('Delete')).toBeDefined();
  });

  it('calls onClick and onClose when action clicked', () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    render(
      <ProcessFlowContextMenu
        x={100}
        y={200}
        actions={[{ id: 'test', label: 'Test Action', icon: <span>T</span>, onClick }]}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByText('Test Action'));
    expect(onClick).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(
      <ProcessFlowContextMenu
        x={100}
        y={200}
        actions={[{ id: 'a', label: 'A', icon: <span>A</span>, onClick: vi.fn() }]}
        onClose={onClose}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ReadbackPanel', () => {
  it('shows generate button when no result', () => {
    render(
      <ReadbackPanel
        result={null}
        isLoading={false}
        isPl={false}
        onFetchReadback={vi.fn()}
        onClickStep={vi.fn()}
      />
    );
    // Should find text about generating readback or a button
    expect(screen.getByRole('button', { name: /generate readback/i })).toBeDefined();
  });

  it('renders steps when result exists', () => {
    const result = {
      paths: [
        { type: 'start' as const, label: 'Begin', object_id: 's1' },
        { type: 'step' as const, label: 'Do something', object_id: 'a1' },
        { type: 'end' as const, label: 'Finish', object_id: 'e1' },
      ],
      warnings: [],
    };
    render(
      <ReadbackPanel
        result={result}
        isLoading={false}
        isPl={false}
        onFetchReadback={vi.fn()}
        onClickStep={vi.fn()}
      />
    );
    expect(screen.getByText('Begin')).toBeDefined();
    expect(screen.getByText('Do something')).toBeDefined();
    expect(screen.getByText('Finish')).toBeDefined();
  });

  it('calls onClickStep when step clicked', () => {
    const onClickStep = vi.fn();
    const result = {
      paths: [{ type: 'step' as const, label: 'Step 1', object_id: 'a1' }],
      warnings: [],
    };
    render(
      <ReadbackPanel
        result={result}
        isLoading={false}
        isPl={false}
        onFetchReadback={vi.fn()}
        onClickStep={onClickStep}
      />
    );
    fireEvent.click(screen.getByText('Step 1'));
    expect(onClickStep).toHaveBeenCalledWith('a1');
  });
});

describe('AIProposalPanel', () => {
  it('shows prompt and generate when no proposal', () => {
    render(
      <AIProposalPanel
        proposal={null}
        isGenerating={false}
        error={null}
        isPl={false}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onEditPrompt={vi.fn()}
        onDismiss={vi.fn()}
        onGenerate={vi.fn()}
      />
    );
    expect(screen.getByText(/AI prompt/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /generate/i })).toBeDefined();
  });

  it('calls onGenerate with draft prompt when Generate clicked', () => {
    const onGenerate = vi.fn();
    render(
      <AIProposalPanel
        proposal={null}
        isGenerating={false}
        error={null}
        isPl={false}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onEditPrompt={vi.fn()}
        onDismiss={vi.fn()}
        onGenerate={onGenerate}
      />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Add a decision node' } });
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));
    expect(onGenerate).toHaveBeenCalledWith('Add a decision node');
  });

  it('renders summary and accept when pending proposal', () => {
    const proposal = {
      id: 'p1',
      status: 'pending' as const,
      prompt: 'x',
      summary: 'Proposed graph edits',
      operations: [{ action: 'create' as const, target_id: 'n1' }],
      risk_flags: ['review'],
      validation_before: { valid: false, issue_count: 2 },
      validation_after: { valid: true, issue_count: 0 },
      readback_before: 'before',
      readback_after: 'after',
      created_at: '2026-04-11',
    };
    render(
      <AIProposalPanel
        proposal={proposal}
        isGenerating={false}
        error={null}
        isPl={false}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onEditPrompt={vi.fn()}
        onDismiss={vi.fn()}
        onGenerate={vi.fn()}
      />
    );
    expect(screen.getByText('Proposed graph edits')).toBeDefined();
    expect(screen.getByRole('button', { name: /accept/i })).toBeEnabled();
  });

  it('calls onAccept when Accept clicked for pending proposal', () => {
    const onAccept = vi.fn();
    const proposal = {
      id: 'p1',
      status: 'pending' as const,
      prompt: 'x',
      summary: 'S',
      operations: [],
      risk_flags: [],
      validation_before: { valid: true, issue_count: 0 },
      validation_after: { valid: true, issue_count: 0 },
      readback_before: '',
      readback_after: '',
      created_at: '2026-04-11',
    };
    render(
      <AIProposalPanel
        proposal={proposal}
        isGenerating={false}
        error={null}
        isPl={false}
        onAccept={onAccept}
        onReject={vi.fn()}
        onEditPrompt={vi.fn()}
        onDismiss={vi.fn()}
        onGenerate={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(onAccept).toHaveBeenCalled();
  });
});

describe('ProcessFlow context menu helpers', () => {
  it('getNodeContextActions returns English labels and wires callbacks', () => {
    const onEditLabel = vi.fn();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    const onOpenProperties = vi.fn();
    const actions = getNodeContextActions({
      nodeId: 'n1',
      isPl: false,
      locked: false,
      onEditLabel,
      onDuplicate,
      onDelete,
      onOpenProperties,
    });
    // Canon K6 order: Open → Context (edit/duplicate) → Danger. Optional AI/convert/auto
    // items only appear when their handlers are passed.
    expect(actions.map((a) => a.label)).toEqual([
      'Open properties',
      'Edit label',
      'Duplicate',
      'Delete',
    ]);
    actions[1].onClick();
    expect(onEditLabel).toHaveBeenCalled();
    actions[3].onClick();
    expect(onDelete).toHaveBeenCalled();
    // Delete is danger-styled and separated from the group above (K6).
    expect(actions[3].danger).toBe(true);
    expect(actions[3].separatorBefore).toBe(true);
  });

  it('getNodeContextActions adds Auto-layout + Convert only when handlers provided', () => {
    const onAutoLayout = vi.fn();
    const onConvertInitiative = vi.fn();
    const actions = getNodeContextActions({
      nodeId: 'n1',
      isPl: false,
      locked: false,
      onEditLabel: vi.fn(),
      onDuplicate: vi.fn(),
      onDelete: vi.fn(),
      onOpenProperties: vi.fn(),
      onAutoLayout,
      onConvertInitiative,
    });
    const labels = actions.map((a) => a.label);
    expect(labels).toContain('Auto-layout');
    expect(labels).toContain('Convert to initiative');
    actions.find((a) => a.id === 'auto-layout')?.onClick();
    expect(onAutoLayout).toHaveBeenCalled();
    actions.find((a) => a.id === 'convert-initiative')?.onClick();
    expect(onConvertInitiative).toHaveBeenCalled();
  });

  it('getNodeContextActions disables destructive actions when locked', () => {
    const actions = getNodeContextActions({
      nodeId: 'n1',
      isPl: false,
      locked: true,
      onEditLabel: vi.fn(),
      onDuplicate: vi.fn(),
      onDelete: vi.fn(),
      onOpenProperties: vi.fn(),
    });
    expect(actions.filter((a) => a.disabled).map((a) => a.id)).toEqual(['edit', 'duplicate', 'delete']);
  });

  it('getCanvasContextActions returns Polish labels when isPl', () => {
    const onAddNode = vi.fn();
    const onPaste = vi.fn();
    const onAutoLayout = vi.fn();
    const actions = getCanvasContextActions({
      isPl: true,
      locked: false,
      onAddNode,
      onPaste,
      onAutoLayout,
    });
    expect(actions.map((a) => a.label)).toEqual(['Dodaj akcję', 'Dodaj decyzję', 'Wklej', 'Auto-układ']);
    actions[0].onClick();
    expect(onAddNode).toHaveBeenCalledWith('action');
    actions[1].onClick();
    expect(onAddNode).toHaveBeenCalledWith('decision');
  });
});

// ── ProcessFlowToolbar — AI Proposal / Readback triggers (M07 gap fix) ──────
// The AIProposalPanel and ReadbackPanel were fully wired but UNREACHABLE: no
// trigger ever set showAIPanel/showReadbackPanel to true. These guard the new
// toolbar buttons that open them (and that they stay hidden when the optional
// callbacks are not supplied).
import { ProcessFlowToolbar } from '../../../src/components/MyWork/processflow/ProcessFlowToolbar';

function baseToolbarProps() {
  return {
    isPl: false,
    locked: false,
    flowMode: 'classic' as const,
    setFlowMode: vi.fn(),
    semanticKit: 'none',
    availableShapes: [],
    addNode: vi.fn(),
    addLane: vi.fn(),
    insertBetween: vi.fn(),
    splitPath: vi.fn(),
    runValidation: vi.fn(),
    showWarnings: false,
    warnings: [],
    showCoach: false,
    setShowCoach: vi.fn(),
    coachLoading: false,
    runProcessCoach: vi.fn(),
    showSummary: false,
    setShowSummary: vi.fn(),
    summaryLoading: false,
    generateSummary: vi.fn(),
    showKPIDashboard: false,
    setShowKPIDashboard: vi.fn(),
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    handleAutoLayout: vi.fn(),
    duplicateSelected: vi.fn(),
    deleteSelected: vi.fn(),
    saving: false,
    syncLabel: 'Saved',
    handleSave: vi.fn(),
    stepCount: 3,
    laneCount: 1,
    guidance: { en: 'g', pl: 'g', stageEn: 's', stagePl: 's' },
  };
}

describe('ProcessFlowToolbar — AI panel triggers', () => {
  // NOTE: the component's actual props are `onOpenAIProposal` / `onOpenReadback`
  // (see IdeaProcessFlowTool.tsx, the real caller, which wires exactly those
  // names) and the triggers are `role="menuitem"` entries inside the "More
  // actions" overflow menu, not standalone titled buttons. This test
  // previously used a `onAIProposal`/`onReadback` prop shape and a
  // getByTitle(/AI Proposal — flow edits/i) selector that never matched
  // anything the component renders — stale from before the feature's actual
  // implementation. Updated to the real prop names and DOM shape.
  it('renders AI Proposal + Readback menu items and fires callbacks on click', () => {
    const onOpenAIProposal = vi.fn();
    const onOpenReadback = vi.fn();
    render(
      <ProcessFlowToolbar
        {...baseToolbarProps()}
        onOpenAIProposal={onOpenAIProposal}
        onOpenReadback={onOpenReadback}
      />
    );

    fireEvent.click(screen.getByTitle(/More actions/i));
    fireEvent.click(screen.getByRole('menuitem', { name: /AI Proposal/i }));

    // The overflow menu closes after a click; reopen it for the second trigger.
    fireEvent.click(screen.getByTitle(/More actions/i));
    fireEvent.click(screen.getByRole('menuitem', { name: /Readback/i }));

    expect(onOpenAIProposal).toHaveBeenCalledTimes(1);
    expect(onOpenReadback).toHaveBeenCalledTimes(1);
  });

  it('hides both menu items when callbacks are not supplied (back-compat)', () => {
    render(<ProcessFlowToolbar {...baseToolbarProps()} />);
    fireEvent.click(screen.getByTitle(/More actions/i));
    expect(screen.queryByRole('menuitem', { name: /AI Proposal/i })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Readback/i })).toBeNull();
  });
});
