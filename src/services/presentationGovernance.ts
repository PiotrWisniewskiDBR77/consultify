import { Api } from '@/services/api';

export type GovernanceVerdict =
  | 'PASS'
  | 'PASS_WITH_P2'
  | 'BLOCKED_P1'
  | 'BLOCKED_P0'
  | 'INCONCLUSIVE';

export interface PresentationGovernanceCard {
  deckId: string;
  generatedAt: string;
  overallVerdict: GovernanceVerdict;
  quality: {
    verdict: GovernanceVerdict | string;
    p0: number;
    p1: number;
    p2: number;
    gateCount: number;
    [key: string]: unknown;
  };
  confidentiality: {
    level: 'public' | 'internal' | 'confidential' | string;
    sharingAllowedForRole?: 'allowed' | 'blocked' | 'unknown' | string;
    [key: string]: unknown;
  };
  telemetry: {
    windowDays: number;
    proposalsCreated: number;
    editsApplied: number;
    editsRejected: number;
    exportsBlocked: number;
    lastActivityAt: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type GovernanceFetchStatus = 'ok' | 'error' | 'forbidden' | 'not_found' | 'unavailable';

export interface GovernanceFetchResult {
  status: GovernanceFetchStatus;
  card?: PresentationGovernanceCard;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const ALLOWED_VERDICTS = new Set<GovernanceVerdict>([
  'PASS',
  'PASS_WITH_P2',
  'BLOCKED_P1',
  'BLOCKED_P0',
  'INCONCLUSIVE',
]);

function asVerdict(value: unknown): GovernanceVerdict {
  if (typeof value === 'string' && ALLOWED_VERDICTS.has(value as GovernanceVerdict)) {
    return value as GovernanceVerdict;
  }
  return 'INCONCLUSIVE';
}

function normalizeCard(raw: unknown): PresentationGovernanceCard | null {
  if (!isRecord(raw)) return null;
  const deckId = asString(raw.deckId);
  if (!deckId) return null;
  const quality = isRecord(raw.quality) ? raw.quality : {};
  const confidentiality = isRecord(raw.confidentiality) ? raw.confidentiality : {};
  const telemetry = isRecord(raw.telemetry) ? raw.telemetry : {};

  return {
    ...(raw as Record<string, unknown>),
    deckId,
    generatedAt: asString(raw.generatedAt, new Date().toISOString()),
    overallVerdict: asVerdict(raw.overallVerdict),
    quality: {
      ...(quality as Record<string, unknown>),
      verdict: asString(quality.verdict, 'INCONCLUSIVE'),
      p0: asNumber((quality as Record<string, unknown>).p0),
      p1: asNumber((quality as Record<string, unknown>).p1),
      p2: asNumber((quality as Record<string, unknown>).p2),
      gateCount: asNumber((quality as Record<string, unknown>).gateCount),
    },
    confidentiality: {
      ...(confidentiality as Record<string, unknown>),
      level: asString((confidentiality as Record<string, unknown>).level, 'internal'),
    },
    telemetry: {
      ...(telemetry as Record<string, unknown>),
      windowDays: asNumber((telemetry as Record<string, unknown>).windowDays, 7),
      proposalsCreated: asNumber((telemetry as Record<string, unknown>).proposalsCreated),
      editsApplied: asNumber((telemetry as Record<string, unknown>).editsApplied),
      editsRejected: asNumber((telemetry as Record<string, unknown>).editsRejected),
      exportsBlocked: asNumber((telemetry as Record<string, unknown>).exportsBlocked),
      lastActivityAt:
        typeof (telemetry as Record<string, unknown>).lastActivityAt === 'string'
          ? ((telemetry as Record<string, unknown>).lastActivityAt as string)
          : null,
    },
  };
}

function statusFromError(err: unknown): GovernanceFetchStatus {
  if (isRecord(err) && typeof err.status === 'number') {
    const code = err.status;
    if (code === 401) return 'error';
    if (code === 403) return 'forbidden';
    if (code === 404) return 'not_found';
    return 'error';
  }
  return 'unavailable';
}

function safeMessage(err: unknown): string | undefined {
  if (isRecord(err) && typeof err.message === 'string') return err.message;
  return undefined;
}

export async function fetchPresentationGovernanceCard(
  deckId: string
): Promise<GovernanceFetchResult> {
  if (!deckId) return { status: 'not_found', error: 'missing_deck_id' };

  const path = `/presentations/decks/${encodeURIComponent(deckId)}/governance-card`;
  const apiAny = Api as unknown as { get?: (url: string) => Promise<unknown> };

  if (typeof apiAny.get === 'function') {
    try {
      const res = await apiAny.get(path);
      const payload = isRecord(res) && 'data' in res ? (res as { data: unknown }).data : res;
      const innerData =
        isRecord(payload) && 'data' in payload ? (payload as { data: unknown }).data : payload;
      const card = normalizeCard(innerData);
      if (!card) return { status: 'error', error: 'invalid_payload' };
      return { status: 'ok', card };
    } catch (err) {
      return { status: statusFromError(err), error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${path}`, { credentials: 'include' });
    if (!res.ok) {
      if (res.status === 401) return { status: 'error', error: 'unauthorized' };
      if (res.status === 403) return { status: 'forbidden', error: 'forbidden' };
      if (res.status === 404) return { status: 'not_found', error: 'not_found' };
      return { status: 'error', error: `http_${res.status}` };
    }
    const json: unknown = await res.json().catch(() => null);
    const innerData = isRecord(json) && 'data' in json ? (json as { data: unknown }).data : json;
    const card = normalizeCard(innerData);
    if (!card) return { status: 'error', error: 'invalid_payload' };
    return { status: 'ok', card };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}
