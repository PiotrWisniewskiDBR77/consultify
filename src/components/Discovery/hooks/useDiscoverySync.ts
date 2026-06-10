/**
 * useDiscoverySync Hook
 *
 * Synchronizes chat messages with discovery canvas.
 * Extracts entities from AI responses and adds them to the canvas.
 */

import { useEffect, useRef } from 'react';

import { Api } from '@/services/api';
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
    const aiMessages = (activeChatMessages || []).filter((m) => m.role === 'ai');
    if (aiMessages.length === 0) return;

    const lastAIMessage = aiMessages[aiMessages.length - 1];

    // Skip if already processed
    if (lastAIMessage.id === lastProcessedIdRef.current) return;
    lastProcessedIdRef.current = lastAIMessage.id;

    // 1) Fast path — if the AI happened to emit an inline extraction block,
    //    use it directly (backwards compat, zero network).
    const inline = parseExtraction(lastAIMessage.content);
    if (inline) {
      processExtraction(inline);
      console.log('[useDiscoverySync] Processed inline extraction:', lastAIMessage.id);
      return;
    }

    // 2) Real path (Discovery revive) — the chat AI does NOT emit extraction
    //    blocks, so send the recent conversation to the backend SPIN
    //    extractor and feed the structured result into the canvas. Fire and
    //    forget; the lastProcessedId guard above prevents re-runs.
    const transcript = (activeChatMessages || [])
      .filter((m) => m.role === 'ai' || m.role === 'user')
      .slice(-20)
      .map((m) => `[${String(m.role).toUpperCase()}]: ${m.content || ''}`)
      .join('\n');
    if (!transcript.trim()) return;

    void (async () => {
      try {
        const res = await Api.post('/discovery/extract', { conversation: transcript });
        const extraction = (res?.extraction || res?.data?.extraction) as
          | ExtractedEntities
          | undefined;
        if (extraction) {
          processExtraction(extraction);
          console.log('[useDiscoverySync] Processed backend extraction:', lastAIMessage.id);
        }
      } catch (err) {
        console.warn('[useDiscoverySync] Backend extraction failed', err);
      }
    })();
  }, [activeChatMessages, activeSessionId, processExtraction]);

  return {
    lastProcessedId: lastProcessedIdRef.current,
  };
};

export default useDiscoverySync;
