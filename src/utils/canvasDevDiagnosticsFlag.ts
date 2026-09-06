/**
 * Canvas dev-diagnostics flag (grafika/kebab-diagnostyka-20260902).
 *
 * Pomiar 2026-09-02: kebab „⋯" kanwy dokumentu roboczego
 * (`WorkCanvasDocumentPanel`) pokazywał KAŻDEMU użytkownikowi sekcję
 * „Diagnostyka i workflow" — właściwości pliku MD (save state/projection/
 * lifecycle), a przede wszystkim badge Możliwość=REALNE/CZĘŚCIOWE i notatki
 * inżynierskie w stylu „…are backed" — surowy język audytu wdrożenia, nie
 * język konsultanta. To NIE była atrapa: `startWorkflow()` woła prawdziwy
 * `Api.workCanvasCreateWorkflow` (server/src/routes/work-canvas.routes.ts),
 * więc mechanika zostaje — diagnostyka znika z widoku klienta.
 *
 * OFF (domyślnie) → MD file properties + Capability badge/note + ResearchSession
 * id + ledger współpracy (Reviewer/Send to review/Mark approved/Timeline/
 * Outputs — wciąż nieprzetłumaczony inżynierski sub-ekran) renderują się
 * TYLKO gdy flaga ON. Selektor szablonu przepływu + przycisk uruchomienia
 * zostają widoczne zawsze (to prawdziwa, użyteczna funkcja — patrz wyżej),
 * z polskimi etykietami z i18n.
 *
 * Kolejność (wygrywa najwyższe):
 *   1. `localStorage["ff.canvas_dev_diagnostics"]` — override dev/QA.
 *   2. `import.meta.env.VITE_DEV_DIAGNOSTICS` — build-time.
 *   3. Default: OFF.
 */

const LS_KEY = 'ff.canvas_dev_diagnostics';
const ENV_KEY = 'VITE_DEV_DIAGNOSTICS';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    return (
      parseFlag(
        (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
      ) === true
    );
  } catch {
    return false;
  }
}

function readLocalStorage(): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(LS_KEY));
  } catch {
    return null;
  }
}

export function isCanvasDevDiagnosticsEnabled(): boolean {
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const CANVAS_DEV_DIAGNOSTICS_FLAG_KEYS = {
  localStorage: LS_KEY,
  env: ENV_KEY,
} as const;
