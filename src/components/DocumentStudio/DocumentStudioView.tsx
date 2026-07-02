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
  getDocumentStudioArtifact,
  listDocumentStudioTemplates,
  MissingRequiredSourceError,
  planDocumentStudioOutline,
} from './api';
import { DocumentStudioDocumentPanel } from './DocumentStudioDocumentPanel';
import { DocumentStudioIntakeForm, type IntakeSubmitOptions } from './DocumentStudioIntakeForm';
import { DocumentStudioOutlinePanel } from './DocumentStudioOutlinePanel';
import { DocumentStudioTemplateArchitectView } from './DocumentStudioTemplateArchitectView';
import type { DocumentIntake, DocumentOutline, DocumentSchema, DocumentTemplate } from './types';

type Phase = 'intake' | 'outline' | 'document';
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
  const [planning, setPlanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingArtifact, setLoadingArtifact] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          ? `Approved templates could not be loaded (${err.message}). You can still generate without a template.`
          : 'Approved templates could not be loaded. You can still generate without a template.'
      );
    }
  }, []);

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
        setSchema(result);
        setPhase('document');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load document');
      } finally {
        if (!cancelled) setLoadingArtifact(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [artifactIdFromUrl, artifactId]);

  const handleIntakeSubmit = async (
    nextIntake: DocumentIntake,
    options: IntakeSubmitOptions
  ): Promise<void> => {
    setError(null);

    // Mode 3: skip outline preview and generate directly.
    if (options.templateId) {
      setIntake(nextIntake);
      setActiveTemplateId(options.templateId);
      setUseLlm(false);
      setGenerating(true);
      try {
        const result = await generateDocumentStudioArtifact({
          intake: nextIntake,
          templateId: options.templateId,
        });
        setArtifactId(result.artifactId);
        setSchema(result.schema);
        setPhase('document');
        navigate(`/document-studio/${encodeURIComponent(result.artifactId)}`, { replace: true });
      } catch (err) {
        if (err instanceof MissingRequiredSourceError) {
          setError(
            `This template requires the following sources before it can generate: ${err.missing.join(
              ', '
            )}.`
          );
        } else {
          setError(err instanceof Error ? err.message : 'Failed to generate from template');
        }
      } finally {
        setGenerating(false);
      }
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
      setError(err instanceof Error ? err.message : 'Failed to plan document outline');
    } finally {
      setPlanning(false);
    }
  };

  const handleGenerate = async (): Promise<void> => {
    if (!intake || !outline) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateDocumentStudioArtifact({
        intake,
        outline,
        useLlm,
        templateId: activeTemplateId ?? undefined,
      });
      setArtifactId(result.artifactId);
      setSchema(result.schema);
      setPhase('document');
      navigate(`/document-studio/${encodeURIComponent(result.artifactId)}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate document artifact');
    } finally {
      setGenerating(false);
    }
  };

  const handleStartOver = (): void => {
    setPhase('intake');
    setIntake(null);
    setOutline(null);
    setUseLlm(false);
    setActiveTemplateId(null);
    setArtifactId(null);
    setSchema(null);
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
        label: 'Generate',
        icon: Sparkles,
        kind: 'toggle',
        active: activeTab === 'generate',
        onClick: () => setActiveTab('generate'),
        tooltip: 'Generuj dokument',
      },
      {
        id: 'templates',
        label: 'Plan template',
        icon: Layers,
        kind: 'toggle',
        active: activeTab === 'templates',
        onClick: () => setActiveTab('templates'),
        tooltip: 'Szablon dokumentu',
      },
    ],
    [activeTab]
  );

  return (
    <div
      data-testid="document-studio-view"
      className="flex h-full min-h-0 flex-col bg-slate-50 dark:bg-navy-950"
    >
      {showDocumentShell ? null : (
        <TopBar
          moduleLabel="Document Studio"
          title={t('documentStudio.view.title', 'Consultify Document Studio')}
          chips={tabChips}
          respectMelsOrder={false}
          presenceSlot={
            <span className="hidden text-[11px] text-c-text-muted lg:inline">
              Modes 1, 2, 3 · Word/PDF artifact runtime
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
          <LoadingState variant="spinner" label="Loading document…" className="flex-1" />
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
        ) : phase === 'document' && schema && artifactId ? (
          <DocumentStudioDocumentPanel
            artifactId={artifactId}
            schema={schema}
            onStartOver={handleStartOver}
            onSchemaUpdated={setSchema}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-c-text-muted">
            {error ?? 'No document loaded.'}
          </div>
        )}
      </main>
    </div>
  );
};

export default DocumentStudioView;
