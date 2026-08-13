/**
 * ToolReportViewerShell — SPEC-A powłoka wokół `ToolReportView` dla
 * Prezentacji (i, jeśli wołający zdecyduje, Raportu).
 *
 * `ToolReportView` sam zostaje NIETKNIĘTY co do treści/znaczenia — renderuje
 * zatwierdzony `ToolReportDocument` deterministycznie (patrz doctryna w jego
 * nagłówku: ten sam dokument + wersja renderera = ten sam wynik). Ten
 * komponent dokłada WYŁĄCZNIE powłokę (Menu 1 + prawy panel przez
 * `ToolArtifactShell`), dokładnie ten sam kontrakt co Session Workspace i
 * Output — bez zmiany renderowanego dokumentu.
 *
 * Presentation = ten sam renderer co Report (`doc.kind`), z
 * `presentationMode` usuwającym kontrolki (linia meta renderer+źródła) —
 * to jest cała różnica, zgodnie z doktryną pliku `ToolReportView.tsx`.
 * Tryb slajdów (edycja/prezentacja pełnoekranowa) NIE jest częścią tego
 * strumienia — to należy do innego strumienia równoległego.
 */
import { Copy } from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  NModeHeaderConfig,
  NModeHeaderOverflowItem,
} from '@/components/shared/NModeLayout/types';
import {
  ARTIFACT_PANEL_CARD_CLASS_DOCKED,
  ArtifactRightPanel,
  ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import type { ToolReportDocument } from '@/toolOutputs/types';

import { ToolArtifactShell } from '../shared/ToolArtifactShell';
import ToolReportView from './ToolReportView';

export interface ToolReportViewerShellProps {
  doc: ToolReportDocument;
  onBack?: () => void;
  /** Omit to derive from the active i18n locale (jak `ToolWorkspace`). */
  isPolish?: boolean;
}

export const ToolReportViewerShell: React.FC<ToolReportViewerShellProps> = ({
  doc,
  onBack,
  isPolish: isPolishProp,
}) => {
  const { i18n } = useTranslation();
  const isPolish = isPolishProp ?? i18n.language === 'pl';
  const isDeck = doc.kind === 'presentation';

  const copyHash = useCallback(() => {
    void navigator.clipboard?.writeText(doc.contentHash);
  }, [doc.contentHash]);

  const overflowItems: NModeHeaderOverflowItem[] = [
    {
      id: 'copy-content-hash',
      label: isPolish ? 'Kopiuj hash treści' : 'Copy content hash',
      icon: Copy,
      onClick: copyHash,
    },
  ];

  const header: NModeHeaderConfig = {
    title: doc.title,
    onTitleChange: () => {},
    titleReadOnly: true,
    artifactId: doc.id,
    artifactType: isDeck ? 'presentation' : 'report',
    onSave: () => {},
    saveState: 'saved',
    onClose: onBack ?? (() => {}),
    statusLabel: isPolish
      ? isDeck
        ? 'Prezentacja'
        : 'Raport'
      : isDeck
        ? 'Presentation'
        : 'Report',
    statusTone: 'approved',
    extraOverflowItems: overflowItems,
  };

  const rightPanelSections: ArtifactRightPanelSection[] = [
    {
      id: 'properties',
      label: isPolish ? 'Właściwości' : 'Properties',
      defaultOpen: true,
      children: (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-c-text-muted">Renderer</dt>
            <dd className="text-right font-mono text-[11px] text-c-text">
              {doc.rendererVersion}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-c-text-muted">{isPolish ? 'Źródła' : 'Sources'}</dt>
            <dd className="text-right tabular-nums text-c-text">{doc.sourceOutputIds.length}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-c-text-muted">{isPolish ? 'Rodzaj' : 'Kind'}</dt>
            <dd className="text-right text-c-text">
              {isDeck ? (isPolish ? 'Prezentacja' : 'Presentation') : isPolish ? 'Raport' : 'Report'}
            </dd>
          </div>
        </dl>
      ),
    },
    {
      id: 'relations',
      label: isPolish ? 'Powiązania' : 'Relations',
      defaultOpen: false,
      isEmpty: doc.sourceOutputIds.length === 0,
      emptyLabel: isPolish ? 'Brak powiązanych Outputów' : 'No related outputs',
      children: (
        <ul className="space-y-1 text-xs text-c-text-secondary">
          {doc.sourceOutputIds.map((id) => (
            <li key={id} className="truncate font-mono">
              {id}
            </li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <ToolArtifactShell
      header={header}
      rightPanel={
        <ArtifactRightPanel
          sections={rightPanelSections}
          className={ARTIFACT_PANEL_CARD_CLASS_DOCKED}
          ariaLabel={isPolish ? 'Szczegóły dokumentu' : 'Document details'}
        />
      }
    >
      <div className="py-8">
        <ToolReportView doc={doc} presentationMode={isDeck} />
      </div>
    </ToolArtifactShell>
  );
};

export default ToolReportViewerShell;
