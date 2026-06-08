/**
 * Radar briefing service — on-demand, AI-generated personalized briefing for a
 * single radar signal ("Teresa explains why this matters to *you*").
 *
 * Hybrid model: the radar list ships sharp deterministic copy instantly; this
 * service is called only when a user opens a signal, and the result is cached
 * so repeat opens are free. LLM failures degrade gracefully (return null and
 * the UI keeps the deterministic baseline).
 */
import { z } from 'zod';

import { radarProcessingService } from './radarProcessingService.js';
import { radarRankingService } from './radarRankingService.js';

export interface RadarBriefing {
  signalId: string;
  whatItIs: string;
  whyItMattersForYou: string;
  goodFirstQuestion: string;
  suggestedNextStep: string;
  aiGenerated: true;
  generatedAt: string;
}

const briefingSchema = z.object({
  whatItIs: z.string().min(1),
  whyItMattersForYou: z.string().min(1),
  goodFirstQuestion: z.string().min(1),
  suggestedNextStep: z.string().min(1),
});

type CacheEntry = { value: RadarBriefing; expiresAt: number };

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const CACHE_MAX = 500;

class RadarBriefingService {
  private cache = new Map<string, CacheEntry>();

  private cacheKey(userId: string, signalId: string, isPolish: boolean): string {
    return `${userId}:${signalId}:${isPolish ? 'pl' : 'en'}`;
  }

  private readCache(key: string): RadarBriefing | null {
    const hit = this.cache.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return hit.value;
  }

  private writeCache(key: string, value: RadarBriefing): void {
    if (this.cache.size >= CACHE_MAX) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  async getBriefing(params: {
    userId: string;
    orgId: string;
    signalId: string;
    isPolish: boolean;
    role?: string | null;
    industry?: string | null;
  }): Promise<RadarBriefing | null> {
    const { userId, orgId, signalId, isPolish, role, industry } = params;
    const key = this.cacheKey(userId, signalId, isPolish);
    const cached = this.readCache(key);
    if (cached) return cached;

    const signal = await radarProcessingService.getSignalById(signalId);
    if (!signal) return null;

    const [profile, dynamicContext] = await Promise.all([
      radarRankingService.getOrCreateProfile({ userId, orgId, role, industry }),
      radarRankingService.buildDynamicContext(userId, orgId),
    ]);

    const userContext = {
      role: profile.roles[0] || role || 'leader',
      industry: profile.industries[0] || industry || 'unknown',
      trackedTopics: profile.trackedTopics.slice(0, 6),
      trackedCompanies: profile.trackedCompanies.slice(0, 6),
      activeInitiatives: dynamicContext.initiativeTitles.slice(0, 5),
      activeIdeas: dynamicContext.ideaTitles.slice(0, 5),
      recentTasks: dynamicContext.taskTitles.slice(0, 5),
      recentDecisions: dynamicContext.decisionTitles.slice(0, 4),
    };

    const signalContext = {
      title: signal.normalizedTitle,
      summary: signal.summaryLong || signal.summaryShort,
      source: signal.sourceName || 'source',
      contentType: signal.contentType,
      domains: signal.domainTags,
      topics: signal.topicTags,
      entities: signal.entityTags,
      businessImpact: signal.businessImpact,
      actionability: signal.actionability,
    };

    try {
      const { llmService } = await import('../ai/llmService.js');
      const result = await llmService.call({
        type: 'structured',
        schema: briefingSchema,
        modelConfig: { id: 'standard' },
        systemPrompt: isPolish
          ? [
              'Jesteś Teresą — doświadczoną strateżką transformacji i doradczynią zarządu.',
              'Dostajesz surowy sygnał z radaru (często marketingowy artykuł vendora) oraz realny kontekst pracy konkretnego użytkownika.',
              'Twoje zadanie: zamienić to w ostry, osobisty briefing. Bez ogólników, bez wypełniaczy, bez powtarzania treści źródła.',
              'Pisz konkretnie i po ludzku. Odnoś się do realnej pracy użytkownika (inicjatywy, decyzje, rola), jeśli pasuje.',
              'Zwracasz wyłącznie poprawny JSON zgodny ze schematem.',
            ].join(' ')
          : [
              'You are Teresa — a seasoned transformation strategist and board advisor.',
              "You receive a raw radar signal (often a vendor marketing article) and a specific user's real work context.",
              'Your job: turn it into a sharp, personal briefing. No generalities, no filler, no parroting the source.',
              "Be concrete and human. Tie it to the user's real work (initiatives, decisions, role) when it fits.",
              'Return valid JSON matching the schema only.',
            ].join(' '),
        messages: [
          {
            role: 'user',
            content: [
              isPolish ? 'KONTEKST UŻYTKOWNIKA:' : 'USER CONTEXT:',
              JSON.stringify(userContext),
              '',
              isPolish ? 'SYGNAŁ:' : 'SIGNAL:',
              JSON.stringify(signalContext),
              '',
              isPolish
                ? [
                    'Napisz 4 pola:',
                    '- whatItIs: 1 zdanie, czym to NAPRAWDĘ jest (utnij marketing vendora).',
                    '- whyItMattersForYou: 2 zdania, dlaczego to ważne DLA TEGO użytkownika; odnieś się do jego realnej pracy, jeśli pasuje.',
                    '- goodFirstQuestion: 1 ostre pytanie, które powinien sobie zadać.',
                    '- suggestedNextStep: 1 konkretny następny krok (np. zamień w zadanie/notatkę/decyzję/inicjatywę).',
                  ].join('\n')
                : [
                    'Write 4 fields:',
                    '- whatItIs: 1 sentence, what this REALLY is (cut the vendor marketing).',
                    '- whyItMattersForYou: 2 sentences, why it matters to THIS user; tie to their real work when it fits.',
                    '- goodFirstQuestion: 1 sharp question they should ask themselves.',
                    '- suggestedNextStep: 1 concrete next step (e.g. turn into a task/note/decision/initiative).',
                  ].join('\n'),
            ].join('\n'),
          },
        ],
        temperature: 0.4,
        maxTokens: 600,
        timeoutMs: 14000,
        breakerOptions: { retryAttempts: 1 },
      });

      const parsed = briefingSchema.safeParse((result as any)?.object);
      if (!parsed.success) return null;

      const briefing: RadarBriefing = {
        signalId,
        ...parsed.data,
        aiGenerated: true,
        generatedAt: new Date().toISOString(),
      };
      this.writeCache(key, briefing);
      return briefing;
    } catch {
      return null;
    }
  }
}

export const radarBriefingService = new RadarBriefingService();
