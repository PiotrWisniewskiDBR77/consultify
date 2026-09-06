/**
 * Excel — flaga prawego panelu jako SZYNY IKON (2026-07-28, zgłoszenie
 * Piotra z żywego demo: „to miało wyglądać jak Word, a po prawej mam coś
 * zupełnie innego").
 *
 * Dziś (flaga OFF) `ExceleView` renderuje po prawej `ExceleRightPanel` —
 * pionowy ACCORDION (Akcje·Właściwości·Powiązania·Komentarze·Historia),
 * bo `ExceleView` montuje `KimiWorkspaceShell`, a NIE `ExecutiveModuleShell`
 * (grep na `ExecutiveModuleShell` w ExceleView.tsx = 0 trafień). Sekcja
 * „Komentarze" tej accordion to dziś jawna atrapa: „Komentarze będą
 * dostępne wkrótce" — dokładnie to, co Piotr zobaczył i odrzucił.
 *
 * Ta flaga podmienia `rightPanel` na `ExceleRightRail` — szynę ikon +
 * jeden panel boczny naraz, zbudowaną z tego samego, świeżo naprawionego
 * `RightRail` (`src/components/shared/ExecutiveModuleShell/RightRail.tsx`,
 * P-01 2026-07-28), którego już używa Document Studio (Word), Deck Builder,
 * Tabele i Prezentacje — więc arkusz wygląda i działa TAK SAMO jak Word.
 * Mapowanie na `_KANON_PRAWY_PANEL_2026-07-28.md` (7 pozycji): tylko 4
 * pozycje mają dziś realną treść dla arkusza (Źródła i liczby · Wybrane ·
 * Struktura · Historia i wydania) — „Asystent", „Do poprawy" i „Uwagi i
 * akcept" świadomie POMINIĘTE (zasada podzbioru §5 kanonu), bo pokazanie
 * ich dziś byłoby kolejną atrapą, nie naprawą. Szczegóły w
 * `ExceleRightRail.tsx`.
 *
 * `KimiWorkspaceShell` (pipeline 8 kroków, Powtórz/Remix, pasek plików na
 * dole) NIE jest ruszany — zmienia się WYŁĄCZNIE zawartość `rightPanel`.
 *
 * ZMIANA DOMYŚLNEJ (2026-07-28, zlecenie Piotra — "jeden Excel na każdej
 * ścieżce, bez flag w adresie"): szyna ikon zweryfikowana wzrokiem na
 * produkcji obok arkusza ze ścieżki B (edytowalnej). Odstępstwo od reguły #7
 * jest ŚWIADOME i zlecone wprost. Kill-switch `?ff_excele_right_rail=0` /
 * `localStorage["ff.excele.right_rail"]=false` działa dalej bez zmian.
 *
 * Kolejność (wygrywa najwyższe):
 *   1. URL query `?ff_excele_right_rail=0|1` — bypass operatora / dev / dev-render.
 *   2. `localStorage["ff.excele.right_rail"]` — override user / org.
 *   3. `import.meta.env.VITE_EXCELE_RIGHT_RAIL_ENABLED` — build-time.
 *   4. Default: ON (2026-07-28) — env jawnie nieustawione = ON.
 */

const LS_KEY = 'ff.excele.right_rail';
const QUERY_KEY = 'ff_excele_right_rail';
const ENV_KEY = 'VITE_EXCELE_RIGHT_RAIL_ENABLED';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const parsed = parseFlag(
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
    );
    // Default ON (2026-07-28) — patrz nagłówek pliku (zlecenie Piotra, akcept
    // na żywej weryfikacji, odstępstwo świadome od reguły #7/#9).
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

export function isExceleRightRailEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const EXCELE_RIGHT_RAIL_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
