/**
 * FIX-206 (pkt 4) — kroki narzędzi nie mogą zapalać panelu „Deep Research".
 *
 * Odbiór 206 wyrenderował realny komponent i zobaczył panel głębokiego badania
 * przy każdej turze z narzędziem, bo `tool_step` dokładał się do
 * `researchProgress`. Tutaj mierzymy DOM: strumień kroków narzędzi renderuje
 * własną listę i nie otwiera panelu badania.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MessageRenderer } from '../MessageRenderer';
import { ResearchProgress } from '../ResearchProgress';
import { ToolStepList } from '../ToolStepList';
import { applyToolStepEvent, hasDeepResearchProgress, type ToolStepEvent } from '../toolSteps';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback || _key }),
}));

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, hasPermission: () => true, permissions: [] }),
}));

vi.mock('../../../services/api', () => ({
  Api: new Proxy({}, { get: () => vi.fn(async () => ({})) }),
}));

/** Fragment MessageRenderer odpowiadający slotom z FIX-206 (te same warunki). */
function MessageSlots({ metadata }: { metadata: Record<string, unknown> }) {
  const progress = (metadata as any).researchProgress;
  return (
    <div>
      {hasDeepResearchProgress(progress) && (
        <ResearchProgress
          topic={String(progress?.topic || '')}
          stage={(progress?.stage || 'searching') as any}
          queries={(progress?.queries || []) as any}
          sources={(progress?.sources || []) as any}
        />
      )}
      {Array.isArray((metadata as any).toolSteps) && (metadata as any).toolSteps.length > 0 && (
        <ToolStepList steps={(metadata as any).toolSteps} />
      )}
    </div>
  );
}

const step: ToolStepEvent = {
  type: 'tool_step',
  toolName: 'get_initiative_status',
  status: 'completed',
  costUsd: 0.001,
};

function renderRealMessage(metadata: Record<string, unknown>) {
  const msg: any = {
    id: 'stream',
    role: 'ai',
    content: 'Odpowiedz Teresy',
    timestamp: new Date(),
    isStreaming: true,
    metadata,
  };
  return render(
    <MessageRenderer
      {...({
        msg,
        index: 0,
        displayMessages: [msg],
        isCompact: false,
        isDisabled: false,
        activeConversationId: null,
        thinkingSteps: [],
        streamStartedAt: null,
        streamCompletedSignal: false,
        retryInfo: null,
        abortFeedback: null,
        agentAuditState: null,
        agentAuditBusy: false,
        agentRegistryById: {},
        agentAuditActiveTabByMessageId: {},
        setAgentAuditActiveTabByMessageId: vi.fn(),
        deepThinkingHint: null,
        dtHintDismissed: true,
        dtPendingConfirm: null,
        setDtHintDismissed: vi.fn(),
        addArtifact: vi.fn(),
        toggleArtifactsPanel: vi.fn(),
        exportArtifact: vi.fn(),
        handleAgentAuditAccept: vi.fn(),
        contextSavedMessageIds: new Set<string>(),
        voiceState: { isSpeaking: false },
        governedHandoffByMessageId: {},
        proposalBusyById: {},
        agentReviewProgressByAgentId: {},
        agentSourcesByAgentId: {},
      } as any)}
    />
  );
}

describe('FIX-206 pkt 4 — slot kroków narzędzi', () => {
  it('REALNY MessageRenderer: kroki narzędzi bez panelu Deep Research', () => {
    const { unmount } = renderRealMessage({ toolSteps: [step] });
    expect(screen.getByLabelText('Kroki narzędzi Teresy')).toBeTruthy();
    expect(screen.queryByText(/Searching sources/i)).toBeNull();
    unmount();

    renderRealMessage({ researchProgress: { stage: 'searching', topic: 'AI' } });
    expect(screen.getByText(/Searching sources/i)).toBeTruthy();
    expect(screen.queryByLabelText('Kroki narzędzi Teresy')).toBeNull();
  });

  it('tool_step renderuje listę kroków i NIE otwiera panelu Deep Research', () => {
    render(<MessageSlots metadata={{ toolSteps: [step] }} />);

    expect(screen.getByLabelText('Kroki narzędzi Teresy')).toBeTruthy();
    expect(screen.getByText('get_initiative_status')).toBeTruthy();
    expect(screen.queryByText(/Searching sources/i)).toBeNull();
    expect(screen.queryByText(/Research/i)).toBeNull();
  });

  it('realny postęp badania nadal renderuje panel Deep Research (czułość)', () => {
    render(<MessageSlots metadata={{ researchProgress: { stage: 'searching', topic: 'AI' } }} />);

    expect(screen.getByText(/Searching sources/i)).toBeTruthy();
  });

  it('obiekt bez treści badania nie otwiera panelu', () => {
    expect(hasDeepResearchProgress({})).toBe(false);
    expect(hasDeepResearchProgress({ toolSteps: [step] })).toBe(false);
    expect(hasDeepResearchProgress({ stage: 'searching' })).toBe(true);
  });

  it('reduktor domyka ostatni otwarty krok i zachowuje powtórzone iteracje', () => {
    let steps = applyToolStepEvent(null, { ...step, status: 'running' });
    steps = applyToolStepEvent(steps, { ...step, status: 'running' });
    steps = applyToolStepEvent(steps, { ...step, status: 'completed' });

    expect(steps.map((s) => s.status)).toEqual(['running', 'completed']);

    const withTimeout = applyToolStepEvent(steps, { ...step, status: 'timeout' });
    expect(withTimeout.map((s) => s.status)).toEqual(['timeout', 'completed']);
  });
});
