/**
 * Consultify Document Studio — View.
 *
 * Tabs:
 *   - Generate: Mode 1 (intake -> outline -> document) and Mode 3 (intake +
 *     approved template -> outline preview, seeded client-side from the
 *     template's sectionBlueprint -> document). Both modes show the plan
 *     before writing starts — see N3, `_DOKTRYNA_STREAMING_2026-07-27.md` §7.4.
 *   - Plan template: Mode 2 — Document Template Architect.
 *
 * Routed at /document-studio (and /document-studio/:artifactId for resume).
 * See docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md.
 */

import { FileQuestion, Layers, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { resolveTemplateProvenancePath } from '@/components/ReportsAndPresentations/artifactNavigation';
import { BlankCreationState } from '@/components/shared/BlankCreationState';
import { TopBar, type TopBarChipDescriptor } from '@/components/shared/ExecutiveModuleShell';
import { TriModeChooser } from '@/components/shared/TriModeChooser';
import { LoadingState } from '@/components/ui/primitives';
import { isTriModeEnabled } from '@/utils/triModeFlag';
import { isZaiTeresaEnabled } from '@/utils/zaiTeresaFlag';

import {
  type DocumentStreamDoneEvent,
  type GenerateDocumentParams,
  generateDocumentStudioArtifact,
  generateDocumentStudioArtifactStream,
  getDocumentStudioArtifact,
  listDocumentStudioTemplates,
  MissingRequiredSourceError,
  planDocumentStudioOutline,
  resolveDocumentStudioTemplate,
  TemplateResolveClientError,
} from './api';
import { DocumentStudioAiEntryPanel } from './DocumentStudioAiEntryPanel';
import { DocumentStudioDocumentPanel } from './DocumentStudioDocumentPanel';
import { DocumentStudioFileMenu } from './DocumentStudioFileMenu';
import { resolveDocumentIntakeGate } from './intakeGate';
import {
  DocumentStudioGeneratingPanel,
  type GeneratingSectionState,
} from './DocumentStudioGeneratingPanel';
import { DocumentStudioIntakeForm, type IntakeSubmitOptions } from './DocumentStudioIntakeForm';
import { DocumentStudioOutlinePanel } from './DocumentStudioOutlinePanel';
import { DocumentStudioTemplateArchitectView } from './DocumentStudioTemplateArchitectView';
import { useManualPrompt } from './editor/useManualPrompt';
import type {
  DocumentGenerationWarning,
  DocumentIntake,
  DocumentOutline,
  DocumentSchema,
  DocumentSourceRef,
  DocumentTemplate,
} from './types';

type Phase = 'intake' | 'outline' | 'generating' | 'document';
type Tab = 'generate' | 'templates';

/**
 * N3 (doktryna streaming §5/§7.2) — collapse a streamed section's blocks down
 * to the distinct sources it is grounded on, so
 * `DocumentStudioGeneratingPanel` can render "Based on: X, Y" chips while the
 * section is being written. The data already flows through the `section` SSE
 * event (`document-studio.routes.ts:866-876`, `blocks[].sourceRef`) — this was
 * previously discarded on the client.
 */
function dedupeSourceRefs(blocks: { sourceRef?: DocumentSourceRef }[]): DocumentSourceRef[] {
  const seen = new Map<string, DocumentSourceRef>();
  for (const block of blocks) {
    const ref = block.sourceRef;
    if (!ref) continue;
    const key = `${ref.sourceType}:${ref.sourceId}`;
    if (!seen.has(key)) seen.set(key, ref);
  }
  return Array.from(seen.values());
}

/**
 * N3 (doktryna streaming §2/§7.4) — Mode 3 preview outline, built client-side
 * from the already-loaded approved template so the plan screen can render
 * instantly with no extra round-trip ("tani do zrobienia" per doctrine). Mirrors
 * `outlineFromTemplate` server-side (`documentStudioService.ts:514-528`) field
 * for field; the server remains the source of truth for the outline actually
 * used to generate (see `handleGenerate` below — `outline` is NOT sent over
 * the wire for template mode, only used to seed this preview + panel skeleton).
 */
function buildTemplateOutlinePreview(
  template: DocumentTemplate,
  intake: DocumentIntake
): DocumentOutline {
  return {
    documentType: template.documentType,
    title: intake.title?.trim() || `${template.documentType.replace(/_/g, ' ')}: ${template.name}`,
    sections: template.sectionBlueprint.map((blueprint) => ({
      title: blueprint.title,
      level: blueprint.level,
      purpose: blueprint.purpose,
      expectedLengthHint: blueprint.expectedLengthHint,
    })),
    recommendedDensity: template.density,
    recommendedRegister: template.communicationRegister,
    recommendedLanguageStyle: template.languageStyle,
  };
}

/**
 * ★ Stan BLOKUJĄCY dla wzorca, którego nie da się rozwiązać (osierocony, brak
 * dostępu, wycofany, niezaindeksowany, nieobsługiwany format). ŻADNEGO
 * fallbacku do pickera ani do generacji z AI — uczciwy komunikat i wyjście.
 *
 * Wydzielone 05.09 z łańcucha renderu przy naprawie fail-open (odbiór na żywo,
 * różnica #5): karta była wcześniej wklejona w jedną gałąź warunku, przez co
 * blokada obowiązywała tylko dla `entry=template`. Jeden komponent = jedna
 * karta, wołana z jednego, nadrzędnego warunku.
 */
const TemplateResolveBlockedCard: React.FC<{
  message: string | null;
  errorCode?: string | null;
  onBack: () => void;
}> = ({ message, errorCode, onBack }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // AGENT_WZORCE_SYSTEMOWE_ATESTACJA_20260905 — po decyzji CTO 05.09 wzorce
  // SYSTEMOWE nigdy nie trafiają już w ten kod (zaufane z definicji, patrz
  // `creationIntent.ts`); 409 TEMPLATE_PROVENANCE_UNVERIFIED zostaje więc
  // wyłącznie dla wzorców ORGANIZACJI, dla których atestacja jest realną
  // ścieżką wyjścia z kwarantanny — stąd drugi przycisk prowadzący wprost do
  // kolejki, zamiast samego opisu słownego.
  const showProvenanceCta = errorCode === 'TEMPLATE_PROVENANCE_UNVERIFIED';
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div
        data-testid="template-resolve-error"
        className="w-full max-w-md rounded-2xl border border-c-border-subtle bg-c-surface p-8 text-center shadow-sm"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-c-surface-raised">
          <FileQuestion className="h-6 w-6 text-c-text-muted" aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-base font-semibold text-c-text">
          {t('documentStudio.view.templateResolveTitle', 'Nie da się użyć tego wzorca')}
        </h2>
        <p className="text-sm leading-relaxed text-c-text-secondary">{message}</p>
        <div className="mt-6 flex flex-col items-center gap-2">
          {showProvenanceCta ? (
            <button
              type="button"
              data-testid="template-resolve-provenance-cta"
              onClick={() => navigate(resolveTemplateProvenancePath())}
              className="rounded-lg border border-c-border-strong bg-c-text px-4 py-2 text-sm font-medium text-c-surface transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {t('documentStudio.view.goToProvenance', 'Przejdź do Pochodzenie i prawa')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-c-border-strong bg-c-surface-raised px-4 py-2 text-sm font-medium text-c-text transition-colors hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {t('documentStudio.view.backToLibrary', 'Wróć do Biblioteki wzorców')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const DocumentStudioView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { requestConfirm, promptDialog } = useManualPrompt();
  const { artifactId: artifactIdFromPath } = useParams<{ artifactId?: string }>();
  // #84b fix: getArtifactPath('report', id) / legacy /wordy deep-links resolve to
  // `/document-studio?artifactId=X` (query string), while this view historically
  // only read the `/document-studio/:artifactId` PATH param. Any "Open" coming
  // from a list/preview/deep-link (Materiały, chat, My Work…) landed on a blank
  // "new document" intake instead of the real document — dead wiring, not a 404.
  // Accept both forms; path param wins if somehow both are present.
  const [searchParams] = useSearchParams();
  const artifactIdFromQuery = searchParams.get('artifactId');
  const artifactIdFromUrl = artifactIdFromPath || artifactIdFromQuery || undefined;
  // Materials may request a one-shot handoff into an existing governed tool.
  // Capture it once because successful artifact loading canonicalizes the URL
  // and intentionally removes the action, preventing refresh from reopening it.
  const [initialDocumentAction] = useState<'share' | null>(() =>
    searchParams.get('action') === 'share' ? 'share' : null
  );

  // Materiały wspólny launcher (2026-07-24) — `?entry=blank|ai|template` sygnalizuje
  // tryb wybrany w KROK 2 tablicy (Harvard/wdrozenie-100/_MATERIALY_INWENTARYZACJA_2026-07-24.md
  // §8), tak żeby wybór w Materiałach lądował od razu w tym trybie zamiast
  // ponownie pytać o wybór w tym widoku. `?tab=templates` skacze prosto do
  // Mode 2 (Document Template Architect) — wejście z Biblioteki szablonów.
  const entryParam = searchParams.get('entry');
  const tabParam = searchParams.get('tab');
  // Biblioteka wzorców → „Użyj wzorca" dla szablonu DOKUMENTU przychodzi jako
  // `?entry=template&templateArtifactId=<id WIERSZA INDEKSU>`.
  //
  // ★ Świadomie NIE przyjmujemy tu kanonicznego `templateId` z URL: parametr
  // pochodzi od klienta, więc byłby niezweryfikowanym wskaźnikiem prosto do
  // generatora. Tłumaczenie indeks → rekord kanoniczny wykonuje SERWER
  // (`POST /document-studio/templates/resolve` → `resolveDocumentTemplateForCreation`),
  // który sprawdza dostęp organizacji, scope, status i to, czy rekord źródłowy
  // nadal istnieje. Dopiero wynik serwera zasila Mode 3.
  const templateArtifactIdFromQuery = (searchParams.get('templateArtifactId') || '').trim() || null;
  const [resolvedTemplateId, setResolvedTemplateId] = useState<string | null>(null);
  const [templateResolveState, setTemplateResolveState] = useState<
    'idle' | 'resolving' | 'resolved' | 'error'
  >('idle');
  const [templateResolveErrorCode, setTemplateResolveErrorCode] = useState<string | null>(null);

  // D1 (roboty tri-tryby): jawny wybór 3 trybów na wejściu, tylko za flagą
  // `ff_tri_tryby`. OFF → `triMode` false → gałąź intake renderuje wyłącznie
  // dotychczasowy `DocumentStudioIntakeForm` (bajt-identycznie).
  const triMode = isTriModeEnabled();
  // FAZA B1 (2026-07-27) — `docEntryMode === 'ai'` renderuje
  // `DocumentStudioAiEntryPanel` (dokument + Teresa z boku) zamiast
  // `DocumentStudioIntakeForm`, kiedy ON. Default OFF — patrz
  // `src/utils/zaiTeresaFlag.ts` (czeka na akcept właściciela na zrzucie).
  const zaiTeresaEnabled = isZaiTeresaEnabled();
  // 'choose' = ekran wyboru (Czysto/Z AI/Z szablonu); 'ai'/'template' = intake;
  // 'blank' = auto-tworzenie pustego dokumentu (wejście z Materiałów, patrz efekt niżej).
  const [docEntryMode, setDocEntryMode] = useState<'choose' | 'ai' | 'template' | 'blank'>(
    entryParam === 'ai'
      ? 'ai'
      : entryParam === 'template'
        ? 'template'
        : entryParam === 'blank'
          ? 'blank'
          : 'choose'
  );

  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam === 'templates' ? 'templates' : 'generate'
  );
  const [phase, setPhase] = useState<Phase>('intake');
  const [intake, setIntake] = useState<DocumentIntake | null>(null);
  const [outline, setOutline] = useState<DocumentOutline | null>(null);
  const [useLlm, setUseLlm] = useState(true);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [activeTemplateVersion, setActiveTemplateVersion] = useState<string | null>(null);
  const [activeSourceRefs, setActiveSourceRefs] = useState<GenerateDocumentParams['sourceRefs']>(
    []
  );
  const [approvedTemplates, setApprovedTemplates] = useState<DocumentTemplate[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [artifactId, setArtifactId] = useState<string | null>(null);
  const [schema, setSchema] = useState<DocumentSchema | null>(null);
  // A4 — generation-time warnings (silent-fallback surface). Passed to the
  // document panel which renders the "generated with limitations" chip.
  const [generationWarnings, setGenerationWarnings] = useState<DocumentGenerationWarning[]>([]);
  const [planning, setPlanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingArtifact, setLoadingArtifact] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // P0.1 fix (2026-07-26): resuming a document that no longer resolves (404 —
  // e.g. a report_builder/native-artifact id routed here by a stale link, or a
  // genuinely deleted document) used to fall straight into the empty Mode-1
  // intake form with `error` shown as a soft banner — indistinguishable from
  // "start a new document". That is silent data-loss-looking behavior. This is
  // a BLOCKING state instead (same pattern as `templateResolveState==='error'`
  // below): no picker, no generation, just the failure + a way back.
  // Tryb „Czysto" (`?entry=blank` / kafel w bramie trybów): trwały, wychodzalny
  // stan porażki zamiast wiecznego spinnera albo niemego „Brak wczytanego
  // dokumentu." — doktryna „zero cichych fallbacków" (patrz `BlankCreationState`).
  const [blankCreateFailed, setBlankCreateFailed] = useState(false);
  const [artifactLoadFailed, setArtifactLoadFailed] = useState(false);
  const [artifactLoadErrorCode, setArtifactLoadErrorCode] = useState<'not_found' | 'other' | null>(
    null
  );
  // C1 — progressive-generation streaming state. `streamOutline` is the outline
  // the server resolved (painted immediately from the `plan` event); it can
  // differ from the previewed Mode-1 outline (e.g. Mode 3 template outline).
  // `streamSections` tracks per-position readiness so the generating panel can
  // fill sections as they arrive.
  const [streamOutline, setStreamOutline] = useState<DocumentOutline | null>(null);
  const [streamSections, setStreamSections] = useState<GeneratingSectionState[]>([]);
  // N3 (doktryna streaming §4/§7.1) — non-blocking, honest notice shown while
  // the live SSE connection has dropped and generation continues via the
  // synchronous fallback. Replaces the previous cichy fallback (nothing shown
  // to the user while `/generate/stream` silently gave way to `/generate`).
  const [streamFallbackNotice, setStreamFallbackNotice] = useState<string | null>(null);
  // N3 (§2/§7.3) — Stop button parity with Canvas (`useCanvasAIStream.ts`).
  // `streamAbortControllerRef` holds the in-flight stream's controller so the
  // generating panel can abort it; `canStopStream` is false once the run has
  // fallen back to the non-abortable synchronous `/generate` call, so the Stop
  // button is hidden instead of becoming a dead control.
  const streamAbortControllerRef = useRef<AbortController | null>(null);
  const [canStopStream, setCanStopStream] = useState(false);

  // Aborts the in-flight stream fetch on unmount (mirrors
  // `useCanvasAIStream.ts:136-141` — closing mid-stream must not leak a fetch
  // into an unmounted view).
  useEffect(() => {
    return () => {
      streamAbortControllerRef.current?.abort();
      streamAbortControllerRef.current = null;
    };
  }, []);

  const refreshApprovedTemplates = useCallback(async (): Promise<void> => {
    try {
      const list = await listDocumentStudioTemplates({ status: 'approved' });
      setApprovedTemplates(list);
      setTemplatesError(null);
    } catch (err) {
      // L-08: the approved-template picker is a soft enhancement (Mode 3) and
      // the plain Mode 1 flow stays available — but the failure must be visible
      // instead of silently swallowed, so the user knows the picker is missing
      // because of an error rather than because no templates exist.
      setApprovedTemplates([]);
      setTemplatesError(
        err instanceof Error
          ? t('documentStudio.view.templatesLoadFailedWithReason', {
              defaultValue:
                'Approved templates could not be loaded ({{reason}}). You can still generate without a template.',
              reason: err.message,
            })
          : t(
              'documentStudio.view.templatesLoadFailed',
              'Approved templates could not be loaded. You can still generate without a template.'
            )
      );
    }
  }, [t]);

  useEffect(() => {
    void refreshApprovedTemplates();
  }, [refreshApprovedTemplates]);

  // ★ SERWEROWE rozwiązanie wzorca z Biblioteki (R1 doc slice).
  // Klient dostał tylko id wiersza indeksu; kanoniczny rekord ustala serwer,
  // sprawdzając dostęp organizacji, scope, status i istnienie źródła. Dopiero
  // wynik tego wywołania trafia do Mode 3 — nic z URL-a nie jest zaufane.
  useEffect(() => {
    if (!templateArtifactIdFromQuery) return;
    let cancelled = false;
    setTemplateResolveState('resolving');
    setTemplateResolveErrorCode(null);
    void (async () => {
      try {
        const resolved = await resolveDocumentStudioTemplate(templateArtifactIdFromQuery);
        if (cancelled) return;
        setResolvedTemplateId(resolved.canonicalTemplateId);
        setTemplateResolveState('resolved');
      } catch (err) {
        if (cancelled) return;
        const code =
          err instanceof TemplateResolveClientError ? err.code : 'TEMPLATE_RESOLVE_FAILED';
        setResolvedTemplateId(null);
        setTemplateResolveErrorCode(code);
        setTemplateResolveState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateArtifactIdFromQuery]);

  // Uczciwy komunikat per kod odrzucenia. ★ Żaden z tych stanów NIE prowadzi do
  // pickera ani do generacji z AI — wzorzec, którego nie da się rozwiązać, musi
  // zatrzymać przepływ, a nie po cichu zamienić się w Mode 1.
  const templateResolveMessage = useMemo((): string | null => {
    if (templateResolveState !== 'error') return null;
    switch (templateResolveErrorCode) {
      case 'TEMPLATE_ORPHANED':
        return t('documentStudio.view.templateOrphaned', {
          defaultValue:
            'Ten wzorzec nie ma już kanonicznego rekordu — nie ma z czego generować. Wybierz inny wzorzec w Bibliotece.',
        });
      case 'TEMPLATE_NOT_INDEXED':
        return t('documentStudio.view.templateNotIndexed', {
          defaultValue: 'Tego wzorca nie ma w Twoim indeksie Biblioteki. Wybierz inny wzorzec.',
        });
      case 'TEMPLATE_FORBIDDEN':
        return t('documentStudio.view.templateForbidden', {
          defaultValue: 'Nie masz dostępu do tego wzorca.',
        });
      // ODBIÓR NA ŻYWO 05.09 — do 05.09 ten stan wracał jako
      // TEMPLATE_FORBIDDEN i mówił właścicielowi OWNER-owi, że nie ma dostępu
      // do WŁASNEGO, oznaczonego w Bibliotece jako zatwierdzony wzorca. To był
      // nieprawdziwy komunikat: wzorzec jest widoczny i należy do organizacji,
      // brakuje mu jedynie zatwierdzonego POCHODZENIA I PRAW. Komunikat mówi
      // teraz prawdę i wskazuje istniejące wyjście z kwarantanny.
      case 'TEMPLATE_PROVENANCE_UNVERIFIED':
        return t('documentStudio.view.templateProvenanceUnverified', {
          defaultValue:
            'Ten wzorzec nie ma jeszcze zatwierdzonego pochodzenia i praw, więc nie może sterować generacją. Otwórz Bibliotekę wzorców → „Pochodzenie i prawa" i zatwierdź go (potrzebne: źródło, podstawa licencji, organ decyzyjny, wersja i dowód).',
        });
      case 'TEMPLATE_DEPRECATED':
        return t('documentStudio.view.templateDeprecated', {
          defaultValue:
            'Ten wzorzec został wycofany i nie może już sterować generacją. Wybierz aktualny wzorzec.',
        });
      case 'TEMPLATE_FORMAT_UNSUPPORTED':
        return t('documentStudio.view.templateFormatUnsupported', {
          defaultValue: 'Ten wzorzec nie tworzy dokumentu.',
        });
      default:
        return t('documentStudio.view.templateResolveFailed', {
          defaultValue: 'Nie udało się rozwiązać wzorca. Spróbuj ponownie.',
        });
    }
  }, [templateResolveState, templateResolveErrorCode, t]);

  // ★ JEDNA reguła wejścia do fazy `intake` (fail-closed dla wzorca) —
  // `intakeGate.ts`. Wyliczona TU, a nie rozsypana po łańcuchu ternary, bo
  // właśnie kolejność gałęzi w tym łańcuchu była przyczyną fail-open z 05.09.
  const intakeGate = useMemo(
    () =>
      resolveDocumentIntakeGate({
        templateArtifactId: templateArtifactIdFromQuery,
        templateResolveState,
        docEntryMode,
        triMode,
        zaiTeresaEnabled,
      }),
    [templateArtifactIdFromQuery, templateResolveState, docEntryMode, triMode, zaiTeresaEnabled]
  );

  // Uczciwy komunikat, gdy wznowienie dokumentu (?artifactId=/:artifactId) się
  // nie powiodło — najczęściej link z listy wskazujący na rekord z INNEGO
  // silnika (np. report_builder) albo dokument, który zniknął. ŻADEN z tych
  // stanów nie prowadzi do pustego intake — patrz `artifactLoadFailed` niżej.
  const artifactLoadMessage = useMemo((): string | null => {
    if (!artifactLoadFailed) return null;
    if (artifactLoadErrorCode === 'not_found') {
      return t(
        'documentStudio.view.artifactNotFound',
        'Nie znaleziono tego dokumentu. Mógł zostać usunięty albo link prowadzi do innego typu dokumentu.'
      );
    }
    return t(
      'documentStudio.view.artifactLoadFailedGeneric',
      'Nie udało się załadować dokumentu. Spróbuj ponownie za chwilę.'
    );
  }, [artifactLoadFailed, artifactLoadErrorCode, t]);

  useEffect(() => {
    if (!artifactIdFromUrl || artifactIdFromUrl === artifactId) return;
    let cancelled = false;
    setLoadingArtifact(true);
    setError(null);
    setArtifactLoadFailed(false);
    setArtifactLoadErrorCode(null);
    void (async () => {
      try {
        const result = await getDocumentStudioArtifact(artifactIdFromUrl);
        if (cancelled) return;
        setArtifactId(artifactIdFromUrl);
        setSchema(result.schema);
        setGenerationWarnings(result.generationWarnings);
        setPhase('document');
        // Normalize `?artifactId=` entries to the canonical path form so the
        // URL matches what the generation flow produces (and back/refresh stay sane).
        if (!artifactIdFromPath || initialDocumentAction) {
          navigate(`/document-studio/${encodeURIComponent(artifactIdFromUrl)}`, { replace: true });
        }
      } catch (err) {
        if (cancelled) return;
        // P0.1 fix: a failed resume (404 = no such document, or any other
        // load error) must NOT fall through to the Mode-1 intake form — that
        // reads as "start fresh", hiding the fact that the document the user
        // clicked couldn't be opened. Surface a blocking error instead.
        setError(
          err instanceof Error
            ? err.message
            : t('documentStudio.view.loadFailed', 'Failed to load document')
        );
        const status = (err as { status?: number } | null)?.status;
        setArtifactLoadErrorCode(status === 404 ? 'not_found' : 'other');
        setArtifactLoadFailed(true);
      } finally {
        if (!cancelled) setLoadingArtifact(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [artifactIdFromUrl, artifactId, artifactIdFromPath, initialDocumentAction, navigate]);

  /**
   * C1 — shared progressive-generation runner. Streams the document via SSE
   * (progressive render) and falls back to the synchronous generate path on
   * ANY transport failure so generation always completes even when streaming
   * is unavailable (old server, proxy stripping SSE, ReadableStream missing).
   *
   * On success it commits the artifact + schema + warnings and lands on the
   * `document` phase. Returns the terminal payload, or `null` when the run
   * failed and an error was already surfaced.
   *
   * `knownOutline` seeds the generating panel's skeleton before the `plan`
   * event lands (Mode 1 already has the previewed outline; Mode 3 does not).
   */
  const runStreamingGeneration = useCallback(
    async (
      params: GenerateDocumentParams,
      knownOutline: DocumentOutline | null
    ): Promise<DocumentStreamDoneEvent | null> => {
      setGenerating(true);
      setError(null);
      setStreamFallbackNotice(null);
      // Seed the progressive panel: known outline (Mode 1) or empty (Mode 3).
      setStreamOutline(knownOutline);
      setStreamSections(
        (knownOutline?.sections ?? []).map((s) => ({ title: s.title, ready: false }))
      );
      setPhase('generating');

      // N3 (§2/§7.3) — a fresh AbortController per run, mirroring
      // `useCanvasAIStream.ts:162-163`. Stoppable only while the SSE stream
      // itself is in flight; see the `canStopStream` toggles below.
      const abortController = new AbortController();
      streamAbortControllerRef.current = abortController;
      setCanStopStream(true);

      const commitDone = async (
        result: DocumentStreamDoneEvent
      ): Promise<DocumentStreamDoneEvent> => {
        streamAbortControllerRef.current = null;
        setCanStopStream(false);
        // The progressive `section` frames are presentation-only. Re-read the
        // persisted artifact at the SSE boundary before mounting the editable
        // panel, so no transient/raw LLM state can become the editor's initial
        // autosave buffer. The terminal payload remains a safe fallback for a
        // brief read-after-write transport failure.
        let canonical = result;
        try {
          const persisted = await getDocumentStudioArtifact(result.artifactId);
          canonical = {
            artifactId: result.artifactId,
            schema: persisted.schema,
            generationWarnings: persisted.generationWarnings ?? result.generationWarnings ?? [],
          };
        } catch {
          // `done.schema` is itself the server-finalized snapshot. Do not turn
          // a successful generation into an error solely because GET failed.
        }
        setArtifactId(canonical.artifactId);
        setSchema(canonical.schema);
        setGenerationWarnings(canonical.generationWarnings ?? []);
        setPhase('document');
        navigate(`/document-studio/${encodeURIComponent(canonical.artifactId)}`, { replace: true });
        return canonical;
      };

      try {
        const result = await generateDocumentStudioArtifactStream(
          params,
          {
            onPlan: (resolvedOutline) => {
              setStreamOutline(resolvedOutline);
              setStreamSections(
                resolvedOutline.sections.map((s) => ({ title: s.title, ready: false }))
              );
            },
            onSection: (event) => {
              setStreamSections((prev) => {
                const next =
                  prev.length >= event.total
                    ? [...prev]
                    : new Array(event.total)
                        .fill(null)
                        .map((_, i) => prev[i] ?? { title: '', ready: false });
                next[event.index] = {
                  title: event.title,
                  ready: true,
                  sourceRefs: dedupeSourceRefs(event.blocks),
                };
                return next;
              });
            },
            onWarning: (warning) => {
              setGenerationWarnings((prev) => [...prev, warning]);
            },
          },
          abortController.signal
        );
        return await commitDone(result);
      } catch (streamErr) {
        streamAbortControllerRef.current = null;
        setCanStopStream(false);
        // User-initiated Stop (§2/§7.3): honor it as a clean cancel, not a
        // transport failure — no fallback, no error banner. Consistent state
        // = back to the phase the user was in before generation started
        // (same pattern as Canvas's `stopStream`, which never surfaces an
        // error either).
        if (abortController.signal.aborted) {
          setGenerating(false);
          setPhase(knownOutline ? 'outline' : 'intake');
          return null;
        }
        // Structured Mode-3 preflight failure is terminal — surface, don't retry.
        if (streamErr instanceof MissingRequiredSourceError) {
          setPhase('intake');
          setError(
            t('documentStudio.view.missingRequiredSources', {
              defaultValue:
                'This template requires the following sources before it can generate: {{sources}}.',
              sources: streamErr.missing.join(', '),
            })
          );
          setGenerating(false);
          return null;
        }
        // Transport / fatal stream failure → fall back to the synchronous path
        // so the user still gets their document (§4: NIE przerywaj generacji —
        // chodzi o widoczność, nie o blokadę). Unlike the silent version this
        // replaced, the user now sees an explicit, calm notice before the
        // fallback kicks in — the żelazna zasada "zero cichych fallbacków"
        // applies here just as much as to any other retry-without-telling.
        setStreamFallbackNotice(
          t(
            'documentStudio.generating.streamFallbackNotice',
            'Połączenie na żywo zerwane — dokańczam w tle…'
          )
        );
        try {
          const sync = await generateDocumentStudioArtifact(params);
          return await commitDone({
            artifactId: sync.artifactId,
            schema: sync.schema,
            generationWarnings: sync.generationWarnings ?? [],
          });
        } catch (syncErr) {
          setPhase(knownOutline ? 'outline' : 'intake');
          if (syncErr instanceof MissingRequiredSourceError) {
            setError(
              t('documentStudio.view.missingRequiredSources', {
                defaultValue:
                  'This template requires the following sources before it can generate: {{sources}}.',
                sources: syncErr.missing.join(', '),
              })
            );
          } else {
            setError(
              syncErr instanceof Error
                ? syncErr.message
                : t('documentStudio.view.generateFailed', 'Failed to generate document artifact')
            );
          }
          return null;
        }
      } finally {
        setGenerating(false);
        setCanStopStream(false);
      }
    },
    [navigate, t]
  );

  // N3 (§2/§7.3) — user-initiated Stop, wired to `DocumentStudioGeneratingPanel`.
  // Aborts the in-flight SSE fetch; `runStreamingGeneration`'s catch block
  // detects `abortController.signal.aborted` and returns to a consistent
  // phase without falling back or surfacing an error (same contract as
  // Canvas's `stopStream`).
  const handleStopGeneration = useCallback((): void => {
    streamAbortControllerRef.current?.abort();
  }, []);

  const handleIntakeSubmit = async (
    nextIntake: DocumentIntake,
    options: IntakeSubmitOptions
  ): Promise<void> => {
    setError(null);

    // N3 (doktryna streaming §2/§7.4) — Mode 3: preview the template's
    // structure as a plan BEFORE generating, same as Mode 1. Previously this
    // skipped straight to `generating`, which was the one inconsistency the
    // doctrine calls out ("plan zawsze widoczny" must not have exceptions).
    // Reuses `DocumentStudioOutlinePanel` as-is, seeded client-side from the
    // already-loaded template's `sectionBlueprint` — zero extra round-trip.
    // Deliberately NOT an editable plan here (that's the more expensive,
    // later-phase item per doctrine §7); a single "Generate document" click
    // confirms it, same gesture speed as before, so the N11/N12 "BANG" feel
    // is preserved while still showing the structure first.
    if (options.templateId) {
      setIntake(nextIntake);
      setActiveTemplateId(options.templateId);
      setActiveTemplateVersion(options.templateVersion ?? null);
      setActiveSourceRefs(options.sourceRefs ?? []);
      setUseLlm(false);
      const template = approvedTemplates.find((tpl) => tpl.templateId === options.templateId);
      if (template) {
        setOutline(buildTemplateOutlinePreview(template, nextIntake));
        setPhase('outline');
        return;
      }
      // Defensive fallback: the form resolved a templateId that isn't in the
      // currently loaded list (stale cache / race with `refreshApprovedTemplates`).
      // Don't block the user behind a plan screen we have no data to render —
      // generate directly, same as the pre-N3 behavior.
      await runStreamingGeneration(
        {
          intake: nextIntake,
          templateId: options.templateId,
          templateVersion: options.templateVersion ?? undefined,
          sourceRefs: options.sourceRefs,
        },
        null
      );
      return;
    }

    // Mode 1: plan outline first.
    setPlanning(true);
    try {
      const result = await planDocumentStudioOutline(nextIntake, { useLlm: options.useLlm });
      setIntake(nextIntake);
      setOutline(result);
      setUseLlm(options.useLlm);
      setActiveTemplateId(null);
      setActiveTemplateVersion(null);
      setActiveSourceRefs([]);
      setPhase('outline');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.view.planFailed', 'Failed to plan document outline')
      );
    } finally {
      setPlanning(false);
    }
  };

  // FAZA B1 (2026-07-27) — buduje DocumentIntake z pojedynczej wiadomości
  // czatu zamiast 6 pól formularza. Parametry, które znikają z EKRANU
  // (Type/Density/Goal/Audience — N12), NIE znikają z SYSTEMU: dostają te
  // same domyślne co dawny `DocumentStudioIntakeForm.tsx` —
  //   documentType: undefined (= "Auto-detect from description", tak jak
  //                 domyślna opcja starego <select>),
  //   density:      'standard' (dawny `useState<DocumentDensity>('standard')`),
  //   goal:         'inform' (dawny `useState<DocumentGoal>('inform')`),
  //   audience:     undefined (dawne puste pole tekstowe).
  // Jedyna ŚWIADOMA zmiana względem formularza: `language` czyta konto
  // (i18n.language, zsynchronizowane z `users.language` na starcie sesji —
  // `src/services/languagePreference.ts`) zamiast sztywnego 'pl', którego
  // formularz nigdy nie odczytywał z konta mimo dostępnego pola.
  const buildAiChatIntake = useCallback(
    (description: string): DocumentIntake => ({
      description,
      documentType: undefined,
      language: (i18n.language || '').toLowerCase().startsWith('en') ? 'en' : 'pl',
      density: 'standard',
      goal: 'inform',
    }),
    [i18n.language]
  );

  // FAZA B1 — pierwsza wiadomość w `DocumentStudioAiEntryPanel` uruchamia
  // generację BEZPOŚREDNIO (BANG, N11/N12): bez ekranu podglądu outline'u —
  // serwer planuje outline wewnętrznie i emituje go zdarzeniem `plan`
  // (`runStreamingGeneration` sieje `knownOutline=null`,
  // `DocumentStudioGeneratingPanel` wypełnia się na żywo dopiero po tym
  // zdarzeniu). Auto-grounding (org + projekty + inicjatywy) dzieje się PO
  // STRONIE SERWERA identycznie jak dla każdego innego wywołania
  // `/generate/stream` — patrz
  // `server/src/services/documentStudio/documentOrgContextSourcePack.ts`
  // i `autoGroundGenerateRequest` w `document-studio.routes.ts`.
  // ★ N3 (2026-07-28, doktryna streaming §7.4): Mode 3 (z szablonu) dostał
  // ekran planu, żeby domknąć niespójność "plan czasem pomijany". Ta ścieżka
  // (`entry=ai`, flaga `ff_zai_teresa`, domyślnie OFF) świadomie NIE dostała
  // tej samej zmiany — poza zakresem tego zadania (dotyczy tylko trybu
  // szablonu) i poza zakresem dozwolonych dotknięć `entry=ai` w tej sesji.
  // Do rozważenia osobno, jeśli/gdy `ff_zai_teresa` wejdzie do akceptu.
  const handleAiChatFirstMessage = useCallback(
    async (description: string): Promise<void> => {
      setError(null);
      const nextIntake = buildAiChatIntake(description);
      setIntake(nextIntake);
      setActiveTemplateId(null);
      setActiveTemplateVersion(null);
      setActiveSourceRefs([]);
      setUseLlm(true);
      await runStreamingGeneration({ intake: nextIntake, useLlm: true }, null);
    },
    [buildAiChatIntake, runStreamingGeneration]
  );

  const handleGenerate = async (): Promise<void> => {
    if (!intake || !outline) return;
    await runStreamingGeneration(
      {
        intake,
        // Mode 1: `outline` came from `/plan` (possibly LLM-refined) and MUST
        // be sent to the server as-is. Mode 3 (template, `activeTemplateId`
        // set): `outline` here is the client-side preview
        // (`buildTemplateOutlinePreview`) shown on the plan screen above —
        // intentionally NOT sent over the wire, so the server stays the one
        // source of truth for the template's canonical outline
        // (`outlineFromTemplate` in `documentStudioService.ts`), exactly like
        // before N3 added the preview screen. `knownOutline` (2nd arg) still
        // gets the preview either way, so the generating panel's section
        // skeleton is seeded instantly instead of waiting for the `plan` event.
        outline: activeTemplateId ? undefined : outline,
        useLlm,
        templateId: activeTemplateId ?? undefined,
        templateVersion: activeTemplateVersion ?? undefined,
        sourceRefs: activeSourceRefs,
      },
      outline
    );
  };

  // D1 tryb ①CZYSTO — pusty dokument otwarty w edytorze, BEZ AI.
  //
  // ★ BLOKER 06.09 (audyt B3, `evidence/audyt-mvp-20260906/B3/RAPORT_B3.md`):
  // ta ścieżka szła przez `runStreamingGeneration`, czyli przez SSE z
  // `AbortController`, który efekt sprzątający na odmontowaniu (linia ~292)
  // przerywa. W React StrictMode efekty mount/cleanup/mount lecą w JEDNYM
  // commicie, więc `abort()` padał ZANIM `fetch` w ogóle wystartował: zero
  // żądań do `/document-studio/generate*` (zmierzone na żywo), a `catch`
  // widział `signal.aborted` i cicho ustawiał `phase='outline'` przy
  // `outline === null` → ostatnia gałąź ternary → nieme „Brak wczytanego
  // dokumentu." bez błędu w konsoli i bez wyjścia. Ref-guard `fire-once`
  // dodatkowo blokował ponowną próbę w drugim przebiegu efektu.
  //
  // Pusty dokument nie ma CO streamować (jedna pusta sekcja, `useLlm:false`,
  // deterministyczny builder), więc idzie teraz PROSTO przez synchroniczne
  // `POST /document-studio/generate` — bez `AbortSignal`, więc odmontowanie
  // ani StrictMode nie mają jak go ubić. Porażka nie jest cicha: `failed`
  // renderuje `BlankCreationState` z polskim komunikatem i „Spróbuj ponownie".
  const handleCreateEmptyDoc = useCallback(async (): Promise<void> => {
    const emptyOutline: DocumentOutline = {
      documentType: 'generic_document',
      title: t('documentStudio.blank.title', 'Nowy dokument'),
      sections: [
        {
          title: t('documentStudio.blank.section', 'Sekcja 1'),
          level: 1,
          purpose: '',
          expectedLengthHint: 'short',
        },
      ],
      recommendedDensity: 'concise',
      recommendedRegister: 'professional',
      recommendedLanguageStyle: 'formal',
    };
    const emptyIntake: DocumentIntake = {
      title: t('documentStudio.blank.title', 'Nowy dokument'),
      description: t(
        'documentStudio.blank.description',
        'Pusty dokument roboczy do samodzielnej edycji.'
      ),
      documentType: 'generic_document',
      language: 'pl',
      density: 'concise',
    };
    setError(null);
    setBlankCreateFailed(false);
    setGenerating(true);
    try {
      const created = await generateDocumentStudioArtifact({
        intake: emptyIntake,
        outline: emptyOutline,
        useLlm: false,
      });
      setArtifactId(created.artifactId);
      setSchema(created.schema);
      setGenerationWarnings(created.generationWarnings ?? []);
      setPhase('document');
      navigate(`/document-studio/${encodeURIComponent(created.artifactId)}`, { replace: true });
    } catch (err) {
      setBlankCreateFailed(true);
      setError(
        err instanceof Error && err.message
          ? err.message
          : t('documentStudio.blank.failed', 'Nie udało się utworzyć pustego dokumentu.')
      );
    } finally {
      setGenerating(false);
    }
  }, [navigate, t]);

  // Materiały wspólny launcher — `?entry=blank`: materializuj pusty dokument
  // automatycznie, bez wymagania drugiego kliknięcia „Czysto" na tym ekranie.
  // Ref guard: fire-once (StrictMode double-invoke / re-renders bezpieczne).
  const blankAutoTriggered = React.useRef(false);
  useEffect(() => {
    if (docEntryMode !== 'blank' || blankAutoTriggered.current) return;
    // Fail-closed (05.09, różnica #5): `?entry=blank&templateArtifactId=…` NIE
    // MOŻE po cichu wyprodukować pustego dokumentu, kiedy w adresie stoi
    // wzorzec, którego serwer jeszcze nie potwierdził albo wprost odrzucił.
    // Sam render jest już zabezpieczony (brama wzorca idzie pierwsza), ale ten
    // efekt woła generator NIEZALEŻNIE od tego, co się renderuje — bez tej
    // linii powstawałby realny artefakt „w tle" za blokującym ekranem.
    if (templateArtifactIdFromQuery && templateResolveState !== 'resolved') return;
    blankAutoTriggered.current = true;
    void handleCreateEmptyDoc();
  }, [docEntryMode, handleCreateEmptyDoc, templateArtifactIdFromQuery, templateResolveState]);

  // U1 (odbiór "menu pliku", 2026-07-28) — this is now reachable from more
  // than one place (File menu "Nowy" in both phases, the canvas's own
  // "Start over" button) and moved OUT of the top-left arrow slot precisely
  // because it looks like simple navigation but actually discards the
  // in-progress view. Guard it once, here, for every caller: skip the
  // confirm when there is nothing to lose (already on a blank intake), so
  // it doesn't become annoying friction on the one screen where it's a
  // true no-op. The document itself is NOT deleted (autosaved server-side,
  // reachable again via File → Otwórz) — the confirm copy says exactly
  // that instead of implying data loss that doesn't actually happen.
  const handleStartOver = async (): Promise<void> => {
    if (
      phase !== 'intake' &&
      !(await requestConfirm(
        t(
          'documentStudio.view.startOverConfirm',
          'Zamknąć ten dokument i zacząć nowy? Bieżący dokument jest zapisany — możesz do niego wrócić przez „Otwórz” w menu Plik.'
        )
      ))
    ) {
      return;
    }
    setPhase('intake');
    setDocEntryMode('choose');
    setIntake(null);
    setOutline(null);
    setUseLlm(false);
    setActiveTemplateId(null);
    setActiveTemplateVersion(null);
    setActiveSourceRefs([]);
    setArtifactId(null);
    setSchema(null);
    setGenerationWarnings([]);
    setStreamOutline(null);
    setStreamSections([]);
    setError(null);
    navigate('/document-studio', { replace: true });
  };

  const handleBackToIntake = (): void => {
    setPhase('intake');
    setOutline(null);
    setError(null);
  };

  // D1 tri-tryby: powrót z formularza intake do ekranu wyboru 3 trybów.
  const handleBackToModes = useCallback((): void => {
    setDocEntryMode('choose');
    setError(null);
  }, []);

  // L-07: the tab strip is expressed as MELS TopBar toggle chips so Document
  // Studio shares the same canonical chrome as the other executive modules
  // (Wordy / Tabele / Prezentacje). In the `document` phase the rendered
  // artifact owns its own full ExecutiveModuleShell (with its own TopBar), so
  // the View-level TopBar is intentionally suppressed there to avoid a double bar.
  const showDocumentShell = activeTab === 'generate' && phase === 'document';

  const tabChips = useMemo<TopBarChipDescriptor[]>(
    () => [
      {
        id: 'generate',
        label: t('documentStudio.view.tabGenerate', 'Generate'),
        icon: Sparkles,
        kind: 'toggle',
        // Mode switch — secondary tier (editor-shell-canon § 2 STREFA GÓRNA);
        // these are the doc-studio segmented modes, not the run action.
        group: 'secondary',
        active: activeTab === 'generate',
        onClick: () => setActiveTab('generate'),
        tooltip: t(
          'documentStudio.view.tabGenerateTooltip',
          'Mode 1 / Mode 3 — intake → outline → document.'
        ),
      },
      {
        id: 'templates',
        label: t('documentStudio.view.tabPlanTemplate', 'Plan template'),
        icon: Layers,
        kind: 'toggle',
        group: 'secondary',
        active: activeTab === 'templates',
        onClick: () => setActiveTab('templates'),
        tooltip: t(
          'documentStudio.view.tabPlanTemplateTooltip',
          'Mode 2 — Document Template Architect.'
        ),
      },
    ],
    [activeTab, t]
  );

  return (
    <div
      data-testid="document-studio-view"
      className="flex h-full min-h-0 flex-col bg-c-surface-raised"
    >
      {promptDialog}
      {showDocumentShell ? null : (
        <TopBar
          moduleLabel={t('documentStudio.view.moduleLabel', 'Document Studio')}
          // P1.3 (plan dokończenia Materiałów): tytuł dublował moduleLabel
          // 1:1 ("Document Studio › Consultify Document Studio" — sama
          // marka, zero informacji). Brak jeszcze realnego dokumentu na tej
          // fazie (intake/plan szablonu), więc tytuł = aktualny tryb pracy
          // (te same etykiety co w `tabChips` wyżej — bez nowego klucza i18n).
          title={
            activeTab === 'templates'
              ? t('documentStudio.view.tabPlanTemplate', 'Plan template')
              : t('documentStudio.view.tabGenerate', 'Generate')
          }
          chips={tabChips}
          respectMelsOrder={false}
          // N20 (menu pliku) — same "Plik" dropdown as the document phase
          // (`DocumentStudioDocumentPanel`), so the operation set (Nowy ·
          // Otwórz · Zapisz · Zapisz jako) is consistent across EVERY
          // Document Studio screen, not just the ones with a document open.
          // No artifact exists yet on this phase (intake/outline/plan
          // template) — Zapisz/Zapisz jako are disabled rather than faked.
          // U3 — `leadingActionSlot` (not `primaryActionSlot`, which renders
          // last/rightmost, nor `titleTrailingSlot`, a separate flex sibling
          // that adds its own width+gap — see U5) puts "Plik" first inside
          // the SAME chip row, ahead of the tab chips, per "pierwsze
          // przyciski jak w Wordzie".
          leadingActionSlot={
            <DocumentStudioFileMenu
              onNew={handleStartOver}
              onOpen={() => navigate('/presentations?tab=documents')}
              saveStatus={undefined}
            />
          }
          // FAZA B3 (2026-07-27): wejście w Document Studio wyrzucało z
          // powłoki Materiałów — brak drogi powrotnej poza przeglądarkowym
          // "Wstecz". MainLayout breadcrumb dostał klikalny pierwszy segment
          // "Materiały" równolegle; ten przycisk jest drugą, redundantną ale
          // tanią afordancją bezpośrednio w studiu (ten sam cel co istniejący
          // "Wróć do Materiałów" w stanie błędu ładowania, patrz niżej).
          onBack={() => navigate('/presentations?tab=documents')}
          backLabel={t('documentStudio.view.backToMaterials', 'Wróć do Materiałów')}
          presenceSlot={
            <span className="hidden text-[11px] text-c-text-muted lg:inline">
              {t('documentStudio.view.presenceNote', 'Modes 1, 2, 3 · Word/PDF artifact runtime')}
            </span>
          }
        />
      )}

      <main className="flex h-full min-h-0 flex-col">
        {activeTab === 'templates' ? (
          <DocumentStudioTemplateArchitectView
            onTemplateApproved={() => {
              void refreshApprovedTemplates();
            }}
          />
        ) : loadingArtifact ? (
          <LoadingState
            variant="spinner"
            label={t('documentStudio.view.loadingDocument', 'Loading document…')}
            className="flex-1"
          />
        ) : artifactLoadFailed ? (
          // P0.1 fix (2026-07-26): blocking state, same pattern as
          // `template-resolve-error` above — a document that failed to load
          // must never silently present as "start a new document".
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            <div
              data-testid="document-load-error"
              className="w-full max-w-md rounded-2xl border border-c-border-subtle bg-c-surface p-8 text-center shadow-sm"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-c-surface-raised">
                <FileQuestion className="h-6 w-6 text-c-text-muted" aria-hidden="true" />
              </div>
              <h2 className="mb-2 text-base font-semibold text-c-text">
                {t('documentStudio.view.artifactNotFoundTitle', 'Nie ma tu dokumentu')}
              </h2>
              <p className="text-sm leading-relaxed text-c-text-secondary">{artifactLoadMessage}</p>
              <button
                type="button"
                onClick={() => navigate('/presentations?tab=documents')}
                className="mt-6 rounded-lg border border-c-border-strong bg-c-surface-raised px-4 py-2 text-sm font-medium text-c-text transition-colors hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {t('documentStudio.view.backToMaterials', 'Wróć do Materiałów')}
              </button>
            </div>
          </div>
        ) : phase === 'intake' ? (
          // ODBIÓR NA ŻYWO 05.09 (różnica #5) — o wejściu decyduje JEDNA czysta
          // funkcja `resolveDocumentIntakeGate` (patrz `intakeGate.ts`), a nie
          // kolejność gałęzi w tym ternary. Wcześniej `blank`/`choose` stały
          // wyżej niż sprawdzenie wzorca, przez co blokada „Nie da się użyć
          // tego wzorca" działała tylko przy `entry=template` (fail-open).
          intakeGate === 'template-resolving' ? (
            <LoadingState
              variant="spinner"
              label={t('documentStudio.view.templateResolving', 'Sprawdzam wybrany wzorzec…')}
              className="flex-1"
            />
          ) : intakeGate === 'template-blocked' ? (
            <TemplateResolveBlockedCard
              message={templateResolveMessage}
              errorCode={templateResolveErrorCode}
              onBack={() => navigate('/presentations?tab=templates')}
            />
          ) : intakeGate === 'blank-creating' ? (
            // BLOKER 06.09: sukces przełącza `phase` na `document`, więc ta
            // gałąź znika sama. Porażka MUSI zostawić trwały, wychodzalny ślad
            // (a nie spinner bez końca ani nieme „Brak wczytanego dokumentu.").
            <BlankCreationState
              status={blankCreateFailed ? 'failed' : 'creating'}
              creatingLabel={t('documentStudio.blank.creating', 'Tworzenie pustego dokumentu…')}
              failedMessage={
                error ??
                t(
                  'documentStudio.blank.failed',
                  'Nie udało się utworzyć pustego dokumentu. Spróbuj ponownie albo wróć do Materiałów.'
                )
              }
              onRetry={() => void handleCreateEmptyDoc()}
              retryLabel={t('documentStudio.blank.retry', 'Spróbuj ponownie')}
              onBack={() => navigate('/presentations?tab=documents')}
              backLabel={t('documentStudio.view.backToMaterials', 'Wróć do Materiałów')}
              testId="document-studio-blank"
            />
          ) : intakeGate === 'mode-chooser' ? (
            <TriModeChooser
              busy={generating}
              showTemplate={approvedTemplates.length > 0}
              heading={t('documentStudio.tri.heading', 'Jak chcesz zacząć dokument?')}
              subheading={t(
                'documentStudio.tri.subheading',
                'Wybierz tryb — wszystkie trzy są równorzędne.'
              )}
              clean={{
                title: t('documentStudio.tri.cleanTitle', 'Czysto'),
                desc: t(
                  'documentStudio.tri.cleanDesc',
                  'Pusty dokument w edytorze. Piszesz sam, bez AI.'
                ),
              }}
              ai={{
                title: t('documentStudio.tri.aiTitle', 'Z AI'),
                desc: t(
                  'documentStudio.tri.aiDesc',
                  'Opisz dokument — Studio zaplanuje strukturę i pierwszą wersję.'
                ),
              }}
              template={{
                title: t('documentStudio.tri.templateTitle', 'Z szablonu'),
                desc: t(
                  'documentStudio.tri.templateDesc',
                  'Zacznij od zatwierdzonego szablonu i dostosuj treść.'
                ),
              }}
              onClean={handleCreateEmptyDoc}
              onAi={() => setDocEntryMode('ai')}
              onTemplate={() => setDocEntryMode('template')}
            />
          ) : intakeGate === 'ai-entry' ? (
            // FAZA B1 (2026-07-27, flaga `ff_zai_teresa`, default OFF) — N11:
            // „Z AI → otwiera się dokument, a Z BOKU okno AI (czat)." Zero pól
            // formularza; pierwsza wiadomość w czacie uruchamia generację.
            <DocumentStudioAiEntryPanel
              onFirstMessage={handleAiChatFirstMessage}
              busy={planning || generating}
              error={phase === 'intake' ? error : null}
              onBackToModes={triMode ? handleBackToModes : undefined}
            />
          ) : (
            <DocumentStudioIntakeForm
              onSubmit={handleIntakeSubmit}
              loading={planning || generating}
              error={phase === 'intake' ? error : null}
              approvedTemplates={approvedTemplates}
              templatesNotice={phase === 'intake' ? templatesError : null}
              // ★ Preselekcja Mode 3 wzorcem ROZWIĄZANYM PRZEZ SERWER.
              initialTemplateId={resolvedTemplateId}
              autoFocusTemplatePicker={
                (triMode && docEntryMode === 'template') ||
                (entryParam === 'template' && !templateArtifactIdFromQuery)
              }
              onBackToModes={triMode ? handleBackToModes : undefined}
            />
          )
        ) : phase === 'outline' && outline ? (
          <DocumentStudioOutlinePanel
            outline={outline}
            onGenerate={handleGenerate}
            onBack={handleBackToIntake}
            generating={generating}
            error={phase === 'outline' ? error : null}
          />
        ) : phase === 'generating' ? (
          <DocumentStudioGeneratingPanel
            outline={streamOutline}
            sections={streamSections}
            error={phase === 'generating' ? error : null}
            notice={streamFallbackNotice}
            onStop={handleStopGeneration}
            canStop={canStopStream}
          />
        ) : phase === 'document' && schema && artifactId ? (
          <DocumentStudioDocumentPanel
            artifactId={artifactId}
            schema={schema}
            initialOverflowToolId={initialDocumentAction ?? undefined}
            generationWarnings={generationWarnings}
            onStartOver={handleStartOver}
            onSchemaUpdated={setSchema}
          />
        ) : (
          // Ostatnia deska: stan, w którym `phase` nie pasuje do żadnego panelu
          // (np. powrót na `outline` bez konspektu po przerwanym strumieniu).
          // Do 06.09 był to NIEMY napis „Brak wczytanego dokumentu." bez
          // jednego przycisku — ślepy zaułek nie do odróżnienia od zawieszenia.
          // Teraz zawsze mówi po polsku, co się stało, i daje drogę dalej.
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            <div
              data-testid="document-studio-dead-end"
              className="w-full max-w-md rounded-2xl border border-c-border-subtle bg-c-surface p-8 text-center shadow-sm"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-c-surface-raised">
                <FileQuestion className="h-6 w-6 text-c-text-muted" aria-hidden="true" />
              </div>
              <p className="text-sm leading-relaxed text-c-text-secondary">
                {error ??
                  t(
                    'documentStudio.view.noDocumentActionable',
                    'Nie udało się otworzyć dokumentu. Spróbuj ponownie albo wróć do Materiałów.'
                  )}
              </p>
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setPhase('intake');
                    setDocEntryMode(triMode ? 'choose' : 'template');
                  }}
                  className="rounded-lg border border-c-border-strong bg-c-surface-raised px-4 py-2 text-sm font-medium text-c-text transition-colors hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  {t('documentStudio.blank.retry', 'Spróbuj ponownie')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/presentations?tab=documents')}
                  className="rounded-lg border border-c-border-strong bg-c-surface-raised px-4 py-2 text-sm font-medium text-c-text transition-colors hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  {t('documentStudio.view.backToMaterials', 'Wróć do Materiałów')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DocumentStudioView;
