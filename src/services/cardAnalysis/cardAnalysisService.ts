/**
 * cardAnalysisService — silnik „Analizuj z AI" (ETAP 3 standardu n-Type).
 *
 * Buduje prompt z CZTERECH składników wymaganych przez kontrakt właściciela
 * (2026-07-23), wywołuje LLM i normalizuje odpowiedź do `CardAnalysisResult`.
 *
 * ── PUNKT PODPIĘCIA BACKENDU: `/api/ai/generate` (ISTNIEJĄCY) ────────────────
 * NIE dokładamy endpointu. Używamy tego, co jest i działa:
 *   server/src/routes/ai.routes.ts:5828  POST /api/ai/generate
 *     body  { message: ≤32000, systemInstruction?: ≤16000, roleName? }
 *           (walidacja: server/src/validators/ai.validators.ts:566 AiGenerateRequestSchema)
 *     zwraca { text }   ← czysty tekst modelu, po `llmService.callText`
 *     błędy  { error, code } z `mapLlmCallError` (+ 502 EMPTY_LLM_RESPONSE)
 *
 * ★ DLACZEGO NIE `/api/ai/chat`: mimo że kilkanaście miejsc w `src/` woła
 *   `Api.post('/ai/chat', …)` i czyta `res.text`, ten endpoint (ai.routes.ts:5885)
 *   zwraca ORKIESTRATOR: `{ role, intent, contextSummary, prompt, policyLevel }`
 *   — pola `text` ani `content` tam NIE MA. Odziedziczenie tego wzorca dałoby
 *   panel, który zawsze pokazuje „AI nie zwróciło wyniku". `/api/ai/generate`
 *   zwraca `{ text }` wprost i jest jedynym uczciwym wyborem. (Sprawdzone grepem
 *   w realnym kodzie routera, nie w dokumentacji — CLAUDE.md złota reguła #1.)
 *
 * ── ZAKAZ NADPISANIA ─────────────────────────────────────────────────────────
 * Ten moduł nie ma dostępu do żadnego settera karty. Zwraca dane. Kropka.
 */

import { Api } from '@/services/api';

import { buildCardStandard, criteriaFor } from './cardAnalysisRubric';
import type {
  CardAnalysisChange,
  CardAnalysisField,
  CardAnalysisFinding,
  CardAnalysisInput,
  CardAnalysisResult,
  CardAnalysisSeverity,
} from './cardAnalysisTypes';

/** Twarde limity endpointu — przycinamy PO NASZEJ stronie, żeby nie dostać 400. */
const MAX_MESSAGE_CHARS = 30_000; // zapas wobec 32000 z AiGenerateRequestSchema
const MAX_CONTEXT_CHARS = 8_000;
const MAX_FIELD_CHARS = 4_000;

/** Ucięcie z widocznym znacznikiem — model ma WIEDZIEĆ, że kontekst jest przycięty. */
function clip(text: string, max: number): string {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…[przycięto ${s.length - max} znaków]`;
}

function severityOf(raw: unknown): CardAnalysisSeverity {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'high' || s === 'wysoki' || s === 'wysokie' || s === 'critical') return 'high';
  if (s === 'low' || s === 'niski' || s === 'niskie') return 'low';
  return 'medium';
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PL =
  'Jesteś recenzentem jakości artefaktów doradczych (poziom BCG/McKinsey). ' +
  'Oceniasz JEDNĄ kartę artefaktu wobec podanego standardu i kryteriów. ' +
  'Zwracasz WYŁĄCZNIE poprawny JSON — bez markdown, bez komentarza. ' +
  'NIGDY nie wymyślasz faktów, liczb ani źródeł; gdy czegoś brakuje, nazywasz to brakiem. ' +
  'Każda liczba w proponowanej treści musi mieć marker niepewności ("szacunek:", "założenie:") ' +
  'chyba że wynika wprost z podanego kontekstu.';

const SYSTEM_EN =
  'You are a quality reviewer of consulting artifacts (BCG/McKinsey level). ' +
  'You assess ONE card of an artifact against the given standard and criteria. ' +
  'You return ONLY valid JSON — no markdown, no commentary. ' +
  'You NEVER invent facts, numbers or sources; when something is missing you name it as a gap. ' +
  'Every number in proposed content must carry an uncertainty marker ("estimate:", "assumption:") ' +
  'unless it follows directly from the supplied context.';

/** Serializacja pól karty — z jawnym oznaczeniem pól PUSTYCH i tylko-do-odczytu. */
function renderFields(fields: CardAnalysisField[], isPolish: boolean): string {
  if (fields.length === 0) {
    return isPolish
      ? '(karta nie zadeklarowała żadnych pól treści)'
      : '(the card declared no content fields)';
  }
  return fields
    .map((f) => {
      const value = clip(String(f.value ?? '').trim(), MAX_FIELD_CHARS);
      const emptyMark = value
        ? ''
        : isPolish
          ? '  <<< PUSTE'
          : '  <<< EMPTY';
      const writeMark = f.writable
        ? ''
        : isPolish
          ? '  [tylko do odczytu — nie proponuj tu zmian treści]'
          : '  [read-only — do not propose content changes here]';
      const hint = f.hint ? `\n  # ${f.hint}` : '';
      return [
        `--- ${isPolish ? 'POLE' : 'FIELD'} id="${f.id}" ${isPolish ? 'nazwa' : 'name'}="${f.label}" ${isPolish ? 'rodzaj' : 'kind'}="${f.kind ?? 'text'}"${emptyMark}${writeMark}${hint}`,
        value || '(—)',
      ].join('\n');
    })
    .join('\n');
}

const SCHEMA_HINT = [
  '{',
  '  "completeness": 0-100,',
  '  "verdict": "jedno zdanie",',
  '  "gaps":        [{"title":"…","detail":"…","criterionId":"…","severity":"high|medium|low"}],',
  '  "risks":       [{"title":"…","detail":"…","criterionId":"…","severity":"high|medium|low"}],',
  '  "suggestions": [{"title":"…","detail":"…","criterionId":"…","severity":"high|medium|low"}],',
  '  "changes":     [{"fieldId":"<id z listy PÓL>","rationale":"…","proposedValue":"…",',
  '                   "mode":"replace|append","criterionId":"…","severity":"high|medium|low"}]',
  '}',
].join('\n');

/** Buduje treść zapytania. Wyeksportowane, żeby dało się je zobaczyć w teście/dev. */
export function buildAnalysisPrompt(input: CardAnalysisInput): {
  system: string;
  message: string;
} {
  const { artifactType, cardId, artifactTitle, artifactContext, fields, isPolish } = input;

  const std = buildCardStandard(artifactType, cardId, cardId, isPolish);
  const criteria = criteriaFor(artifactType, isPolish);
  const writableIds = fields.filter((f) => f.writable).map((f) => f.id);

  const L = isPolish
    ? {
        head: 'ZADANIE: oceń AKTYWNĄ KARTĘ artefaktu wobec jej celu, standardu treści i kryteriów typu artefaktu.',
        card: 'KARTA (aktywna)',
        purpose: 'CEL KARTY (kanon kart)',
        standard: 'STANDARD TREŚCI — co ta karta powinna zawierać (kanon kart)',
        noStandard:
          'Kanon NIE deklaruje opisu ani szablonu treści tej karty. NIE wymyślaj wymagań — ' +
          'oceniaj wyłącznie wobec kryteriów typu artefaktu i wobec tego, co karta faktycznie zawiera.',
        aiRole: 'ROLA AI wobec tej karty (kanon)',
        criteria: 'KRYTERIA OCENY (typ artefaktu — kontrakt właściciela)',
        noCriteria: 'Dla tego typu artefaktu nie zadeklarowano kryteriów.',
        content: 'AKTUALNA ZAWARTOŚĆ KARTY',
        context: 'KONTEKST CAŁEGO ARTEFAKTU',
        rules: 'ZASADY',
        r: [
          'Oceniaj TYLKO aktywną kartę. Kontekst artefaktu służy do wykrycia NIESPÓJNOŚCI, nie do oceny innych kart.',
          '„gaps" = czego karta nie ma, a standard/kryteria tego wymagają.',
          '„risks" = niespójności, sprzeczności (także z kontekstem artefaktu), zagrożenia gotowości.',
          '„suggestions" = rekomendowane ROZWINIĘCIA — nie braki, tylko wzmocnienia.',
          '„changes" = KONKRETNA treść gotowa do wstawienia. Każda zmiana MUSI mieć "fieldId" z listy PÓL.',
          `Pola, do których wolno proponować zmiany: ${writableIds.length ? writableIds.join(', ') : '(BRAK — nie proponuj żadnych "changes")'}.`,
          'Nie proponuj zmian do pól oznaczonych [tylko do odczytu].',
          '"mode":"append" gdy dopisujesz pozycję do listy; "replace" gdy przepisujesz całość pola.',
          'Maks. 6 pozycji w każdej z czterech list. Lepiej mniej i konkretnie.',
          'Gdy karta jest pusta — powiedz to wprost w "verdict", a "completeness" ustaw nisko.',
          'Pisz po polsku.',
        ],
        criterionNote:
          'Do każdej pozycji dodaj "criterionId" z listy kryteriów (dokładny id), gdy pozycja wynika z kryterium.',
        schema: 'ZWRÓĆ WYŁĄCZNIE JSON W TYM KSZTAŁCIE',
      }
    : {
        head: 'TASK: assess the ACTIVE CARD of an artifact against its purpose, content standard and the artifact-type criteria.',
        card: 'CARD (active)',
        purpose: 'CARD PURPOSE (card canon)',
        standard: 'CONTENT STANDARD — what this card should contain (card canon)',
        noStandard:
          'The canon does NOT declare a description or content template for this card. Do NOT invent ' +
          'requirements — assess only against the artifact-type criteria and what the card actually contains.',
        aiRole: 'AI ROLE for this card (canon)',
        criteria: 'ASSESSMENT CRITERIA (artifact type — owner contract)',
        noCriteria: 'No criteria are declared for this artifact type.',
        content: 'CURRENT CARD CONTENT',
        context: 'CONTEXT OF THE WHOLE ARTIFACT',
        rules: 'RULES',
        r: [
          'Assess ONLY the active card. The artifact context serves to detect INCONSISTENCIES, not to grade other cards.',
          '"gaps" = what the card lacks that the standard/criteria require.',
          '"risks" = inconsistencies, contradictions (including with the artifact context), readiness threats.',
          '"suggestions" = recommended EXPANSIONS — not gaps, but reinforcements.',
          '"changes" = CONCRETE content ready to insert. Every change MUST carry a "fieldId" from the FIELD list.',
          `Fields you may propose changes for: ${writableIds.length ? writableIds.join(', ') : '(NONE — do not propose any "changes")'}.`,
          'Do not propose changes for fields marked [read-only].',
          '"mode":"append" when adding an item to a list; "replace" when rewriting the whole field.',
          'Max 6 items in each of the four lists. Fewer and sharper is better.',
          'When the card is empty — say so plainly in "verdict" and set "completeness" low.',
          'Write in English.',
        ],
        criterionNote:
          'Add a "criterionId" from the criteria list (exact id) to each item that follows from a criterion.',
        schema: 'RETURN ONLY JSON IN THIS SHAPE',
      };

  const parts: string[] = [
    L.head,
    '',
    `${L.card}: "${std.label}" (id: ${cardId})`,
    `${isPolish ? 'ARTEFAKT' : 'ARTIFACT'}: ${artifactType} — "${artifactTitle}"`,
    '',
  ];

  if (std.purpose) parts.push(`=== ${L.purpose} ===`, std.purpose, '');
  if (std.standard) parts.push(`=== ${L.standard} ===`, std.standard, '');
  if (!std.standardZnany) parts.push(`=== ${L.standard} ===`, L.noStandard, '');
  parts.push(`${L.aiRole}: ${std.aiRole}`, '');

  parts.push(`=== ${L.criteria} ===`);
  parts.push(
    criteria.length
      ? criteria.map((c) => `- ${c.id}: ${c.text}`).join('\n')
      : L.noCriteria
  );
  parts.push('', L.criterionNote, '');

  parts.push(`=== ${L.content} ===`, renderFields(fields, isPolish), '');

  const ctx = clip(String(artifactContext ?? '').trim(), MAX_CONTEXT_CHARS);
  if (ctx) parts.push(`=== ${L.context} ===`, ctx, '');

  parts.push(`=== ${L.rules} ===`, L.r.map((r, i) => `${i + 1}. ${r}`).join('\n'), '');
  parts.push(`=== ${L.schema} ===`, SCHEMA_HINT);

  return {
    system: isPolish ? SYSTEM_PL : SYSTEM_EN,
    message: clip(parts.join('\n'), MAX_MESSAGE_CHARS),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsowanie
// ─────────────────────────────────────────────────────────────────────────────

/** Wyłuskuje pierwszy obiekt JSON z odpowiedzi (model bywa gadatliwy mimo zakazu). */
function extractJson(raw: string): unknown {
  const text = String(raw ?? '').trim();
  if (!text) throw new Error('EMPTY_RESPONSE');

  // Zdejmij płotek ```json … ``` gdy model go jednak dołożył.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;

  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('NO_JSON');
  return JSON.parse(body.slice(start, end + 1));
}

function toFindings(raw: unknown, prefix: string): CardAnalysisFinding[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 6)
    .map((item, i) => {
      const o = (item ?? {}) as Record<string, unknown>;
      const title = String(o.title ?? '').trim();
      const detail = String(o.detail ?? '').trim();
      if (!title && !detail) return null;
      const finding: CardAnalysisFinding = {
        id: `${prefix}-${i}`,
        title: title || detail.slice(0, 80),
        detail: detail || title,
        severity: severityOf(o.severity),
      };
      const criterionId = String(o.criterionId ?? '').trim();
      return criterionId ? { ...finding, criterionId } : finding;
    })
    .filter((x): x is CardAnalysisFinding => x !== null);
}

function toChanges(raw: unknown, fields: CardAnalysisField[]): CardAnalysisChange[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map(fields.map((f) => [f.id, f]));

  return raw
    .slice(0, 6)
    .map((item, i) => {
      const o = (item ?? {}) as Record<string, unknown>;
      const fieldId = String(o.fieldId ?? '').trim();
      const proposedValue = String(o.proposedValue ?? '').trim();
      if (!proposedValue) return null;

      const field = byId.get(fieldId);
      const mode = String(o.mode ?? '').toLowerCase() === 'append' ? 'append' : 'replace';

      const change: CardAnalysisChange = {
        id: `chg-${i}`,
        fieldId,
        // Nieznane `fieldId` NIE jest naprawiane zgadywaniem pola — panel pokaże
        // pozycję jako „propozycja bez celu" i zablokuje „Zastosuj".
        fieldLabel: field?.label ?? fieldId,
        rationale: String(o.rationale ?? '').trim(),
        currentValue: String(field?.value ?? ''),
        proposedValue,
        mode,
        severity: severityOf(o.severity),
      };
      const criterionId = String(o.criterionId ?? '').trim();
      return criterionId ? { ...change, criterionId } : change;
    })
    .filter((x): x is CardAnalysisChange => x !== null);
}

function clampCompleteness(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Wywołanie
// ─────────────────────────────────────────────────────────────────────────────

/** Kody błędów, które panel tłumaczy na komunikat dla człowieka. */
export type CardAnalysisErrorCode =
  | 'EMPTY_RESPONSE'
  | 'NO_JSON'
  | 'BAD_JSON'
  | 'REQUEST_FAILED';

export class CardAnalysisError extends Error {
  readonly code: CardAnalysisErrorCode;
  /** Kod z backendu (np. AI_BUDGET_EXHAUSTED, EMPTY_LLM_RESPONSE), gdy był. */
  readonly serverCode?: string;

  constructor(code: CardAnalysisErrorCode, message: string, serverCode?: string) {
    super(message);
    this.name = 'CardAnalysisError';
    this.code = code;
    if (serverCode) this.serverCode = serverCode;
  }
}

/**
 * Analizuje aktywną kartę. Rzuca `CardAnalysisError` — panel pokazuje uczciwy
 * powód, NIE cichy „brak wyniku".
 */
export async function analyzeCard(input: CardAnalysisInput): Promise<CardAnalysisResult> {
  const { system, message } = buildAnalysisPrompt(input);

  let raw = '';
  try {
    const res = await Api.post('/ai/generate', {
      message,
      systemInstruction: system,
      roleName: 'Card Quality Reviewer',
    });
    raw = String(res?.text ?? '').trim();
  } catch (err) {
    const serverCode =
      (err as { code?: string })?.code ??
      (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
    throw new CardAnalysisError(
      'REQUEST_FAILED',
      (err as Error)?.message || 'AI request failed',
      serverCode
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(raw) as Record<string, unknown>;
  } catch (err) {
    const code = (err as Error)?.message;
    throw new CardAnalysisError(
      code === 'EMPTY_RESPONSE' ? 'EMPTY_RESPONSE' : code === 'NO_JSON' ? 'NO_JSON' : 'BAD_JSON',
      `AI response could not be parsed (${code})`
    );
  }

  const std = buildCardStandard(input.artifactType, input.cardId, input.cardId, input.isPolish);

  return {
    artifactType: input.artifactType,
    cardId: input.cardId,
    cardLabel: std.label,
    completeness: clampCompleteness(parsed.completeness),
    verdict: String(parsed.verdict ?? '').trim(),
    gaps: toFindings(parsed.gaps, 'gap'),
    risks: toFindings(parsed.risks, 'risk'),
    suggestions: toFindings(parsed.suggestions, 'sug'),
    changes: toChanges(parsed.changes, input.fields),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Scalanie treści przy „Zastosuj". Wspólne dla wszystkich sześciu kart, żeby
 * „append" znaczyło wszędzie to samo (nowa linia, bez duplikatu, bez zjadania
 * istniejącej treści).
 */
export function mergeChangeValue(change: CardAnalysisChange, currentValue: string): string {
  const current = String(currentValue ?? '');
  const proposed = String(change.proposedValue ?? '').trim();
  if (change.mode === 'replace') return proposed;
  if (!current.trim()) return proposed;
  if (current.includes(proposed)) return current;
  return `${current.replace(/\s+$/, '')}\n${proposed}`;
}
