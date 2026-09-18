import { useCallback, useEffect, useState } from 'react';

import type { ReportBuilderWorkspaceMode } from '@/components/ReportBuilder/ReportEditor/reportBuilderWorkspaceMode';
import { Api } from '@/services/api';

const PREFERENCE_KEY = 'report_builder_nav_v2';

export interface ReportBuilderShellPreferences {
  tocExpanded: boolean;
  rightPanelExpanded: boolean;
  lastMode?: ReportBuilderWorkspaceMode;
}

const DEFAULTS: ReportBuilderShellPreferences = {
  tocExpanded: true,
  rightPanelExpanded: true,
};

function normalizePreferences(value: unknown): ReportBuilderShellPreferences {
  let candidate = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return DEFAULTS;
    }
  }
  if (!candidate || typeof candidate !== 'object') return DEFAULTS;
  const record = candidate as Record<string, unknown>;
  const lastMode = record.lastMode;
  return {
    tocExpanded: typeof record.tocExpanded === 'boolean' ? record.tocExpanded : true,
    rightPanelExpanded:
      typeof record.rightPanelExpanded === 'boolean' ? record.rightPanelExpanded : true,
    lastMode:
      lastMode === 'write' || lastMode === 'review' || lastMode === 'publish'
        ? lastMode
        : undefined,
  };
}

export function useReportBuilderShellPreferences(enabled: boolean) {
  const [preferences, setPreferencesState] = useState<ReportBuilderShellPreferences>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setLoaded(true);
      return () => {
        active = false;
      };
    }
    Api.get('/preferences')
      .then((payload) => {
        if (!active) return;
        const record = payload && typeof payload === 'object' ? payload : {};
        setPreferencesState(
          normalizePreferences((record as Record<string, unknown>)[PREFERENCE_KEY])
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  const updatePreferences = useCallback(
    (patch: Partial<ReportBuilderShellPreferences>) => {
      setPreferencesState((current) => {
        const next = { ...current, ...patch };
        if (enabled) {
          void Api.put('/preferences', { [PREFERENCE_KEY]: next }).catch(() => undefined);
        }
        return next;
      });
    },
    [enabled]
  );

  return { preferences, loaded, updatePreferences };
}
