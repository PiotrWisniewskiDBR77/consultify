/**
 * useDeliverableTemplates — pobiera szablony z GET /api/deliverables/templates?type=…
 * Używane w OutputsLauncherModal (krok 2: galeria szablonów).
 */

import { useState, useEffect } from 'react';

export interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  isBlank: boolean;
  isSystem: boolean;
  type: 'doc' | 'deck' | 'table';
}

/** Mapowanie typu launchera na typ API */
const TYPE_MAP: Record<string, string> = {
  report: 'doc',
  presentation: 'deck',
  table: 'table',
};

export function useDeliverableTemplates(type: 'doc' | 'deck' | 'table' | 'report' | 'presentation' | null) {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!type) return;
    const apiType = TYPE_MAP[type] ?? type;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/deliverables/templates?type=${apiType}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
      .then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setTemplates(data.templates ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Nie udało się załadować szablonów');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  return { templates, loading, error };
}
