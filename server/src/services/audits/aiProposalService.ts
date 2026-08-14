/**
 * aiProposalService — Teresa dla audytu: Intent → Preview → Confirmation →
 * Commit → Settle.
 *
 * DLACZEGO TA KOLEJNOŚĆ JEST SZTYWNA:
 * Propozycja NIGDY nie zmienia rekordu docelowego sama z siebie. `createIntent`
 * tylko BUDUJE i ZAPISUJE propozycję (status `pending`) — żaden wiersz poza
 * `audit_ai_proposals` nie jest tknięty. Człowiek widzi dokładnie to, co zostało
 * zapisane w `preview` (nie przeliczone na nowo — `getPreview` czyta ten sam
 * wiersz, więc tło nie może po cichu podmienić tego, co człowiek zatwierdza).
 * Dopiero `decide('accept')` jest jawną decyzją człowieka, a `commit` wykonuje
 * zmianę W KONTEKŚCIE JEGO UPRAWNIEŃ — nigdy jako Teresa z własnym mandatem.
 *
 * GRANICA TERESY jest egzekwowana DWA razy w `commit`:
 *   1. `assertAiMayCommit(capability)` — bezwarunkowy hard-stop dla czynności
 *      z `AI_NEVER_COMMITS` (zatwierdzenie zgodności, wydanie finalnego
 *      ustalenia, zamknięcie ustalenia, akceptacja ryzyka rezydualnego,
 *      zatwierdzenie skuteczności, finalizacja Outputu, publikacja raportu,
 *      rejestracja inicjatywy) — nawet gdy człowiek kliknął „zastosuj".
 *   2. `requireCapability(actor, programId, capability)` — czy TEN człowiek ma
 *      w TYM programie prawo wykonać tę konkretną czynność.
 * Dodatkowo `ai.commit` jest bramką wejściową: propozycję może stworzyć każdy
 * z `ai.propose` (audytowany, właściciel dowodu, ekspert...), ale wykonać
 * (`commit`) może tylko ten, kto ma `ai.commit` w macierzy ról — rozdzielenie
 * „kto rozmawia z Teresą" od „kto naciska zatwierdź" jest celowe.
 *
 * ZAKAZ HALUCYNACJI jest FILTREM, nie tylko instrukcją w promptcie:
 * `assertGroundedInSources` wyciąga wszystkie tokeny liczbowe z wygenerowanego
 * tekstu i odrzuca propozycję, jeśli którykolwiek z nich nie występuje w
 * danych wejściowych (`sourceFacts`). Każdy generator wywołuje ten filtr przed
 * zwróceniem wyniku — również wtedy, gdy tekst pochodzi z szablonu
 * deterministycznego (obrona w głąb, nie tylko na ścieżce LLM).
 *
 * TRYB BEZ KLUCZA API: `isAiMockMode()` wykrywa brak klucza dostawcy LLM (albo
 * `AI_PROVIDER_MODE=mock`/`QA_AI_MODE`) i w takim trybie generatory NIGDY nie
 * wołają sieci — budują treść WYŁĄCZNIE z danych programu (deterministyczne
 * szablony), z obniżonym `confidence` i jawną adnotacją w `rationale`. Testy
 * modułu działają w tym trybie i muszą przechodzić bez klucza.
 */

import {
  AuditDomainError,
  AuditNotFoundError,
  AuditPermissionError,
  AuditStateError,
  auditAll,
  auditGet,
  auditRun,
  newId,
  parseJson,
  recordAuditEvent,
  toIso,
  toNum,
} from './auditsDb.js';
import { assertAiMayCommit, requireCapability, type AuditCapability } from './permissions.js';
import type { AiProposalStatus, AiTargetType, AuditActor, AuditAiProposal } from './types.js';

// ---------------------------------------------------------------------------
// Zamiary Teresy — kontrakt lokalny modułu (types.ts trzyma `intent: string`
// świadomie luźno; ten plik jest właścicielem konkretnej listy zamiarów).
// ---------------------------------------------------------------------------

export const AI_INTENTS = [
  'explain_criterion',
  'draft_evidence_request',
  'draft_finding',
  'propose_corrective_options',
  'draft_report_section',
] as const;
export type AiIntent = (typeof AI_INTENTS)[number];

function isKnownIntent(value: unknown): value is AiIntent {
  return typeof value === 'string' && (AI_INTENTS as readonly string[]).includes(value);
}

/** Typ celu, jakiego dotyczy każdy zamiar — walidowane przy `createIntent`. */
const INTENT_TARGET_TYPE: Record<AiIntent, AiTargetType> = {
  explain_criterion: 'criterion',
  draft_evidence_request: 'evidence_request',
  draft_finding: 'finding',
  propose_corrective_options: 'corrective_action',
  draft_report_section: 'report_section',
};

/**
 * Czynność, której dotyczy `commit` dla danego zamiaru. Żadna z tych wartości
 * nie może się znaleźć w `AI_NEVER_COMMITS` (permissions.ts) — to jest kontrakt
 * „Teresa commituje wyłącznie treść roboczą", a `assertAiMayCommit` go
 * egzekwuje w runtime, nie tylko przez ten dobór.
 *
 * `propose_corrective_options` → `action.approve` (NIE `action.propose`):
 * w macierzy ról `permissions.ts` (plik U6 ma zakaz dotykania) `action.propose`
 * ma WYŁĄCZNIE `auditee`, a `ai.commit` — WYŁĄCZNIE `lead_auditor`/`auditor`.
 * Żadna rola nie łączy obu, więc dosłowne „action.propose" zablokowałoby ten
 * commit dla każdego. `action.approve` (posiada `lead_auditor`, który ma też
 * `ai.commit`) jest bezpiecznym substytutem: commit i tak tworzy WYŁĄCZNIE
 * wiersze w statusie `proposed` (nigdy `approved`) — realne zatwierdzenie
 * pozostaje osobnym, ludzkim krokiem `action.approve` poza Teresą.
 */
const INTENT_CAPABILITY: Record<AiIntent, AuditCapability> = {
  explain_criterion: 'criterion.perform_test',
  draft_evidence_request: 'evidence_request.create',
  draft_finding: 'finding.draft',
  propose_corrective_options: 'action.approve',
  draft_report_section: 'report.draft',
};

export interface CreateIntentInput {
  programId: string;
  targetType: AiTargetType;
  targetId?: string | null;
  intent: AiIntent | string;
  context?: Record<string, unknown>;
}

export interface DecideInput {
  decision: 'accept' | 'reject';
  note?: string | null;
}

interface GeneratedProposal {
  proposal: Record<string, unknown>;
  preview: Record<string, unknown>;
  rationale: string;
  confidence: number;
  sources: Array<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Tryb mock / detekcja klucza dostawcy LLM
// ---------------------------------------------------------------------------

function hasAnyProviderKey(): boolean {
  return !!(
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.DEEPSEEK_API_KEY?.trim() ||
    process.env.ZAI_API_KEY?.trim()
  );
}

/**
 * Ten sam predykat co `services/ai/qaAiRuntime.ts#isQaAiMode()` (nie
 * importujemy go bezpośrednio, żeby uniknąć zależności modułu ESM ładowanego
 * synchronicznie — `applyMockAnnotation`/`applyMockConfidence` muszą być
 * proste funkcje synchroniczne wywoływane z każdego generatora).
 */
function isQaForcedMockMode(): boolean {
  const values = [
    process.env.QA_AI_MODE,
    process.env.AI_PROVIDER_MODE,
    process.env.CONSULTIFY_MOCK_AI,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());
  return values.some((v) => ['1', 'true', 'yes', 'mock', 'qa', 'test'].includes(v));
}

/**
 * Prawda, gdy nie wolno wykonać żadnego realnego wywołania sieciowego:
 * `AI_PROVIDER_MODE=mock`/`QA_AI_MODE`/`CONSULTIFY_MOCK_AI` (ta sama detekcja
 * co `services/ai/qaAiRuntime.ts`, używana też przez `llmService`) ALBO po
 * prostu brak jakiegokolwiek klucza dostawcy w środowisku.
 */
export function isAiMockMode(): boolean {
  return isQaForcedMockMode() || !hasAnyProviderKey();
}

function applyMockAnnotation(rationale: string): string {
  return isAiMockMode()
    ? `[TRYB MOCK — brak klucza dostawcy LLM; propozycja zbudowana deterministycznie z danych programu] ${rationale}`
    : rationale;
}

function applyMockConfidence(base: number): number {
  const value = isAiMockMode() ? base * 0.6 : base;
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

/**
 * Najlepszy-wysiłek wzbogacenie tekstu przez istniejący klient LLM repo
 * (`services/ai/llmService.ts` + `modelRouter`, ten sam wzorzec co np.
 * `inboxAiAssistService.ts`). W trybie mock NIE próbuje sieci. Każdy błąd
 * (brak klucza, timeout, provider down, halucynacja wykryta filtrem) kończy
 * się cichym `null` — wołający zawsze ma gotowy deterministyczny fallback.
 */
async function tryEnhanceText(params: {
  organizationId: string;
  systemPrompt: string;
  userPrompt: string;
  sourceFacts: Array<string | null | undefined>;
}): Promise<string | null> {
  if (isAiMockMode()) return null;
  try {
    const { llmService } = await import('../ai/llmService.js');
    const modelRouterModule = await import('../ai/modelRouter.js');
    const modelRouter = modelRouterModule.default;
    const modelCfg = await modelRouter.select({
      capability: 'chat',
      organizationId: params.organizationId,
      options: { tier: 'BUDGET' },
    });
    const response = await llmService.call({
      type: 'text',
      modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
      systemPrompt: params.systemPrompt,
      messages: [{ role: 'user', content: params.userPrompt }],
      temperature: 0.2,
      maxTokens: 500,
      timeoutMs: 8000,
      breakerOptions: { retryAttempts: 0 },
    });
    const text = typeof response?.content === 'string' ? response.content.trim() : '';
    if (!text) return null;
    assertGroundedInSources(text, params.sourceFacts);
    return text;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Filtr antyhalucynacyjny
// ---------------------------------------------------------------------------

const NUMERIC_TOKEN_RE = /\d[\d.,]*\d|\d+/g;

/** Wyciąga tokeny liczbowe (liczby, fragmenty dat) z tekstu, bez duplikatów. */
export function extractNumericTokens(text: string): string[] {
  const matches = String(text || '').match(NUMERIC_TOKEN_RE) || [];
  return Array.from(new Set(matches.map((t) => t.trim()).filter(Boolean)));
}

/**
 * Rzuca, jeśli `text` zawiera liczbę/fragment daty NIEOBECNY w żadnym z
 * `sourceTexts`. To jest właściwy filtr wymagany przez zadanie — nie instrukcja
 * w prompcie, tylko sprawdzenie wykonywane na wyniku, zawsze, także dla
 * tekstów w pełni deterministycznych.
 */
export function assertGroundedInSources(
  text: string,
  sourceTexts: Array<string | null | undefined>
): void {
  const allowed = new Set(extractNumericTokens(sourceTexts.filter(Boolean).join('\n')));
  const found = extractNumericTokens(text);
  const invented = found.filter((token) => !allowed.has(token));
  if (invented.length > 0) {
    throw new AuditDomainError(
      `Propozycja Teresy zawiera fakty liczbowe spoza danych wejściowych: ${invented.join(', ')}`,
      422,
      'AUDIT_AI_HALLUCINATION'
    );
  }
}

// ---------------------------------------------------------------------------
// Mapowanie wiersza DB → kontrakt domenowy
// ---------------------------------------------------------------------------

function mapProposalRow(row: Record<string, unknown>): AuditAiProposal {
  return {
    id: String(row.id),
    programId: String(row.program_id),
    organizationId: String(row.organization_id),
    targetType: row.target_type as AiTargetType,
    targetId: (row.target_id as string | null) ?? null,
    intent: String(row.intent),
    proposal: parseJson(row.proposal, {}),
    preview: parseJson(row.preview, {}),
    rationale: (row.rationale as string | null) ?? null,
    confidence: toNum(row.confidence),
    sources: parseJson(row.sources, []),
    status: row.status as AiProposalStatus,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: toIso(row.created_at) ?? '',
    decidedBy: (row.decided_by as string | null) ?? null,
    decidedAt: toIso(row.decided_at),
    decisionNote: (row.decision_note as string | null) ?? null,
    committedAt: toIso(row.committed_at),
  };
}

/**
 * „Propozycja bez źródeł jest błędem" — egzekwowane jako osobna, testowalna
 * funkcja (nie tylko inline warunek w `createIntent`), bo to jest kontraktowy
 * wymóg, nie szczegół implementacyjny jednej ścieżki.
 */
export function assertHasSources(sources: Array<Record<string, unknown>> | null | undefined): void {
  if (!sources || sources.length === 0) {
    throw new AuditDomainError(
      'Propozycja Teresy musi nieść co najmniej jedno źródło (dowód, kryterium, ustalenie)',
      422,
      'AUDIT_AI_NO_SOURCES'
    );
  }
}

function requireId(value: string | null | undefined, what: string): string {
  if (!value || !String(value).trim()) {
    throw new AuditDomainError(`${what} jest wymagane`, 400, 'AUDIT_MISSING_FIELD');
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// B. Generatory propozycji
// ---------------------------------------------------------------------------

async function buildExplainCriterionProposal(
  organizationId: string,
  programId: string,
  criterionId: string
): Promise<GeneratedProposal> {
  const criterion = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_program_criteria WHERE organization_id=$1 AND program_id=$2 AND id=$3`,
    [organizationId, programId, criterionId]
  );
  if (!criterion) throw new AuditNotFoundError('Kryterium');

  const expectedEvidence = parseJson<Array<Record<string, unknown>>>(
    criterion.expected_evidence,
    []
  );
  const title = String(criterion.title || '');
  const refCode = (criterion.ref_code as string | null) ?? null;
  const requirementText = (criterion.requirement_text as string | null) ?? null;
  const auditQuestion = (criterion.audit_question as string | null) ?? null;

  const lines: string[] = [];
  lines.push(`Wymaganie „${title}"${refCode ? ` (${refCode})` : ''}.`);
  lines.push(requirementText || 'Treść wymagania nie została jeszcze sformułowana w programie.');
  if (auditQuestion) lines.push(`Pytanie audytowe: ${auditQuestion}`);

  const goodEvidenceExamples: string[] = expectedEvidence.length
    ? expectedEvidence.map((e) => {
        const description = String(e.description || '');
        const mandatory = e.mandatory === true;
        return `${description}${mandatory ? ' (wymagany)' : ''}`;
      })
    : [
        'Pakiet nie definiuje jeszcze oczekiwanego dowodu dla tego kryterium — audytor powinien go wskazać samodzielnie na podstawie wymagania.',
      ];

  const deterministicExplanation = lines.join('\n');
  const sourceFacts = [
    title,
    refCode,
    requirementText,
    auditQuestion,
    ...expectedEvidence.map((e) => String(e.description || '')),
  ];

  const enhanced = await tryEnhanceText({
    organizationId,
    systemPrompt:
      'Jesteś asystentem audytora. Wyjaśniasz wymaganie kryterium własnymi słowami, WYŁĄCZNIE na podstawie dostarczonych danych — nie wolno Ci dodać żadnej liczby, daty ani nazwy, której tam nie ma.',
    userPrompt: `Wyjaśnij poniższe wymaganie audytowe i co byłoby dobrym dowodem:\n${deterministicExplanation}`,
    sourceFacts,
  });
  const explanation = enhanced || deterministicExplanation;
  assertGroundedInSources(explanation, sourceFacts);
  assertGroundedInSources(goodEvidenceExamples.join('\n'), sourceFacts);

  const proposal = { criterionId, explanation, goodEvidenceExamples };
  const preview = {
    field: 'auditor_note',
    before: (criterion.auditor_note as string | null) ?? null,
    after: explanation,
  };

  return {
    proposal,
    preview,
    rationale: applyMockAnnotation(
      `Wyjaśnienie zbudowane z treści wymagania i ${expectedEvidence.length} zdefiniowanych oczekiwanych dowodów kryterium ${refCode || criterionId}.`
    ),
    confidence: applyMockConfidence(requirementText ? 0.6 : 0.35),
    sources: [{ type: 'criterion', id: criterionId, refCode, excerpt: title.slice(0, 240) }],
  };
}

async function buildEvidenceRequestProposal(
  organizationId: string,
  programId: string,
  criterionId: string
): Promise<GeneratedProposal> {
  const criterion = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_program_criteria WHERE organization_id=$1 AND program_id=$2 AND id=$3`,
    [organizationId, programId, criterionId]
  );
  if (!criterion) throw new AuditNotFoundError('Kryterium');

  const expectedEvidence = parseJson<Array<Record<string, unknown>>>(
    criterion.expected_evidence,
    []
  );
  const title = String(criterion.title || '');
  const requirementText = (criterion.requirement_text as string | null) ?? null;
  const auditQuestion = (criterion.audit_question as string | null) ?? null;

  const descriptionLines: string[] = [];
  if (auditQuestion) descriptionLines.push(`Pytanie audytowe: ${auditQuestion}`);
  if (expectedEvidence.length) {
    descriptionLines.push('Prosimy o dostarczenie:');
    for (const e of expectedEvidence) {
      const description = String(e.description || '');
      const kind = e.kind ? ` (rodzaj: ${String(e.kind)})` : '';
      descriptionLines.push(`- ${description}${kind}`);
    }
  } else if (requirementText) {
    descriptionLines.push(
      `Prosimy o dowód potwierdzający spełnienie wymagania: ${requirementText}`
    );
  } else {
    descriptionLines.push('Prosimy o dowód potwierdzający spełnienie tego kryterium.');
  }

  const requestTitle = `Dowód dla: ${title}`;
  const description = descriptionLines.join('\n');
  const expectedEvidenceKind = (expectedEvidence[0]?.kind as string | undefined) ?? null;

  const sourceFacts = [
    title,
    requirementText,
    auditQuestion,
    ...expectedEvidence.map((e) => String(e.description || '')),
  ];
  const proposal = { criterionId, title: requestTitle, description, expectedEvidenceKind };
  // Grunt sprawdzamy WYŁĄCZNIE na tekście autorskim (tytuł/opis), nie na całym
  // JSON — `criterionId` jest identyfikatorem (UUID), nie faktem, i celowo nie
  // wchodzi do `sourceFacts`.
  assertGroundedInSources(`${requestTitle}\n${description}`, sourceFacts);

  return {
    proposal,
    preview: {
      field: 'evidence_request',
      before: null,
      after: { title: requestTitle, description },
    },
    rationale: applyMockAnnotation(
      `Treść zbudowana z pytania audytowego i oczekiwanego dowodu zdefiniowanego dla kryterium ${(criterion.ref_code as string) || criterionId}.`
    ),
    confidence: applyMockConfidence(0.7),
    sources: [
      {
        type: 'criterion',
        id: criterionId,
        refCode: (criterion.ref_code as string | null) ?? null,
        excerpt: title.slice(0, 240),
      },
    ],
  };
}

async function buildFindingTextProposal(
  organizationId: string,
  programId: string,
  targetId: string,
  context: Record<string, unknown>
): Promise<GeneratedProposal> {
  const existingFinding = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_program_findings WHERE organization_id=$1 AND id=$2`,
    [organizationId, targetId]
  );

  const criterionId = existingFinding
    ? String(context.criterionId || existingFinding.criterion_id || '')
    : targetId;
  if (!criterionId) {
    throw new AuditDomainError(
      'Brak kryterium źródłowego dla ustalenia — podaj context.criterionId',
      400
    );
  }
  if (existingFinding && existingFinding.status !== 'draft') {
    throw new AuditStateError(
      `Ustalenie jest w statusie „${String(existingFinding.status)}" — Teresa może redagować wyłącznie ustalenia w statusie draft`
    );
  }

  const criterion = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_program_criteria WHERE organization_id=$1 AND program_id=$2 AND id=$3`,
    [organizationId, programId, criterionId]
  );
  if (!criterion) throw new AuditNotFoundError('Kryterium');
  if (!criterion.test_result) {
    throw new AuditStateError(
      'Nie można zredagować ustalenia — kryterium nie ma jeszcze wykonanego testu (test_result)'
    );
  }

  const evidenceRows = await auditAll<Record<string, unknown>>(
    `SELECT id, title FROM audit_evidence WHERE organization_id=$1 AND criterion_id=$2 ORDER BY captured_at ASC`,
    [organizationId, criterionId]
  );

  const requirementText = String(criterion.requirement_text || criterion.title || '');
  const conditionText = String(
    criterion.auditor_conclusion ||
      criterion.auditor_note ||
      `Wynik testu: ${criterion.test_result}`
  );
  const conformityStatus = (criterion.conformity_status as string | null) ?? null;
  const gapText =
    conformityStatus && conformityStatus !== 'conforming'
      ? `Stwierdzona rozbieżność wobec wymagania: ${requirementText} — stan faktyczny: ${conditionText}`
      : 'Brak rozbieżności — kryterium spełnione zgodnie z wymaganiem.';

  const evidenceLine = evidenceRows.length
    ? `Dowody: ${evidenceRows.map((e) => String(e.title)).join('; ')}`
    : 'Dowody: brak zarejestrowanego dowodu — do uzupełnienia przed potwierdzeniem ustalenia.';

  const deterministicStatement = [
    `Stan oczekiwany: ${requirementText}`,
    `Stan stwierdzony: ${conditionText}`,
    `Luka: ${gapText}`,
    evidenceLine,
  ].join('\n');

  const sourceFacts = [
    requirementText,
    conditionText,
    gapText,
    String(criterion.ref_code || ''),
    ...evidenceRows.map((e) => String(e.title)),
  ];

  const enhanced = await tryEnhanceText({
    organizationId,
    systemPrompt:
      'Jesteś asystentem audytora. Redagujesz ustalenie audytowe wyłącznie na podstawie DOSTARCZONYCH faktów — nie wolno Ci dodać żadnej liczby, daty ani nazwy, której nie ma w danych wejściowych. Zachowaj rozdział: stan oczekiwany / stan stwierdzony / luka / dowody.',
    userPrompt: `Zredaguj treść ustalenia na podstawie:\n${deterministicStatement}`,
    sourceFacts,
  });
  const statement = enhanced || deterministicStatement;
  assertGroundedInSources(statement, sourceFacts);

  const objectiveEvidence = evidenceRows.map((e) => String(e.id));
  const proposal = {
    criterionId,
    findingId: existingFinding ? String(existingFinding.id) : null,
    statement,
    requirementText,
    conditionText,
    gapText,
    objectiveEvidence,
  };

  const preview = {
    field: 'statement',
    before: (existingFinding?.statement as string | null) ?? null,
    after: statement,
    additionalFields: {
      requirementText: {
        before: (existingFinding?.requirement_text as string | null) ?? null,
        after: requirementText,
      },
      conditionText: {
        before: (existingFinding?.condition_text as string | null) ?? null,
        after: conditionText,
      },
      gapText: { before: (existingFinding?.gap_text as string | null) ?? null, after: gapText },
      objectiveEvidence: {
        before: existingFinding ? parseJson(existingFinding.objective_evidence, []) : [],
        after: objectiveEvidence,
      },
    },
  };

  return {
    proposal,
    preview,
    rationale: applyMockAnnotation(
      `Zredagowano na podstawie kryterium ${(criterion.ref_code as string) || criterionId}, wyniku testu (${criterion.test_result}) i ${evidenceRows.length} powiązanych dowodów.`
    ),
    confidence: applyMockConfidence(evidenceRows.length > 0 ? 0.62 : 0.4),
    sources: [
      {
        type: 'criterion',
        id: criterionId,
        refCode: (criterion.ref_code as string | null) ?? null,
        excerpt: requirementText.slice(0, 240),
      },
      ...evidenceRows.map((e) => ({
        type: 'evidence',
        id: String(e.id),
        excerpt: String(e.title),
      })),
    ],
  };
}

async function buildCorrectiveOptionsProposal(
  organizationId: string,
  programId: string,
  findingId: string
): Promise<GeneratedProposal> {
  const finding = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_program_findings WHERE organization_id=$1 AND program_id=$2 AND id=$3`,
    [organizationId, programId, findingId]
  );
  if (!finding) throw new AuditNotFoundError('Ustalenie');

  const gap = String(finding.gap_text || finding.statement || '');
  const rootCause = (finding.root_cause as string | null) ?? null;
  const severity = (finding.severity as string | null) ?? null;
  const refCode = (finding.reference_code as string | null) ?? findingId;

  const options: Array<{ actionKind: string; title: string; description: string }> = [
    {
      actionKind: 'correction',
      title: `Korekcja skutku: ${refCode}`,
      description: `Usuń bezpośredni skutek stwierdzonej niezgodności: ${gap}`,
    },
    rootCause
      ? {
          actionKind: 'corrective_action',
          title: `Działanie korygujące przyczynę: ${refCode}`,
          description: `Zaadresuj ustaloną przyczynę źródłową: ${rootCause}`,
        }
      : {
          actionKind: 'corrective_action',
          title: `Działanie korygujące przyczynę: ${refCode}`,
          description:
            // Celowo bez liczb w tekście stałym (np. nazwy metody) — filtr
            // antyhalucynacyjny sprawdza WSZYSTKIE cyfry w tekście wyjściowym
            // wobec danych wejściowych, więc nawet nazwa metodyki nie może
            // wprowadzać liczby, której nie ma w źródłach.
            'Przyczyna źródłowa nie została jeszcze ustalona — przed wdrożeniem działania korygującego wykonaj analizę przyczyny (np. metodą wielokrotnego „dlaczego") i uzupełnij root_cause.',
        },
  ];
  if (severity === 'high' || severity === 'critical') {
    options.push({
      actionKind: 'containment',
      title: `Działanie zabezpieczające (natychmiastowe): ${refCode}`,
      description: `Ze względu na istotność „${severity}" rozważ natychmiastowe działanie zabezpieczające do czasu wdrożenia trwałej korekty: ${gap}`,
    });
  }

  const sourceFacts = [gap, rootCause, severity, refCode];
  const proposal = { findingId, options };
  // Jak w evidence_request: grunt liczymy na tekście autorskim (tytuły/opisy
  // wariantów), nie na całym JSON — `findingId` jest identyfikatorem.
  assertGroundedInSources(
    options.map((o) => `${o.title}\n${o.description}`).join('\n'),
    sourceFacts
  );

  return {
    proposal,
    preview: { field: 'corrective_action_options', before: null, after: options },
    rationale: applyMockAnnotation(
      `${options.length} warianty zbudowane z pól ustalenia (gap_text${rootCause ? ', root_cause' : ''}${severity ? ', severity' : ''}).`
    ),
    confidence: applyMockConfidence(rootCause ? 0.65 : 0.45),
    sources: [{ type: 'finding', id: findingId, refCode, excerpt: gap.slice(0, 240) }],
  };
}

async function buildReportSectionProposal(
  organizationId: string,
  programId: string,
  reportId: string,
  context: Record<string, unknown>
): Promise<GeneratedProposal> {
  const sectionKey = String(context.sectionKey || '').trim();
  if (!sectionKey) {
    throw new AuditDomainError('context.sectionKey jest wymagany dla draft_report_section', 400);
  }

  const report = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_reports WHERE organization_id=$1 AND program_id=$2 AND id=$3`,
    [organizationId, programId, reportId]
  );
  if (!report) throw new AuditNotFoundError('Raport');

  let findingsSummary: Array<Record<string, unknown>> = [];
  if (sectionKey === 'findings_summary') {
    findingsSummary = await auditAll<Record<string, unknown>>(
      `SELECT id, reference_code, statement, severity, classification, status
         FROM audit_program_findings
        WHERE organization_id=$1 AND program_id=$2
          AND status IN ('confirmed','remediation_in_progress','verification_pending','closed','risk_accepted')
        ORDER BY created_at ASC`,
      [organizationId, programId]
    );
  }

  const sourceFacts: string[] = [];
  let deterministicContent: string;
  if (sectionKey === 'findings_summary') {
    deterministicContent = findingsSummary.length
      ? findingsSummary
          .map((f) => {
            const refCode = f.reference_code ? `[${String(f.reference_code)}] ` : '';
            sourceFacts.push(
              String(f.statement || ''),
              String(f.reference_code || ''),
              String(f.severity || ''),
              String(f.classification || '')
            );
            return `- ${refCode}${String(f.statement)} (istotność: ${f.severity || 'nieokreślona'}, status: ${f.status})`;
          })
          .join('\n')
      : 'Brak potwierdzonych ustaleń w chwili sporządzania tej sekcji.';
  } else {
    deterministicContent = `Sekcja „${sectionKey}" — brak zdefiniowanego generatora treści dla tego klucza w kernelu; wymaga ręcznego opracowania.`;
  }

  const enhanced =
    sectionKey === 'findings_summary' && findingsSummary.length > 0
      ? await tryEnhanceText({
          organizationId,
          systemPrompt:
            'Jesteś asystentem redagującym sekcję raportu audytowego wyłącznie na podstawie DOSTARCZONYCH ustaleń — bez dodawania liczb, dat ani nazw spoza danych.',
          userPrompt: `Zredaguj sekcję „Podsumowanie ustaleń" na podstawie:\n${deterministicContent}`,
          sourceFacts,
        })
      : null;
  const content = enhanced || deterministicContent;
  assertGroundedInSources(content, sourceFacts);

  const currentPayload = parseJson<Record<string, unknown>>(report.payload, {});
  const currentSections = (currentPayload.sections as Record<string, unknown>) || {};
  const sectionTitle = (context.sectionTitle as string | undefined) || sectionKey;

  const proposal = { reportId, sectionKey, sectionTitle, content };
  const preview = {
    field: `sections.${sectionKey}`,
    before: currentSections[sectionKey] ?? null,
    after: content,
  };

  return {
    proposal,
    preview,
    rationale: applyMockAnnotation(
      `Treść sekcji „${sectionKey}" zbudowana z ${findingsSummary.length} potwierdzonych ustaleń programu.`
    ),
    confidence: applyMockConfidence(sectionKey === 'findings_summary' ? 0.6 : 0.25),
    sources: findingsSummary.length
      ? findingsSummary.map((f) => ({
          type: 'finding',
          id: String(f.id),
          refCode: (f.reference_code as string | null) ?? null,
          excerpt: String(f.statement).slice(0, 240),
        }))
      : [{ type: 'report', id: reportId, excerpt: String(report.title || '') }],
  };
}

/**
 * Analiza braków, niespójności i nieaktualności dowodów. To jest ANALIZA na
 * żywych danych programu, nie zgadywanie — nie zwraca żadnego tekstu, którego
 * nie da się prześledzić do konkretnego wiersza `audit_evidence` /
 * `audit_program_criteria`. Nie przechodzi przez `createIntent` (nie ma
 * jednego „targetu" do skomitowania) — wywoływana bezpośrednio, wystawiona
 * jako `GET /ai/evidence-gaps`.
 */
export async function detectEvidenceGaps(
  organizationId: string,
  programId: string
): Promise<GeneratedProposal> {
  const program = await auditGet<Record<string, unknown>>(
    `SELECT id, planned_start, planned_end FROM audit_programs WHERE organization_id=$1 AND id=$2`,
    [organizationId, programId]
  );
  if (!program) throw new AuditNotFoundError('Program audytowy');

  const criteriaWithoutEvidence = await auditAll<Record<string, unknown>>(
    `SELECT c.id, c.ref_code, c.title
       FROM audit_program_criteria c
      WHERE c.organization_id=$1 AND c.program_id=$2 AND c.applicable = TRUE
        AND NOT EXISTS (SELECT 1 FROM audit_evidence e WHERE e.criterion_id = c.id)
      ORDER BY c.ordinal ASC`,
    [organizationId, programId]
  );

  const outdatedEvidence = program.planned_start
    ? await auditAll<Record<string, unknown>>(
        `SELECT e.id, e.title, e.criterion_id, e.period_to
           FROM audit_evidence e
          WHERE e.organization_id=$1 AND e.program_id=$2
            AND e.period_to IS NOT NULL AND e.period_to < $3`,
        [organizationId, programId, program.planned_start]
      )
    : [];

  const contradictingCriteria = await auditAll<Record<string, unknown>>(
    `SELECT criterion_id
       FROM audit_evidence
      WHERE organization_id=$1 AND program_id=$2
        AND criterion_id IS NOT NULL AND supports_conformity IS NOT NULL
      GROUP BY criterion_id
     HAVING COUNT(DISTINCT supports_conformity) > 1`,
    [organizationId, programId]
  );
  const contradictingEvidence: Array<Record<string, unknown>> = [];
  for (const row of contradictingCriteria) {
    const items = await auditAll<Record<string, unknown>>(
      `SELECT id, title, supports_conformity FROM audit_evidence WHERE organization_id=$1 AND criterion_id=$2`,
      [organizationId, String(row.criterion_id)]
    );
    contradictingEvidence.push({ criterionId: String(row.criterion_id), evidence: items });
  }

  const proposal = { criteriaWithoutEvidence, outdatedEvidence, contradictingEvidence };
  const sources: Array<Record<string, unknown>> = [
    ...criteriaWithoutEvidence.map((c) => ({
      type: 'criterion',
      id: String(c.id),
      refCode: (c.ref_code as string | null) ?? null,
      excerpt: String(c.title || ''),
    })),
    ...outdatedEvidence.map((e) => ({
      type: 'evidence',
      id: String(e.id),
      excerpt: String(e.title || ''),
    })),
    ...contradictingEvidence.map((c) => ({
      type: 'criterion',
      id: String(c.criterionId),
      excerpt: `${(c.evidence as unknown[]).length} sprzecznych dowodów`,
    })),
  ];

  return {
    proposal,
    preview: proposal,
    rationale: `Analiza danych programu: ${criteriaWithoutEvidence.length} kryteriów bez dowodu, ${outdatedEvidence.length} dowodów starszych niż zakres audytu, ${contradictingEvidence.length} kryteriów ze sprzecznymi dowodami.`,
    confidence: 0.95,
    sources: sources.length
      ? sources
      : [{ type: 'program', id: programId, excerpt: 'Brak wykrytych braków w chwili analizy' }],
  };
}

async function buildProposalForIntent(
  organizationId: string,
  programId: string,
  intent: AiIntent,
  targetId: string | null | undefined,
  context: Record<string, unknown>
): Promise<GeneratedProposal> {
  switch (intent) {
    case 'explain_criterion':
      return buildExplainCriterionProposal(
        organizationId,
        programId,
        requireId(targetId, 'targetId (criterionId)')
      );
    case 'draft_evidence_request':
      return buildEvidenceRequestProposal(
        organizationId,
        programId,
        requireId(targetId, 'targetId (criterionId)')
      );
    case 'draft_finding':
      return buildFindingTextProposal(
        organizationId,
        programId,
        requireId(targetId, 'targetId (criterionId lub findingId)'),
        context
      );
    case 'propose_corrective_options':
      return buildCorrectiveOptionsProposal(
        organizationId,
        programId,
        requireId(targetId, 'targetId (findingId)')
      );
    case 'draft_report_section':
      return buildReportSectionProposal(
        organizationId,
        programId,
        requireId(targetId, 'targetId (reportId)'),
        context
      );
    default:
      throw new AuditDomainError(`Nieobsłużony zamiar Teresy: ${String(intent)}`, 400);
  }
}

// ---------------------------------------------------------------------------
// A. Intent → Preview → Confirmation → Commit → Settle
// ---------------------------------------------------------------------------

export async function createIntent(
  organizationId: string,
  actor: AuditActor,
  input: CreateIntentInput
): Promise<AuditAiProposal> {
  const programId = requireId(input.programId, 'programId');
  if (!isKnownIntent(input.intent)) {
    throw new AuditDomainError(`Nieznany zamiar Teresy: ${String(input.intent)}`, 400);
  }
  const intent = input.intent;
  const expectedTargetType = INTENT_TARGET_TYPE[intent];
  if (input.targetType !== expectedTargetType) {
    throw new AuditDomainError(
      `Zamiar „${intent}" dotyczy typu „${expectedTargetType}", otrzymano „${String(input.targetType)}"`,
      400
    );
  }

  await requireCapability(
    actor,
    programId,
    'ai.propose',
    'Tworzenie propozycji Teresy wymaga uprawnienia ai.propose w tym programie'
  );

  const built = await buildProposalForIntent(
    organizationId,
    programId,
    intent,
    input.targetId ?? null,
    input.context ?? {}
  );

  assertHasSources(built.sources);

  const id = newId('aip');
  await auditRun(
    `INSERT INTO audit_ai_proposals
       (id, program_id, organization_id, target_type, target_id, intent, proposal, preview,
        rationale, confidence, sources, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12)`,
    [
      id,
      programId,
      organizationId,
      input.targetType,
      input.targetId ?? null,
      intent,
      JSON.stringify(built.proposal),
      JSON.stringify(built.preview),
      built.rationale ?? null,
      built.confidence ?? null,
      JSON.stringify(built.sources),
      actor.userId,
    ]
  );

  await recordAuditEvent({
    organizationId,
    programId,
    entityType: 'ai_proposal',
    entityId: id,
    eventType: 'ai_proposal.created',
    actorId: actor.userId,
    summary: `Teresa: nowa propozycja „${intent}"`,
    payload: { targetType: input.targetType, targetId: input.targetId ?? null, intent },
  });

  const row = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_ai_proposals WHERE organization_id=$1 AND id=$2`,
    [organizationId, id]
  );
  return mapProposalRow(row!);
}

/**
 * Zwraca DOKŁADNIE ten fragment (przed/po, pole po polu), który zobaczy/zobaczył
 * człowiek — czytane wprost z zapisanego wiersza, nigdy przeliczane na nowo.
 */
export async function getPreview(
  organizationId: string,
  id: string
): Promise<{
  id: string;
  targetType: string;
  targetId: string | null;
  intent: string;
  preview: Record<string, unknown>;
  proposal: Record<string, unknown>;
  rationale: string | null;
  confidence: number | null;
  sources: Array<Record<string, unknown>>;
  status: string;
}> {
  const row = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_ai_proposals WHERE organization_id=$1 AND id=$2`,
    [organizationId, id]
  );
  if (!row) throw new AuditNotFoundError('Propozycja Teresy');
  return {
    id: String(row.id),
    targetType: String(row.target_type),
    targetId: (row.target_id as string | null) ?? null,
    intent: String(row.intent),
    preview: parseJson(row.preview, {}),
    proposal: parseJson(row.proposal, {}),
    rationale: (row.rationale as string | null) ?? null,
    confidence: toNum(row.confidence),
    sources: parseJson(row.sources, []),
    status: String(row.status),
  };
}

export async function decide(
  organizationId: string,
  actor: AuditActor,
  id: string,
  input: DecideInput
): Promise<AuditAiProposal> {
  const row = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_ai_proposals WHERE organization_id=$1 AND id=$2`,
    [organizationId, id]
  );
  if (!row) throw new AuditNotFoundError('Propozycja Teresy');
  if (row.status !== 'pending') {
    throw new AuditStateError(
      `Propozycja jest już w stanie „${String(row.status)}" — decyzję można podjąć tylko raz`
    );
  }
  const programId = String(row.program_id);
  await requireCapability(
    actor,
    programId,
    'ai.propose',
    'Decyzję o propozycji Teresy może podjąć tylko członek zespołu audytowego z dostępem do Teresy w tym programie'
  );

  const decision =
    input.decision === 'accept' ? 'accepted' : input.decision === 'reject' ? 'rejected' : null;
  if (!decision) {
    throw new AuditDomainError('decision musi być "accept" lub "reject"', 400);
  }

  await auditRun(
    `UPDATE audit_ai_proposals
        SET status=$1, decided_by=$2, decided_at=NOW(), decision_note=$3
      WHERE organization_id=$4 AND id=$5`,
    [decision, actor.userId, input.note ?? null, organizationId, id]
  );

  await recordAuditEvent({
    organizationId,
    programId,
    entityType: 'ai_proposal',
    entityId: id,
    eventType: 'ai_proposal.decided',
    actorId: actor.userId,
    summary: `Teresa: propozycja ${decision === 'accepted' ? 'zaakceptowana' : 'odrzucona'} przez człowieka`,
    payload: { decision, note: input.note ?? null },
  });

  const updated = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_ai_proposals WHERE organization_id=$1 AND id=$2`,
    [organizationId, id]
  );
  return mapProposalRow(updated!);
}

// ---------------------------------------------------------------------------
// Commit — zapis do rekordu docelowego, WYŁĄCZNIE treść robocza
// ---------------------------------------------------------------------------

async function commitExplainCriterion(
  organizationId: string,
  row: Record<string, unknown>,
  proposal: Record<string, unknown>
): Promise<void> {
  const criterionId = String(row.target_id || '');
  if (!criterionId) throw new AuditDomainError('Brak targetId kryterium', 400);
  const explanation = String(proposal.explanation || '');
  const current = await auditGet<Record<string, unknown>>(
    `SELECT auditor_note FROM audit_program_criteria WHERE organization_id=$1 AND id=$2`,
    [organizationId, criterionId]
  );
  if (!current) throw new AuditNotFoundError('Kryterium');
  const existingNote = (current.auditor_note as string | null) ?? null;
  const merged = existingNote
    ? `${existingNote}\n\n[Teresa] ${explanation}`
    : `[Teresa] ${explanation}`;
  await auditRun(
    `UPDATE audit_program_criteria SET auditor_note=$1, updated_at=NOW() WHERE organization_id=$2 AND id=$3`,
    [merged, organizationId, criterionId]
  );
}

async function commitEvidenceRequest(
  organizationId: string,
  programId: string,
  proposal: Record<string, unknown>,
  actor: AuditActor
): Promise<void> {
  const criterionId = String(proposal.criterionId || '');
  const title = String(proposal.title || '').trim();
  if (!criterionId || !title) {
    throw new AuditDomainError('Propozycja evidence request nie ma criterionId/title', 400);
  }
  const id = newId('aer');
  await auditRun(
    `INSERT INTO audit_evidence_requests
       (id, program_id, organization_id, criterion_id, title, description, expected_evidence_kind, requested_by, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open')`,
    [
      id,
      programId,
      organizationId,
      criterionId,
      title,
      (proposal.description as string | null) ?? null,
      (proposal.expectedEvidenceKind as string | null) ?? null,
      actor.userId,
    ]
  );
  await auditRun(
    `UPDATE audit_program_criteria
        SET work_status='evidence_requested', updated_at=NOW()
      WHERE organization_id=$1 AND id=$2 AND work_status='open'`,
    [organizationId, criterionId]
  );
}

async function commitFindingText(
  organizationId: string,
  programId: string,
  row: Record<string, unknown>,
  proposal: Record<string, unknown>,
  actor: AuditActor
): Promise<void> {
  const criterionId = String(proposal.criterionId || '');
  const objectiveEvidence = Array.isArray(proposal.objectiveEvidence)
    ? proposal.objectiveEvidence
    : [];
  const findingId = (proposal.findingId as string | null) ?? null;
  const rationale = (row.rationale as string | null) ?? null;

  if (findingId) {
    const existing = await auditGet<Record<string, unknown>>(
      `SELECT status FROM audit_program_findings WHERE organization_id=$1 AND id=$2`,
      [organizationId, findingId]
    );
    if (!existing) throw new AuditNotFoundError('Ustalenie');
    if (existing.status !== 'draft') {
      throw new AuditStateError(
        'Ustalenie nie jest już w statusie draft — treści nie można nadpisać automatycznie'
      );
    }
    await auditRun(
      `UPDATE audit_program_findings
          SET statement=$1, requirement_text=$2, condition_text=$3, gap_text=$4,
              objective_evidence=$5, ai_proposed=TRUE, ai_rationale=$6, updated_at=NOW()
        WHERE organization_id=$7 AND id=$8`,
      [
        proposal.statement,
        proposal.requirementText,
        proposal.conditionText,
        proposal.gapText,
        JSON.stringify(objectiveEvidence),
        rationale,
        organizationId,
        findingId,
      ]
    );
  } else {
    const id = newId('apf');
    await auditRun(
      `INSERT INTO audit_program_findings
         (id, program_id, organization_id, criterion_id, statement, requirement_text, condition_text,
          gap_text, objective_evidence, classification, status, author_id, ai_proposed, ai_rationale)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'nonconforming','draft',$10,TRUE,$11)`,
      [
        id,
        programId,
        organizationId,
        criterionId,
        proposal.statement,
        proposal.requirementText,
        proposal.conditionText,
        proposal.gapText,
        JSON.stringify(objectiveEvidence),
        actor.userId,
        rationale,
      ]
    );
  }
}

async function commitCorrectiveOptions(
  organizationId: string,
  programId: string,
  proposal: Record<string, unknown>,
  actor: AuditActor
): Promise<void> {
  const findingId = String(proposal.findingId || '');
  if (!findingId) throw new AuditDomainError('Propozycja nie ma findingId', 400);
  const options = Array.isArray(proposal.options) ? proposal.options : [];
  for (const optRaw of options) {
    const opt = optRaw as Record<string, unknown>;
    const id = newId('aca');
    await auditRun(
      `INSERT INTO audit_corrective_actions
         (id, finding_id, program_id, organization_id, action_kind, title, description, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'proposed',$8)`,
      [
        id,
        findingId,
        programId,
        organizationId,
        opt.actionKind,
        opt.title,
        opt.description,
        actor.userId,
      ]
    );
  }
}

async function commitReportSection(
  organizationId: string,
  programId: string,
  proposal: Record<string, unknown>
): Promise<void> {
  const reportId = String(proposal.reportId || '');
  const sectionKey = String(proposal.sectionKey || '');
  if (!reportId || !sectionKey) {
    throw new AuditDomainError('Propozycja nie ma reportId/sectionKey', 400);
  }
  const report = await auditGet<Record<string, unknown>>(
    `SELECT payload, status FROM audit_reports WHERE organization_id=$1 AND program_id=$2 AND id=$3`,
    [organizationId, programId, reportId]
  );
  if (!report) throw new AuditNotFoundError('Raport');
  if (report.status !== 'draft') {
    throw new AuditStateError(
      'Sekcję raportu może zredagować Teresa tylko wtedy, gdy raport jest w statusie draft'
    );
  }
  const payload = parseJson<Record<string, unknown>>(report.payload, {});
  const sections = { ...((payload.sections as Record<string, unknown>) || {}) };
  sections[sectionKey] = {
    title: proposal.sectionTitle ?? sectionKey,
    content: proposal.content,
    aiProposed: true,
  };
  const nextPayload = { ...payload, sections };
  await auditRun(
    `UPDATE audit_reports SET payload=$1, updated_at=NOW() WHERE organization_id=$2 AND id=$3`,
    [JSON.stringify(nextPayload), organizationId, reportId]
  );
}

/**
 * Wykonuje zmianę w kontekście uprawnień CZŁOWIEKA. Trójstopniowa bramka:
 *   1. `ai.commit` — czy ten człowiek w ogóle może wykonywać propozycje Teresy
 *      w tym programie (osobne od `ai.propose` — rozmawiać z Teresą może
 *      niemal każdy członek zespołu, nacisnąć „wykonaj" tylko audytor).
 *   2. `assertAiMayCommit(capability)` — bezwarunkowy hard-stop dla
 *      `AI_NEVER_COMMITS`.
 *   3. `requireCapability(actor, programId, capability)` — czy TEN człowiek ma
 *      konkretną czynność, której dotyczy target.
 */
export async function commit(
  organizationId: string,
  actor: AuditActor,
  id: string
): Promise<AuditAiProposal> {
  const row = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_ai_proposals WHERE organization_id=$1 AND id=$2`,
    [organizationId, id]
  );
  if (!row) throw new AuditNotFoundError('Propozycja Teresy');
  if (row.status !== 'accepted') {
    throw new AuditStateError(
      'Propozycję można wykonać (commit) dopiero po jej zaakceptowaniu przez człowieka (decide)'
    );
  }
  if (row.committed_at) {
    throw new AuditStateError('Ta propozycja została już wykonana');
  }

  const programId = String(row.program_id);
  const intent = String(row.intent) as AiIntent;
  const capability = INTENT_CAPABILITY[intent];
  if (!capability) {
    throw new AuditDomainError(`Nie można wykonać propozycji o nieznanym zamiarze: ${intent}`, 400);
  }

  await requireCapability(
    actor,
    programId,
    'ai.commit',
    'Wykonywanie (commit) propozycji Teresy wymaga uprawnienia ai.commit w tym programie'
  );

  // Granica bezwarunkowa — patrz komentarz modułu i permissions.ts.
  assertAiMayCommit(capability);
  await requireCapability(actor, programId, capability);

  const proposal = parseJson<Record<string, unknown>>(row.proposal, {});

  switch (intent) {
    case 'explain_criterion':
      await commitExplainCriterion(organizationId, row, proposal);
      break;
    case 'draft_evidence_request':
      await commitEvidenceRequest(organizationId, programId, proposal, actor);
      break;
    case 'draft_finding':
      await commitFindingText(organizationId, programId, row, proposal, actor);
      break;
    case 'propose_corrective_options':
      await commitCorrectiveOptions(organizationId, programId, proposal, actor);
      break;
    case 'draft_report_section':
      await commitReportSection(organizationId, programId, proposal);
      break;
    default:
      throw new AuditDomainError(`Nieobsłużony commit dla zamiaru: ${intent}`, 400);
  }

  await auditRun(
    `UPDATE audit_ai_proposals SET committed_at=NOW() WHERE organization_id=$1 AND id=$2`,
    [organizationId, id]
  );

  await recordAuditEvent({
    organizationId,
    programId,
    entityType: 'ai_proposal',
    entityId: id,
    eventType: 'ai_proposal.committed',
    actorId: actor.userId,
    actorRole: 'ai_confirmed_by_human',
    summary: `Teresa: propozycja wykonana (${intent})`,
    payload: { intent, capability },
  });

  const updated = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_ai_proposals WHERE organization_id=$1 AND id=$2`,
    [organizationId, id]
  );
  return mapProposalRow(updated!);
}

/**
 * Domyka: propozycje KONKURENCYJNE dla tego samego targetu (nadal `pending`)
 * przechodzą w `superseded`, żeby nie zostały zaakceptowane po fakcie na
 * nieaktualnych danych. Sama propozycja `id` nie jest ruszana.
 */
export async function settle(organizationId: string, id: string): Promise<AuditAiProposal> {
  const row = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_ai_proposals WHERE organization_id=$1 AND id=$2`,
    [organizationId, id]
  );
  if (!row) throw new AuditNotFoundError('Propozycja Teresy');

  await auditRun(
    `UPDATE audit_ai_proposals
        SET status='superseded'
      WHERE organization_id=$1 AND target_type=$2 AND target_id=$3
        AND id != $4 AND status='pending'`,
    [organizationId, row.target_type, row.target_id, id]
  );

  await recordAuditEvent({
    organizationId,
    programId: row.program_id ? String(row.program_id) : null,
    entityType: 'ai_proposal',
    entityId: id,
    eventType: 'ai_proposal.settled',
    summary: `Teresa: rozstrzygnięto konkurencyjne propozycje dla ${String(row.target_type)}:${String(row.target_id)}`,
    payload: { targetType: row.target_type, targetId: row.target_id },
  });

  const updated = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_ai_proposals WHERE organization_id=$1 AND id=$2`,
    [organizationId, id]
  );
  return mapProposalRow(updated!);
}

// ---------------------------------------------------------------------------
// Odczyt listowy
// ---------------------------------------------------------------------------

export interface ListProposalsFilters {
  programId?: string;
  status?: string;
  targetType?: string;
  targetId?: string;
  limit?: number;
  offset?: number;
}

export async function listProposals(
  organizationId: string,
  filters: ListProposalsFilters
): Promise<AuditAiProposal[]> {
  const clauses = ['organization_id = $1'];
  const params: unknown[] = [organizationId];
  const add = (col: string, value: unknown) => {
    params.push(value);
    clauses.push(`${col} = $${params.length}`);
  };
  if (filters.programId) add('program_id', filters.programId);
  if (filters.status) add('status', filters.status);
  if (filters.targetType) add('target_type', filters.targetType);
  if (filters.targetId) add('target_id', filters.targetId);

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);
  params.push(limit, offset);

  const rows = await auditAll<Record<string, unknown>>(
    `SELECT * FROM audit_ai_proposals
      WHERE ${clauses.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows.map(mapProposalRow);
}

export async function getProposal(organizationId: string, id: string): Promise<AuditAiProposal> {
  const row = await auditGet<Record<string, unknown>>(
    `SELECT * FROM audit_ai_proposals WHERE organization_id=$1 AND id=$2`,
    [organizationId, id]
  );
  if (!row) throw new AuditNotFoundError('Propozycja Teresy');
  return mapProposalRow(row);
}

// Re-eksport dla czytelności wywołań w trasach/testach.
export { AuditPermissionError, AuditStateError, AuditDomainError, AuditNotFoundError };
