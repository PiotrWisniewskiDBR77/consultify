import { GoogleGenAI } from '@google/genai';

import logger from '../../utils/Logger.js';

const DEFAULT_EXPIRE_MS = 30 * 60 * 1000;
const DEFAULT_NEW_SESSION_EXPIRE_MS = 60 * 1000;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX = 20;

type RateLimitEntry = {
  count: number;
  resetAtMs: number;
};

export type GeminiLiveEphemeralToken = {
  clientToken: string;
  tokenType: 'ephemeral';
  expiresAt: string;
  newSessionExpiresAt: string;
};

type MintGeminiLiveEphemeralTokenOptions = {
  subjectKey: string;
  assistant: 'anna' | 'teresa';
  expireMs?: number;
  newSessionExpireMs?: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

const stripInvisibleFormatting = (value: string): string =>
  value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

const isPlaceholderApiKey = (value: string): boolean => {
  const normalized = value.trim();
  return (
    normalized.startsWith('sk-demo-') ||
    normalized.toLowerCase().includes('placeholder') ||
    normalized === 'YOUR_GEMINI_API_KEY_HERE' ||
    normalized === 'YOUR_OPENAI_API_KEY_HERE'
  );
};

const summarizeProviderError = (
  error: unknown
): { message: string; reason?: string; status?: string } => {
  const rawMessage = error instanceof Error ? error.message : 'unknown_error';
  try {
    const parsed = JSON.parse(rawMessage) as {
      error?: {
        code?: unknown;
        status?: unknown;
        details?: Array<{ reason?: unknown }>;
      };
    };
    return {
      message:
        typeof parsed.error?.code === 'number' ? `provider_${parsed.error.code}` : 'provider_error',
      reason:
        typeof parsed.error?.details?.[0]?.reason === 'string'
          ? parsed.error.details[0].reason
          : undefined,
      status: typeof parsed.error?.status === 'string' ? parsed.error.status : undefined,
    };
  } catch {
    return {
      message: rawMessage.slice(0, 120),
    };
  }
};

export const resolveGeminiLiveServerKey = (): string => {
  const candidates = [
    process.env.GEMINI_LIVE_API_KEY,
    process.env.ANNA_GEMINI_LIVE_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_AI_API_KEY,
    process.env.GOOGLE_AI_KEY,
  ];

  for (const rawCandidate of candidates) {
    const candidate = stripInvisibleFormatting(String(rawCandidate || ''));
    if (!candidate || isPlaceholderApiKey(candidate)) continue;
    return candidate;
  }

  return '';
};

const consumeRateLimit = (key: string, nowMs = Date.now()): boolean => {
  const existing = rateLimitStore.get(key);
  if (!existing || existing.resetAtMs <= nowMs) {
    rateLimitStore.set(key, {
      count: 1,
      resetAtMs: nowMs + DEFAULT_RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (existing.count >= DEFAULT_RATE_LIMIT_MAX) {
    return false;
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  return true;
};

export const resetGeminiLiveTokenRateLimitForTests = (): void => {
  rateLimitStore.clear();
};

export const mintGeminiLiveEphemeralToken = async ({
  subjectKey,
  assistant,
  expireMs = DEFAULT_EXPIRE_MS,
  newSessionExpireMs = DEFAULT_NEW_SESSION_EXPIRE_MS,
}: MintGeminiLiveEphemeralTokenOptions): Promise<GeminiLiveEphemeralToken | null> => {
  const apiKey = resolveGeminiLiveServerKey();
  if (!apiKey) return null;

  const rateLimitKey = `gemini-live-token:${assistant}:${subjectKey || 'anonymous'}`;
  if (!consumeRateLimit(rateLimitKey)) {
    logger.warn('[GeminiLiveToken] Token mint rate limited', { assistant });
    return null;
  }

  const expiresAt = new Date(Date.now() + expireMs).toISOString();
  const newSessionExpiresAt = new Date(Date.now() + newSessionExpireMs).toISOString();

  try {
    const client = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1alpha' },
    });

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime: expiresAt,
        newSessionExpireTime: newSessionExpiresAt,
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });
    const clientToken = typeof token.name === 'string' ? token.name.trim() : '';
    if (!clientToken) {
      logger.warn('[GeminiLiveToken] Gemini token response missing token name', { assistant });
      return null;
    }

    return {
      clientToken,
      tokenType: 'ephemeral',
      expiresAt:
        typeof (token as { expireTime?: unknown }).expireTime === 'string'
          ? ((token as { expireTime?: unknown }).expireTime as string)
          : expiresAt,
      newSessionExpiresAt,
    };
  } catch (error) {
    logger.warn('[GeminiLiveToken] Gemini token mint request failed', {
      assistant,
      error: summarizeProviderError(error),
    });
    return null;
  }
};
