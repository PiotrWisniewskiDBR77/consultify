import type {
  AnnaLpChannel,
  AnnaLpCtaType,
  AnnaLpLanguage,
  AnnaLpSourceIntent,
} from './publicAnnaAnalytics';

export type AnnaLpCtaContext = {
  session_id: string;
  cta_type: AnnaLpCtaType;
  language: AnnaLpLanguage;
  channel: AnnaLpChannel;
  turn_id: string;
  source_intent: AnnaLpSourceIntent;
  created_at_ms: number;
  start_recorded_at_ms?: number;
  submit_attempts?: number;
  last_submit_error_at_ms?: number;
  submit_success_at_ms?: number;
};

const STORAGE_KEY = 'anna_lp_cta_context_v1';

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function readAnnaLpCtaContext(): AnnaLpCtaContext | null {
  if (typeof window === 'undefined') return null;
  const data = safeParse(window.sessionStorage.getItem(STORAGE_KEY));
  if (!data || typeof data !== 'object') return null;

  const ctx = data as Partial<AnnaLpCtaContext>;
  if (!ctx.session_id || !ctx.cta_type || !ctx.language || !ctx.channel || !ctx.turn_id) return null;
  return ctx as AnnaLpCtaContext;
}

export function persistAnnaLpCtaContext(ctx: Omit<AnnaLpCtaContext, 'created_at_ms'>): void {
  if (typeof window === 'undefined') return;
  const next: AnnaLpCtaContext = {
    ...ctx,
    created_at_ms: Date.now(),
  };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function updateAnnaLpCtaContext(patch: Partial<AnnaLpCtaContext>): AnnaLpCtaContext | null {
  if (typeof window === 'undefined') return null;
  const current = readAnnaLpCtaContext();
  if (!current) return null;
  const next: AnnaLpCtaContext = { ...current, ...patch };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function clearAnnaLpCtaContext(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

