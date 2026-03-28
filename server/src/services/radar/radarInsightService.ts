import { z } from 'zod';

import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import type { RadarSignalCard } from './radarTypes.js';

const insightSchema = z.object({
  insightSummary: z.string().min(8).max(280),
  whyItMatters: z.string().min(8).max(280),
  whyYouSeeThis: z.string().min(8).max(220),
  suggestedNextStep: z.string().min(8).max(220),
  impactType: z.enum([
    'strategic',
    'operational',
    'commercial',
    'product',
    'risk',
    'compliance',
    'learning',
  ]),
  confidenceScore: z.number().min(0).max(1),
});

const translationItemSchema = z.object({
  signalId: z.string().min(1),
  title: z.string().min(3).max(280),
  summary: z.string().min(3).max(500),
  insightSummary: z.string().min(3).max(700),
});

const translationBatchSchema = z.object({
  items: z.array(translationItemSchema),
});

type InsightCard = Pick<
  RadarSignalCard,
  | 'signalId'
  | 'title'
  | 'summary'
  | 'whyItMatters'
  | 'whyYouSeeThis'
  | 'suggestedNextStep'
  | 'impactType'
  | 'confidenceScore'
  | 'source'
  | 'tags'
  | 'contentType'
  | 'relevanceScope'
  | 'relatedContext'
>;

type LocalizedCardCopy = Pick<RadarSignalCard, 'title' | 'summary' | 'insightSummary'>;

const localizationCache = new Map<string, LocalizedCardCopy>();

function getLocalizationCacheKey(card: RadarSignalCard): string {
  return JSON.stringify(['pl', card.signalId, card.title, card.summary, card.insightSummary]);
}

class RadarInsightService {
  async enhanceTopSignals(cards: RadarSignalCard[], isPolish: boolean): Promise<RadarSignalCard[]> {
    const topCards = cards.slice(0, 3);
    const enhanced = await Promise.all(
      topCards.map(async (card) => {
        const improved = await this.generateInsight(card, isPolish);
        return improved ? { ...card, ...improved } : card;
      })
    );

    return [...enhanced, ...cards.slice(topCards.length)];
  }

  async localizeCards(cards: RadarSignalCard[], isPolish: boolean): Promise<RadarSignalCard[]> {
    if (!isPolish || cards.length === 0) return cards;

    try {
      const localizedCards = [...cards];
      const missing: RadarSignalCard[] = [];

      for (let index = 0; index < cards.length; index += 1) {
        const card = cards[index];
        const cached = localizationCache.get(getLocalizationCacheKey(card));
        if (cached) {
          localizedCards[index] = { ...card, ...cached };
          continue;
        }
        missing.push(card);
      }

      if (missing.length === 0) return localizedCards;

      const { llmService } = await import('../ai/llmService.js');
      const payload = missing.map((card) => ({
        signalId: card.signalId,
        title: card.title,
        summary: card.summary,
        insightSummary: card.insightSummary,
      }));

      const result = await llmService.call({
        type: 'structured',
        schema: translationBatchSchema,
        modelConfig: { id: 'standard' },
        systemPrompt:
          'Jesteś produkcyjnym silnikiem lokalizacji UI. Tłumaczysz treści biznesowe z angielskiego na naturalny polski. Zwracasz wyłącznie poprawny JSON.',
        messages: [
          {
            role: 'user',
            content: `Przetłumacz na polski treści kart Radaru.
- Zachowaj sens biznesowy i konkret.
- Nie tłumacz nazw własnych produktów, firm i akronimów technicznych, jeśli lepiej brzmią w oryginale.
- Nie skracaj nadmiernie.
- Zwróć wszystkie elementy wejściowe w polu items, zachowując signalId.

Wejście:
${JSON.stringify(payload)}`,
          },
        ],
        temperature: 0.1,
        maxTokens: 2200,
        timeoutMs: 12000,
        breakerOptions: { retryAttempts: 1 },
      });

      const parsed = translationBatchSchema.safeParse((result as any)?.object);
      if (!parsed.success) return localizedCards;

      const localizedById = new Map(
        parsed.data.items.map((item) => [
          item.signalId,
          {
            title: item.title,
            summary: item.summary,
            insightSummary: item.insightSummary,
          },
        ])
      );

      return localizedCards.map((card) => {
        const localized = localizedById.get(card.signalId);
        if (!localized) return card;
        localizationCache.set(getLocalizationCacheKey(card), localized);
        return { ...card, ...localized };
      });
    } catch (error: any) {
      logger.warn(`[RadarInsight] Localization fallback to original copy: ${error?.message}`);
      return cards;
    }
  }

  private async generateInsight(card: InsightCard, isPolish: boolean) {
    try {
      const { llmService } = await import('../ai/llmService.js');
      const prompt = isPolish
        ? `Jesteś silnikiem interpretacji Radar 2.0.
Masz wygenerować krótki, konkretny kontekst dla użytkownika pracującego w My Work.

Sygnał:
- title: ${JSON.stringify(card.title)}
- summary: ${JSON.stringify(card.summary)}
- source: ${JSON.stringify(card.source.name)}
- domains: ${JSON.stringify(card.tags.domains)}
- topics: ${JSON.stringify(card.tags.topics)}
- relevanceScope: ${JSON.stringify(card.relevanceScope)}
- relatedContext: ${JSON.stringify(card.relatedContext)}

Zwróć poprawny JSON zgodny ze schematem.
Unikaj banałów i nie powtarzaj source ani title 1:1.
W polu suggestedNextStep podaj 1 ruch do wykonania w systemie.`
        : `You are the Radar 2.0 interpretation engine.
Generate user-specific context for a signal inside My Work.

Signal:
- title: ${JSON.stringify(card.title)}
- summary: ${JSON.stringify(card.summary)}
- source: ${JSON.stringify(card.source.name)}
- domains: ${JSON.stringify(card.tags.domains)}
- topics: ${JSON.stringify(card.tags.topics)}
- relevanceScope: ${JSON.stringify(card.relevanceScope)}
- relatedContext: ${JSON.stringify(card.relatedContext)}

Return valid JSON matching the schema.
Avoid generic restatement and keep suggestedNextStep as one concrete in-system move.`;

      const result = await llmService.call({
        type: 'structured',
        schema: insightSchema,
        modelConfig: { id: 'standard' },
        systemPrompt: isPolish
          ? 'Jesteś produkcyjnym silnikiem interpretacji. Odpowiadasz wyłącznie poprawnym JSON.'
          : 'You are a production interpretation engine. Return only valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 500,
        timeoutMs: 8000,
        breakerOptions: { retryAttempts: 1 },
      });

      const parsed = insightSchema.safeParse((result as any)?.object);
      if (!parsed.success) return null;

      await queryHelpers.queryRun(
        `UPDATE radar_ranked_signals
         SET why_you_see_this = ?, why_it_matters = ?, suggested_next_step = ?,
             impact_type = ?, confidence_score = ?, updated_at = CURRENT_TIMESTAMP
         WHERE signal_id = ?`,
        [
          parsed.data.whyYouSeeThis,
          parsed.data.whyItMatters,
          parsed.data.suggestedNextStep,
          parsed.data.impactType,
          parsed.data.confidenceScore,
          card.signalId,
        ]
      );

      return parsed.data;
    } catch (error: any) {
      logger.warn(`[RadarInsight] Falling back to deterministic copy: ${error?.message}`);
      return null;
    }
  }
}

export const radarInsightService = new RadarInsightService();
