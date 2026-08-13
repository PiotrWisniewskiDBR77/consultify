/**
 * ToolArtifactShell — wspólna powłoka SPEC-A dla widoków Discovery Tools
 * (Session Workspace, Output, Presentation).
 *
 * NIE jest nowym komponentem wizualnym — składa DWA kanoniczne prymitywy
 * z Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §10.2/§11.2, dokładnie
 * tak jak robi to `NModeShell` wewnętrznie (patrz
 * src/components/shared/NModeLayout/NModeShell.tsx):
 *
 *   Menu 1        → NModeHeader        (src/components/shared/NModeLayout/NModeHeader.tsx)
 *   Prawy panel   → ArtifactRightPanel (src/components/standard/ArtifactRightPanel.tsx)
 *
 * Discovery Tool = archetyp A/Canvas (§13.3 ARTIFACT_ANATOMY_STANDARD.md):
 * ikona `wrench`, centrum = spatial/canvas narzędzia, Menu1 primary zależny
 * od stanu narzędzia (deklaruje wołający). Nie używamy tu pełnego
 * `NModeShell`, bo jego PropertiesStrip / przełącznik N-C / LeftNav+sections
 * są zbudowane pod archetyp C/Rekord (karty pól) — Tool ma własne centrum
 * (ToolCanvas/ToolReviewPanel/ToolOutputsPanel/ToolReportView), które tu
 * przechodzi przez `children` bez zmian. `secondaryBar` to miejsce na
 * nawigację wewnętrzną widoku (np. pasek kroków sesji) — odpowiednik Menu 2/3
 * archetypu Canvas.
 *
 * Zasada nadrzędna (moduł deklaruje treść, powłoka narzuca wygląd): wołający
 * podaje `header` (NModeHeaderConfig) + `rightPanel` (zwykle
 * `<ArtifactRightPanel sections={…} className={ARTIFACT_PANEL_CARD_CLASS_DOCKED} />`)
 * — ten komponent tylko je składa w tym samym układzie co NModeShell
 * (centrum flex-1 scrollowalne + panel dokowany pełnej wysokości, ukryty
 * <lg, żeby nie ściskać centrum na wąskich ekranach).
 */
import { Loader2 } from 'lucide-react';
import React from 'react';

import NModeHeader from '@/components/shared/NModeLayout/NModeHeader';
import type { NModeHeaderConfig } from '@/components/shared/NModeLayout/types';

export interface ToolArtifactShellProps {
  /** Konfiguracja Menu 1 — identyczny kontrakt co karty N (NModeHeaderConfig). */
  header: NModeHeaderConfig;
  /**
   * Prawy panel dokowany (SPEC-A §10.2/§11.2). Zwykle
   * `<ArtifactRightPanel sections={…} className={ARTIFACT_PANEL_CARD_CLASS_DOCKED} />`.
   * Pomiń, gdy widok świadomie nie ma jeszcze treści na panel (np. wczesny
   * stan pustej sesji) — powłoka renderuje się wtedy bez zmian centrum.
   */
  rightPanel?: React.ReactNode;
  /** Pasek pod Menu1 — nawigacja wewnętrzna widoku (np. kroki sesji). */
  secondaryBar?: React.ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  children: React.ReactNode;
}

export const ToolArtifactShell: React.FC<ToolArtifactShellProps> = ({
  header,
  rightPanel,
  secondaryBar,
  loading = false,
  loadingLabel,
  children,
}) => {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-c-bg">
        <Loader2 className="animate-spin text-c-info" size={32} aria-hidden="true" />
        {loadingLabel ? (
          <span className="ml-3 text-sm text-c-text-muted">{loadingLabel}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-c-bg">
      {/* Menu 1 — identyczny prymityw co karty N, bez PropertiesStrip/N-C. */}
      <div className="shrink-0 px-6 pt-4">
        <NModeHeader
          {...header}
          presentationMode="n"
          onPresentationModeChange={() => {}}
          showModeSwitcher={false}
        />
      </div>

      {secondaryBar}

      <div className="flex min-h-0 flex-1">
        <div className="h-full min-h-0 flex-1 min-w-0 overflow-y-auto">{children}</div>
        {rightPanel ? (
          <div className="hidden h-full min-h-0 shrink-0 lg:block">{rightPanel}</div>
        ) : null}
      </div>
    </div>
  );
};

export default ToolArtifactShell;
