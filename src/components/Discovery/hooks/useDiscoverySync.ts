/**
 * useDiscoverySync Hook
 *
 * Synchronizes chat messages with discovery canvas.
 * Extracts entities from AI responses and adds them to the canvas.
 */

import { useEffect, useRef } from 'react';

import { useAppStore } from '@/store/useAppStore';
import { useDiscoveryStore } from '@/store/useDiscoveryStore';
import { ExtractedEntities } from '@/types/discovery';

/**
 * Parse extraction JSON from AI response
 */
const parseExtraction = (content: string): ExtractedEntities | null => {
  // Look for JSON block in response
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    // Try to find inline extraction block
    const extractionMatch = content.match(/---EXTRACTION---\n([\s\S]*?)\n---END---/);
    if (!extractionMatch) return null;

    try {
      return JSON.parse(extractionMatch[1]);
    } catch {
      return null;
    }
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    return parsed.extraction || parsed;
  } catch {
    console.warn('[useDiscoverySync] Failed to parse extraction JSON');
    return null;
  }
};

/**
 * Hook to sync chat messages with discovery canvas
 */
export const useDiscoverySync = () => {
  const { activeChatMessages } = useAppStore();
  const { processExtraction, activeSessionId } = useDiscoveryStore();

  // Track last processed message to avoid duplicates
  const lastProcessedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeSessionId) return;

    // Find the latest AI message
    const aiMessages = activeChatMessages.filter((m) => m.role === 'ai');
    if (aiMessages.length === 0) return;

    const lastAIMessage = aiMessages[aiMessages.length - 1];

    // Skip if already processed
    if (lastAIMessage.id === lastProcessedIdRef.current) return;

    // Try to extract entities
    const extraction = parseExtraction(lastAIMessage.content);
    if (extraction) {
      processExtraction(extraction);
      lastProcessedIdRef.current = lastAIMessage.id;
      console.log('[useDiscoverySync] Processed extraction from message:', lastAIMessage.id);
    }
  }, [activeChatMessages, activeSessionId, processExtraction]);

  return {
    lastProcessedId: lastProcessedIdRef.current,
  };
};

export default useDiscoverySync;
