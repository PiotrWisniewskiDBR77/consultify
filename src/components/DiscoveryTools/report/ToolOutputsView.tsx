/**
 * ToolOutputsView — SPEC-A powłoka wokół `ToolOutputsPanel` ("Output"
 * archetyp A/Canvas — czytanie/listowanie zatwierdzonych snapshotów sesji
 * narzędzia). `ToolOutputsPanel` sam zostaje bez zmian (logika S4
 * read/list/reopen) — ten komponent tylko dokłada Menu 1 (`NModeHeader`)
 * i prawy panel (`ArtifactRightPanel`) przez wspólny `ToolArtifactShell`,
 * dokładnie jak Session Workspace (`ToolWorkspace.tsx`).
 *
 * Gdy `ToolOutputsPanel` jest osadzony WEWNĄTRZ Session Workspace (sesja
 * zatwierdzona, patrz `ToolWorkspace.tsx`), powłoka workspace'u już
 * istnieje — osadzenie zostaje bez tego wrappera (podwójne Menu 1 byłoby
 * naruszeniem "tylko centrum się różni"). Ten widok jest dla samodzielnego
 * dostępu do Outputów sesji (poza kontekstem Session Workspace) —
 * `ToolWorkspace.tsx` otwiera go przez „Otwórz pełny widok".
 *
 * Otwarcie Raportu/Prezentacji z listy PODMIENIA tę powłokę na
 * `ToolReportViewerShell` (siostrzana pełnoekranowa powierzchnia, NIE
 * zagnieżdżona) — więc na ekranie zawsze jest dokładnie jedno Menu 1.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { NModeHeaderConfig } from '@/components/shared/NModeLayout/types';
import {
  ARTIFACT_PANEL_CARD_CLASS_DOCKED,
  ArtifactRightPanel,
  ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import type { ToolReportDocument } from '@/toolOutputs/types';

import { ToolArtifactShell } from '../shared/ToolArtifactShell';
import ToolOutputsPanel from './ToolOutputsPanel';
import ToolReportViewerShell from './ToolReportViewerShell';

export interface ToolOutputsViewProps {
  toolSessionId: string;
  sessionTitle?: string;
  onBack?: () => void;
  /** Omit to derive from the active i18n locale (jak `ToolWorkspace`). */
  isPolish?: boolean;
}

export const ToolOutputsView: React.FC<ToolOutputsViewProps> = ({
  toolSessionId,
  sessionTitle,
  onBack,
  isPolish: isPolishProp,
}) => {
  const { i18n } = useTranslation();
  const isPolish = isPolishProp ?? i18n.language === 'pl';
  const [viewingDoc, setViewingDoc] = useState<ToolReportDocument | null>(null);

  if (viewingDoc) {
    return (
      <ToolReportViewerShell
        doc={viewingDoc}
        onBack={() => setViewingDoc(null)}
        isPolish={isPolish}
      />
    );
  }
  const header: NModeHeaderConfig = {
    title: sessionTitle || (isPolish ? 'Wyniki narzędzia' : 'Tool outputs'),
    onTitleChange: () => {},
    titleReadOnly: true,
    artifactId: toolSessionId,
    artifactType: 'tool_session',
    onSave: () => {},
    saveState: 'saved',
    onClose: onBack ?? (() => {}),
    statusLabel: isPolish ? 'Zatwierdzone' : 'Approved',
    statusTone: 'approved',
  };

  const rightPanelSections: ArtifactRightPanelSection[] = [
    {
      id: 'actions',
      label: isPolish ? 'Akcje' : 'Actions',
      defaultOpen: true,
      children: (
        <p className="text-xs leading-relaxed text-c-text-muted">
          {isPolish
            ? 'Otwórz wersję z listy, aby przejrzeć jej Raport lub Prezentację, albo cofnij zatwierdzoną wersję do korekty.'
            : 'Open a version from the list to review its Report or Presentation, or reopen an approved version for correction.'}
        </p>
      ),
    },
    {
      id: 'properties',
      label: isPolish ? 'Właściwości' : 'Properties',
      defaultOpen: true,
      children: (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-c-text-muted">{isPolish ? 'Sesja' : 'Session'}</dt>
            <dd className="text-right font-mono text-[11px] text-c-text">
              {toolSessionId.slice(0, 12)}…
            </dd>
          </div>
        </dl>
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
          ariaLabel={isPolish ? 'Szczegóły wyników' : 'Output details'}
        />
      }
    >
      <div className="px-6 py-6">
        <div className="mx-auto max-w-3xl">
          <ToolOutputsPanel toolSessionId={toolSessionId} onOpenReport={setViewingDoc} />
        </div>
      </div>
    </ToolArtifactShell>
  );
};

export default ToolOutputsView;
