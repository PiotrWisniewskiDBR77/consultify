import { useQuery } from '@tanstack/react-query';

import { V8RetrievalApi } from '@/services/api/v8';

export type { V8RetrievalTrace } from '@/services/api/v8/retrieval';

export const V8_RETRIEVAL_KEYS = {
  conversationTraces: (conversationId: string) => ['v8', 'retrieval', 'conversation', conversationId] as const,
};

export function useV8ConversationRetrievalTraces(conversationId: string | undefined) {
  return useQuery({
    queryKey: V8_RETRIEVAL_KEYS.conversationTraces(conversationId ?? ''),
    queryFn: () => V8RetrievalApi.getConversationTraces(conversationId!),
    enabled: !!conversationId,
  });
}
