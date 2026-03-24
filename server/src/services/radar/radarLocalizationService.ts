import { z } from 'zod';

import * as queryHelpers from '../../utils/queryHelpers.js';
import logger from '../../utils/Logger.js';
import type { RadarProcessedSignal } from './radarTypes.js';

const localizedSignalSchema = z.object({
  signalId: z.string().min(1),
  title: z.string().min(3).max(280),
  summaryShort: z.string().min(3).max(500),
  summaryLong: z.string().min(3).max(2200),
});

const localizedBatchSchema = z.object({
  items: z.array(localizedSignalSchema),
});

type RadarLocalizedContent = {
  title: string;
  summaryShort: string;
  summaryLong: string;
  contentHash: string;
  updatedAt: string;
};

type RadarSignalMetadata = {
  sourceLanguage?: string;
  contentHash?: string;
  localizedCopy?: Record<string, RadarLocalizedContent>;
};

type LocalizedResolution = {
  signal: RadarProcessedSignal;
  sourceLanguage: string;
  requestedLanguage: string;
  isLocalized: boolean;
  pending: boolean;
};

function parseSignalMetadata(signal: RadarProcessedSignal): RadarSignalMetadata {
  const metadata = signal.metadata || {};
  const localizedCopy =
    metadata.localizedCopy && typeof metadata.localizedCopy === 'object'
      ? (metadata.localizedCopy as Record<string, RadarLocalizedContent>)
      : {};

  return {
    sourceLanguage:
      typeof metadata.sourceLanguage === 'string' && metadata.sourceLanguage.trim().length > 0
        ? metadata.sourceLanguage.trim().toLowerCase()
        : 'en',
    contentHash:
      typeof metadata.contentHash === 'string' && metadata.contentHash.trim().length > 0
        ? metadata.contentHash.trim()
        : '',
    localizedCopy,
  };
}

function buildInflightKey(signalId: string, language: string, contentHash: string): string {
  return `${signalId}:${language}:${contentHash}`;
}

function detectTextLanguage(sample: string, fallback = 'en'): 'pl' | 'en' {
  const text = String(sample || '').toLowerCase();
  if (!text.trim()) return fallback === 'pl' ? 'pl' : 'en';

  const polishMarkers = [' oraz ', ' jest ', ' się ', ' dla ', ' które ', 'ż', 'ł', 'ą', 'ę'];
  const englishMarkers = [
    ' the ',
    ' and ',
    ' with ',
    ' from ',
    ' for ',
    ' into ',
    ' approach ',
    ' guide ',
    ' latest ',
    ' open source ',
  ];

  const polishHits = polishMarkers.filter((marker) => text.includes(marker)).length;
  const englishHits = englishMarkers.filter((marker) => text.includes(marker)).length;

  if (polishHits === 0 && englishHits === 0) return fallback === 'pl' ? 'pl' : 'en';
  if (polishHits >= englishHits) return 'pl';
  return 'en';
}

function inferSignalLanguage(signal: RadarProcessedSignal, metadata: RadarSignalMetadata): string {
  const originalTitle =
    typeof signal.metadata.originalTitle === 'string' ? signal.metadata.originalTitle : signal.normalizedTitle;
  const fallbackLanguage = metadata.sourceLanguage || 'en';
  const titleLanguage = detectTextLanguage(originalTitle, fallbackLanguage);
  const shortSummaryLanguage = detectTextLanguage(signal.summaryShort, fallbackLanguage);
  const longSummaryLanguage = detectTextLanguage(signal.summaryLong || signal.summaryShort, fallbackLanguage);

  if (titleLanguage === shortSummaryLanguage && shortSummaryLanguage === longSummaryLanguage) {
    return titleLanguage;
  }

  return 'mixed';
}

class RadarLocalizationService {
  private inflight = new Set<string>();

  resolveSignal(signal: RadarProcessedSignal, requestedLanguage: string): LocalizedResolution {
    const normalizedLanguage = String(requestedLanguage || 'en').toLowerCase();
    const metadata = parseSignalMetadata(signal);
    const sourceLanguage = inferSignalLanguage(signal, metadata);
    const contentHash = metadata.contentHash || '';
    const stored = metadata.localizedCopy?.[normalizedLanguage];
    const hasFreshStoredCopy =
      !!stored &&
      stored.contentHash === contentHash &&
      typeof stored.title === 'string' &&
      typeof stored.summaryShort === 'string' &&
      typeof stored.summaryLong === 'string';

    if (sourceLanguage !== 'mixed' && normalizedLanguage === sourceLanguage) {
      return {
        signal,
        sourceLanguage,
        requestedLanguage: normalizedLanguage,
        isLocalized: true,
        pending: false,
      };
    }

    if (hasFreshStoredCopy && stored) {
      return {
        signal: {
          ...signal,
          normalizedTitle: stored.title,
          summaryShort: stored.summaryShort,
          summaryLong: stored.summaryLong,
        },
        sourceLanguage,
        requestedLanguage: normalizedLanguage,
        isLocalized: true,
        pending: false,
      };
    }

    return {
      signal,
      sourceLanguage,
      requestedLanguage: normalizedLanguage,
      isLocalized: false,
      pending: true,
    };
  }

  prewarmSignals(signals: RadarProcessedSignal[], requestedLanguage: string): number {
    const normalizedLanguage = String(requestedLanguage || 'en').toLowerCase();
    if (!['pl', 'en'].includes(normalizedLanguage)) return 0;

    const missing = signals.filter((signal) => {
      const resolution = this.resolveSignal(signal, normalizedLanguage);
      if (!resolution.pending) return false;
      const metadata = parseSignalMetadata(signal);
      return !this.inflight.has(buildInflightKey(signal.id, normalizedLanguage, metadata.contentHash || ''));
    });

    if (missing.length === 0) return 0;

    const batch = missing.slice(0, 8);
    for (const signal of batch) {
      const metadata = parseSignalMetadata(signal);
      this.inflight.add(buildInflightKey(signal.id, normalizedLanguage, metadata.contentHash || ''));
    }

    void this.translateBatch(batch, normalizedLanguage);
    return missing.length;
  }

  private async translateBatch(signals: RadarProcessedSignal[], requestedLanguage: string) {
    try {
      const { llmService } = await import('../ai/llmService.js');
      const payload = signals.map((signal) => ({
        signalId: signal.id,
        title:
          typeof signal.metadata.originalTitle === 'string' && signal.metadata.originalTitle.trim().length > 0
            ? signal.metadata.originalTitle.trim()
            : signal.normalizedTitle,
        summaryShort: signal.summaryShort,
        summaryLong: signal.summaryLong || signal.summaryShort,
      }));

      const targetLanguageLabel = requestedLanguage === 'pl' ? 'polski' : 'English';
      const result = await llmService.call({
        type: 'structured',
        schema: localizedBatchSchema,
        modelConfig: { id: 'standard' },
        systemPrompt:
          requestedLanguage === 'pl'
            ? 'Jesteś produkcyjnym silnikiem lokalizacji. Tłumaczysz treści biznesowe na naturalny polski i zwracasz wyłącznie poprawny JSON.'
            : 'You are a production localization engine. Translate business content into natural English and return valid JSON only.',
        messages: [
          {
            role: 'user',
            content: `Przygotuj lokalizację treści Radar do języka ${targetLanguageLabel}.
- Zachowaj nazwy własne, brandy i akronimy techniczne, jeśli w oryginale brzmią lepiej.
- Nie skracaj nadmiernie.
- Zachowaj wszystkie elementy w polu items.

Wejście:
${JSON.stringify(payload)}`,
          },
        ],
        temperature: 0.1,
        maxTokens: 2200,
        timeoutMs: 12000,
        breakerOptions: { retryAttempts: 1 },
      });

      const parsed = localizedBatchSchema.safeParse((result as any)?.object);
      if (!parsed.success) return;

      const localizedById = new Map(parsed.data.items.map((item) => [item.signalId, item]));
      await Promise.allSettled(
        signals.map(async (signal) => {
          const localized = localizedById.get(signal.id);
          if (!localized) return;

          const metadata = parseSignalMetadata(signal);
          const mergedMetadata: Record<string, unknown> = {
            ...signal.metadata,
            sourceLanguage: metadata.sourceLanguage || 'en',
            contentHash: metadata.contentHash || '',
            localizedCopy: {
              ...(metadata.localizedCopy || {}),
              [requestedLanguage]: {
                title: localized.title,
                summaryShort: localized.summaryShort,
                summaryLong: localized.summaryLong,
                contentHash: metadata.contentHash || '',
                updatedAt: new Date().toISOString(),
              },
            },
          };

          await queryHelpers.queryRun(
            `UPDATE radar_processed_signals
             SET metadata_json = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [JSON.stringify(mergedMetadata), signal.id]
          );
        })
      );
    } catch (error: any) {
      logger.warn(
        `[RadarLocalization] Background localization fallback for ${requestedLanguage}: ${error?.message}`
      );
    } finally {
      for (const signal of signals) {
        const metadata = parseSignalMetadata(signal);
        this.inflight.delete(buildInflightKey(signal.id, requestedLanguage, metadata.contentHash || ''));
      }
    }
  }
}

export const radarLocalizationService = new RadarLocalizationService();
