/**
 * DOC-0 (DEC-593) — the ONE read-only document viewer.
 *
 * Before this component an approved document could be opened through 16 different
 * entry paths landing on 4 bespoke viewers (KROK0.md §2). DEC-593 collapses that:
 * clicking an approved document opens THIS read-only surface; the editor
 * (Report Builder / Document Studio) is reachable only through an explicit
 * "Edit" action, never as the click target.
 *
 * Archetype B (Dokument) of SPEC-A: the shared shell (Menu 1 + `ArtifactRightPanel`
 * + kebab + states) is unchanged — the archetype differs ONLY in the centre, which
 * here is the projected markdown of whichever registry backs the row
 * (`documentContentResolver`).
 *
 * Colour: `c-*` tokens only. Crimson (`primary-*`, `#85182F`) is critical semantics
 * and a read-only document has none.
 */
import { FileText, Pencil } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { NModeToolbar } from '@/components/shared/NModeLayout';
import { ArtifactPropertiesTable } from '@/components/standard/ArtifactPropertiesTable';
import { StandardArtifactShell } from '@/components/standard/StandardArtifactShell';
import type { StandardSekcjaDef } from '@/components/standard/StandardArtifactShell.types';
import type { PresentationMode } from '@/hooks/usePresentationMode';

import {
  resolveDocumentContent,
  type DocumentContentResolution,
  type DocumentContentSection,
} from './documentContentResolver';

export interface DocumentViewerProps {
  /** Registry artifact id (`v8_output_artifacts.artifact_id`). */
  artifactId: string;
  /** Materials archetype rendered by the same SPEC-A viewer shell. */
  kind?: 'document' | 'presentation';
  /** Canvas draft id, when the row's primary origin is `work_canvas_drafts`. */
  originRecordId?: string | null;
  /** List-row title — used until the content resolves (and as a fallback). */
  title?: string | null;
  statusLabel?: string | null;
  ownerName?: string | null;
  /** ISO timestamp shown in Properties. */
  updatedAt?: string | null;
  onClose: () => void;
  /**
   * DEC-593: editing is a SEPARATE, explicit action. Omit → the viewer has no
   * primary CTA at all (declared, not forgotten — see `primaryAction` below).
   */
  onEdit?: () => void;
}

const STATE_BOX =
  'rounded-xl border border-c-border-subtle bg-c-surface p-6 text-sm text-c-text-secondary';
const MARKDOWN_CLASS =
  'prose prose-sm max-w-none prose-headings:text-c-text prose-headings:scroll-mt-20 ' +
  'prose-p:text-c-text-secondary prose-li:text-c-text-secondary prose-strong:text-c-text ' +
  'prose-a:text-c-focus prose-a:underline prose-table:text-c-text-secondary ' +
  'prose-th:text-c-text prose-code:text-c-text prose-code:before:content-none prose-code:after:content-none ' +
  'dark:prose-invert';

/** Single newlines are soft breaks in CommonMark; keep the author's line breaks visible. */
function withHardBreaks(markdown: string): string {
  return String(markdown || '')
    .split('\n')
    .map((line) => (/^\s*$/.test(line) || /^\s*(```|~~~)/.test(line) ? line : line.replace(/\s+$/, '  ')))
    .join('\n');
}

export function DocumentViewer(props: DocumentViewerProps) {
  const {
    artifactId,
    kind = 'document',
    originRecordId,
    title,
    statusLabel,
    ownerName,
    updatedAt,
    onClose,
    onEdit,
  } = props;
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  /** DEC-461: PL key + EN default, zero hardcoded literals. */
  const tr = useCallback(
    (key: string, en: string, opts?: Record<string, unknown>) =>
      t(`documents.viewer.${key}`, en, opts),
    [t]
  );

  const [resolution, setResolution] = useState<DocumentContentResolution | null>(null);
  const [activeSection, setActiveSection] = useState<string>('');
  const [densityMode, setDensityMode] = useState<PresentationMode>('n');

  useEffect(() => {
    let cancelled = false;
    setResolution(null);
    void resolveDocumentContent({ artifactId, originRecordId, title }).then((next) => {
      if (cancelled) return;
      setResolution(next);
      setActiveSection(next.state === 'ready' ? next.sections[0]?.id ?? '' : 'doc-state');
    });
    return () => {
      cancelled = true;
    };
  }, [artifactId, originRecordId, title]);

  const readySections: DocumentContentSection[] =
    resolution?.state === 'ready' ? resolution.sections : [];
  const isPresentation = kind === 'presentation';
  const viewerNoun = isPresentation ? tr('deck', 'Deck') : tr('document', 'Document');

  const stateNode = useMemo<React.ReactNode>(() => {
    if (!resolution) {
      return <div className={STATE_BOX}>{tr('loading', 'Loading the document…')}</div>;
    }
    if (resolution.state === 'empty') {
      return <div className={STATE_BOX}>{tr('stateEmpty', 'This document has no content yet.')}</div>;
    }
    if (resolution.state === 'error') {
      return (
        <div className={STATE_BOX}>
          {resolution.errorCode === 'load_failed'
            ? tr('stateLoadFailed', 'The document could not be loaded. Try again.')
            : tr('stateNotFound', 'No content is stored for this document.')}
        </div>
      );
    }
    return null;
  }, [resolution, tr]);

  const sections = useMemo<StandardSekcjaDef[]>(() => {
    if (readySections.length === 0) {
      return [
        {
          id: 'doc-state',
          icon: FileText,
          label: { en: 'Document', pl: 'Dokument' },
          alwaysShow: true,
          component: stateNode,
          aiContract: {
            none: true,
            reason: 'DOC-0 stage 1: read-only viewer — no AI state on a projected document.',
          },
        },
      ];
    }
    return readySections.map((section) => ({
      id: section.id,
      icon: FileText,
      label: section.label
        ? { en: section.label, pl: section.label }
        : { en: 'Document', pl: 'Dokument' },
      title: section.label ? { en: section.label, pl: section.label } : undefined,
      alwaysShow: true,
      component: (
        <article className="rounded-xl border border-c-border-subtle bg-c-surface p-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {withHardBreaks(section.markdown)}
          </ReactMarkdown>
        </article>
      ),
      aiContract: {
        none: true,
        reason: 'DOC-0 stage 1: read-only viewer — the markdown is a projection, not an AI draft.',
      },
    }));
  }, [readySections, stateNode]);

  const resolvedActive = activeSection || sections[0]?.id || 'doc-state';

  const registryLabel =
    resolution?.state === 'ready' || resolution?.state === 'empty'
      ? resolution.registry === 'work_canvas_drafts'
        ? tr('registryCanvas', 'Work Canvas draft')
        : isPresentation
          ? tr('registryPresentation', 'Presentation deck')
          : tr('registryArtifact', 'Artifact content')
      : '—';

  const rightPanel = useMemo(
    () => ({
      actions: onEdit
        ? {
            label: tr('actions', 'Actions'),
            children: (
              <button
                type="button"
                className="w-full rounded-lg border border-c-border px-3 py-2 text-sm text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                onClick={onEdit}
              >
                {tr('edit', 'Edit')}
              </button>
            ),
            actionIds: ['edit'],
          }
        : {
            pominieta: true as const,
            reason:
              'DOC-0 stage 1: the viewer is read-only and the caller supplied no edit path (DEC-593).',
          },
      properties: {
        label: tr('properties', 'Properties'),
        children: (
          <ArtifactPropertiesTable
            propertyLabel={tr('property', 'Property')}
            valueLabel={tr('value', 'Value')}
            rows={[
              { id: 'status', label: tr('status', 'Status'), value: statusLabel?.trim() || '—' },
              { id: 'registry', label: tr('registry', 'Content registry'), value: registryLabel },
              { id: 'owner', label: tr('owner', 'Owner'), value: ownerName?.trim() || '—' },
              {
                id: 'updated',
                label: tr('updated', 'Updated'),
                value: updatedAt?.trim() || '—',
                mono: true,
              },
            ]}
          />
        ),
      },
      relations: {
        pominieta: true as const,
        reason:
          'DOC-0 stage 1: a read-only viewer has no relations source — the list row carries content and metadata only.',
      },
      comments: {
        pominieta: true as const,
        reason: 'DOC-0 stage 1: document comments are out of read-only scope (no write path).',
      },
      history: {
        pominieta: true as const,
        reason: 'DOC-0 stage 1: revision history is out of read-only scope (no write path).',
      },
    }),
    [onEdit, ownerName, registryLabel, statusLabel, tr, updatedAt]
  );

  const activeLabel = sections.find((section) => section.id === resolvedActive)?.label;

  return (
    <StandardArtifactShell
      karta={isPresentation ? 'presentation' : 'document'}
      klasa="L"
      header={{
        title: (resolution?.state === 'ready' && resolution.title) || title?.trim() || tr('untitled', viewerNoun),
        onTitleChange: () => undefined,
        titleReadOnly: true,
        // The Materials registry stores documents as output_type='report'
        // (artifact_family='document'); `ArtifactType` has no 'document' member.
        artifactType: isPresentation ? 'presentation' : 'report',
        artifactId,
        onSave: () => undefined,
        saveState: 'saved',
        onClose,
        statusLabel: statusLabel?.trim() || undefined,
        statusTone: 'neutral',
      }}
      primaryAction={
        onEdit
          ? {
              id: 'doc0-edit',
              label: { en: tr('edit', 'Edit'), pl: tr('edit', 'Edit') },
              icon: Pencil,
              onClick: onEdit,
            }
          : {
              intentionallyNone: true,
              reason:
                'DEC-593: the viewer is read-only — editing opens only through the explicit Edit action, so this card has no primary of its own.',
            }
      }
      sections={sections}
      rightPanel={rightPanel}
      activeSection={resolvedActive}
      onSectionChange={setActiveSection}
      densityMode={densityMode}
      onDensityModeChange={setDensityMode}
      toolbar={
        <NModeToolbar
          isPolish={isPolish}
          activeSectionLabel={
            activeLabel ? (isPolish ? activeLabel.pl : activeLabel.en) : undefined
          }
        />
      }
      panelAriaLabel={tr('panelAriaLabel', isPresentation ? 'Deck details' : 'Document details')}
      loading={!resolution}
    />
  );
}

export default DocumentViewer;
