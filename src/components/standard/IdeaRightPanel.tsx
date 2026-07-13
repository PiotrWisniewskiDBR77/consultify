/**
 * IdeaRightPanel — JEDEN kanoniczny prawy panel narzędzi idei (canvas / My Work).
 *
 * SSOT doktryny: Harvard/wdrozenie-100/_KONCEPT_IDEAS_TERESA_2026-07-10.md §4
 * (#8/#9/Z16) + ★D17 (07-12, cytat Piotra): „Generalnie wszystko korzysta z
 * panelu Teresy — nigdy nie ma innego i przekładamy go na PRAWĄ stronę ekranu."
 *
 * Zastępuje archaiczny przełącznik 3 osobnych szuflad (WorkspacePanelStrip →
 * ToolsPanel / IdeaContextPanel / IdeaAISuggestionsPanel) JEDNYM panelem =
 * accordion `<ArtifactRightPanel>` (ten sam kanon co reszta artefaktów). Trzy
 * karty zostają jako sekcje accordionu w STAŁEJ kolejności (D16):
 *
 *     Właściwości · Kontekst · Teresa
 *
 * gdzie trzecia karta JEST Teresą (komendy + proaktywny strumień sugestii),
 * a nie osobnym bytem „AI Suggestions".
 *
 * Zasady (reużycie 1:1, NIE bespoke):
 *  - Ten komponent NIE renderuje treści — wygląd narzuca `<ArtifactRightPanel>`
 *    (nagłówki L1 UPPERCASE c-text-muted, chevron, ramki c-*, collapse). Moduł
 *    DEKLARUJE treść sekcji jako gotowe węzły (`propertiesContent` itd.).
 *  - Wyłącznie tokeny `c-*` (dziedziczone z ArtifactRightPanel). Zero crimson,
 *    zero navy/slate. Fokus = c-focus (w ArtifactRightPanel).
 *  - Identyczny co do piksela dla 4 narzędzi (mindmap/process_flow/whiteboard/
 *    table) — różni się WYŁĄCZNIE deklaracja treści.
 */
import { Link2, Sparkles, SlidersHorizontal } from 'lucide-react';
import React, { useMemo } from 'react';

import {
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';

/** Która sekcja ma być otwarta na starcie (mapowana z aktywnego klawisza paska). */
export type IdeaRightPanelSectionKey = 'properties' | 'context' | 'teresa' | null;

export interface IdeaRightPanelProps {
  /** Sekcja domyślnie otwarta (z paska przełącznika). null = pierwsza (Właściwości). */
  activeSection?: IdeaRightPanelSectionKey;
  /** Treść karty „Właściwości" (zwykle <IdeaWorkspaceTools embedded>). */
  propertiesContent: React.ReactNode;
  /** Treść karty „Kontekst" (zwykle <IdeaContextPanel embedded>). */
  contextContent: React.ReactNode;
  /** Treść karty „Teresa" (komendy + strumień sugestii — <IdeaTeresaSection>). */
  teresaContent: React.ReactNode;
  /** Szerokość panelu (default 360; kanon ArtifactRightPanel 320–420). */
  width?: number;
  /** PL/EN etykiety nagłówków sekcji. */
  isPolish?: boolean;
}

export const IdeaRightPanel: React.FC<IdeaRightPanelProps> = ({
  activeSection = null,
  propertiesContent,
  contextContent,
  teresaContent,
  width = 360,
  isPolish = false,
}) => {
  const sections = useMemo<ArtifactRightPanelSection[]>(
    () => [
      {
        id: 'properties',
        label: isPolish ? 'Właściwości' : 'Properties',
        icon: SlidersHorizontal,
        children: propertiesContent,
        defaultOpen: activeSection === 'properties' || activeSection === null,
      },
      {
        id: 'context',
        label: isPolish ? 'Kontekst' : 'Context',
        icon: Link2,
        children: contextContent,
        defaultOpen: activeSection === 'context',
      },
      {
        id: 'teresa',
        // Trzecia karta JEST Teresą (D16) — nie „AI Suggestions".
        label: 'Teresa',
        icon: Sparkles,
        children: teresaContent,
        defaultOpen: activeSection === 'teresa',
      },
    ],
    [isPolish, activeSection, propertiesContent, contextContent, teresaContent]
  );

  return (
    <ArtifactRightPanel
      sections={sections}
      width={width}
      ariaLabel={isPolish ? 'Panel narzędzi idei' : 'Idea tools panel'}
    />
  );
};

export default IdeaRightPanel;
