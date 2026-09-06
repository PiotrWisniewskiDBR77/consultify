/**
 * Excel engine reveal flag (audyt 2026-07-22).
 *
 * `/excele` renderuje dziś czysty redirect na `/tabele`
 * (`AppRoutes.tsx`, reason="excele_merged_into_table_studio"), więc realny
 * silnik arkuszy z FORMUŁAMI (`ExceleView` → `useKimiArtifactPipeline('excele')`
 * → `POST /api/workbook/generate` → `WorkbookGeneratorService`, 5-fazowy pipeline
 * + quality-gate + ExcelJS) jest NIEOSIĄGALNY z UI, mimo że backend działa i jest
 * już wołany produkcyjnie z innego miejsca (`ArtifactActionPanel`). Audyt
 * `_AUDYT_DOKUMENTY_2026-07-22.md` — „najbardziej boli (Sheet)".
 *
 * Ta flaga pozwala odsłonić `ExceleView` pod `/excele` (zamiast redirectu na
 * Table Studio): OFF → dokładnie stare zachowanie (redirect na Table Studio),
 * zero regresji na `/tabele`. Kill-switch: `?ff_excele=0` lub env=false.
 *
 * Kolejność (wygrywa najwyższe):
 *   1. URL query `?ff_excele=0|1` — bypass operatora / dev / dev-render.
 *   2. `localStorage["ff.excele"]` — override user / org.
 *   3. `import.meta.env.VITE_EXCELE_ENGINE_ENABLED` — build-time.
 *   4. Default: ON (flip fb119cefe8, akcept Piotra 2026-07-22), env jawnie
 *      nieustawione = ON.
 */

const LS_KEY = 'ff.excele';
const QUERY_KEY = 'ff_excele';
const ENV_KEY = 'VITE_EXCELE_ENGINE_ENABLED';

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
    return parsed === null ? true : parsed;
  } catch {
    return false;
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

export function isExceleEngineEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const EXCELE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
