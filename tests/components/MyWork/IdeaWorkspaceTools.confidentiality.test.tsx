/**
 * RISK-22 (E12 confidentiality gate, S8-CONFID) — component tests for the
 * confidentiality pill in IdeaWorkspaceTools.tsx (§ Metadata sub-group,
 * next to Branch/Area/Priority — see the file's ~1155-1350 region). This is
 * the presentational half; the confirm/save/revert logic it calls back into
 * is covered separately in
 * tests/unit/mywork/useIdeaConfidentialityGate.test.tsx.
 *
 * Pattern mirrors tests/components/MyWork/IdeaWorkspaceTools.inspector.test.tsx:
 * real EN copy resolved from public/locales/en/translation.json (not raw
 * i18n keys), heavy inspector widgets stubbed.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../public/locales/en/translation.json';

function resolveTranslation(key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, segment) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined,
      enTranslation
    );
  return typeof value === 'string' ? value : key;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => resolveTranslation(key), i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('../../../src/components/MyWork/table/IdeaCompletenessWidget', () => ({
  IdeaCompletenessWidget: () => <div data-testid="completeness" />,
}));
vi.mock('../../../src/components/MyWork/mindmap/MindmapInspector', () => ({
  MindmapInspector: () => <div data-testid="mindmap-inspector" />,
}));
vi.mock('../../../src/components/MyWork/mindmap/MapHealthScore', () => ({
  MapHealthScore: () => <div data-testid="map-health" />,
}));

import { IdeaWorkspaceTools } from '../../../src/components/MyWork/IdeaWorkspaceTools';

const baseProps = {
  open: true,
  onClose: vi.fn(),
  ideaId: 'idea-1',
  title: 'My idea',
  seedText: 'seed',
  stage: 'draft',
  branch: '',
  area: '',
  priority: 50,
  isDraft: false,
  isAccepted: true,
  saving: false,
  draftSavedLabel: 'Saved',
  activeTool: 'mindmap' as const,
  selection: { type: 'none' as const, ids: [], count: 0, primaryId: null, meta: null },
  onTitleChange: vi.fn(),
  onSeedTextChange: vi.fn(),
  onBranchChange: vi.fn(),
  onAreaChange: vi.fn(),
  onPriorityChange: vi.fn(),
  onSave: vi.fn(),
  onAcceptChallenge: vi.fn(),
  onConvert: vi.fn(),
  onOpenChat: vi.fn(),
  graphNodes: [{ id: 'n1', data: {} }],
  graphEdges: [],
};

describe('IdeaWorkspaceTools — confidentiality pill (RISK-22)', () => {
  it('renders nothing when confidentialitySupported is false — never offers a control that cannot persist', () => {
    render(<IdeaWorkspaceTools {...baseProps} confidentiality="restricted" confidentialitySupported={false} />);
    expect(screen.queryByTestId('idea-confidentiality-pill')).not.toBeInTheDocument();
  });

  it.each([
    ['standard', 'Standard'],
    ['confidential', 'Confidential'],
    ['restricted', 'Restricted'],
  ] as const)('renders the %s state with its label', (level, label) => {
    render(<IdeaWorkspaceTools {...baseProps} confidentiality={level} confidentialitySupported />);
    const pill = screen.getByTestId('idea-confidentiality-pill');
    expect(pill).toHaveTextContent(label);
  });

  it('opens a 3-option dropdown on click, current level highlighted', () => {
    render(
      <IdeaWorkspaceTools {...baseProps} confidentiality="confidential" confidentialitySupported />
    );
    fireEvent.click(screen.getByTestId('idea-confidentiality-pill'));
    expect(screen.getByTestId('idea-confidentiality-option-standard')).toHaveTextContent('Standard');
    expect(screen.getByTestId('idea-confidentiality-option-confidential')).toHaveTextContent(
      'Confidential'
    );
    expect(screen.getByTestId('idea-confidentiality-option-restricted')).toHaveTextContent(
      'Restricted'
    );
  });

  it('changing state calls onConfidentialityChange with the new level and closes the dropdown', () => {
    const onChange = vi.fn();
    render(
      <IdeaWorkspaceTools
        {...baseProps}
        confidentiality="standard"
        confidentialitySupported
        onConfidentialityChange={onChange}
      />
    );
    fireEvent.click(screen.getByTestId('idea-confidentiality-pill'));
    fireEvent.click(screen.getByTestId('idea-confidentiality-option-restricted'));
    expect(onChange).toHaveBeenCalledWith('restricted');
    expect(screen.queryByTestId('idea-confidentiality-menu')).not.toBeInTheDocument();
  });

  it('selecting the already-active level is a no-op — does not call onConfidentialityChange', () => {
    const onChange = vi.fn();
    render(
      <IdeaWorkspaceTools
        {...baseProps}
        confidentiality="confidential"
        confidentialitySupported
        onConfidentialityChange={onChange}
      />
    );
    fireEvent.click(screen.getByTestId('idea-confidentiality-pill'));
    fireEvent.click(screen.getByTestId('idea-confidentiality-option-confidential'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('blocks an unauthorized user: canEditConfidentiality=false renders a non-interactive badge that never calls onConfidentialityChange', () => {
    const onChange = vi.fn();
    render(
      <IdeaWorkspaceTools
        {...baseProps}
        confidentiality="restricted"
        confidentialitySupported
        canEditConfidentiality={false}
        onConfidentialityChange={onChange}
      />
    );
    const pill = screen.getByTestId('idea-confidentiality-pill');
    expect(pill.tagName).toBe('SPAN'); // not a <button> — not focusable/clickable as a control
    fireEvent.click(pill);
    expect(screen.queryByTestId('idea-confidentiality-menu')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables the pill while a save is in flight (confidentialitySaving)', () => {
    render(
      <IdeaWorkspaceTools
        {...baseProps}
        confidentiality="standard"
        confidentialitySupported
        confidentialitySaving
      />
    );
    expect(screen.getByTestId('idea-confidentiality-pill')).toBeDisabled();
  });
});
