/**
 * ExceleRightPanel — SPEC-A prawy panel (ArtifactRightPanel) dla widoku
 * otwartego arkusza w Excele.
 *
 * SSOT: Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §10.2/§11.2 —
 * powłoka wspólna wszystkich artefaktów: prawy panel = `㉝`accordion, sekcje
 * w STAŁEJ kolejności Akcje · Właściwości · Powiązania · Komentarze ·
 * Historia (§10.2 pkt 3, §11.2 "Prawy panel ⑪").
 *
 * Renderowane WYŁĄCZNIE na widoku otwartego artefaktu (KimiWorkspaceShell,
 * gałąź `!showHome` w ExceleView.tsx) — nigdy na home z kartami startowymi
 * (ArtifactModuleHome), zgodnie z zadaniem G1.
 *
 * Treść buduje moduł (ExceleView) — ten plik tylko mapuje dane na sekcje
 * `ArtifactRightPanelSection[]`; wygląd (accordion, nagłówki, kolejność)
 * narzuca `ArtifactRightPanel`. Tokeny wyłącznie `c-*` — zero
 * navy/slate/hex, zero primary-*, zero crimson (CLAUDE.md UI pkt 6).
 *
 * ★ Rozwożenie prawego pasa (2026-08-30, docs/program/grafika/ANALIZA_PRAWY_PANEL.md
 * §7 krok 4). Za flagą `ff_artifact_right_rail` (`isArtifactRightRailEnabled`,
 * domyślnie OFF) ten sam accordion (`sections`, bez zmian) montuje się w
 * trybie Artefakt wspólnej szyny (`ArtifactRightRail`), dokładając WŁASNĄ
 * ikonę — tryb zależny od typu „Struktura": lista arkuszy skoroszytu
 * (`preview.sheetNames`, realna dana, ta sama co licznik w sekcji
 * Właściwości — nie mock). Brak trybu Teresa — ten panel nigdy nie miał
 * treści Teresy (Excel oddaje Teresę drugiej szynie, `ExceleRightRail.tsx`,
 * za osobną, wcześniejszą flagą `ff_excele_right_rail`), więc `teresa` prop
 * pozostaje niezadeklarowany (brak tej ikony na szynie — kanon: „lepiej
 * brak niż pusty tryb udający funkcję"). Przy fladze OFF ten plik renderuje
 * dokładnie ten sam `<ArtifactRightPanel sections={sections} />` co dziś —
 * `isArtifactRightRailEnabled`/`ArtifactRightRail`/`structureTypeMode` są
 * wtedy martwe.
 */
import {
  Download,
  Eye,
  FileSpreadsheet,
  FolderOpen,
  History,
  Link2,
  ListTree,
  ShieldOff,
  Sparkles,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { PreviewActionButton } from '@/components/shared/PreviewPane';
import {
  ARTIFACT_PANEL_SECTION_ORDER,
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import {
  ArtifactRightRail,
  type ArtifactRailTypeMode,
} from '@/components/standard/ArtifactRightRail';
import { isArtifactRightRailEnabled } from '@/utils/artifactRightRailFlag';

import type { ArtifactPreview, TaskStep } from './KimiWorkspaceShell';

export interface ExceleRightPanelProps {
  preview: ArtifactPreview | null;
  workbookId: string | null;
  taskSteps: TaskStep[];
  isGenerating: boolean;
  isFailed?: boolean;
  failureReason?: string | null;
  onDownload?: () => void;
  onPreviewFile?: () => void;
  onAllFiles?: () => void;
  /** MAT-006 (2026-08-02) — workbook lifecycle actions. All optional/hidden
   * when no workbookId is available (nothing to version/share/export yet). */
  onOpenVersionHistory?: () => void;
  onCheckpoint?: () => void;
  onShare?: () => void;
  onRevokeShare?: () => void;
  isShared?: boolean;
  onExportCsv?: () => void;
  onOpenTeresa?: () => void;
}

/**
 * Buduje sekcje kanonu (Akcje·Właściwości·Powiązania·Komentarze·Historia) z
 * danych arkusza. Wyekstrahowane z `ExceleRightPanel` (2026-08-30) jako
 * WSPÓLNY hook, żeby `ExceleRightRail.tsx` (druga szyna Excela, item 3
 * rozwożenia — patrz jej nagłówek) mogła zbudować swoją nową ikonę
 * „Artefakt" z TEGO SAMEGO źródła treści zamiast drugiej kopii ~150 linii.
 * Zero zmian zachowania — identyczna logika, tylko wyjęta z komponentu.
 */
export function useExceleRightPanelSections({
  preview,
  workbookId,
  taskSteps,
  isGenerating,
  isFailed,
  failureReason,
  onDownload,
  onPreviewFile,
  onAllFiles,
  onOpenVersionHistory,
  onCheckpoint,
  onShare,
  onRevokeShare,
  isShared,
  onExportCsv,
}: ExceleRightPanelProps): ArtifactRightPanelSection[] {
  const { t } = useTranslation();

  const sheetCount = preview?.sheetNames?.length ?? 0;
  const qualityScore = preview?.qualityScore;

  // Krok 1 (docs/program/grafika/ANALIZA_PRAWY_PANEL.md §7): mapa id→sekcja;
  // KOLEJNOŚĆ renderu pochodzi z filtracji kanonicznej
  // `ARTIFACT_PANEL_SECTION_ORDER` (nie z własnej literałowej listy). Excel
  // pomija 'evidence'/'results' (bez zastosowania) — filtr zachowuje 1:1
  // dawną kolejność (actions, properties, relations, comments, history).
  const sectionsById: Partial<Record<string, ArtifactRightPanelSection>> = {
    actions: {
      id: 'actions',
      label: t('excele.rightPanel.actions', 'Akcje'),
      children: (
        <div className="space-y-2">
          <PreviewActionButton
            variant="neutral"
            icon={Download}
            label={t('excele.rightPanel.download', 'Pobierz XLSX')}
            onClick={() => onDownload?.()}
            disabled={!onDownload || isGenerating || (!workbookId && !preview)}
          />
          <PreviewActionButton
            variant="neutral"
            icon={Eye}
            label={t('excele.rightPanel.openWorkspace', 'Otwórz w arkuszu')}
            onClick={() => onPreviewFile?.()}
            disabled={!onPreviewFile}
          />
          <PreviewActionButton
            variant="neutral"
            icon={FolderOpen}
            label={t('excele.rightPanel.allFiles', 'Wszystkie pliki')}
            onClick={() => onAllFiles?.()}
            disabled={!onAllFiles}
          />
          {/* MAT-006 (2026-08-02) — versions/checkpoint/share/CSV. Functional
              proof only (no redesign) — see WorkbookVersionHistoryModal.tsx. */}
          <PreviewActionButton
            variant="neutral"
            icon={History}
            label={t('excele.rightPanel.versionHistory', 'Historia wersji')}
            onClick={() => onOpenVersionHistory?.()}
            disabled={!onOpenVersionHistory || !workbookId}
          />
          <PreviewActionButton
            variant="neutral"
            icon={Sparkles}
            label={t('excele.rightPanel.checkpoint', 'Utwórz punkt kontrolny')}
            onClick={() => onCheckpoint?.()}
            disabled={!onCheckpoint || !workbookId}
          />
          {isShared ? (
            <PreviewActionButton
              variant="neutral"
              icon={ShieldOff}
              label={t('excele.rightPanel.revokeShare', 'Cofnij udostępnienie')}
              onClick={() => onRevokeShare?.()}
              disabled={!onRevokeShare || !workbookId}
            />
          ) : (
            <PreviewActionButton
              variant="neutral"
              icon={Link2}
              label={t('excele.rightPanel.share', 'Udostępnij (kopiuj link)')}
              onClick={() => onShare?.()}
              disabled={!onShare || !workbookId}
            />
          )}
          <PreviewActionButton
            variant="neutral"
            icon={FileSpreadsheet}
            label={t('excele.rightPanel.exportCsv', 'Eksportuj CSV')}
            onClick={() => onExportCsv?.()}
            disabled={!onExportCsv || !workbookId}
          />
        </div>
      ),
    },
    properties: {
      id: 'properties',
      label: t('excele.rightPanel.properties', 'Właściwości'),
      isEmpty: !preview,
      emptyLabel: t(
        'excele.rightPanel.propertiesEmpty',
        'Właściwości pojawią się po wygenerowaniu arkusza'
      ),
      children: (
        <dl className="space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-c-text-muted">{t('excele.rightPanel.format', 'Format')}</dt>
            <dd className="text-c-text font-medium">XLSX</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-c-text-muted">{t('excele.rightPanel.sheets', 'Arkusze')}</dt>
            <dd className="text-c-text font-medium tabular-nums">{sheetCount || '—'}</dd>
          </div>
          {typeof qualityScore === 'number' && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-c-text-muted">{t('excele.rightPanel.quality', 'Jakość')}</dt>
              <dd className="text-c-text font-medium tabular-nums">
                {Math.round(qualityScore * 100)}%
              </dd>
            </div>
          )}
          {preview?.fileName && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-c-text-muted">{t('excele.rightPanel.fileName', 'Plik')}</dt>
              <dd
                className="text-c-text font-medium truncate max-w-[180px]"
                title={preview.fileName}
              >
                {preview.fileName}
              </dd>
            </div>
          )}
        </dl>
      ),
    },
    relations: {
      id: 'relations',
      label: t('excele.rightPanel.relations', 'Powiązania'),
      isEmpty: !workbookId || !onPreviewFile,
      emptyLabel: t('excele.rightPanel.relationsEmpty', 'Brak powiązanych obiektów'),
      children: (
        <button
          type="button"
          onClick={() => onPreviewFile?.()}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-c-border-subtle px-3 py-2 text-xs text-c-text hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
        >
          <span className="truncate">{t('excele.rightPanel.sourceTable', 'Tabela źródłowa')}</span>
          <span aria-hidden="true">{'→'}</span>
        </button>
      ),
    },
    comments: {
      id: 'comments',
      label: t('excele.rightPanel.comments', 'Komentarze'),
      isEmpty: true,
      emptyLabel: t('excele.rightPanel.commentsEmpty', 'Komentarze będą dostępne wkrótce'),
      children: null,
    },
    history: {
      id: 'history',
      label: t('excele.rightPanel.history', 'Historia'),
      icon: Sparkles,
      isEmpty: taskSteps.length === 0,
      emptyLabel: isFailed
        ? failureReason || t('excele.rightPanel.historyFailed', 'Generowanie nie powiodło się')
        : t('excele.rightPanel.historyEmpty', 'Historia pojawi się po wygenerowaniu'),
      children: (
        <ol className="space-y-1.5">
          {taskSteps.map((step) => (
            <li key={step.id} className="flex items-center gap-2 text-xs">
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  step.status === 'completed'
                    ? 'bg-c-success'
                    : step.status === 'failed'
                      ? 'bg-c-danger'
                      : step.status === 'running'
                        ? 'bg-c-info'
                        : 'bg-c-border'
                }`}
              />
              <span className="text-c-text-muted truncate">{step.label}</span>
            </li>
          ))}
        </ol>
      ),
    },
  };

  const sections: ArtifactRightPanelSection[] = ARTIFACT_PANEL_SECTION_ORDER.map(
    (id) => sectionsById[id]
  ).filter((section): section is ArtifactRightPanelSection => section !== undefined);

  return sections;
}

/** Tryb zależny od typu „Struktura" — lista arkuszy skoroszytu. Wyjęty do
 * osobnej funkcji (nie tylko hooka sekcji), bo `ExceleRightRail.tsx` go NIE
 * potrzebuje — ma już własną, starszą, bogatszą „Struktura" (z liczbą
 * wierszy per arkusz, kanon `_KANON_PRAWY_PANEL_2026-07-28.md`) i jej nie
 * ruszamy. Ten typeMode żyje WYŁĄCZNIE tutaj. */
function buildExceleStructureTypeMode(
  preview: ArtifactPreview | null,
  t: (key: string, fallback: string) => string
): ArtifactRailTypeMode {
  const sheetNames = preview?.sheetNames ?? [];
  return {
    id: 'struktura',
    label: t('excele.rightPanel.structure', 'Struktura'),
    icon: ListTree,
    contextLabel: t(
      'excele.rightPanel.structureHint',
      'Arkusze skoroszytu — nawigacja PO artefakcie, nie metadana o nim.'
    ),
    content:
      sheetNames.length === 0 ? (
        <p className="text-xs italic text-c-text-muted">
          {t(
            'excele.rightPanel.structureEmpty',
            'Ten skoroszyt nie ma jeszcze arkuszy — struktura pojawi się po wygenerowaniu.'
          )}
        </p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {sheetNames.map((name, index) => (
            <li
              key={`${index}-${name}`}
              className="truncate rounded-md px-2 py-1 text-[12.5px] text-c-text-secondary"
            >
              {name}
            </li>
          ))}
        </ol>
      ),
  };
}

export const ExceleRightPanel: React.FC<ExceleRightPanelProps> = (props) => {
  const { t } = useTranslation();
  const sections = useExceleRightPanelSections(props);

  // Wspólny prawy pas (`ArtifactRightRail`) — flaga DOMYŚLNIE OFF
  // (src/utils/artifactRightRailFlag.ts). Przy OFF ta zmienna jest `false`,
  // więc poniższa gałąź nigdy nie renderuje się i `sections` idzie 1:1 do
  // dawnej ścieżki bez zmian.
  if (isArtifactRightRailEnabled()) {
    return (
      <ArtifactRightRail
        title={props.preview?.fileName || undefined}
        ariaLabel={t('excele.rightPanel.ariaLabel', 'Szczegóły arkusza')}
        artifact={{ sections }}
        typeModes={[buildExceleStructureTypeMode(props.preview, t)]}
      />
    );
  }

  return (
    // DEC-419 (06.09.2026): przycisk „Zapytaj Teresę o ten arkusz" usunięty
    // z sekcji Akcje — wejście do Teresy jest w Menu 1 (DEC-404).
    <ArtifactRightPanel
      ariaLabel={t('excele.rightPanel.ariaLabel', 'Szczegóły arkusza')}
      sections={sections}
    />
  );
};

export default ExceleRightPanel;
