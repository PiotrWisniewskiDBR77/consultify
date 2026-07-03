/**
 * useTemplateSuggestion — T4: hook do wywoływania Teresa-suggests.
 *
 * POST /api/deliverables/templates/suggest
 * Fail-open: błąd fetch → suggestion=null, loading=false.
 */

import { useState } from 'react';

export interface TemplateSuggestionResult {
  templateId: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export function useTemplateSuggestion() {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<TemplateSuggestionResult | null>(null);

  const suggest = async (intent: string, type: 'doc' | 'deck' | 'table') => {
    setLoading(true);
    setSuggestion(null);
    try {
      const r = await fetch('/api/deliverables/templates/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ intent, type }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setSuggestion(d.suggestion ?? null);
    } catch {
      setSuggestion(null);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSuggestion(null);
    setLoading(false);
  };

  return { loading, suggestion, suggest, reset };
}
