import { useEffect, useRef } from 'react';

import { useAIContext } from '@/contexts/AIContext';

const DEFAULT_DEBOUNCE_MS = 300;

export const useScreenContext = (
  screenId: string,
  title: string,
  data: Record<string, unknown>,
  description?: string,
  persona: string = 'consultant'
) => {
  const { setScreenContext } = useAIContext();
  const timeoutRef = useRef<number | null>(null);
  const sequenceRef = useRef(0);

  useEffect(() => {
    if (!screenId || !title) return;

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      sequenceRef.current += 1;

      setScreenContext({
        version: '1.0',
        screenId,
        persona,
        timestamp: Date.now(),
        sequenceId: sequenceRef.current,
        intent: description,
        data: {
          ...(data || {}),
          _meta: {
            title,
            description,
          },
        },
      });
    }, DEFAULT_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [screenId, title, data, description, persona, setScreenContext]);
};
