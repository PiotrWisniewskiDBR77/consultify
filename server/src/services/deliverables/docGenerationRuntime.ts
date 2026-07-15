/**
 * Deliverables — lekki runtime: GAŁĄŹ DOC (L2, kroki 1+2)
 *
 * Realna treść zamiast rusztowania (decyzje D-L2-1…3, plan §11):
 * - plan  = deterministyczny outline z documentStudio.planDocument (instant),
 *           artefakt = canvas draft (markdown canonical) tworzony od razu —
 *           generationId == draftId, jak deckId w gałęzi deck.
 * - start = materializeDocumentArtifact z **useLlm: true** (uśpiony silnik D11 —
 *           generateBlockProse) w tle; render schema→markdown do draftu.
 * - D-L2-3: generateBlockProse przy KAŻDYM błędzie po cichu wraca do placeholderów
 *           „MVP-1…" — dlatego po renderze jest twarda bramka anty-placeholder:
 *           wykryty placeholder ⇒ uczciwy stan `error`, nigdy wydmuszka u użytkownika.
 *
 * Grounding (D-L2-2): sourceRefs z encji org → DocumentIntake.sourceHints
 * (documentSourcePack), a kontekst rozmowy z czatu dokleja się do description.
 */

import type {
  CreateGenerationResponse,
  GenerationPlanItem,
  GenerationStatusResponse,
} from '../../types/deliverablesGeneration.js';
import logger from '../../utils/Logger.js';
import { isPlaceholderDocumentProse } from '../documentStudio/documentContentGenerator.js';
import { renderSchemaToMarkdown } from '../documentStudio/documentSchemaRenderer.js';
import {
  materializeDocumentArtifact,
  planDocument,
} from '../documentStudio/documentStudioService.js';
import type {
  DocumentIntake,
  DocumentOutline,
  DocumentSourceRef,
} from '../documentStudio/documentStudioTypes.js';
import { registerArtifactOrigin } from '../v8/artifactRegistryService.js';
import {
  createDraft,
  getDraft,
  updateDraft,
  type WorkCanvasDraftRecord,
} from '../workCanvasService.js';
import { trackDeliverableEvent } from './deliverablesTelemetryService.js';
import { DeliverablesGenerationError } from './errors.js';

const LOG_PREFIX = '[DeliverablesGen:doc]';

/** Marker szkieletu — obecny w treści draftu dopóki generacja nie skończy. */
const GENERATION_PENDING_MARKER = 'po zakończeniu generacji';
/** EN równoważnik markera szkieletu (naprawa-r2Narr — skeleton lokalizowany). */
const GENERATION_PENDING_MARKER_EN = 'sections fill in once generation completes';

/** Czy treść draftu to wciąż SZKIELET (PL lub EN)? Używane w fallbacku statusu. */
function isSkeletonContent(content: string): boolean {
  return (
    content.includes(GENERATION_PENDING_MARKER) || content.includes(GENERATION_PENDING_MARKER_EN)
  );
}

/**
 * N-6: twarda dyrektywa języka treści. Sam dobór polskiego/angielskiego
 * systemowego promptu NIE wymusza języka u modelu — przy mieszanym kontekście
 * (angielskie cytaty w faktach, angielskie tytuły sekcji) model dryfuje na EN
 * mimo prośby po polsku. Dopinamy jawne, dosadne zdanie w docelowym języku.
 */
function languageDirective(language: 'pl' | 'en'): string {
  return language === 'en'
    ? 'CRITICAL: Write ALL content in English, regardless of the language of any context, facts, or section titles provided. Every sentence must be in English.'
    : 'BEZWZGLĘDNIE WAŻNE: Całą treść pisz po POLSKU, niezależnie od języka kontekstu, faktów czy tytułów sekcji. Każde zdanie musi być po polsku.';
}

/**
 * N-9: dyrektywa tabel. Deterministyczny planer (documentNarrativePlanner)
 * tworzy tylko nieliczne sekcje tabelaryczne (risk_table), reszta to proza —
 * więc model nigdy nie dostaje tabeli tam, gdzie sekcja jest z natury
 * zestawieniem (scenariusze + koszty/ROI, KPI, roadmapa, porównania dostawców,
 * kamienie milowe). Dopinamy jawną instrukcję, że treść takich sekcji MA
 * zawierać poprawną tabelę Markdown GFM (nagłówek + wiersz separatora |---|).
 * `reinforced` = intencja użytkownika wprost prosi o tabele/zestawienie.
 */
function tableDirective(language: 'pl' | 'en', reinforced: boolean): string {
  const base =
    language === 'en'
      ? 'TABLES: When a section is inherently tabular — scenario comparisons with costs/ROI, risk maps/matrices, quarterly roadmaps or schedules, KPI summaries, vendor/option comparisons, milestones — the content MUST include a valid GFM Markdown table (a header row "| col | col |", a separator row "|---|---|", then data rows). Use prose AND a table where it adds clarity; do not force tables where prose is enough. Never wrap tables in code fences.'
      : 'TABELE: Gdy sekcja jest z natury tabelaryczna — porównania scenariuszy z kosztami/ROI, mapy/macierze ryzyk, roadmapy lub harmonogramy kwartalne, zestawienia KPI, porównania dostawców/opcji, kamienie milowe — treść MUSI zawierać poprawną tabelę Markdown GFM (wiersz nagłówków "| kol | kol |", wiersz separatora "|---|---|", potem wiersze danych). Stosuj prozę ORAZ tabelę tam, gdzie zwiększa to czytelność; nie wymuszaj tabel tam, gdzie wystarczy proza. Nigdy nie owijaj tabel w bloki kodu.';
  if (!reinforced) return base;
  const reinforcement =
    language === 'en'
      ? 'The user explicitly asked for tables/comparisons — render every quantitative or comparative breakdown as a GFM Markdown table, not prose.'
      : 'Użytkownik wprost poprosił o tabele/zestawienia — każde zestawienie liczbowe lub porównawcze przedstaw jako tabelę Markdown GFM, nie prozą.';
  return `${base} ${reinforcement}`;
}

/** N-9: czy intencja/kontekst użytkownika wprost prosi o tabele/zestawienia? */
const TABLE_INTENT_RE =
  /\btabel|\btable\b|zestawieni|por[óo]wnani|comparison|compare|macierz|matrix|scenariusz|scenario|roadmap|mapa drogow|harmonogram|schedule|kamieni(?:e|ach|ami)? milow|milestone/i;

function intentWantsTables(intent: string, conversationContext?: string): boolean {
  return TABLE_INTENT_RE.test(`${intent}\n${conversationContext || ''}`);
}

/**
 * N-10: deterministyczny planer (documentNarrativePlanner) zwraca tytuły sekcji
 * twardo po angielsku (taksonomia typów) — przy polskim raporcie nagłówki są EN
 * mimo polskiej treści. Lokalizujemy je na granicy deliverables-light (nie w
 * samym planerze: tytuły EN są kluczem dyspozytora bloków w buildSectionBlocks
 * — risk_table, listy „Next Steps" itd. — oraz bramek QA Document Studio).
 * Dlatego EN-owy outline płynie do materializeDocumentArtifact bez zmian, a tu
 * mapujemy nagłówki w finalnym markdownie / planie / szkielecie do języka usera.
 */
const SECTION_TITLE_PL: Record<string, string> = {
  'AI Opportunities': 'Możliwości AI',
  'Adoption KPIs': 'KPI adopcji',
  Appendix: 'Załącznik',
  Assumptions: 'Założenia',
  'Audit Scope': 'Zakres audytu',
  'Benefits Methodology': 'Metodyka korzyści',
  'Benefits Snapshot': 'Migawka korzyści',
  'Benefits and KPIs': 'Korzyści i KPI',
  Capabilities: 'Zdolności',
  'Client Context': 'Kontekst klienta',
  'Communication Plan': 'Plan komunikacji',
  Compliance: 'Zgodność',
  Context: 'Kontekst',
  Controls: 'Mechanizmy kontroli',
  'Current State': 'Stan obecny',
  'Decision in One Sentence': 'Decyzja w jednym zdaniu',
  Decisions: 'Decyzje',
  'Decisions Required': 'Wymagane decyzje',
  Definitions: 'Definicje',
  Dependencies: 'Zależności',
  'Discovery Scope': 'Zakres rozpoznania',
  'Economic Analysis': 'Analiza ekonomiczna',
  Escalations: 'Eskalacje',
  Exceptions: 'Wyjątki',
  'Executive Summary': 'Streszczenie wykonawcze',
  'Financial Snapshot': 'Migawka finansowa',
  Findings: 'Ustalenia',
  'For Information': 'Do wiadomości',
  Governance: 'Ład (Governance)',
  Hypotheses: 'Hipotezy',
  'Implementation Outline': 'Zarys wdrożenia',
  'Implementation Roadmap': 'Roadmapa wdrożenia',
  Implications: 'Implikacje',
  'Initiatives Progress': 'Postęp inicjatyw',
  'Initiatives by Wave': 'Inicjatywy wg fal',
  'Inputs and Outputs': 'Wejścia i wyjścia',
  'Interview Coverage': 'Zakres wywiadów',
  Investment: 'Inwestycja',
  'KPI Evidence': 'Dowody KPI',
  KPIs: 'KPI',
  'Key Organizational Findings': 'Kluczowe ustalenia organizacyjne',
  'Key Results': 'Kluczowe wyniki',
  'Main Pain Points': 'Główne problemy',
  Method: 'Metoda',
  Methodology: 'Metodyka',
  Milestones: 'Kamienie milowe',
  'Mitigation Plans': 'Plany mitygacji',
  'Next Review': 'Następny przegląd',
  'Next Steps': 'Następne kroki',
  'Open Questions': 'Pytania otwarte',
  'Operational Snapshot': 'Migawka operacyjna',
  Opportunities: 'Możliwości',
  Options: 'Opcje',
  Owners: 'Właściciele',
  'Period and Scope': 'Okres i zakres',
  'Plan Approach': 'Podejście do planu',
  'Policy Statements': 'Zapisy polityki',
  'Portfolio Health': 'Kondycja portfela',
  'Portfolio Status': 'Status portfela',
  Prioritization: 'Priorytetyzacja',
  'Problem Statement': 'Sformułowanie problemu',
  'Process Steps': 'Kroki procesu',
  'Project Context': 'Kontekst projektu',
  'Proposed Approach': 'Proponowane podejście',
  'Proposed Initiative': 'Proponowana inicjatywa',
  Purpose: 'Cel',
  'RAG Heatmap': 'Mapa cieplna RAG',
  Recommendation: 'Rekomendacja',
  Recommendations: 'Rekomendacje',
  'Recommended Actions': 'Rekomendowane działania',
  'Recommended Adjustments': 'Rekomendowane korekty',
  'Recommended Initiatives': 'Rekomendowane inicjatywy',
  'Recommended Option': 'Rekomendowana opcja',
  'Research Question': 'Pytanie badawcze',
  'Revision History': 'Historia zmian',
  'Risk Methodology': 'Metodyka ryzyka',
  'Risk Register Table': 'Tabela rejestru ryzyk',
  Risks: 'Ryzyka',
  'Risks and Consequences': 'Ryzyka i konsekwencje',
  'Risks and Constraints': 'Ryzyka i ograniczenia',
  'Risks and Dependencies': 'Ryzyka i zależności',
  'Risks and Issues': 'Ryzyka i problemy',
  'Roadmap Waves': 'Fale roadmapy',
  Roles: 'Role',
  'Root Causes': 'Przyczyny źródłowe',
  Scope: 'Zakres',
  'Scope and Approach': 'Zakres i podejście',
  'Scope and Methodology': 'Zakres i metodyka',
  Sources: 'Źródła',
  'Stakeholder Analysis': 'Analiza interesariuszy',
  'Status Overview': 'Przegląd statusu',
  'Strategic Context': 'Kontekst strategiczny',
  'Strategic Fit': 'Dopasowanie strategiczne',
  'Strategic Themes': 'Tematy strategiczne',
  'Target Overview': 'Przegląd celu',
  'Target State': 'Stan docelowy',
  'Team and Credentials': 'Zespół i referencje',
  Themes: 'Tematy',
  Timeline: 'Harmonogram',
  'Top Risks Detail': 'Szczegóły kluczowych ryzyk',
  'Top Risks and Decisions': 'Kluczowe ryzyka i decyzje',
  'Training Plan': 'Plan szkoleń',
  Variances: 'Odchylenia',
  Waves: 'Fale',
  'Workshop Context': 'Kontekst warsztatu',
};

/**
 * N-9: marked (canvasMarkdownConversion) parsuje tabele GFM tylko jako osobny
 * blok — tabela wprost po zdaniu (bez pustej linii) NIE jest rozpoznana jako
 * tabela i ląduje jako proza z surowymi „|". Tu wstawiamy pustą linię przed
 * pierwszym wierszem tabeli, jeśli poprzedza go niepusty, nie-tabelowy wiersz.
 * Nie ruszamy treści tabel — tylko odstęp, więc separatory/„|" przechodzą.
 */
/**
 * N-9 + N-canvas-append: gwarantuje, że marked/turndown widzą każdy blok na
 * własnej linii z pustą linią oddzielającą.
 *  - tabela GFM: pusta linia przed pierwszym wierszem (oryginalny N-9),
 *  - nagłówek ATX (#..######): pusta linia PRZED i PO,
 *  - lista (-, *, +, 1.): pusta linia przed blokiem listy po linii nie-listowej,
 *  - opener bloku sklejony w środku linii ("…rynku. ## Bariery 1. **Koszt**")
 *    rozbijany na osobne bloki — inaczej marked renderuje surowy `##`/`1.`.
 * Idempotentny i bezpieczny dla generacji nowego dokumentu (nie psuje formatu),
 * stosowany TAKŻE na ścieżce scalania/edycji (nie tylko one-shot generacji).
 */
function ensureTableSpacing(markdown: string): string {
  if (!markdown) return markdown;
  // 1) Rozbij opener bloku sklejony na końcu poprzedniej linii.
  const pre = markdown
    .replace(/(\S)[ \t]+(#{1,6}[ \t]+\S)/g, '$1\n\n$2') // nagłówek mid-line
    .replace(/(\S)[ \t]+(\d+\.[ \t]+\S)/g, '$1\n\n$2') // lista numerowana mid-line
    .replace(/(\S)[ \t]+([-*+][ \t]+\S)/g, '$1\n\n$2'); // lista punktowana mid-line

  const rows = pre.split('\n');
  const out: string[] = [];
  const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isHeading = (l: string) => /^\s*#{1,6}\s+\S/.test(l);
  const isListItem = (l: string) => /^\s*([-*+]|\d+\.)\s+\S/.test(l);
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i];
    const prev = out.length ? out[out.length - 1] : '';
    const prevTrim = prev.trim();
    const needsGapBefore =
      prevTrim !== '' &&
      ((isTableRow(line) && !isTableRow(prev)) ||
        (isHeading(line) && !isHeading(prev)) ||
        ((isListItem(line) || isTableRow(line)) && !isListItem(prev) && !isTableRow(prev)));
    if (needsGapBefore) out.push('');
    out.push(line);
    // Pusta linia PO nagłówku, jeśli następna linia nie jest pusta.
    if (isHeading(line)) {
      const next = rows[i + 1];
      if (next !== undefined && next.trim() !== '') out.push('');
    }
  }
  return out.join('\n');
}

/** N-10: tytuł sekcji w języku usera (PL ⇒ mapa, brak wpisu ⇒ EN bez zmian). */
function localizeSectionTitle(title: string, language: 'pl' | 'en'): string {
  if (language !== 'pl') return title;
  return SECTION_TITLE_PL[title.trim()] || title;
}

/**
 * N-10: lokalizacja outline'u na potrzeby tego, co WIDZI użytkownik (plan +
 * szkielet draftu). Outline przekazywany do materializeDocumentArtifact musi
 * zachować tytuły EN (dyspozytor bloków), dlatego ta funkcja tworzy kopię tylko
 * z przetłumaczonymi tytułami sekcji.
 */
function localizeOutlineTitles(outline: DocumentOutline, language: 'pl' | 'en'): DocumentOutline {
  if (language !== 'pl') return outline;
  return {
    ...outline,
    sections: outline.sections.map((s) => ({
      ...s,
      title: localizeSectionTitle(s.title, language),
    })),
  };
}

/**
 * N-10: zamiana nagłówków sekcji (## Tytuł / ### Tytuł) w gotowym markdownie na
 * język usera. Działa na outpucie renderera schematu (ścieżka one-shot), gdzie
 * tytuły EN były kluczem dyspozytora — po renderze możemy je bezpiecznie
 * zlokalizować bez wpływu na strukturę/bloki.
 */
function localizeMarkdownHeadings(markdown: string, language: 'pl' | 'en'): string {
  if (language !== 'pl') return markdown;
  return markdown.replace(/^(#{2,3})\s+(.+?)\s*$/gm, (full, hashes: string, title: string) => {
    const localized = SECTION_TITLE_PL[title.trim()];
    return localized ? `${hashes} ${localized}` : full;
  });
}

interface DocRuntimeEntry {
  state: 'plan_ready' | 'generating' | 'validating' | 'draft' | 'error';
  error?: string;
  warnings: string[];
  sectionCount?: number;
  documentArtifactId?: string;
}

const docRuntimeState = new Map<string, DocRuntimeEntry & { updatedAtMs?: number }>();

// P2-1 (audyt): mapa nie może rosnąć do restartu — wpisy starsze niż TTL są
// zbędne (SSOT stanu po czasie = treść draftu; statusDoc ma fallback z DB).
const RUNTIME_ENTRY_TTL_MS = 6 * 60 * 60 * 1000;

function setDocRuntime(id: string, entry: DocRuntimeEntry): void {
  docRuntimeState.set(id, { ...entry, updatedAtMs: Date.now() });
  if (docRuntimeState.size % 50 === 0) {
    const cutoff = Date.now() - RUNTIME_ENTRY_TTL_MS;
    for (const [key, value] of docRuntimeState) {
      if ((value.updatedAtMs || 0) < cutoff) docRuntimeState.delete(key);
    }
  }
}

/** Setup kontraktu dla format='doc' (przychodzi z czatu / encji). */
export interface DocGenerationSetup {
  /** Intencja użytkownika — jedyne wymagane pole (wejście = rozmowa, D-L2-1). */
  intent: string;
  language?: 'pl' | 'en';
  title?: string;
  /** Wycinek rozmowy z Teresą — grounding trybu (b) z D-L2-2. */
  conversationContext?: string;
  /** Encje org (notatki/idee/inicjatywy/…) — grounding trybu (a) z D-L2-2. */
  sourceRefs?: DocumentSourceRef[];
  /** Id rozmowy czatu — canvas draft jest do niej przypięty. */
  conversationId?: string;
  audience?: string[];
}

function parseSetup(setup: Record<string, unknown>): DocGenerationSetup {
  const intent = typeof setup.intent === 'string' ? setup.intent.trim() : '';
  if (!intent) {
    throw new DeliverablesGenerationError(
      'invalid_setup',
      `setup dla 'doc' wymaga pola intent (treść prośby użytkownika)`
    );
  }
  const conversationId =
    typeof setup.conversationId === 'string' && setup.conversationId.trim()
      ? setup.conversationId.trim()
      : undefined;
  // P2-4 (audyt): draft bez prawdziwej rozmowy = sierota z conversationId='chat'.
  // Frontend zawsze bootstrapuje rozmowę przed wywołaniem — brak = błąd wołającego.
  if (!conversationId) {
    throw new DeliverablesGenerationError(
      'invalid_setup',
      `setup wymaga conversationId — artefakt musi być przypięty do rozmowy`
    );
  }
  return {
    intent,
    language: setup.language === 'en' ? 'en' : 'pl',
    title: typeof setup.title === 'string' && setup.title.trim() ? setup.title.trim() : undefined,
    conversationContext:
      typeof setup.conversationContext === 'string' ? setup.conversationContext : undefined,
    sourceRefs: Array.isArray(setup.sourceRefs)
      ? (setup.sourceRefs as DocumentSourceRef[])
      : undefined,
    conversationId,
    audience: Array.isArray(setup.audience) ? (setup.audience as string[]) : undefined,
  };
}

/**
 * P2-3 (audyt): nieudana generacja nie zostawia anonimowej sieroty na liście draftów.
 *
 * naprawa-r2Narr · Problem 2 — DODATKOWO nadpisujemy TREŚĆ draftu uczciwym stanem
 * błędu. Wcześniej po cichej porażce fill'a w draftcie zostawał SZKIELET: nagłówki
 * + `*Substantive section "X" relevant to the document goal.*` (purpose sekcji jako
 * kursywa) + stopka „Teresa pisze treść…". Użytkownik po 45 s widział placeholdery
 * UDAJĄCE treść (bug sędziego BCG). Teraz zamiast szkieletu draft niesie jawny
 * komunikat błędu + krótki powód — nigdy wydmuszka podszywająca się pod treść.
 */
function failureContentMarkdown(
  title: string,
  reason: string | undefined,
  language: 'pl' | 'en'
): string {
  const safeReason = String(reason || '')
    .trim()
    .slice(0, 300);
  if (language === 'en') {
    return [
      `# ${title}`,
      '',
      '> **Generation failed.** The document was not filled with content.',
      '',
      safeReason ? `Reason: ${safeReason}` : 'The AI content engine was unavailable.',
      '',
      'Please try generating again. If it keeps failing, contact support.',
    ].join('\n');
  }
  return [
    `# ${title}`,
    '',
    '> **Generacja nie powiodła się.** Dokument nie został wypełniony treścią.',
    '',
    safeReason ? `Powód: ${safeReason}` : 'Silnik treści AI był niedostępny.',
    '',
    'Spróbuj wygenerować ponownie. Jeśli błąd się powtarza — zgłoś do wsparcia.',
  ].join('\n');
}

function markDraftFailedBestEffort(
  organizationId: string,
  draftId: string,
  title: string,
  opts?: { reason?: string; language?: 'pl' | 'en' }
): void {
  const suffix = ' — generacja nieudana';
  const newTitle = title.endsWith(suffix)
    ? title
    : `${title.slice(0, 200 - suffix.length)}${suffix}`;
  // Nadpisz TREŚĆ uczciwym stanem błędu (usuwa szkielet z placeholderami-purpose),
  // a przy okazji oznacz tytuł sieroty. Best-effort — stan `error` w runtime i tak
  // niesie komunikat dla poll'a statusu.
  const cleanTitle = title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
  void updateDraft({
    organizationId,
    draftId,
    patch: {
      title: newTitle,
      content: failureContentMarkdown(cleanTitle, opts?.reason, opts?.language ?? 'pl'),
    },
  }).catch(() => {
    /* best-effort — stan error i tak niesie komunikat */
  });
}

/**
 * B2 (plan wykonawczy): grounding trybu source_refs — fakty z encji org
 * (ContextPack) wstrzykiwane do promptu generatora. Best-effort: brak
 * ekstraktora dla typu encji ⇒ pomijamy z warningiem, generacja biegnie dalej
 * na trybie rozmowy (spec §4: dokument nigdy nie jest pusty przez braki źródeł).
 */
async function buildGroundingFacts(
  organizationId: string,
  sourceRefs: DocumentSourceRef[] | undefined,
  language: 'pl' | 'en'
): Promise<string | null> {
  if (!sourceRefs?.length) return null;
  try {
    const { buildContextPack } = await import('../contextPackBuilder.js');
    const pack = await buildContextPack(
      organizationId,
      sourceRefs.map((ref) => ({
        artifact_id: ref.sourceId,
        artifact_type: ref.sourceType,
        artifact_name: ref.sourceTitle || ref.sourceId,
      })),
      language
    );
    const keyPoints = (pack.key_points || []).slice(0, 20);
    const dataPoints = (pack.data_points || [])
      .slice(0, 20)
      .map((d) => `${d.label}: ${d.value}${d.unit ? ` ${d.unit}` : ''}`);
    const lines = [...keyPoints, ...dataPoints].map((l) => String(l).trim()).filter(Boolean);
    if (lines.length === 0) return null;
    const header =
      language === 'en'
        ? 'Facts from organization sources (treat as the factual basis; do not contradict them):'
        : 'Fakty ze źródeł organizacji (traktuj jako podstawę faktograficzną; nie zaprzeczaj im):';
    return `${header}\n- ${lines.join('\n- ')}`.slice(0, 4000);
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} grounding facts unavailable (continuing conversation-grounded): ${err instanceof Error ? err.message : err}`
    );
    return null;
  }
}

function buildIntake(parsed: DocGenerationSetup): DocumentIntake {
  const description = parsed.conversationContext
    ? `${parsed.intent}\n\nKontekst rozmowy:\n${parsed.conversationContext.slice(0, 4000)}`
    : parsed.intent;
  return {
    title: parsed.title,
    description,
    language: parsed.language,
    audience: parsed.audience,
    sourceHints: parsed.sourceRefs,
  };
}

/**
 * C7 — initiative linkage z sourceRefs groundingu (D-L2-2a): jeśli encje org
 * przekazane z czatu zawierają ref inicjatywy, artefakt rejestruje się w
 * kanonicznym rejestrze z sourceInitiativeId (sekcja „Artefakty" w widoku
 * inicjatywy czyta to przez GET /api/artifacts?sourceInitiativeId=…).
 */
function extractInitiativeIdFromSourceRefs(refs?: DocumentSourceRef[]): string | null {
  for (const ref of refs || []) {
    if (!ref || typeof ref !== 'object') continue;
    if (String(ref.sourceType || '').toLowerCase() !== 'initiative') continue;
    if (typeof ref.sourceId === 'string' && ref.sourceId.trim()) return ref.sourceId.trim();
  }
  return null;
}

/**
 * C7 — best-effort rejestracja gotowego dokumentu w kanonicznym rejestrze
 * Outputs (ta sama konwencja co G5 w document-studio.routes.ts: dokumenty =
 * outputType 'report' + family 'document' + runtime 'native_artifact').
 * Gałąź doc omija router DocumentStudio (woła materializeDocumentArtifact
 * bezpośrednio), więc bez tego kroku chatowe dokumenty nie istnieją w
 * rejestrze. Błąd rejestru NIGDY nie psuje generacji — log + kontynuacja.
 */
async function registerDocArtifactBestEffort(params: {
  organizationId: string;
  userId: string;
  documentArtifactId: string;
  title: string;
  generationDraftId: string;
  sourceRefs?: DocumentSourceRef[];
}): Promise<void> {
  try {
    await registerArtifactOrigin({
      organizationId: params.organizationId,
      outputType: 'report',
      artifactFamily: 'document',
      originRuntime: 'native_artifact',
      originRecordId: params.documentArtifactId,
      titleSnapshot: params.title,
      ownerUserId: params.userId,
      createdBy: params.userId,
      sourceInitiativeId: extractInitiativeIdFromSourceRefs(params.sourceRefs),
      originSummary: {
        sourceType: 'deliverables_doc_generation',
        generationId: params.generationDraftId,
        sourceTable: 'document_studio_artifacts',
      },
    });
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} outputs registration failed (document still saved): generation=${params.generationDraftId} — ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * B4 (plan wykonawczy): auto-skan organizacji, gdy użytkownik nie wskazał źródeł.
 * Reuse narzędzi retrieval Teresy (insighty + notatki; flaga ENABLE_TERESA_RETRIEVAL
 * — wyłączona ⇒ puste wyniki, generacja biegnie trybem rozmowy). Snippety hitów
 * stają się faktami groundingu (ContextPack nie ma jeszcze ekstraktorów tych encji).
 */
async function autoScanOrgSources(
  organizationId: string,
  intent: string,
  language: 'pl' | 'en'
): Promise<{ refs: DocumentSourceRef[]; facts: string | null }> {
  try {
    const [{ searchInsights }, { searchOrgNotes }] = await Promise.all([
      import('../ai/tools/searchInsights.js'),
      import('../ai/tools/searchOrgNotes.js'),
    ]);
    const [insights, notes] = await Promise.all([
      searchInsights({ query: intent, limit: 3 }, { organizationId }),
      searchOrgNotes({ query: intent, limit: 3 }, { organizationId }),
    ]);
    const hits = [
      ...insights.results.map((h) => ({
        type: 'insight',
        id: h.id,
        title: h.title,
        snippet: h.snippet,
      })),
      ...notes.results.map((h) => ({
        type: 'note',
        id: h.pageId,
        title: h.title,
        snippet: h.snippet,
      })),
    ].slice(0, 6);
    if (hits.length === 0) return { refs: [], facts: null };
    const refs: DocumentSourceRef[] = hits.map((h) => ({
      sourceType: h.type,
      sourceId: h.id,
      sourceTitle: h.title,
    }));
    const header =
      language === 'en'
        ? 'Facts from organization sources found for this request (factual basis):'
        : 'Fakty ze źródeł organizacji znalezionych dla tej prośby (podstawa faktograficzna):';
    const lines = hits
      .map((h) => `${h.title}: ${String(h.snippet || '').trim()}`)
      .filter((l) => l.length > 5);
    const facts = lines.length ? `${header}\n- ${lines.join('\n- ')}`.slice(0, 4000) : null;
    return { refs, facts };
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} auto-scan unavailable (continuing conversation-grounded): ${err instanceof Error ? err.message : err}`
    );
    return { refs: [], facts: null };
  }
}

function outlineToPlanItems(outline: DocumentOutline): GenerationPlanItem[] {
  return outline.sections.map((section, index) => ({
    key: `${index}:${section.title}`,
    title: section.title,
    enabled: true,
    hint: section.purpose,
  }));
}

function applyPlanToOutline(outline: DocumentOutline, plan: GenerationPlanItem[]): DocumentOutline {
  // N-10: plan items wracają z FE z tytułami zlokalizowanymi (PL), więc klucz
  // `${index}:${title}` nie zrówna się z EN-owym outline. Dopasowujemy po
  // prefiksie indeksu (stabilny), żeby enable/disable + rename z planu działały.
  const byIndex = new Map(plan.map((p) => [String(p.key).split(':', 1)[0], p]));
  const sections = outline.sections
    .map((section, index) => {
      const edit = byIndex.get(String(index));
      if (!edit) return section;
      if (!edit.enabled) return null;
      // Tytuł z planu (zlokalizowany lub przemianowany) wygrywa tylko gdy różny
      // od domyślnego zlokalizowanego — inaczej zostaje EN (klucz dyspozytora).
      const defaultLocalized = localizeSectionTitle(section.title, 'pl');
      const fromPlan = edit.title?.trim();
      const renamed = fromPlan && fromPlan !== defaultLocalized && fromPlan !== section.title;
      return renamed ? { ...section, title: fromPlan } : section;
    })
    .filter((s): s is DocumentOutline['sections'][number] => s !== null);
  return { ...outline, sections: sections.length > 0 ? sections : outline.sections };
}

function outlineSkeletonMarkdown(
  title: string,
  outline: DocumentOutline,
  language: 'pl' | 'en' = 'pl'
): string {
  // naprawa-r2Narr · Problem 2 — the skeleton previously rendered each section's
  // outline `purpose` as `*…*` body. For un-hinted sections that is literally
  // `*Substantive section "X" relevant to the document goal.*` — a scaffolding
  // hint that READS like real prose. If the fill was slow or failed, the user saw
  // it as content. The skeleton now emits a NEUTRAL, explicitly-pending line per
  // section (never the raw purpose), so nothing masquerades as finished content.
  const pending = language === 'en' ? '_Writing this section…_' : '_Trwa pisanie tej sekcji…_';
  const footer =
    language === 'en'
      ? '> Teresa is writing — sections fill in once generation completes.'
      : '> Teresa pisze treść — sekcje wypełnią się po zakończeniu generacji.';
  const lines = [`# ${title}`, ''];
  for (const section of outline.sections) {
    lines.push(`## ${section.title}`, '', pending, '');
  }
  lines.push('', footer);
  return lines.join('\n');
}

// ── Gałąź SHEET (L3) ────────────────────────────────────────────────────────
// Doktryna §2.1: Sheet = jeden blok `table` na całą powierzchnię. Artefakt to
// canvas draft kind='table' (markdown canonical, tabela GFM) — dzięki temu za
// darmo dostaje istniejący edytor, eksport XLSX/CSV i bridge „Send to Table
// Studio". Status/poll współdzielony ze ścieżką doc (format po kind draftu).

function sheetSkeletonMarkdown(title: string): string {
  return [
    `# ${title}`,
    '',
    `> Teresa buduje tabelę — struktura i dane pojawią się po zakończeniu generacji.`,
  ].join('\n');
}

/**
 * W4/B4 (premium): renderuje TYPOWANY schemat B4 (fields + seedRows) do tej
 * samej tabeli GFM, którą produkuje ścieżka legacy (kontrakt treści draftu bez
 * zmian). Materializuje JEDEN arkusz — przy multi-sheet bierze arkusz #0, by
 * widok draftu pozostał pojedynczą tabelą jak dziś (pełna wierność wieloarkusza
 * trafia do eksportu xlsx). Czysta funkcja, brak I/O — bezpieczna do testów.
 */
function premiumSchemaToGfmMarkdown(
  schema: {
    fields: Array<{ key: string; header: string }>;
    seedRows: Array<Record<string, unknown>>;
    sheets?: Array<{
      fields: Array<{ key: string; header: string }>;
      seedRows: Array<Record<string, unknown>>;
    }>;
  },
  title: string
): string | null {
  const sheet = schema.sheets?.[0] ?? { fields: schema.fields, seedRows: schema.seedRows };
  const fields = Array.isArray(sheet.fields) ? sheet.fields : [];
  if (fields.length === 0) return null;
  const esc = (v: unknown): string =>
    String(v ?? '')
      .replace(/\|/g, '\\|')
      .replace(/\n/g, ' ')
      .trim();
  const headerLine = `| ${fields.map((f) => esc(f.header || f.key)).join(' | ')} |`;
  const separator = `| ${fields.map(() => '---').join(' | ')} |`;
  const rows = (Array.isArray(sheet.seedRows) ? sheet.seedRows : []).map(
    (row) => `| ${fields.map((f) => esc(row[f.key])).join(' | ')} |`
  );
  if (rows.length === 0) return null;
  return [`# ${title}`, '', headerLine, separator, ...rows].join('\n');
}

/** Walidacja: wynik MUSI zawierać tabelę GFM (nagłówek + separator + ≥1 wiersz). */
function extractGfmTable(markdown: string): {
  ok: boolean;
  rowCount: number;
  /** Cleaned table markdown (title line + table) salvaged from possibly-verbose output. */
  table?: string;
} {
  const rawLines = markdown.split('\n');
  const lines = rawLines.map((l) => l.trim());
  const separatorIdx = lines.findIndex(
    (l) => /^\|?[\s:|-]*-{3,}[\s|:-]*\|?$/.test(l) && l.includes('-') && l.includes('|')
  );
  if (separatorIdx < 1) return { ok: false, rowCount: 0 };
  const header = lines[separatorIdx - 1];
  if (!header.includes('|')) return { ok: false, rowCount: 0 };
  // BUG D: tolerate borderless GFM (rows that merely CONTAIN a pipe rather than start with one)
  // and stop at the first non-table line so trailing prose from a rich prompt doesn't break us.
  const dataLines: string[] = [];
  for (let i = separatorIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.includes('|')) {
      dataLines.push(l);
    } else if (l === '') {
      // blank line ends the table body
      break;
    } else {
      // prose after the table — stop collecting
      break;
    }
  }
  if (dataLines.length < 1) return { ok: false, rowCount: 0 };
  // Rebuild a clean table block (header + separator + rows) so downstream storage never
  // carries the model's surrounding chatter.
  const cleanTable = [header, lines[separatorIdx], ...dataLines].join('\n');
  return { ok: true, rowCount: dataLines.length, table: cleanTable };
}

export async function planSheet(params: {
  setup: Record<string, unknown>;
  organizationId: string;
  userId: string;
}): Promise<CreateGenerationResponse> {
  const parsed = parseSetup(params.setup);
  const title = parsed.title || (parsed.language === 'en' ? 'Sheet from chat' : 'Arkusz z czatu');

  // B4: brak wskazanych źródeł ⇒ auto-skan org (jak w planDoc).
  const auto = parsed.sourceRefs?.length
    ? { refs: [] as DocumentSourceRef[], facts: null as string | null }
    : await autoScanOrgSources(
        params.organizationId,
        parsed.intent,
        parsed.language === 'en' ? 'en' : 'pl'
      );

  const draft = await createDraft({
    organizationId: params.organizationId,
    actorUserId: params.userId,
    input: {
      conversationId: parsed.conversationId!,
      kind: 'table',
      title,
      content: sheetSkeletonMarkdown(title),
      sources: parsed.sourceRefs?.length ? parsed.sourceRefs : auto.refs,
      provenance: {
        deliverablesGeneration: {
          sheetSetup: { ...parsed, title },
          autoGrounding: auto.refs.length ? { refs: auto.refs, facts: auto.facts } : undefined,
        },
      },
    },
  });

  setDocRuntime(draft.id, { state: 'plan_ready', warnings: [] });
  void trackDeliverableEvent({
    organizationId: params.organizationId,
    userId: params.userId,
    generationId: draft.id,
    format: 'sheet',
    event: 'plan_ready',
    language: parsed.language,
    groundingMode: parsed.sourceRefs?.length
      ? 'source_refs'
      : auto.refs.length
        ? 'auto_scan'
        : 'conversation',
  });
  logger.info(
    `${LOG_PREFIX} sheet plan ready: generation=${draft.id} autoSources=${auto.refs.length}`
  );
  const usedSheetRefs = parsed.sourceRefs?.length ? parsed.sourceRefs : auto.refs;
  return {
    generationId: draft.id,
    format: 'sheet',
    state: 'plan_ready',
    sources: usedSheetRefs.map((r) => ({
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      sourceTitle: r.sourceTitle,
    })),
    plan: [
      {
        key: '0:sheet',
        title,
        enabled: true,
        hint:
          parsed.language === 'en'
            ? 'Columns and rows generated by Teresa from your request'
            : 'Kolumny i wiersze wygeneruje Teresa z Twojej prośby',
      },
    ],
    warnings: [],
  };
}

export async function startSheet(params: {
  generationId: string;
  setup: Record<string, unknown>;
  organizationId: string;
  userId: string;
}): Promise<GenerationStatusResponse> {
  const draft = await getDocDraft(params.generationId, params.organizationId);
  if (docRuntimeState.get(draft.id)?.state === 'generating') {
    throw new DeliverablesGenerationError(
      'invalid_state',
      `Generacja ${draft.id} już trwa — odpytuj status zamiast startować ponownie`
    );
  }
  const provenance = (draft.provenance || {}) as Record<string, any>;
  const stored = provenance.deliverablesGeneration?.sheetSetup as DocGenerationSetup | undefined;
  if (!stored?.intent) {
    throw new DeliverablesGenerationError(
      'invalid_state',
      `Generacja ${draft.id} nie ma zapisanego setupu — uruchom najpierw krok PLAN`
    );
  }

  setDocRuntime(draft.id, { state: 'generating', warnings: [] });
  const generationStartedAt = Date.now();

  void (async () => {
    try {
      const pl = stored.language !== 'en';
      const sheetLang = pl ? ('pl' as const) : ('en' as const);
      // §0.3-style kwantyfikacja dla arkusza (parytet z docGenerationRuntime §0.3 dla
      // dokumentów/narrativeEngine dla decków): bez faktów z groundingu model NIE MOŻE
      // podawać precyzyjnie wyglądających liczb biznesowych jako realnych danych org —
      // seed rows muszą być jawnie oznaczone jako przykładowe (round numbers / etykieta
      // "przykład"/"example"), nigdy nie mieszane bez oznaczenia z realnymi faktami.
      const sheetFabricationGuard = pl
        ? ' DANE (§0.3): jeśli kontekst zawiera konkretne fakty organizacji — użyj WYŁĄCZNIE tych wartości, bez modyfikacji. Jeśli faktów brak: wiersze startowe muszą być jawnie oznaczone jako przykładowe (np. nazwa "Przykład 1", "Przykład 2" w pierwszej kolumnie lub dopisek "(przykład)" przy wartości) i używać okrągłych, ewidentnie ilustracyjnych liczb (10/20/30, nie 27,4% czy 183 450 zł) — NIGDY nie prezentuj zmyślonych precyzyjnych metryk biznesowych jako rzeczywistych danych organizacji.'
        : ' DATA (§0.3): if the context contains concrete organisation facts, use ONLY those values, unmodified. If there are no facts: seed rows MUST be explicitly marked as examples (e.g. "Example 1", "Example 2" in the first column, or an "(example)" tag next to the value) and use round, clearly illustrative numbers (10/20/30, not 27.4% or $183,450) — NEVER present fabricated precise-looking business metrics as real organisation data.';
      const sheetSystemBase = pl
        ? 'Jesteś analitykiem danych w Consultify. Tworzysz arkusz roboczy jako tabelę Markdown (GFM). Zwracasz WYŁĄCZNIE: linię tytułu "# <tytuł>" i jedną tabelę GFM (wiersz nagłówków, separator, wiersze danych). Maksymalnie 10 kolumn i 15 wierszy. Kolumny dobierz pod intencję użytkownika. Jeśli kontekst zawiera konkretne dane — użyj ich; w przeciwnym razie wypełnij realistycznymi wierszami startowymi (bez lorem ipsum).' +
          sheetFabricationGuard +
          ' Bez komentarzy, bez bloków kodu.'
        : 'You are a data analyst at Consultify. You create a working sheet as a Markdown (GFM) table. Return ONLY: a title line "# <title>" and one GFM table (header row, separator, data rows). At most 10 columns and 15 rows. Choose columns to fit the user intent. If the context contains concrete data, use it; otherwise fill with realistic seed rows (no lorem ipsum).' +
          sheetFabricationGuard +
          ' No commentary, no code fences.';
      const systemPrompt = `${languageDirective(sheetLang)}\n\n${sheetSystemBase}`;
      const explicitSheetFacts = await buildGroundingFacts(
        params.organizationId,
        stored.sourceRefs,
        pl ? 'pl' : 'en'
      );
      const sheetFacts =
        explicitSheetFacts || provenance.deliverablesGeneration?.autoGrounding?.facts || null;
      const userPromptBase = stored.conversationContext
        ? `${stored.intent}\n\n${pl ? 'Kontekst rozmowy' : 'Conversation context'}:\n${stored.conversationContext.slice(0, 3000)}`
        : stored.intent;
      const userPrompt = sheetFacts ? `${userPromptBase}\n\n${sheetFacts}` : userPromptBase;

      // W4/B4 (premium) — flag-gated, FAIL-OPEN. Gdy ENABLE_DELIVERABLES_PREMIUM
      // jest ON, próbujemy wygenerować TYPOWANY schemat B4 (singleSelect+hex /
      // number / currency / date + seedRows + CF) zamiast surowego markdownu.
      // generateTableSchema sam jest bramkowany tym samym resolverem tieru (B5):
      // gdy flaga OFF zwraca STANDARD fallback ⇒ poniższy warunek jest false ⇒
      // ścieżka legacy LLM-markdown bez zmian (zachowanie byte-identyczne dziś).
      // Każdy błąd / brak premium ⇒ markdown=null ⇒ stara ścieżka.
      let markdown: string | null = null;
      let tableSchemaB4: unknown = null;
      try {
        const { generateTableSchema } = await import('../tableSchemaGeneratorService.js');
        // Grounding gap fix: `sheetFacts` (buildGroundingFacts, computed above for the
        // legacy markdown path) was NOT reaching the B4 premium generator — it received
        // only the bare intent, so its §0.3 guard had nothing to ground seed rows in even
        // when real org facts were available. tableSchemaGeneratorService has no separate
        // facts param (intent is the only channel — see materialDataBinding.
        // datasetToTableIntent / bundleOrchestrator.spineToTableIntent for the same
        // pattern), so we embed the facts into the intent text with an explicit
        // "use verbatim, do not invent" instruction the §0.3 guard recognizes.
        const b4Intent = sheetFacts
          ? `${stored.intent}\n\n${sheetFacts}\n\n${
              pl
                ? 'Powyższe to realne fakty organizacji — ZASIAĆ realnymi danymi (nie zmyślaj); nie mieszaj ich ze zmyślonymi liczbami.'
                : 'The above are real organisation facts — seed rows with these real values (do not invent); do not mix them with fabricated numbers.'
            }`
          : stored.intent;
        const b4 = await generateTableSchema(b4Intent, {
          orgId: params.organizationId,
          userId: params.userId,
          preferPremium: true,
        });
        if (b4 && b4.tierUsed === 'PREMIUM' && !b4.fallbackUsed) {
          const rendered = premiumSchemaToGfmMarkdown(b4, draft.title);
          if (rendered) {
            markdown = rendered;
            tableSchemaB4 = b4;
            logger.info(
              `${LOG_PREFIX} sheet premium B4 schema materialized: generation=${draft.id} fields=${b4.fields.length} rows=${b4.seedRows.length}`
            );
          }
        }
      } catch (premiumErr) {
        logger.warn(
          `${LOG_PREFIX} sheet premium B4 failed, falling back to standard: generation=${draft.id} — ${premiumErr instanceof Error ? premiumErr.message : String(premiumErr)}`
        );
        markdown = null;
        tableSchemaB4 = null;
      }

      // Ścieżka legacy (= dzisiejsza, gdy premium OFF lub B4 nie dało wyniku).
      // BUG D: bogaty prompt potrafił zwrócić prozę/komentarz zamiast czystej tabeli GFM,
      // co wywalało extractGfmTable → stan 'error' i utknięcie na szkielecie. Naprawa:
      // (1) tolerancyjny extractor (borderless + proza wokół), (2) RETRY z twardą instrukcją
      // korygującą, (3) deterministyczny fallback zamiast cichego error-state.
      const sheetWarnings: string[] = [];
      let table = markdown !== null ? extractGfmTable(markdown) : { ok: false, rowCount: 0 };

      if (markdown === null || !table.ok) {
        const { generateChatResponse } = await import('../aiService.js');
        setDocRuntime(draft.id, { state: 'validating', warnings: [] });

        const maxAttempts = 2;
        for (let attempt = 1; attempt <= maxAttempts && !table.ok; attempt++) {
          const correction =
            attempt === 1
              ? ''
              : pl
                ? '\n\nUWAGA: poprzednia odpowiedź NIE zawierała poprawnej tabeli. Zwróć TYLKO linię tytułu "# ..." i jedną tabelę Markdown GFM (nagłówek | separator z myślnikami | wiersze). Żadnego tekstu przed ani po tabeli, bez bloków kodu.'
                : '\n\nNOTE: the previous answer did NOT contain a valid table. Return ONLY a title line "# ..." and one Markdown GFM table (header | dashed separator | rows). No text before or after the table, no code fences.';
          try {
            const response = await generateChatResponse({
              systemPrompt,
              messages: [{ role: 'user', content: `${userPrompt}${correction}` }],
              model: 'standard',
              maxTokens: 2400,
            });
            markdown = String(response.content || '')
              .replace(/^```(?:markdown)?\s*/i, '')
              .replace(/\s*```\s*$/, '')
              .trim();
            table = extractGfmTable(markdown);
            if (!table.ok && attempt < maxAttempts) {
              logger.warn(
                `${LOG_PREFIX} sheet attempt ${attempt} produced no valid table, retrying: generation=${draft.id}`
              );
            }
          } catch (llmErr) {
            logger.warn(
              `${LOG_PREFIX} sheet LLM attempt ${attempt} failed: generation=${draft.id} — ${llmErr instanceof Error ? llmErr.message : String(llmErr)}`
            );
          }
        }
      } else {
        setDocRuntime(draft.id, { state: 'validating', warnings: [] });
      }

      // After retries still no valid table. We deliberately do NOT silently fabricate content
      // (that would mask a genuine model refusal and break the anti-placeholder contract):
      // raise an HONEST, explicit error. The draft skeleton is left untouched so the user can
      // retry. The retry loop above is the real fix for the common rich-prompt format-miss.
      if (!table.ok) {
        throw new Error(
          pl
            ? 'Generacja tabeli nie powiodła się po 2 próbach — model nie zwrócił poprawnej tabeli. Spróbuj ponownie lub doprecyzuj prośbę.'
            : 'Sheet generation failed after 2 attempts — the model did not return a valid table. Try again or refine your request.'
        );
      }

      // Prefer the salvaged clean table block (strips any surrounding prose) when available.
      // `table.ok` is true here (else we threw above), so we always have a table body.
      const safeMarkdown = markdown ?? '';
      const titleLine = (safeMarkdown.match(/^#\s.*$/m) || [])[0];
      const cleanBody = table.table || safeMarkdown;
      const composed = titleLine
        ? `${titleLine}\n\n${cleanBody}`
        : `# ${draft.title}\n\n${cleanBody}`;
      const baseContent = composed;
      const sheetRefs = stored.sourceRefs?.length
        ? stored.sourceRefs
        : provenance.deliverablesGeneration?.autoGrounding?.refs;
      const content = appendSourcesSection(baseContent, sheetRefs, pl ? 'pl' : 'en');
      // Premium: zachowaj schemat B4 w provenance, by eksport xlsx mógł użyć
      // tableSchemaToWorkbook (realne style/CF exceljs). Legacy ⇒ provenance
      // nietknięte (patch bez pola provenance ⇒ updateDraft zachowuje istniejące).
      const sheetPatch: { content: string; provenance?: Record<string, unknown> } = { content };
      if (tableSchemaB4) {
        sheetPatch.provenance = {
          ...(provenance as Record<string, unknown>),
          deliverablesGeneration: {
            ...((provenance as Record<string, any>).deliverablesGeneration || {}),
            tableSchemaB4,
          },
        };
      }
      await updateDraft({
        organizationId: params.organizationId,
        draftId: draft.id,
        patch: sheetPatch,
      });
      setDocRuntime(draft.id, {
        state: 'draft',
        warnings: sheetWarnings,
        sectionCount: table.rowCount,
      });
      // P1-4 (audyt): bez tego arkusze z czatu nie istnieją w Outputs Library.
      try {
        await registerArtifactOrigin({
          organizationId: params.organizationId,
          outputType: 'sheet',
          artifactFamily: 'sheet',
          originRuntime: 'native_artifact',
          originRecordId: draft.id,
          titleSnapshot: draft.title,
          ownerUserId: params.userId,
          createdBy: params.userId,
          originSummary: {
            sourceType: 'deliverables_sheet_generation',
            generationId: draft.id,
            sourceTable: 'work_canvas_drafts',
          },
        });
      } catch (registryErr) {
        logger.warn(
          `${LOG_PREFIX} outputs registration failed (sheet still saved): generation=${draft.id} — ${registryErr instanceof Error ? registryErr.message : String(registryErr)}`
        );
      }
      void trackDeliverableEvent({
        organizationId: params.organizationId,
        userId: params.userId,
        generationId: draft.id,
        format: 'sheet',
        event: 'completed',
        durationMs: Date.now() - generationStartedAt,
        unitCount: table.rowCount,
        language: stored.language,
        groundingMode: stored.sourceRefs?.length ? 'source_refs' : 'conversation',
      });
      logger.info(`${LOG_PREFIX} sheet ready: generation=${draft.id} rows=${table.rowCount}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setDocRuntime(draft.id, { state: 'error', error: message, warnings: [] });
      markDraftFailedBestEffort(params.organizationId, draft.id, draft.title, {
        reason: message,
        language: stored.language === 'en' ? 'en' : 'pl',
      });
      void trackDeliverableEvent({
        organizationId: params.organizationId,
        userId: params.userId,
        generationId: draft.id,
        format: 'sheet',
        event: 'failed',
        durationMs: Date.now() - generationStartedAt,
        error: message,
      });
      logger.error(`${LOG_PREFIX} sheet generation failed: generation=${draft.id} — ${message}`);
    }
  })();

  return {
    generationId: draft.id,
    format: 'sheet',
    state: 'generating',
  };
}

interface DraftProvenance {
  deliverablesGeneration?: {
    intake: DocumentIntake;
    outline: DocumentOutline;
    /** B4: źródła znalezione auto-skanem + fakty (snippety) do promptu. */
    autoGrounding?: { refs: DocumentSourceRef[]; facts: string | null };
  };
  [key: string]: unknown;
}

/**
 * B3 (plan wykonawczy): artefakt niesie swoje źródła — sekcja na końcu treści
 * (typ + tytuł). Klikalne chipy per sekcja = przyszła iteracja UI; v1 czytelny tekst.
 */
function appendSourcesSection(
  markdown: string,
  refs: DocumentSourceRef[] | undefined,
  language: 'pl' | 'en'
): string {
  if (!refs?.length) return markdown;
  const typeLabels: Record<string, { pl: string; en: string }> = {
    initiative: { pl: 'Inicjatywa', en: 'Initiative' },
    insight: { pl: 'Insight', en: 'Insight' },
    note: { pl: 'Notatka', en: 'Note' },
    decision: { pl: 'Decyzja', en: 'Decision' },
    task: { pl: 'Zadanie', en: 'Task' },
    report: { pl: 'Raport', en: 'Report' },
  };
  const items = refs
    .slice(0, 10)
    .map((r) => {
      const label = typeLabels[String(r.sourceType)]?.[language] || r.sourceType;
      return `- ${label}: ${r.sourceTitle || r.sourceId}`;
    })
    .join('\n');
  const heading = language === 'en' ? '## Sources' : '## Źródła';
  return `${markdown}\n\n${heading}\n\n${items}`;
}

async function getDocDraft(
  draftId: string,
  organizationId: string
): Promise<WorkCanvasDraftRecord> {
  const draft = await getDraft({ organizationId, draftId });
  if (!draft) {
    throw new DeliverablesGenerationError('not_found', `Generacja ${draftId} nie istnieje`);
  }
  return draft;
}

/**
 * Kimi-parity: deliverable w canvasie ma wyglądać jak dokument, nie jak zrzut
 * wewnętrznego schematu. Renderer (renderSchemaToMarkdown) zostaje bez zmian
 * dla eksportu/legacy — tu czyścimy jego output dla użytkownika:
 *  - blok metadanych intake'u (Document type/Audience/Goal/…),
 *  - notki `_Purpose: …_` per sekcja (scaffolding, nie treść),
 *  - techniczne etykiety calloutów (`> **KEY_MESSAGE:**` → ludzka, w języku dokumentu).
 */
/**
 * BUG E (b) — dedup nagłówków. Renderer schema→markdown i planer sekcji potrafiły
 * wyprodukować dwa równoważne nagłówki H2 pod rząd (np. „## Streszczenie" + „## Podsumowanie",
 * albo tytuł sekcji H2 + opis sekcji H2 bez treści między nimi). Ta funkcja:
 *  1. usuwa H2 identyczny (po normalizacji) z wcześniejszym H2,
 *  2. gdy dwa H2 stoją pod rząd bez treści między nimi — zostawia pierwszy (tytuł),
 *  3. traktuje znane pary synonimów (Streszczenie/Podsumowanie wykonawcze) jak duplikat,
 *     gdy stoją bezpośrednio po sobie.
 * Zachowawcza: nie łączy nagłówków oddzielonych realną treścią.
 */
const H2_SYNONYM_GROUPS: string[][] = [
  ['streszczenie', 'streszczenie wykonawcze', 'podsumowanie', 'podsumowanie wykonawcze'],
  ['executive summary', 'summary', 'overview'],
];

function normalizeHeadingText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function headingsAreEquivalent(a: string, b: string): boolean {
  const na = normalizeHeadingText(a);
  const nb = normalizeHeadingText(b);
  if (na === nb) return true;
  return H2_SYNONYM_GROUPS.some((group) => group.includes(na) && group.includes(nb));
}

export function dedupeMarkdownHeadings(markdown: string): string {
  const rawLines = markdown.split('\n');
  const out: string[] = [];
  const seenH2: string[] = [];
  let lastEmittedWasH2 = false;
  let lastH2Text = '';

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const h2Match = /^##\s+(.*\S)\s*$/.exec(line);
    if (h2Match) {
      const text = h2Match[1];
      // Case 1: two H2 back-to-back (only blank lines between) that are equivalent →
      // drop this one, keep the first. Also drop if a duplicate of any earlier H2.
      if (lastEmittedWasH2 && headingsAreEquivalent(text, lastH2Text)) {
        continue; // skip duplicate heading line
      }
      const dupOfEarlier = seenH2.some((prev) => headingsAreEquivalent(text, prev));
      if (dupOfEarlier && lastEmittedWasH2) {
        continue;
      }
      seenH2.push(text);
      lastEmittedWasH2 = true;
      lastH2Text = text;
      out.push(line);
      continue;
    }
    if (line.trim() === '') {
      out.push(line);
      // blank lines don't reset "last emitted was H2" — two H2 separated only by blanks
      // are still back-to-back.
      continue;
    }
    // Any real content line resets the back-to-back tracker.
    lastEmittedWasH2 = false;
    out.push(line);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

export function polishMarkdownForCanvas(markdown: string, language: 'pl' | 'en'): string {
  let out = markdown;
  out = out.replace(
    /^- \*\*(Document type|Audience|Goal|Register|Density|Language style|Confidentiality):\*\*.*$\n?/gm,
    ''
  );
  out = out.replace(/^_Purpose: .*_$\n?/gm, '');
  const calloutLabels: Record<string, { pl: string; en: string }> = {
    KEY_MESSAGE: { pl: 'Kluczowa myśl', en: 'Key message' },
    NOTE: { pl: 'Uwaga', en: 'Note' },
    WARNING: { pl: 'Ostrzeżenie', en: 'Warning' },
  };
  out = out.replace(/> \*\*([A-Z_]+):\*\*/g, (_match, raw: string) => {
    const label = calloutLabels[raw]?.[language] || raw.replace(/_/g, ' ').toLowerCase();
    return `> **${label}:**`;
  });
  // Zbite puste linie po usunięciach.
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  // BUG E (b): usuń zdublowane/synonimiczne nagłówki H2.
  out = dedupeMarkdownHeadings(out);
  return out;
}

// ── API gałęzi doc ──────────────────────────────────────────────────────────

export async function planDoc(params: {
  setup: Record<string, unknown>;
  organizationId: string;
  userId: string;
}): Promise<CreateGenerationResponse> {
  const parsed = parseSetup(params.setup);
  const intake = buildIntake(parsed);
  const { outline } = planDocument({ intake });
  const planLang = parsed.language === 'en' ? ('en' as const) : ('pl' as const);
  // N-10: outline EN (klucz dyspozytora bloków) trafia do provenance/materialize;
  // użytkownik widzi tytuły zlokalizowane (plan + szkielet draftu).
  const localizedOutline = localizeOutlineTitles(outline, planLang);
  const title = parsed.title || outline.title;

  // B4: brak wskazanych źródeł ⇒ Teresa sama szuka w organizacji.
  const auto = parsed.sourceRefs?.length
    ? { refs: [] as DocumentSourceRef[], facts: null as string | null }
    : await autoScanOrgSources(
        params.organizationId,
        parsed.intent,
        parsed.language === 'en' ? 'en' : 'pl'
      );

  const draft = await createDraft({
    organizationId: params.organizationId,
    actorUserId: params.userId,
    input: {
      conversationId: parsed.conversationId!,
      kind: 'document',
      title,
      content: outlineSkeletonMarkdown(title, localizedOutline, planLang),
      sources: parsed.sourceRefs?.length ? parsed.sourceRefs : auto.refs,
      provenance: {
        deliverablesGeneration: {
          intake: { ...intake, title },
          outline,
          autoGrounding: auto.refs.length ? { refs: auto.refs, facts: auto.facts } : undefined,
        },
      } satisfies DraftProvenance,
    },
  });

  setDocRuntime(draft.id, { state: 'plan_ready', warnings: [] });
  void trackDeliverableEvent({
    organizationId: params.organizationId,
    userId: params.userId,
    generationId: draft.id,
    format: 'doc',
    event: 'plan_ready',
    language: parsed.language,
    groundingMode: parsed.sourceRefs?.length
      ? 'source_refs'
      : auto.refs.length
        ? 'auto_scan'
        : 'conversation',
  });
  logger.info(
    `${LOG_PREFIX} plan ready: generation=${draft.id} sections=${outline.sections.length} autoSources=${auto.refs.length}`
  );
  const usedRefs = parsed.sourceRefs?.length ? parsed.sourceRefs : auto.refs;
  return {
    generationId: draft.id,
    format: 'doc',
    state: 'plan_ready',
    plan: outlineToPlanItems(localizedOutline),
    warnings: [],
    sources: usedRefs.map((r) => ({
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      sourceTitle: r.sourceTitle,
    })),
  };
}

/**
 * A3 (plan wykonawczy): generacja dokumentu sekcja-po-sekcji. Każde wywołanie
 * widzi tytuły poprzednich sekcji (koherencja narracji bez kwadratowego rozrostu
 * kontekstu) + fakty groundingu. Po KAŻDEJ sekcji zapisuje narastający markdown
 * do draftu i emituje progres — panel re-hydratuje, więc sekcje „rosną na oczach".
 * Zwraca finalny markdown albo null gdy WSZYSTKIE sekcje padły (uczciwy error).
 */
async function runStreamingDocGeneration(params: {
  draftId: string;
  organizationId: string;
  title: string;
  outline: DocumentOutline;
  language: 'pl' | 'en';
  groundingFacts: string | null;
  /** N-9: intencja usera wprost prosi o tabele ⇒ wzmocniona dyrektywa. */
  reinforceTables: boolean;
  onSectionDone: (index: number, total: number) => void;
}): Promise<string | null> {
  const { generateChatResponse } = await import('../aiService.js');
  const pl = params.language !== 'en';
  const sections = params.outline.sections;
  const total = sections.length;

  const docLang = pl ? ('pl' as const) : ('en' as const);
  // N-9: dopuszczamy tabelę GFM obok prozy (dawniej „wyłącznie prozę" → model
  // nigdy nie dawał tabel). Nagłówek sekcji nadal dokleja runtime, nie model.
  // BUG E (a) — §0.3 kwantyfikacja: każda liczba MUSI nieść jawne założenie albo znika.
  // Zakaz halucynowania konkretnych wartości (np. „redukcja 30%") bez podstawy w faktach.
  const quantificationRule = pl
    ? ' KWANTYFIKACJA (§0.3): każda liczba, procent, kwota lub ROI/payback MUSI albo wynikać z dostarczonych faktów, albo być opatrzona jawnym założeniem w nawiasie, np. „30% (szacunek: przy założeniu X)". Liczby bez podstawy w faktach i bez założenia są ZABRONIONE — usuń je lub zastąp jakościowym opisem. Jeśli poproszono o ROI/payback, a brak danych do wyliczenia — napisz wprost, jakich danych brakuje, zamiast zmyślać wynik.'
    : ' QUANTIFICATION (§0.3): every number, percentage, amount, or ROI/payback MUST either follow from the provided facts or carry an explicit assumption in parentheses, e.g. "30% (estimate: assuming X)". Numbers with no basis in the facts and no assumption are FORBIDDEN — remove them or replace with a qualitative statement. If ROI/payback was requested but there is no data to compute it, state plainly which data is missing instead of fabricating a result.';
  const systemPromptBase = pl
    ? 'Jesteś starszym konsultantem w Consultify. Piszesz JEDNĄ sekcję dokumentu biznesowego — zwracasz treść tej sekcji bez nagłówka (bez markdownu nagłówków #/##). Domyślnie 2–4 akapity prozy, konkretnie, językiem konsultingowym; gdy sekcja jest tabelaryczna z natury, dodaj tabelę Markdown GFM. Jeśli twierdzenie wykracza poza dostarczone fakty, oznacz je w nawiasie „(założenie)".' +
      quantificationRule +
      ' Bez bloków kodu, bez meta-komentarzy.'
    : 'You are a senior consultant at Consultify. You write ONE section of a business document — return the section content with no heading (no #/## markdown headings). By default 2–4 paragraphs of prose, concrete, consulting register; when the section is inherently tabular, add a GFM Markdown table. If a claim goes beyond the provided facts, flag it inline as "(assumption)".' +
      quantificationRule +
      ' No code fences, no meta-commentary.';
  const systemPrompt = `${languageDirective(docLang)}\n\n${tableDirective(docLang, params.reinforceTables)}\n\n${systemPromptBase}`;

  const lines = [`# ${params.title}`, ''];
  let anySucceeded = false;

  for (let i = 0; i < total; i++) {
    const section = sections[i];
    const localizedTitle = localizeSectionTitle(section.title, docLang);
    const priorTitles = sections.slice(0, i).map((s) => localizeSectionTitle(s.title, docLang));
    const ctxParts = [
      pl ? `Dokument: „${params.title}"` : `Document: "${params.title}"`,
      pl ? `Sekcja do napisania: „${localizedTitle}"` : `Section to write: "${localizedTitle}"`,
      section.purpose
        ? pl
          ? `Cel sekcji: ${section.purpose}`
          : `Section purpose: ${section.purpose}`
        : '',
      priorTitles.length
        ? pl
          ? `Wcześniejsze sekcje (nie powtarzaj ich treści): ${priorTitles.join(', ')}`
          : `Earlier sections (do not repeat them): ${priorTitles.join(', ')}`
        : '',
      params.groundingFacts || '',
    ].filter(Boolean);

    let prose = '';
    try {
      const res = await generateChatResponse({
        systemPrompt,
        messages: [{ role: 'user', content: ctxParts.join('\n\n') }],
        model: 'standard',
        maxTokens: 900,
      });
      prose = String(res.content || '')
        .replace(/^```(?:markdown)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .replace(/^#{1,3}\s.*$/gm, '') // wytnij ewentualne nagłówki od modelu
        .trim();
    } catch (err) {
      logger.warn(
        `${LOG_PREFIX} streaming section failed: generation=${params.draftId} section="${section.title}" — ${err instanceof Error ? err.message : err}`
      );
    }

    if (prose && !isPlaceholderDocumentProse(prose)) {
      anySucceeded = true;
      lines.push(`## ${localizedTitle}`, '', prose, '');
    } else {
      // Sekcja padła — jawny znacznik, nie cisza (D-L2-3 w duchu).
      lines.push(
        `## ${localizedTitle}`,
        '',
        pl
          ? '_(Nie udało się wygenerować tej sekcji — spróbuj ponownie lub uzupełnij ręcznie.)_'
          : '_(This section could not be generated — retry or fill it in manually.)_',
        ''
      );
    }

    // Progresywny zapis: panel re-hydratuje i pokazuje narastającą treść.
    await updateDraft({
      organizationId: params.organizationId,
      draftId: params.draftId,
      patch: { content: lines.join('\n') },
    });
    params.onSectionDone(i + 1, total);
  }

  // BUG E (b): dedup zdublowanych/synonimicznych nagłówków H2 w finalnym markdownie.
  return anySucceeded ? dedupeMarkdownHeadings(lines.join('\n')) : null;
}

export async function startDoc(params: {
  generationId: string;
  setup: Record<string, unknown>;
  organizationId: string;
  userId: string;
  plan?: GenerationPlanItem[];
}): Promise<GenerationStatusResponse> {
  const draft = await getDocDraft(params.generationId, params.organizationId);
  if (docRuntimeState.get(draft.id)?.state === 'generating') {
    throw new DeliverablesGenerationError(
      'invalid_state',
      `Generacja ${draft.id} już trwa — odpytuj status zamiast startować ponownie`
    );
  }

  const provenance = (draft.provenance || {}) as DraftProvenance;
  const stored = provenance.deliverablesGeneration;
  if (!stored?.intake || !stored?.outline) {
    throw new DeliverablesGenerationError(
      'invalid_state',
      `Generacja ${draft.id} nie ma zapisanego planu — uruchom najpierw krok PLAN`
    );
  }
  const outline = params.plan?.length
    ? applyPlanToOutline(stored.outline, params.plan)
    : stored.outline;

  setDocRuntime(draft.id, { state: 'generating', warnings: [] });
  const generationStartedAt = Date.now();

  // W tle (wzorzec Gamma, jak deck w L1). Stan przez status() (poll).
  void (async () => {
    try {
      // B2: fakty z encji org (jeśli wskazane) wzbogacają opis dla silnika prozy.
      const explicitFacts = await buildGroundingFacts(
        params.organizationId,
        stored.intake.sourceHints,
        stored.intake.language === 'en' ? 'en' : 'pl'
      );
      const groundingFacts = explicitFacts || stored.autoGrounding?.facts || null;
      const docLangEarly = stored.intake.language === 'en' ? ('en' as const) : ('pl' as const);
      // N-9: intencja usera (zaszyta w description przez buildIntake) decyduje o
      // wzmocnieniu dyrektywy tabel — opis niesie intent + kontekst rozmowy.
      const reinforceTables = intentWantsTables(String(stored.intake.description || ''));
      // N-6: ścieżka one-shot (materializeDocumentArtifact) wymusza język tylko
      // przez intake.language — przy mieszanym kontekście to za słabe. Dopinamy
      // twardą dyrektywę do description (jedyny lever na ten generator stąd).
      // N-9: tą samą drogą wstrzykujemy dyrektywę tabel — silnik prozy
      // (generateBlockProse) czyta intake.description do user-promptu, a tabelę
      // GFM w tekście paragrafu renderer oddaje verbatim (przejdzie do edytora).
      const intakeDescription = [
        stored.intake.description,
        groundingFacts || '',
        languageDirective(docLangEarly),
        tableDirective(docLangEarly, reinforceTables),
      ]
        .filter(Boolean)
        .join('\n\n');
      const intake = { ...stored.intake, description: intakeDescription };
      const usedRefsEarly = stored.intake.sourceHints?.length
        ? stored.intake.sourceHints
        : stored.autoGrounding?.refs;
      const groundingModeDoc = stored.intake.sourceHints?.length
        ? 'source_refs'
        : stored.autoGrounding?.refs?.length
          ? 'auto_scan'
          : 'conversation';

      // A3: streaming per-sekcja (flaga OFF ⇒ sprawdzona ścieżka one-shot niżej).
      const { featureFlags } = await import('../../config/FeatureFlags.js');
      if (featureFlags.ENABLE_DELIVERABLES_DOC_STREAMING) {
        const streamed = await runStreamingDocGeneration({
          draftId: draft.id,
          organizationId: params.organizationId,
          title: String(stored.intake.title || draft.title),
          outline,
          language: docLangEarly,
          groundingFacts,
          reinforceTables,
          onSectionDone: (done, totalSections) =>
            setDocRuntime(draft.id, {
              state: done >= totalSections ? 'validating' : 'generating',
              warnings: [],
              sectionCount: totalSections,
            }),
        });
        if (!streamed) {
          throw new Error(
            'Generacja treści nie powiodła się (LLM niedostępny) — dokument nie został wypełniony'
          );
        }
        // N-9: pewny odstęp przed tabelami GFM w sklejonym markdownie.
        const withSources = appendSourcesSection(
          ensureTableSpacing(streamed),
          usedRefsEarly,
          docLangEarly
        );

        // C3 — unifikacja toru doc: streaming daje żywy podgląd sekcji w draftcie,
        // ale artefakt KANONICZNY to encja Document Studio (document_studio_artifacts
        // przez wave5) — tak samo jak w ścieżce one-shot niżej i w moście
        // „Send to Document Studio". Bez tego kroku streamowany dokument nie ma
        // encji Studio → brak eksportu DOCX/PDF z FormattingSchema i brak wpisu w
        // rejestrze Outputs. Materializujemy Studio-artefakt z tego samego
        // intake+outline (useLlm:true → generateBlockProse/Wave5 wypełnia schema),
        // a treść streamowaną trzymamy w draftcie dla podglądu. Best-effort:
        // awaria materializacji NIE psuje gotowego draftu (użytkownik ma treść).
        let streamedArtifactId: string | undefined;
        try {
          const materialized = await materializeDocumentArtifact({
            organizationId: params.organizationId,
            userId: params.userId,
            intake,
            outline,
            sourceRefs: stored.intake.sourceHints,
            useLlm: true,
          });
          streamedArtifactId = materialized.artifactId;
          await registerDocArtifactBestEffort({
            organizationId: params.organizationId,
            userId: params.userId,
            documentArtifactId: materialized.artifactId,
            title: String(materialized.schema?.title || stored.intake.title || draft.title),
            generationDraftId: draft.id,
            sourceRefs: stored.intake.sourceHints,
          });
        } catch (materializeErr) {
          logger.warn(
            `${LOG_PREFIX} streamed doc: Studio artifact materialize failed (draft still saved): generation=${draft.id} — ${
              materializeErr instanceof Error ? materializeErr.message : String(materializeErr)
            }`
          );
        }

        await updateDraft({
          organizationId: params.organizationId,
          draftId: draft.id,
          patch: streamedArtifactId
            ? { content: withSources, artifactId: streamedArtifactId }
            : { content: withSources },
        });
        setDocRuntime(draft.id, {
          state: 'draft',
          warnings: [],
          sectionCount: outline.sections.length,
          documentArtifactId: streamedArtifactId,
        });
        void trackDeliverableEvent({
          organizationId: params.organizationId,
          userId: params.userId,
          generationId: draft.id,
          format: 'doc',
          event: 'completed',
          durationMs: Date.now() - generationStartedAt,
          unitCount: outline.sections.length,
          language: stored.intake.language,
          groundingMode: `${groundingModeDoc}+stream`,
        });
        logger.info(
          `${LOG_PREFIX} draft ready (streamed): generation=${draft.id} sections=${outline.sections.length} artifact=${streamedArtifactId ?? 'none'}`
        );
        return;
      }

      const result = await materializeDocumentArtifact({
        organizationId: params.organizationId,
        userId: params.userId,
        intake,
        outline,
        sourceRefs: stored.intake.sourceHints,
        useLlm: true,
      });
      setDocRuntime(draft.id, {
        state: 'validating',
        warnings: [],
        sectionCount: outline.sections.length,
      });

      const rendered = renderSchemaToMarkdown(result.schema);
      const docLang = stored.intake.language === 'en' ? ('en' as const) : ('pl' as const);
      // N-10: renderer zachowuje EN tytuły sekcji (klucz dyspozytora bloków) —
      // po renderze lokalizujemy nagłówki do języka usera.
      // N-9: ensureTableSpacing gwarantuje pustą linię przed tabelą GFM (marked).
      // 2026-07-08 fix: polishMarkdownForCanvas MUST run before the placeholder
      // gate below, not after — it strips the `_Purpose: …_` scaffolding line
      // that documentSchemaRenderer.renderSection appends to EVERY section
      // whose title has no documentNarrativePlanner.PURPOSE_HINTS entry
      // (most real outlines, e.g. "Project Context"/"KPIs"/"Appendix"). Gating
      // on the raw `rendered` string false-positived on fully-generated real
      // documents purely because of that harmless scaffolding text, throwing
      // "LLM niedostępny" even though the LLM succeeded (regression from
      // cb2764bcb0: the two new isPlaceholderDocumentProse clauses target text
      // that only ever appears in this pre-polish scaffolding, never in real
      // block prose).
      const polished = polishMarkdownForCanvas(rendered, docLang);
      // D-L2-3: silnik D11 przy błędzie LLM po cichu oddaje stuby —
      // tu zamieniamy cichą degradację na uczciwy błąd.
      if (isPlaceholderDocumentProse(polished)) {
        throw new Error(
          'Generacja treści nie powiodła się (LLM niedostępny) — dokument nie został wypełniony'
        );
      }
      const markdown = ensureTableSpacing(localizeMarkdownHeadings(polished, docLang));
      const usedRefs = stored.intake.sourceHints?.length
        ? stored.intake.sourceHints
        : stored.autoGrounding?.refs;
      const markdownWithSources = appendSourcesSection(markdown, usedRefs, docLang);

      await updateDraft({
        organizationId: params.organizationId,
        draftId: draft.id,
        patch: { content: markdownWithSources, artifactId: result.artifactId },
      });
      // C7 — zarejestruj gotowy dokument w rejestrze Outputs (best-effort).
      await registerDocArtifactBestEffort({
        organizationId: params.organizationId,
        userId: params.userId,
        documentArtifactId: result.artifactId,
        title: String(result.schema?.title || stored.intake.title || draft.title),
        generationDraftId: draft.id,
        sourceRefs: stored.intake.sourceHints,
      });
      setDocRuntime(draft.id, {
        state: 'draft',
        warnings: [],
        sectionCount: outline.sections.length,
        documentArtifactId: result.artifactId,
      });
      void trackDeliverableEvent({
        organizationId: params.organizationId,
        userId: params.userId,
        generationId: draft.id,
        format: 'doc',
        event: 'completed',
        durationMs: Date.now() - generationStartedAt,
        unitCount: outline.sections.length,
        language: stored.intake.language,
        groundingMode: stored.intake.sourceHints?.length ? 'source_refs' : 'conversation',
      });
      logger.info(
        `${LOG_PREFIX} draft ready: generation=${draft.id} sections=${outline.sections.length} artifact=${result.artifactId}`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setDocRuntime(draft.id, { state: 'error', error: message, warnings: [] });
      markDraftFailedBestEffort(params.organizationId, draft.id, draft.title, {
        reason: message,
        language: stored.intake.language === 'en' ? 'en' : 'pl',
      });
      void trackDeliverableEvent({
        organizationId: params.organizationId,
        userId: params.userId,
        generationId: draft.id,
        format: 'doc',
        event: 'failed',
        durationMs: Date.now() - generationStartedAt,
        error: message,
      });
      logger.error(`${LOG_PREFIX} generation failed: generation=${draft.id} — ${message}`);
    }
  })();

  return {
    generationId: draft.id,
    format: 'doc',
    state: 'generating',
    plan: outlineToPlanItems(outline),
  };
}

export async function statusDoc(params: {
  generationId: string;
  organizationId: string;
}): Promise<GenerationStatusResponse> {
  const draft = await getDocDraft(params.generationId, params.organizationId);
  const runtime = docRuntimeState.get(draft.id);
  // L3: ta sama ścieżka statusu obsługuje doc i sheet — format po kind draftu.
  const format = draft.kind === 'table' ? ('sheet' as const) : ('doc' as const);

  // Po restarcie serwera mapa jest pusta — wnioskujemy z draftu: wypełniona
  // treść bez markera szkieletu ⇒ draft gotowy; inaczej plan_ready.
  const content = typeof draft.content === 'string' ? draft.content : '';
  const fallbackState: DocRuntimeEntry['state'] = isSkeletonContent(content)
    ? 'plan_ready'
    : 'draft';
  const state = runtime?.state || fallbackState;

  const response: GenerationStatusResponse = {
    generationId: draft.id,
    format,
    state,
  };
  if (state === 'error') {
    response.error = runtime?.error || 'Generacja nie powiodła się';
  }
  if (state === 'draft') {
    response.artifact = {
      artifactId: runtime?.documentArtifactId || draft.artifactId || draft.id,
      originRecordId: draft.id,
      format,
      title: draft.title,
      unitCount:
        runtime?.sectionCount ??
        (format === 'sheet'
          ? Math.max(0, (content.match(/^\|/gm) || []).length - 2)
          : (content.match(/^## /gm) || []).length),
    };
  }
  return response;
}

/** Czy generationId należy do gałęzi doc (draft istnieje w work_canvas_drafts)? */
export async function isDocGeneration(
  generationId: string,
  organizationId: string
): Promise<boolean> {
  if (docRuntimeState.has(generationId)) return true;
  const draft = await getDraft({ organizationId, draftId: generationId });
  return Boolean(draft);
}

/** Wyłącznie do testów. */
export function __clearDocRuntimeStateForTests(): void {
  docRuntimeState.clear();
}
