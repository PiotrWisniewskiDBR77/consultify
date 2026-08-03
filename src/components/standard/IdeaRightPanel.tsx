/**
 * IdeaRightPanel — JEDEN kanoniczny prawy panel narzędzi idei (canvas / My Work).
 *
 * SSOT doktryny: Harvard/wdrozenie-100/_KONCEPT_IDEAS_TERESA_2026-07-10.md §4
 * (#8/#9/Z16) + ★D17 (07-12, cytat Piotra): „Generalnie wszystko korzysta z
 * panelu Teresy — nigdy nie ma innego i przekładamy go na PRAWĄ stronę ekranu."
 *
 * Z8 (2026-07-22): przebudowa na 5 sekcji KANONU SPEC-A
 * (Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §10.2/§11.2) — powłoka
 * wspólna wszystkich artefaktów, nie własny 3-kartowy układ Idei:
 *
 *     Akcje · Właściwości · Powiązania · Komentarze · Historia
 *
 * Mapowanie starych 3 kart → 5 kanonicznych (wzór dev-render/screens/idea-table.tsx):
 *   - Akcje         NOWA — `PreviewActionBar` z realnymi akcjami workspace
 *                   (eksport/konwertuj), podpięta przez `onExport`/`onConvert`.
 *   - Właściwości   1:1 dawna karta „Właściwości" (`propertiesContent`,
 *                   zwykle <IdeaWorkspaceTools embedded>) — bez zmian.
 *   - Powiązania    dawna karta „Kontekst" (`relationsContent`, zwykle
 *                   <IdeaContextPanel embedded>) SCALONA z dawną opcjonalną
 *                   5. kartą „Źródła i założenia" (HP-17 `EvidencePanelSection`)
 *                   — oba renderują się w JEDNEJ sekcji Powiązania, evidence
 *                   dołączony pod treścią kontekstu gdy `evidenceArtifactId`
 *                   jest podane (flaga `ff_evidencePanel`; brak = nic się nie
 *                   dokłada, zero zmian DOM jak przed Z8).
 *   - Komentarze    NOWA — brak workspace-level kanału komentarzy dla idei
 *                   (per-node wątki w NodeCommentThread/WhiteboardNodeComment-
 *                   Thread/ProcessFlowNodeCommentThread to inny zakres: wątek
 *                   NA WĘŹLE, nie na artefakcie). Sekcja renderuje się jako
 *                   pusta (`isEmpty`, emptyLabel „Brak komentarzy").
 *   - Historia      dawna karta „Teresa" (`teresaContent`, <IdeaTeresaSection>)
 *                   — bez zmian funkcji, nowa etykieta wg kanonu.
 *
 * Zasady (reużycie 1:1, NIE bespoke):
 *  - Ten komponent buduje WYŁĄCZNIE strukturę sekcji + akcje-skrót (Akcje);
 *    treść Właściwości/Powiązania/Historia-AI dalej DEKLARUJE moduł wołający
 *    (propertiesContent/relationsContent/teresaContent) — wygląd narzuca
 *    `<ArtifactRightPanel>` (nagłówki L1 UPPERCASE c-text-muted, chevron,
 *    ramki c-*, collapse).
 *  - Wyłącznie tokeny `c-*` (dziedziczone z ArtifactRightPanel/PreviewActionBar).
 *    Zero crimson, zero navy/slate. Fokus = c-focus (w ArtifactRightPanel).
 *  - Identyczny co do piksela dla 4 narzędzi (mindmap/process_flow/whiteboard/
 *    table) — różni się WYŁĄCZNIE deklaracja treści.
 */
import {
  FileSpreadsheet,
  Link2,
  MessageSquare,
  Repeat,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import React, { useMemo } from 'react';

import { PreviewActionBar } from '@/components/shared/PreviewPane';
import {
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import { EvidencePanelSection } from '@/components/standard/EvidencePanelSection';

/** Która sekcja ma być otwarta na starcie (mapowana z aktywnego klawisza paska). */
export type IdeaRightPanelSectionKey = 'properties' | 'relations' | 'teresa' | null;

export interface IdeaRightPanelProps {
  /** Sekcja domyślnie otwarta (z paska przełącznika). null = pierwsza (Akcje). */
  activeSection?: IdeaRightPanelSectionKey;
  /** Treść karty „Właściwości" (zwykle <IdeaWorkspaceTools embedded>). */
  propertiesContent: React.ReactNode;
  /**
   * Treść karty „Powiązania" (dawny „Kontekst", zwykle <IdeaContextPanel
   * embedded>: backlinki, powiązane inicjatywy, luki assessmentu, insighty,
   * KPI, podobne idee).
   */
  relationsContent: React.ReactNode;
  /** Treść karty „Historia" (komendy + strumień sugestii — <IdeaTeresaSection>). */
  teresaContent: React.ReactNode;
  /**
   * HP-17: id artefaktu canvas (tool_session/mindmap id) — gdy podane (flaga
   * `ff_evidencePanel` ON u wołającego), `EvidencePanelSection` („Źródła i
   * założenia") dokłada się POD `relationsContent` w tej samej sekcji
   * Powiązania (Z8: scalenie, już nie osobna 6. karta). `undefined` → nic się
   * nie dokłada, zero zmian DOM.
   */
  evidenceArtifactId?: string;
  /**
   * Akcja „Eksportuj" w karcie Akcje — realny handler workspace (zwykle
   * `() => setExportMenuOpen(true)`, ten sam co kebab Menu 1 / Menu 3).
   * Pominięte → przycisk się nie renderuje (nigdy stub/no-op).
   */
  onExport?: () => void;
  /**
   * Akcja „Konwertuj" w karcie Akcje — realny handler workspace (zwykle
   * `() => handlePanelChange('tools')`, otwiera kartę Właściwości, gdzie
   * żyje faktyczny wybór celu konwersji — ta sama ścieżka co Menu 3
   * `onConvertFromMap` w wariancie EditorShell). Pominięte → przycisk się
   * nie renderuje.
   */
  onConvert?: () => void;
  /** Szerokość panelu (default 360; kanon ArtifactRightPanel 320–420). */
  width?: number;
  /** PL/EN etykiety nagłówków sekcji. */
  isPolish?: boolean;
}

export const IdeaRightPanel: React.FC<IdeaRightPanelProps> = ({
  activeSection = null,
  propertiesContent,
  relationsContent,
  teresaContent,
  evidenceArtifactId,
  onExport,
  onConvert,
  width = 360,
  isPolish = false,
}) => {
  const sections = useMemo<ArtifactRightPanelSection[]>(() => {
    const actionButtons = [
      onExport
        ? {
            label: isPolish ? 'Eksportuj' : 'Export',
            icon: FileSpreadsheet,
            colorScheme: 'neutral' as const,
            onClick: onExport,
            flex: true,
          }
        : null,
      onConvert
        ? {
            label: isPolish ? 'Konwertuj' : 'Convert',
            icon: Repeat,
            colorScheme: 'neutral' as const,
            onClick: onConvert,
            flex: true,
          }
        : null,
    ].filter((b): b is NonNullable<typeof b> => b !== null);

    const hasActions = actionButtons.length > 0;

    const base: ArtifactRightPanelSection[] = [
      {
        id: 'actions',
        label: isPolish ? 'Akcje' : 'Actions',
        icon: Sparkles,
        defaultOpen: activeSection === null,
        isEmpty: !hasActions,
        emptyLabel: isPolish ? 'Brak dostępnych akcji.' : 'No actions available.',
        children: hasActions ? <PreviewActionBar rows={[{ buttons: actionButtons }]} /> : null,
      },
      {
        id: 'properties',
        label: isPolish ? 'Właściwości' : 'Properties',
        icon: SlidersHorizontal,
        children: propertiesContent,
        defaultOpen: activeSection === 'properties',
      },
      {
        id: 'relations',
        label: isPolish ? 'Powiązania' : 'Relations',
        icon: Link2,
        defaultOpen: activeSection === 'relations',
        children: (
          <div className="space-y-4">
            {relationsContent}
            {evidenceArtifactId ? (
              <div className="border-t border-c-border-subtle pt-3">
                <EvidencePanelSection
                  artifactType="canvas"
                  artifactId={evidenceArtifactId}
                  isPolish={isPolish}
                />
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: 'comments',
        label: isPolish ? 'Komentarze' : 'Comments',
        icon: MessageSquare,
        defaultOpen: false,
        isEmpty: true,
        emptyLabel: isPolish ? 'Brak komentarzy.' : 'No comments yet.',
        children: null,
      },
      {
        id: 'history',
        label: isPolish ? 'Historia' : 'History',
        icon: Sparkles,
        children: teresaContent,
        defaultOpen: activeSection === 'teresa',
      },
    ];
    return base;
  }, [
    isPolish,
    activeSection,
    propertiesContent,
    relationsContent,
    teresaContent,
    evidenceArtifactId,
    onExport,
    onConvert,
  ]);

  return (
    <ArtifactRightPanel
      sections={sections}
      width={width}
      ariaLabel={isPolish ? 'Panel narzędzi idei' : 'Idea tools panel'}
    />
  );
};

export default IdeaRightPanel;
