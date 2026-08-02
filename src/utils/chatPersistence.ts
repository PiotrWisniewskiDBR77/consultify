import type { Artifact, ThinkingStep } from '@/types';

export interface PersistedConversationArtifact {
  id: string;
  type: string;
  title: string;
  content: string;
  language?: string;
}

export interface PersistedAiResponseMetadata {
  thinkingSteps: Array<{
    id: string;
    title: string;
    content: string;
    status: 'pending' | 'active' | 'completed';
  }>;
  artifacts: PersistedConversationArtifact[];
  citations: any[];
  sourceLedger?: Record<string, unknown>;
  streamSessionId?: string;
  [key: string]: unknown;
}

function normalizeThinkingSteps(
  thinking: ThinkingStep[] | undefined
): PersistedAiResponseMetadata['thinkingSteps'] {
  return (thinking || []).map((step) => ({
    id: step.id,
    title: step.label || 'Thinking',
    content: step.content,
    status:
      step.status === 'done' ? 'completed' : step.status === 'in_progress' ? 'active' : 'pending',
  }));
}

export function normalizeArtifactsForConversationMetadata(
  artifacts: Artifact[] | undefined
): PersistedConversationArtifact[] {
  return (artifacts || []).map((artifact) => ({
    id: artifact.id,
    type: String((artifact as any).type),
    title: String((artifact as any).title || 'Artifact'),
    content: String((artifact as any).content || ''),
    language: (artifact as any).language,
  }));
}

export function buildPersistedAiResponseMetadata(params: {
  thinking?: ThinkingStep[];
  artifacts?: Artifact[];
  citations?: any[];
  sourceLedger?: Record<string, unknown> | null;
  streamSessionId?: string;
  extra?: Record<string, unknown>;
}): PersistedAiResponseMetadata {
  const {
    thinking = [],
    artifacts = [],
    citations = [],
    sourceLedger,
    streamSessionId,
    extra = {},
  } = params;

  return {
    thinkingSteps: normalizeThinkingSteps(thinking),
    artifacts: normalizeArtifactsForConversationMetadata(artifacts),
    citations: Array.isArray(citations) ? citations : [],
    ...(sourceLedger ? { sourceLedger } : {}),
    ...(streamSessionId ? { streamSessionId } : {}),
    ...extra,
  };
}
