export type ArtifactStudioLane = 'document' | 'presentation' | 'spreadsheet';

const GLOBAL_QUERY_KEY = 'ff_artifactStudio';
const GLOBAL_STORAGE_KEY = 'ff.artifact_studio';
const GLOBAL_ENV_KEY = 'VITE_ARTIFACT_STUDIO';

const LANE_KEYS: Record<ArtifactStudioLane, { query: string; storage: string; env: string }> = {
  document: {
    query: 'ff_documentStudioV2',
    storage: 'ff.document_studio_v2',
    env: 'VITE_DOCUMENT_STUDIO_V2',
  },
  presentation: {
    query: 'ff_presentationStudioV2',
    storage: 'ff.presentation_studio_v2',
    env: 'VITE_PRESENTATION_STUDIO_V2',
  },
  spreadsheet: {
    query: 'ff_spreadsheetStudioV2',
    storage: 'ff.spreadsheet_studio_v2',
    env: 'VITE_SPREADSHEET_STUDIO_V2',
  },
};

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readQuery(key: string): boolean | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(key));
  } catch {
    return null;
  }
}

function readStorage(key: string): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function readEnv(key: string): boolean | null {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    return parseFlag(meta.env?.[key]);
  } catch {
    return null;
  }
}

function resolveFlag(keys: { query: string; storage: string; env: string }): boolean | null {
  return readQuery(keys.query) ?? readStorage(keys.storage) ?? readEnv(keys.env);
}

export interface ArtifactStudioFlagSource {
  query?: URLSearchParams;
  storage?: Pick<Storage, 'getItem'>;
  env?: Record<string, string | undefined>;
}

export type ArtifactStudioFlagResolutionSource = 'query' | 'storage' | 'env' | 'default';

export interface ArtifactStudioRolloutDecision {
  lane: ArtifactStudioLane;
  enabled: boolean;
  globalEnabled: boolean;
  laneEnabled: boolean;
  globalSource: ArtifactStudioFlagResolutionSource;
  laneSource: ArtifactStudioFlagResolutionSource;
}

function resolveFlagWithSource(
  keys: { query: string; storage: string; env: string },
  source?: ArtifactStudioFlagSource
): { value: boolean | null; source: ArtifactStudioFlagResolutionSource } {
  const queryValue = source
    ? parseFlag(source.query?.get(keys.query))
    : readQuery(keys.query);
  if (queryValue !== null) return { value: queryValue, source: 'query' };

  const storageValue = source
    ? parseFlag(source.storage?.getItem(keys.storage))
    : readStorage(keys.storage);
  if (storageValue !== null) return { value: storageValue, source: 'storage' };

  const envValue = source ? parseFlag(source.env?.[keys.env]) : readEnv(keys.env);
  if (envValue !== null) return { value: envValue, source: 'env' };

  return { value: null, source: 'default' };
}

function resolveFlagFromSource(
  keys: { query: string; storage: string; env: string },
  source?: ArtifactStudioFlagSource
): boolean | null {
  if (!source) return resolveFlag(keys);
  return (
    parseFlag(source.query?.get(keys.query)) ??
    parseFlag(source.storage?.getItem(keys.storage)) ??
    parseFlag(source.env?.[keys.env])
  );
}

/**
 * Master flag plus lane flag. Both must be enabled. This prevents a partially
 * migrated lane from leaking into production while still allowing precise
 * operator rollback through URL or local storage.
 */
export function isArtifactStudioLaneEnabled(
  lane: ArtifactStudioLane,
  source?: ArtifactStudioFlagSource
): boolean {
  const global = resolveFlagFromSource(
    {
      query: GLOBAL_QUERY_KEY,
      storage: GLOBAL_STORAGE_KEY,
      env: GLOBAL_ENV_KEY,
    },
    source
  );
  const laneValue = resolveFlagFromSource(LANE_KEYS[lane], source);
  return global === true && laneValue === true;
}

/**
 * Returns the fail-closed rollout decision together with the non-sensitive
 * source of each flag. This is used by rollout telemetry and operator
 * diagnostics; it deliberately never exposes raw query/storage/env values.
 */
export function getArtifactStudioRolloutDecision(
  lane: ArtifactStudioLane,
  source?: ArtifactStudioFlagSource
): ArtifactStudioRolloutDecision {
  const global = resolveFlagWithSource(
    {
      query: GLOBAL_QUERY_KEY,
      storage: GLOBAL_STORAGE_KEY,
      env: GLOBAL_ENV_KEY,
    },
    source
  );
  const laneFlag = resolveFlagWithSource(LANE_KEYS[lane], source);
  const globalEnabled = global.value === true;
  const laneEnabled = laneFlag.value === true;

  return {
    lane,
    enabled: globalEnabled && laneEnabled,
    globalEnabled,
    laneEnabled,
    globalSource: global.source,
    laneSource: laneFlag.source,
  };
}

export const ARTIFACT_STUDIO_FLAG_KEYS = {
  global: {
    query: GLOBAL_QUERY_KEY,
    storage: GLOBAL_STORAGE_KEY,
    env: GLOBAL_ENV_KEY,
  },
  lanes: LANE_KEYS,
} as const;
