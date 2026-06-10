/**
 * Deliverables — lekki runtime: klient kontraktu generacji (L1, krok 5)
 *
 * Cienki klient async kontraktu POST /api/deliverables/generations
 * (plan → generate → poll) — docs/plans/DELIVERABLES_LIGHT_TARGET.md §2.2.
 * Włączany flagą VITE_ENABLE_DELIVERABLES_LIGHT (frontend) w parze
 * z ENABLE_DELIVERABLES_LIGHT (backend); obie off ⇒ legacy nawigacja
 * do /prezentacje pozostaje bez zmian.
 */

import { Api } from '@/services/api';

export type DeliverableGenerationState =
  | 'requested'
  | 'planning'
  | 'plan_ready'
  | 'generating'
  | 'validating'
  | 'draft'
  | 'error';

export interface DeliverableGenerationPlanItem {
  key: string;
  title: string;
  enabled: boolean;
  sourceRef?: string;
  hint?: string;
}

export interface DeliverableGenerationStatus {
  generationId: string;
  format: 'deck' | 'doc' | 'sheet';
  state: DeliverableGenerationState;
  plan?: DeliverableGenerationPlanItem[];
  artifact?: {
    artifactId: string;
    originRecordId: string;
    format: 'deck' | 'doc' | 'sheet';
    title: string;
    unitCount: number;
  };
  error?: string;
}

export function isDeliverablesLightEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_DELIVERABLES_LIGHT === 'true';
}

/** Tytuł roboczy decka z intencji czatu — pierwsza sensowna linia, przycięta. */
export function deckTitleFromIntent(intent: string, fallback: string): string {
  const firstLine = String(intent || '')
    .split('\n')[0]
    .replace(/^\/(prezentacja|presentation|deck)\s*/i, '')
    .trim();
  if (!firstLine) return fallback;
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
}

interface DeckGenerationSetup {
  title: string;
  language: 'pl' | 'en';
}

function buildDeckSetup({ title, language }: DeckGenerationSetup): Record<string, unknown> {
  // Minimalny DeckSetup (presentationGeneratorService) — bez źródeł generator
  // tworzy outline z default szablonu i oznacza deck jako częściowo ugruntowany.
  return {
    title,
    audience: 'internal',
    goal: 'inform',
    language,
    theme: 'corporate',
    confidentiality: 'internal',
    sourceArtifacts: [],
  };
}

export async function planDeckGeneration(params: {
  intent: string;
  title: string;
  language: 'pl' | 'en';
}): Promise<{
  generationId: string;
  plan: DeliverableGenerationPlanItem[];
  warnings: string[];
  setup: Record<string, unknown>;
}> {
  const setup = buildDeckSetup({ title: params.title, language: params.language });
  const res = (await Api.post('/deliverables/generations', {
    format: 'deck',
    setup,
    intent: params.intent,
  })) as any;
  const data = res?.data?.data && typeof res.data.data === 'object' ? res.data.data : res?.data;
  if (!data?.generationId) {
    throw new Error(data?.error || 'Generation plan failed');
  }
  return {
    generationId: String(data.generationId),
    plan: Array.isArray(data.plan) ? data.plan : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    setup,
  };
}

// ── Gałąź doc (L2) ──────────────────────────────────────────────────────────

/**
 * Krok PLAN dla dokumentu: wejściem jest sama intencja + opcjonalny wycinek
 * rozmowy (D-L2-2b) i/lub sourceRefs z encji (D-L2-2a). Zwraca generationId
 * == draftId canvasa — po stanie 'draft' montujemy go w starterze 'document'.
 */
export async function planDocGeneration(params: {
  intent: string;
  title?: string;
  language: 'pl' | 'en';
  conversationId?: string | null;
  conversationContext?: string;
  sourceRefs?: Array<Record<string, unknown>>;
}): Promise<{
  generationId: string;
  plan: DeliverableGenerationPlanItem[];
  warnings: string[];
  setup: Record<string, unknown>;
}> {
  const setup: Record<string, unknown> = {
    intent: params.intent,
    title: params.title,
    language: params.language,
    conversationId: params.conversationId || undefined,
    conversationContext: params.conversationContext,
    sourceRefs: params.sourceRefs,
  };
  const res = (await Api.post('/deliverables/generations', {
    format: 'doc',
    setup,
    intent: params.intent,
  })) as any;
  const data = res?.data?.data && typeof res.data.data === 'object' ? res.data.data : res?.data;
  if (!data?.generationId) {
    throw new Error(data?.error || 'Generation plan failed');
  }
  return {
    generationId: String(data.generationId),
    plan: Array.isArray(data.plan) ? data.plan : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    setup,
  };
}

export async function startDocGeneration(params: {
  generationId: string;
  setup: Record<string, unknown>;
  plan?: DeliverableGenerationPlanItem[];
}): Promise<void> {
  await Api.post(`/deliverables/generations/${params.generationId}/generate`, {
    format: 'doc',
    setup: params.setup,
    plan: params.plan,
  });
}

export async function startDeckGeneration(params: {
  generationId: string;
  setup: Record<string, unknown>;
  plan?: DeliverableGenerationPlanItem[];
}): Promise<void> {
  await Api.post(`/deliverables/generations/${params.generationId}/generate`, {
    format: 'deck',
    setup: params.setup,
    plan: params.plan,
  });
}

export async function getDeckGenerationStatus(
  generationId: string
): Promise<DeliverableGenerationStatus> {
  const res = (await Api.get(`/deliverables/generations/${generationId}`)) as any;
  const data = res?.data?.data && typeof res.data.data === 'object' ? res.data.data : res?.data;
  return data as DeliverableGenerationStatus;
}

/**
 * Polluje status aż do stanu terminalnego ('draft' | 'error'). Każda zmiana
 * stanu wywołuje onUpdate (checklista Task-Progress w czacie, wzorzec Kimi).
 */
export async function pollDeckGenerationUntilDone(params: {
  generationId: string;
  onUpdate: (status: DeliverableGenerationStatus) => void;
  intervalMs?: number;
  timeoutMs?: number;
}): Promise<DeliverableGenerationStatus> {
  const intervalMs = params.intervalMs ?? 2500;
  const timeoutMs = params.timeoutMs ?? 5 * 60 * 1000;
  const startedAt = Date.now();
  let lastState: DeliverableGenerationState | null = null;

  for (;;) {
    const status = await getDeckGenerationStatus(params.generationId);
    if (status.state !== lastState) {
      lastState = status.state;
      params.onUpdate(status);
    }
    if (status.state === 'draft' || status.state === 'error') return status;
    if (Date.now() - startedAt > timeoutMs) {
      const timedOut: DeliverableGenerationStatus = {
        ...status,
        state: 'error',
        error: 'Generation timed out',
      };
      params.onUpdate(timedOut);
      return timedOut;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
