/**
 * M01 Organization redesign v1 — reveal flag (2026-08-24).
 *
 * FAZA 2 / moduł 01: właściciel zaakceptował PROTOTYP nowego ekranu Organizacji
 * (`org-prototyp-wzorzec.html` + zrzuty proto-light/proto-dark). Redesign niesie:
 *   - konsolidację 21 ekranów → 11 (mapa: `org-konsolidacja-propozycja.md`),
 *     przy NIEZMIENIONYCH 6 grupach menu (karta zamrożenia),
 *   - jeden wspólny szkielet ekranu (nagłówek breadcrumb → Menu 2 pigułki sekcji
 *     → Menu 3 chipy z licznikami → karty treści → prawy panel stanu),
 *   - jeden „Zapisz zmiany" w panelu stanu zamiast per-ekranowych przycisków.
 *
 * Żelazna zasada projektu (CLAUDE.md §7): wygląd wchodzi na demo DOPIERO po
 * akcepcie właściciela na REALNYCH zrzutach. Ekran wzorcowy „Tożsamość i model
 * działania" przeszedł ten odbiór 2026-08-24 (DEC-2026-08-24-11), a zakres
 * pozostałych 10 ekranów + anatomia karty (pochodzenie faktu, „Szczegóły
 * techniczne", karty Gotowość 5 wymiarów, karta Pliki „Używany w") — 2026-08-26
 * na prototypie `organization-prototyp-{uklad,gotowosc}.html`
 * (DEC-2026-08-26-78). Od tego odbioru flaga jest DEFAULT ON.
 *
 * OFF → Organizacja renderuje się bajt w bajt jak przed redesignem: 21 pozycji
 * nawigacji w 6 grupach, stare komponenty ekranów, nagłówek z „Save Changes"
 * przez `SettingsHeaderActionPortal`. Zostaje jako awaryjny wyłącznik
 * (CLAUDE.md §8 — przycisk cofania), nie jako ścieżka domyślna.
 * ON (default) → nawigacja pokazuje 11 skonsolidowanych ekranów, treść jest
 * opakowana w `OrganizationScreenShell`, ekran wzorcowy „Tożsamość i model
 * działania" renderuje nowy, skonsolidowany widok profilu.
 *
 * Wzorzec 1:1 z `src/utils/drdReportFlag.ts`.
 *
 * Kolejność (wygrywa najwyższe):
 *   1. URL query `?ff_org_redesign_v1=0|1` — bypass operatora / dev / dev-render.
 *   2. `localStorage["ff.orgRedesignV1"]` — override user / org.
 *   3. `import.meta.env.VITE_ORG_REDESIGN_V1_ENABLED` — build-time.
 *   4. Default: ON (DEC-2026-08-26-78).
 */

const LS_KEY = 'ff.orgRedesignV1';
const QUERY_KEY = 'ff_org_redesign_v1';
const ENV_KEY = 'VITE_ORG_REDESIGN_V1_ENABLED';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const parsed = parseFlag(meta?.env?.[ENV_KEY]);
    // DEC-2026-08-26-78: brak build-time override → domyślnie ON.
    return parsed === null ? true : parsed;
  } catch {
    return true;
  }
}

function readQueryOverride(): boolean | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
  } catch {
    return null;
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

export function isOrgRedesignV1Enabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ORG_REDESIGN_V1_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
