/**
 * FIX-206 (pkt 4) — kroki narzędzi Teresy jako WŁASNY strumień stanu.
 *
 * Dyżur 206 wpinał zdarzenia `tool_step` w `researchProgress`, czyli w ten sam
 * slot, z którego renderuje się panel „Deep Research". Efekt: każda tura z
 * narzędziem zapalała panel głębokiego badania, którego nikt nie uruchomił.
 * Reduktor mieszka tutaj, żeby dało się go zmierzyć bez montowania czatu.
 */

export type ToolStepStatus = 'running' | 'completed' | 'failed' | 'blocked' | 'timeout';

export type ToolStepEvent = {
  type: 'tool_step';
  toolName: string;
  status: ToolStepStatus;
  costUsd?: number;
};

/**
 * Kolejne `running` dokłada nowy krok (ta sama nazwa narzędzia może wystąpić w
 * wielu iteracjach pętli); stan końcowy domyka OSTATNI otwarty krok o tej
 * nazwie, a gdy takiego nie ma — dopisuje się jako osobny wpis.
 */
export function applyToolStepEvent(
  previous: ToolStepEvent[] | null | undefined,
  event: ToolStepEvent
): ToolStepEvent[] {
  const steps = Array.isArray(previous) ? previous : [];
  if (event.status === 'running') return [...steps, event];

  const pendingIndex = steps
    .map((step) => step.toolName === event.toolName && step.status === 'running')
    .lastIndexOf(true);
  if (pendingIndex < 0) return [...steps, event];

  const next = [...steps];
  next[pendingIndex] = event;
  return next;
}

/**
 * Panel „Deep Research" ma prawo się pokazać tylko wtedy, gdy strumień
 * naprawdę przyniósł postęp badania (etap/temat/zapytania/źródła/błąd).
 * Sam obiekt-śmieć (np. wyłącznie kroki narzędzi) go NIE otwiera.
 */
export function hasDeepResearchProgress(progress: unknown): boolean {
  if (!progress || typeof progress !== 'object') return false;
  const p = progress as Record<string, unknown>;
  return Boolean(
    p.stage ||
      p.topic ||
      p.error ||
      (Array.isArray(p.queries) && p.queries.length > 0) ||
      (Array.isArray(p.sources) && p.sources.length > 0)
  );
}
