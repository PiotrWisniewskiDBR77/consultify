/**
 * templateBuilderFlags — flaga wejścia „Nowy szablon" → TemplateBuilderFlow
 * (#83c/#83d wpięcie w Materials▸Biblioteka wzorców).
 *
 * Wzorzec 1:1 z executionFeatureFlags.ts (D-D): resolution order (pierwsze
 * wygrywa) URL query → localStorage → Vite build env → default. Po akcepcie
 * Piotra na zrzutach (harness dev-render #83c/#83d, 2026-07-13) flaga domyślnie
 * ON wszędzie OPRÓCZ publicznej produkcji (consultify.ai) — reguła #7 CLAUDE.md.
 * Reversible: usuń ostatnią linię `isTemplateBuilderEnabled`, żeby wrócić do
 * default-OFF.
 */

import { isPublicProductionHost } from '@/utils/publicProduction';

const QUERY_KEY = 'ff_templateBuilder';
const LOCAL_STORAGE_KEY = 'ff.template_builder';
const ENV_KEY = 'VITE_TEMPLATE_BUILDER_ENABLED';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return null;
}

function readQuery(): boolean | null {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorage(): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(LOCAL_STORAGE_KEY));
  } catch {
    return null;
  }
}

function readEnv(): boolean {
  try {
    const env = (import.meta.env as unknown as Record<string, string>);
    return parseFlag(env?.[ENV_KEY]) === true;
  } catch {
    return false;
  }
}

/** True gdy „Nowy szablon" ma otwierać TemplateBuilderFlow (default ON poza public prod). */
export function isTemplateBuilderEnabled(): boolean {
  const fromQuery = readQuery();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  if (readEnv()) return true;
  return !isPublicProductionHost(typeof window !== 'undefined' ? window.location.hostname : '');
}
