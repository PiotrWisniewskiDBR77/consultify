import type { Artifact, ThinkingStep } from '@/types';

export interface PersistedConversationArtifact {
  id: string;
  type: string;
  title: string;
  content: string;
  language?: string;
}

export interface PersistedAiResponseMetadata {
  thinkingSteps: ThinkingStep[];
  artifacts: PersistedConversationArtifact[];
  citations: any[];
  streamSessionId?: string;
  [key: string]: unknown;
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
  streamSessionId?: string;
  extra?: Record<string, unknown>;
}): PersistedAiResponseMetadata {
  const {
    thinking = [],
    artifacts = [],
    citations = [],
    streamSessionId,
    extra = {},
  } = params;

  return {
    thinkingSteps: thinking,
    artifacts: normalizeArtifactsForConversationMetadata(artifacts),
    citations: Array.isArray(citations) ? citations : [],
    ...(streamSessionId ? { streamSessionId } : {}),
    ...extra,
  };
}
