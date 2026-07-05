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
import { useNavigate, useParams } from 'react-router-dom';

import { TopBar, type TopBarChipDescriptor } from '@/components/shared/ExecutiveModuleShell';
import { LoadingState } from '@/components/ui/primitives';

import {
  generateDocumentStudioArtifact,
  generateDocumentStudioArtifactStream,
  getDocumentStudioArtifact,
  listDocumentStudioTemplates,
  MissingRequiredSourceError,
  planDocumentStudioOutline,
  type DocumentStreamDoneEvent,
  type GenerateDocumentParams,
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
  const { artifactId: artifactIdFromUrl } = useParams<{ artifactId?: string }>();

  const [activeTab, setActiveTab] = useState<Tab>('generate');
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

  useEffect(() => {
    if (!artifactIdFromUrl || artifactIdFromUrl === artifactId) return;
    let cancelled = false;
    setLoadingArtifact(true);
    setError(null);
    void (async () => {
      try {
        const result = await getDocumentStudioArtifact(artifactIdFromUrl);
        if (cancelled) return;
        setArtifactId(artifactIdFromUrl);
        setSchema(result.schema);
        setGenerationWarnings(result.generationWarnings);
        setPhase('document');
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : t('documentStudio.view.loadFailed', 'Failed to load document')
        );
      } finally {
        if (!cancelled) setLoadingArtifact(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [artifactIdFromUrl, artifactId]);

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
              const next = prev.length >= event.total ? [...prev] : new Array(event.total)
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
      await runStreamingGeneration(
        { intake: nextIntake, templateId: options.templateId },
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

  const handleStartOver = (): void => {
    setPhase('intake');
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
          title={t('documentStudio.view.title', 'Consultify Document Studio')}
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
        ) : phase === 'intake' ? (
          <DocumentStudioIntakeForm
            onSubmit={handleIntakeSubmit}
            loading={planning || generating}
            error={phase === 'intake' ? error : null}
            approvedTemplates={approvedTemplates}
            templatesNotice={phase === 'intake' ? templatesError : null}
          />
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
