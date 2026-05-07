/**
 * Consultify Document Studio — Document Panel (MVP-1, Mode 1).
 *
 * Shows the generated DocumentSchema as a read-only structured preview and
 * exposes a markdown export. DOCX/PDF exports are wired but currently surface
 * the backend's pendingRendering manifest until the export pipeline lands in
 * MVP-1 finalization (see CONSULTIFY_DOCUMENT_STUDIO_V1_IMPLEMENTATION_PLAN.md).
 */

import { Download, FileText, Loader2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import Button from '@/components/ui/primitives/Button';
import {
  buildMyWorkSheetTableOpenPath,
  resolveTablePlatformWorkspaceIdForTable,
} from '@/utils/sheetArtifactOpen';

import { exportDocumentStudioArtifact } from './api';
import { DocumentStudioEditorPanel } from './DocumentStudioEditorPanel';
import type { DocumentSchema, DocumentSection } from './types';

interface DocumentStudioDocumentPanelProps {
  artifactId: string;
  schema: DocumentSchema;
  onStartOver: () => void;
  onSchemaUpdated: (nextSchema: DocumentSchema) => void;
}

function renderSectionPreview(section: DocumentSection, idx: number): React.ReactNode {
  return (
    <section
      key={section.sectionId}
      className="rounded-lg border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900"
    >
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-navy-900 dark:text-white">
          {idx + 1}. {section.title}
        </h3>
        {section.purpose ? <span className="text-xs text-slate-400">{section.purpose}</span> : null}
      </header>
      <div className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-300">
        {section.blocks.map((block) => {
          const isAssumption = Boolean(block.isAssumption);
          const blockClass = isAssumption
            ? 'rounded border border-amber-400/30 bg-amber-50 px-2 py-1 dark:border-amber-400/30 dark:bg-amber-500/10'
            : '';
          const content = (() => {
            if (block.type === 'heading') {
              const value = block.content as { text?: string };
              return (
                <div className="font-semibold text-navy-900 dark:text-white">{value.text}</div>
              );
            }
            if (block.type === 'paragraph') {
              const value = block.content as { text?: string };
              return <p>{value.text}</p>;
            }
            if (block.type === 'list') {
              const value = block.content as { style?: string; items?: string[] };
              const items = Array.isArray(value.items) ? value.items : [];
              if (value.style === 'numbered') {
                return (
                  <ol className="list-decimal pl-5">
                    {items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ol>
                );
              }
              return (
                <ul className="list-disc pl-5">
                  {items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              );
            }
            if (block.type === 'callout') {
              const value = block.content as { variant?: string; text?: string };
              return (
                <div className="rounded-md border border-primary-500/30 bg-primary-500/5 px-3 py-2 italic">
                  {value.text}
                </div>
              );
            }
            return (
              <pre className="whitespace-pre-wrap text-xs text-slate-500">
                {JSON.stringify(block.content, null, 2)}
              </pre>
            );
          })();
          return (
            <div key={block.blockId} className={blockClass}>
              {content}
              {isAssumption ? (
                <div className="mt-1 text-xs font-medium uppercase tracking-wide text-amber-600">
                  Assumption — needs source
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const DocumentStudioDocumentPanel: React.FC<DocumentStudioDocumentPanelProps> = ({
  artifactId,
  schema,
  onStartOver,
  onSchemaUpdated,
}) => {
  const [exporting, setExporting] = useState<'markdown' | 'docx' | 'pdf' | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [openingBuilder, setOpeningBuilder] = useState(false);

  const sourceCount = schema.sourceRefs.length;
  const assumptionCount = useMemo(
    () =>
      schema.sections.reduce(
        (acc, section) => acc + section.blocks.filter((b) => b.isAssumption).length,
        0
      ),
    [schema]
  );
  const tableSourceRef = useMemo(
    () =>
      schema.sourceRefs.find((ref) => {
        const sourceType = String(ref.sourceType || '').toLowerCase();
        return sourceType.includes('table') || sourceType.includes('sheet');
      }) ?? null,
    [schema.sourceRefs]
  );

  const triggerTextDownload = (filename: string, content: string, mime: string): void => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const triggerBinaryDownload = (filename: string, base64: string, mime: string): void => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const mimeForFormat = (format: 'markdown' | 'docx' | 'pdf'): string => {
    if (format === 'markdown') return 'text/markdown';
    if (format === 'pdf') return 'application/pdf';
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  };

  const handleExport = async (format: 'markdown' | 'docx' | 'pdf'): Promise<void> => {
    setExporting(format);
    setExportError(null);
    setExportNote(null);
    try {
      const payload = await exportDocumentStudioArtifact(artifactId, format);
      const manifest = (payload.manifest ?? {}) as Record<string, unknown>;
      const pending = manifest.pendingRendering as string | undefined;
      const pendingNote = manifest.pendingRenderingNote as string | undefined;

      if (typeof payload.contentBase64 === 'string' && payload.contentBase64.length > 0) {
        triggerBinaryDownload(payload.filename, payload.contentBase64, mimeForFormat(format));
        return;
      }
      if (typeof payload.contentText === 'string' && payload.contentText.length > 0) {
        triggerTextDownload(payload.filename, payload.contentText, mimeForFormat(format));
        if (pending) {
          // Backwards-compatible fallback: if a deployment still returns the
          // pending tag, surface its note rather than failing silently.
          setExportNote(
            pendingNote ??
              `${format.toUpperCase()} export is pending finalization. Markdown is available now.`
          );
        }
        return;
      }
      setExportNote('Export returned no content.');
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const handleOpenBuilder = async (): Promise<void> => {
    if (!tableSourceRef?.sourceId) {
      setExportNote('No sheet/table source is attached to this document.');
      return;
    }
    setOpeningBuilder(true);
    setExportError(null);
    try {
      const workspaceId = await resolveTablePlatformWorkspaceIdForTable(tableSourceRef.sourceId);
      if (!workspaceId) {
        setExportError('Could not resolve workspace for the linked table source.');
        return;
      }
      const targetPath = buildMyWorkSheetTableOpenPath(workspaceId, tableSourceRef.sourceId);
      toast.success('Opening sheets builder lane…');
      window.location.assign(targetPath);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to open sheets builder');
    } finally {
      setOpeningBuilder(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 dark:border-navy-700 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 text-sky-500" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold text-navy-900 dark:text-white">{schema.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {schema.documentType} · {schema.language.toUpperCase()} · {schema.density} ·{' '}
              {schema.confidentiality} · sources: {sourceCount}
              {assumptionCount > 0 ? ` · ${assumptionCount} assumption(s) flagged` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenBuilder}
            disabled={!tableSourceRef || openingBuilder}
          >
            <span className="inline-flex items-center gap-1">
              {openingBuilder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Open in Sheets Builder
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleExport('markdown')}
            disabled={exporting !== null}
          >
            <span className="inline-flex items-center gap-1">
              {exporting === 'markdown' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Markdown
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleExport('docx')}
            disabled={exporting !== null}
          >
            <span className="inline-flex items-center gap-1">
              {exporting === 'docx' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              DOCX
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
          >
            <span className="inline-flex items-center gap-1">
              {exporting === 'pdf' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              PDF
            </span>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onStartOver}>
            Start over
          </Button>
        </div>
      </header>

      {exportNote ? (
        <div className="mx-6 mt-3 rounded-md border border-amber-400/30 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          {exportNote}
        </div>
      ) : null}

      {exportError ? (
        <div
          role="alert"
          className="mx-6 mt-3 rounded-md border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-xs text-danger-700 dark:text-danger-400"
        >
          {exportError}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 overflow-y-auto p-6">
        <DocumentStudioEditorPanel
          artifactId={artifactId}
          schema={schema}
          onSchemaUpdated={onSchemaUpdated}
        />
        {schema.sections.map((section, idx) => renderSectionPreview(section, idx))}
      </div>
    </div>
  );
};

export default DocumentStudioDocumentPanel;
