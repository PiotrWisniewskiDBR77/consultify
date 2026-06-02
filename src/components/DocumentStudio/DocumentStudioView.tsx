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
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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
  const navigate = useNavigate();
  const { artifactId: artifactIdFromUrl } = useParams<{ artifactId?: string }>();

  const [activeTab, setActiveTab] = useState<Tab>('generate');
  const [phase, setPhase] = useState<Phase>('intake');
  const [intake, setIntake] = useState<DocumentIntake | null>(null);
  const [outline, setOutline] = useState<DocumentOutline | null>(null);
  const [useLlm, setUseLlm] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [approvedTemplates, setApprovedTemplates] = useState<DocumentTemplate[]>([]);
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
    } catch {
      // Tab list is a soft enhancement; the plain Mode 1 flow stays available.
      setApprovedTemplates([]);
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

  const tabClass = (tab: Tab): string =>
    `inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
      activeTab === tab
        ? 'border-primary-500 text-navy-900 dark:text-white'
        : 'border-transparent text-slate-500 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white'
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 dark:bg-navy-950">
      <header className="border-b border-slate-200 bg-white px-6 pt-4 dark:border-navy-700 dark:bg-navy-900">
        <h1 className="text-base font-semibold text-navy-900 dark:text-white">
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-500" />
            Consultify Document Studio
          </span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          AI Document Artifact Engine · Modes 1, 2, 3 · Word/PDF artifact runtime
        </p>
        <nav className="mt-3 flex gap-2" aria-label="Document Studio modes">
          <button
            type="button"
            onClick={() => setActiveTab('generate')}
            className={tabClass('generate')}
          >
            <Sparkles className="h-4 w-4" /> Generate
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={tabClass('templates')}
          >
            <Layers className="h-4 w-4" /> Plan template
          </button>
        </nav>
      </header>

      <main className="flex h-full min-h-0 flex-col">
        {activeTab === 'templates' ? (
          <DocumentStudioTemplateArchitectView
            onTemplateApproved={() => {
              void refreshApprovedTemplates();
            }}
          />
        ) : loadingArtifact ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            Loading document…
          </div>
        ) : phase === 'intake' ? (
          <DocumentStudioIntakeForm
            onSubmit={handleIntakeSubmit}
            loading={planning || generating}
            error={phase === 'intake' ? error : null}
            approvedTemplates={approvedTemplates}
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
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            {error ?? 'No document loaded.'}
          </div>
        )}
      </main>
    </div>
  );
};

export default DocumentStudioView;
