/**
 * deckBriefContentPack — generator realnej treści slajdów dla decka Z CZATU bez
 * podpiętych źródeł (ścieżka Teresy, `useBriefRewrite`).
 *
 * DLACZEGO OSOBNY GENERATOR (a nie Narrative Engine):
 * Live-verify 2026-07-22 pokazał, że deck z czatu DALEJ pisał „Brak dostępnych
 * danych uniemożliwia…" mimo wzmocnionego `user_instruction`. Powód (potwierdzony
 * w kodzie silnika): `linguisticRealization.ts` ramuje instrukcję autora jako
 * PODRZĘDNĄ wobec reguł anty-fabrykacji („Honour it while still obeying the
 * factual rules above"), więc LLM przy ZERO faktach i tak domyślnie pisze
 * „insufficient data". Współdzielony silnik (deck + report) jest ryzykiem
 * globalnym — nie ruszamy go.
 *
 * ROZWIĄZANIE = wzorzec Worda (`documentBlockProseGenerator.ts`): bezpośrednie
 * wywołanie LLM z własnym system-promptem STROJONYM pod przypadek bez źródeł —
 * pisz konkretną, decyzyjną treść o temacie, oznaczaj niepoparte liczby
 * „(założenie)"/"(assumption)", NIGDY „brak danych". Zero post_check odrzucającego.
 *
 * Zwraca cząstkę `artifactData` (pola `_keyFindings`/`_keyMessages`/… które
 * konsumuje `buildSlideContentBase`) albo `null` na DOWOLNEJ ścieżce błędu —
 * caller wtedy spada na dotychczasowe zachowanie (zero regresji).
 */

import logger from '../utils/Logger.js';
import { generateChatResponse } from './aiService.js';

/** Model tier — 'standard' rozwiązywany przez LLMConfigService (jak Word). */
const MODEL_DEFAULT = 'standard';
const MAX_TOKENS = 2600;

export interface DeckBriefContentPackInput {
  /** Wolny tekst prośby z czatu (temat/brief). */
  brief: string;
  language: 'pl' | 'en';
  title: string;
  audience: string;
  goal: string;
}

/** Kształt cząstki artifactData, którą konsumuje buildSlideContentBase. */
export interface DeckBriefContentPack {
  _keyFindings?: string[];
  _keyMessages?: Array<{ title: string; description: string }>;
  _recommendations?: Array<{
    title: string;
    description: string;
    impact: string;
    priority: string;
    category?: string;
  }>;
  _recommendation?: string;
  _actions?: Array<{ action: string; owner: string; deadline: string }>;
  _rootCauses?: Array<{ cause: string; impact: string; severity: string }>;
  _risks?: Array<{
    risk: string;
    likelihood: string;
    impact: string;
    mitigation: string;
    owner?: string;
  }>;
  _phases?: Array<{ label: string; timeframe: string; items: string[] }>;
  _kpis?: Array<{ label: string; value: string | number; unit?: string }>;
  _performanceKpis?: Array<{ label: string; value: string | number; unit?: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildSystemPrompt(input: DeckBriefContentPackInput): string {
  const isPl = input.language === 'pl';
  const marker = isPl ? '"(założenie)"' : '"(assumption)"';
  return [
    'You are a senior management consultant preparing the content of a board-level slide deck.',
    `The deck topic is: "${input.brief}". Title: "${input.title}". Audience: ${input.audience}. Goal: ${input.goal}.`,
    `Write in this language code: ${input.language}.`,
    'There is NO attached data source. Do NOT reply "insufficient data" / "brak danych" / "evidence required" and do NOT produce placeholders — instead write concrete, decision-oriented, answer-first consulting content grounded in the topic, the way a real consultant drafts a first cut from domain knowledge.',
    `When you state a SPECIFIC number, percentage, amount or date that is NOT given in the topic, mark just that value inline in parentheses in the document language — ${marker} — e.g. ${
      isPl ? '"redukcja błędów o 30% (założenie)"' : '"error reduction of 30% (assumption)"'
    }. Never prefix a whole sentence with "Assumption:" and never repeat the marker on consecutive words. Qualitative reasoning is stated plainly.`,
    'Produce MECE, sharp content — no filler, no hedging, no meta-commentary about being an AI.',
    'Return STRICT JSON only, no markdown fence, in EXACTLY this shape (omit a key only if truly not applicable to the topic):',
    JSON.stringify({
      key_findings: ['<3-5 short finding sentences>'],
      key_messages: [{ title: '<short>', description: '<one sentence>' }],
      recommendations: [
        {
          title: '<short>',
          description: '<one sentence>',
          impact: '<High|Medium|Low or short phrase>',
          priority: '<high|medium|low>',
          category: '<optional short>',
        },
      ],
      headline_recommendation: '<one decisive sentence>',
      actions: [{ action: '<short>', owner: '<role>', deadline: '<e.g. 30 dni (założenie)>' }],
      root_causes: [{ cause: '<short>', impact: '<short>', severity: '<high|medium|low>' }],
      risks: [
        {
          risk: '<short>',
          likelihood: '<high|medium|low>',
          impact: '<high|medium|low>',
          mitigation: '<short>',
          owner: '<optional role>',
        },
      ],
      phases: [{ label: '<short>', timeframe: '<e.g. 0-3m>', items: ['<short>'] }],
      kpis: [{ label: '<short>', value: '<number or short>', unit: '<optional>' }],
    }),
    'Provide 3-5 key_findings, 3-4 key_messages, 3-6 recommendations, 2-4 actions, 2-4 root_causes, 2-4 risks, exactly 3 phases, 2-4 kpis. Do not add commentary outside the JSON.',
  ].join(' ');
}

function stripFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/** Bezpieczne parsowanie + koercja do kształtów artifactData. Zwraca null na błąd.
 *  Eksportowany do testów (pure, bez I/O). */
export function coercePack(raw: string): DeckBriefContentPack | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(raw));
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  const pack: DeckBriefContentPack = {};

  const keyFindings = Array.isArray(parsed.key_findings)
    ? parsed.key_findings.map(str).filter((s) => s.length > 0)
    : [];
  if (keyFindings.length > 0) pack._keyFindings = keyFindings.slice(0, 5);

  const keyMessages = Array.isArray(parsed.key_messages)
    ? parsed.key_messages
        .filter(isRecord)
        .map((m) => ({ title: str(m.title), description: str(m.description) }))
        .filter((m) => m.description.length > 0)
    : [];
  if (keyMessages.length > 0) {
    pack._keyMessages = keyMessages
      .map((m) => ({ title: m.title || m.description.slice(0, 40), description: m.description }))
      .slice(0, 4);
  }

  const recs = Array.isArray(parsed.recommendations)
    ? parsed.recommendations
        .filter(isRecord)
        .map((r) => ({
          title: str(r.title),
          description: str(r.description),
          impact: str(r.impact) || 'Medium',
          priority: (str(r.priority) || 'medium').toLowerCase(),
          category: str(r.category) || undefined,
        }))
        .filter((r) => r.title.length > 0)
    : [];
  if (recs.length > 0) pack._recommendations = recs.slice(0, 6);

  const headline = str(parsed.headline_recommendation);
  if (headline) pack._recommendation = headline;

  const actions = Array.isArray(parsed.actions)
    ? parsed.actions
        .filter(isRecord)
        .map((a) => ({ action: str(a.action), owner: str(a.owner), deadline: str(a.deadline) }))
        .filter((a) => a.action.length > 0)
    : [];
  if (actions.length > 0) {
    pack._actions = actions
      .map((a) => ({ action: a.action, owner: a.owner || 'TBD', deadline: a.deadline || 'TBD' }))
      .slice(0, 5);
  }

  const rootCauses = Array.isArray(parsed.root_causes)
    ? parsed.root_causes
        .filter(isRecord)
        .map((c) => ({
          cause: str(c.cause),
          impact: str(c.impact),
          severity: (str(c.severity) || 'medium').toLowerCase(),
        }))
        .filter((c) => c.cause.length > 0)
    : [];
  if (rootCauses.length > 0) pack._rootCauses = rootCauses.slice(0, 5);

  const risks = Array.isArray(parsed.risks)
    ? parsed.risks
        .filter(isRecord)
        .map((r) => ({
          risk: str(r.risk),
          likelihood: (str(r.likelihood) || 'medium').toLowerCase(),
          impact: (str(r.impact) || 'medium').toLowerCase(),
          mitigation: str(r.mitigation) || 'Define mitigation owner',
          owner: str(r.owner) || undefined,
        }))
        .filter((r) => r.risk.length > 0)
    : [];
  if (risks.length > 0) pack._risks = risks.slice(0, 6);

  const phases = Array.isArray(parsed.phases)
    ? parsed.phases
        .filter(isRecord)
        .map((p) => ({
          label: str(p.label),
          timeframe: str(p.timeframe),
          items: Array.isArray(p.items) ? p.items.map(str).filter((s) => s.length > 0) : [],
        }))
        .filter((p) => p.label.length > 0)
    : [];
  if (phases.length > 0) pack._phases = phases.slice(0, 4);

  const kpis = Array.isArray(parsed.kpis)
    ? parsed.kpis
        .filter(isRecord)
        .map((k) => {
          const value = typeof k.value === 'number' ? k.value : str(k.value);
          return { label: str(k.label), value, unit: str(k.unit) || undefined };
        })
        .filter((k) => k.label.length > 0 && (typeof k.value === 'number' || k.value.length > 0))
    : [];
  if (kpis.length > 0) {
    pack._kpis = kpis.slice(0, 4);
    pack._performanceKpis = kpis.slice(0, 6);
  }

  // Pusty pack (nic sensownego nie wróciło) = traktuj jak porażkę.
  return Object.keys(pack).length > 0 ? pack : null;
}

/**
 * Generuje content-pack z briefu (jeden LLM call, wzorzec Word). Fail-soft:
 * zwraca `null` na wyjątku, pustej odpowiedzi lub nieparsowalnym JSON — caller
 * spada na dotychczasowe zachowanie. NIGDY nie rzuca.
 */
export async function generateDeckBriefContentPack(
  input: DeckBriefContentPackInput
): Promise<DeckBriefContentPack | null> {
  const brief = str(input.brief);
  if (!brief) return null;

  try {
    const response = await generateChatResponse({
      systemPrompt: buildSystemPrompt(input),
      messages: [
        {
          role: 'user',
          content:
            input.language === 'pl'
              ? `Wygeneruj treść slajdów dla tematu: "${brief}". Zwróć wyłącznie JSON w podanym kształcie.`
              : `Generate the slide content for the topic: "${brief}". Return only JSON in the given shape.`,
        },
      ],
      model: MODEL_DEFAULT,
      maxTokens: MAX_TOKENS,
    });
    const pack = coercePack(response.content);
    if (!pack) {
      logger.warn('[deckBriefContentPack] LLM returned unparseable/empty pack — fail-soft to null');
      return null;
    }
    logger.info(
      `[deckBriefContentPack] pack generated: keys=[${Object.keys(pack).join(',')}] for brief="${brief.slice(0, 60)}"`
    );
    return pack;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[deckBriefContentPack] generation failed (fail-soft to null): ${message}`);
    return null;
  }
}
