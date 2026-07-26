/**
 * Consultify Document Studio — View.
 *
 * Tabs:
 *   - Generate: Mode 1 (intake -> outline -> document) and Mode 3 (intake +
 *     approved template -> document, no outline preview).
 *   - Plan template: Mode 2 — Document Template Architect.
 *
 * Routed at /document-studio (and /document-studio/:artifactId for resume).
 * See docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md.
 */

import { Layers, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { TopBar, type TopBarChipDescriptor } from '@/components/shared/ExecutiveModuleShell';
import { TriModeChooser } from '@/components/shared/TriModeChooser';
import { LoadingState } from '@/components/ui/primitives';
import { isTriModeEnabled } from '@/utils/triModeFlag';

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
import { DocumentStudioDocumentPanel } from './DocumentStudioDocumentPanel';
import {
  DocumentStudioGeneratingPanel,
  type GeneratingSectionState,
} from './DocumentStudioGeneratingPanel';
import { DocumentStudioIntakeForm, type IntakeSubmitOptions } from './DocumentStudioIntakeForm';
import { DocumentStudioOutlinePanel } from './DocumentStudioOutlinePanel';
import { DocumentStudioTemplateArchitectView } from './DocumentStudioTemplateArchitectView';
import type {
  DocumentGenerationWarning,
  DocumentIntake,
  DocumentOutline,
  DocumentSchema,
  DocumentTemplate,
} from './types';

type Phase = 'intake' | 'outline' | 'generating' | 'document';
type Tab = 'generate' | 'templates';

export const DocumentStudioView: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const templateArtifactIdFromQuery =
    (searchParams.get('templateArtifactId') || '').trim() || null;
  const [resolvedTemplateId, setResolvedTemplateId] = useState<string | null>(null);
  const [templateResolveState, setTemplateResolveState] = useState<
    'idle' | 'resolving' | 'resolved' | 'error'
  >('idle');
  const [templateResolveErrorCode, setTemplateResolveErrorCode] = useState<string | null>(null);

  // D1 (roboty tri-tryby): jawny wybór 3 trybów na wejściu, tylko za flagą
  // `ff_tri_tryby`. OFF → `triMode` false → gałąź intake renderuje wyłącznie
  // dotychczasowy `DocumentStudioIntakeForm` (bajt-identycznie).
  const triMode = isTriModeEnabled();
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

  const [activeTab, setActiveTab] = useState<Tab>(tabParam === 'templates' ? 'templates' : 'generate');
  const [phase, setPhase] = useState<Phase>('intake');
  const [intake, setIntake] = useState<DocumentIntake | null>(null);
  const [outline, setOutline] = useState<DocumentOutline | null>(null);
  const [useLlm, setUseLlm] = useState(true);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
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
          defaultValue:
            'Tego wzorca nie ma w Twoim indeksie Biblioteki. Wybierz inny wzorzec.',
        });
      case 'TEMPLATE_FORBIDDEN':
        return t('documentStudio.view.templateForbidden', {
          defaultValue: 'Nie masz dostępu do tego wzorca.',
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
        if (!artifactIdFromPath) {
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
  }, [artifactIdFromUrl, artifactId, artifactIdFromPath, navigate]);

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
      // Seed the progressive panel: known outline (Mode 1) or empty (Mode 3).
      setStreamOutline(knownOutline);
      setStreamSections(
        (knownOutline?.sections ?? []).map((s) => ({ title: s.title, ready: false }))
      );
      setPhase('generating');

      const commitDone = (result: DocumentStreamDoneEvent): DocumentStreamDoneEvent => {
        setArtifactId(result.artifactId);
        setSchema(result.schema);
        setGenerationWarnings(result.generationWarnings ?? []);
        setPhase('document');
        navigate(`/document-studio/${encodeURIComponent(result.artifactId)}`, { replace: true });
        return result;
      };

      try {
        const result = await generateDocumentStudioArtifactStream(params, {
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
              next[event.index] = { title: event.title, ready: true };
              return next;
            });
          },
          onWarning: (warning) => {
            setGenerationWarnings((prev) => [...prev, warning]);
          },
        });
        return commitDone(result);
      } catch (streamErr) {
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
        // so the user still gets their document.
        try {
          const sync = await generateDocumentStudioArtifact(params);
          return commitDone({
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
      }
    },
    [navigate, t]
  );

  const handleIntakeSubmit = async (
    nextIntake: DocumentIntake,
    options: IntakeSubmitOptions
  ): Promise<void> => {
    setError(null);

    // Mode 3: skip outline preview and generate directly (streamed).
    if (options.templateId) {
      setIntake(nextIntake);
      setActiveTemplateId(options.templateId);
      setUseLlm(false);
      await runStreamingGeneration({ intake: nextIntake, templateId: options.templateId }, null);
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

  const handleGenerate = async (): Promise<void> => {
    if (!intake || !outline) return;
    await runStreamingGeneration(
      {
        intake,
        outline,
        useLlm,
        templateId: activeTemplateId ?? undefined,
      },
      outline
    );
  };

  // D1 tryb ①CZYSTO — pusty dokument otwarty w edytorze, BEZ AI. Nie ma osobnej
  // ścieżki create-empty-draft w documentStudio API (zbadane), więc reużywamy
  // istniejącego kanału materializacji z `useLlm:false` (deterministyczny builder,
  // zero LLM) i minimalnym, jedno-sekcyjnym outlinem. Ląduje w fazie `document`
  // (edytor TipTap), gdzie użytkownik pisze ręcznie.
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
    await runStreamingGeneration(
      { intake: emptyIntake, outline: emptyOutline, useLlm: false },
      emptyOutline
    );
  }, [runStreamingGeneration, t]);

  // Materiały wspólny launcher — `?entry=blank`: materializuj pusty dokument
  // automatycznie, bez wymagania drugiego kliknięcia „Czysto" na tym ekranie.
  // Ref guard: fire-once (StrictMode double-invoke / re-renders bezpieczne).
  const blankAutoTriggered = React.useRef(false);
  useEffect(() => {
    if (docEntryMode !== 'blank' || blankAutoTriggered.current) return;
    blankAutoTriggered.current = true;
    void handleCreateEmptyDoc();
  }, [docEntryMode, handleCreateEmptyDoc]);

  const handleStartOver = (): void => {
    setPhase('intake');
    setDocEntryMode('choose');
    setIntake(null);
    setOutline(null);
    setUseLlm(false);
    setActiveTemplateId(null);
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
          <div
            data-testid="document-load-error"
            className="mx-auto max-w-xl rounded-xl border border-c-border bg-c-surface p-6 text-center"
          >
            <p className="text-sm text-c-text">{artifactLoadMessage}</p>
            <button
              type="button"
              onClick={() => navigate('/presentations?tab=documents')}
              className="mt-4 rounded-lg border border-c-border px-3 py-2 text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {t('documentStudio.view.backToMaterials', 'Wróć do Materiałów')}
            </button>
          </div>
        ) : phase === 'intake' ? (
          docEntryMode === 'blank' ? (
            <LoadingState
              variant="spinner"
              label={t('documentStudio.blank.creating', 'Tworzenie pustego dokumentu…')}
              className="flex-1"
            />
          ) : triMode && docEntryMode === 'choose' ? (
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
          ) : templateResolveState === 'resolving' ? (
            // Serwer właśnie tłumaczy id indeksu na rekord kanoniczny — nie
            // pokazujemy pickera, żeby użytkownik nie zaczął wybierać ręcznie
            // wzorca, który za chwilę i tak zostanie ustawiony.
            <LoadingState
              message={t('documentStudio.view.templateResolving', 'Sprawdzam wybrany wzorzec…')}
            />
          ) : templateResolveState === 'error' ? (
            // ★ Stan blokujący: wzorzec nie do rozwiązania (osierocony, brak
            // dostępu, wycofany, niezaindeksowany). ŻADNEGO fallbacku do
            // pickera ani do generacji z AI — uczciwy komunikat i wyjście.
            <div
              data-testid="template-resolve-error"
              className="mx-auto max-w-xl rounded-xl border border-c-border bg-c-surface p-6 text-center"
            >
              <p className="text-sm text-c-text">{templateResolveMessage}</p>
              <button
                type="button"
                onClick={() => navigate('/presentations?tab=templates')}
                className="mt-4 rounded-lg border border-c-border px-3 py-2 text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {t('documentStudio.view.backToLibrary', 'Wróć do Biblioteki wzorców')}
              </button>
            </div>
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
          />
        ) : phase === 'document' && schema && artifactId ? (
          <DocumentStudioDocumentPanel
            artifactId={artifactId}
            schema={schema}
            generationWarnings={generationWarnings}
            onStartOver={handleStartOver}
            onSchemaUpdated={setSchema}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-c-text-muted">
            {error ?? t('documentStudio.view.noDocument', 'No document loaded.')}
          </div>
        )}
      </main>
    </div>
  );
};

export default DocumentStudioView;
