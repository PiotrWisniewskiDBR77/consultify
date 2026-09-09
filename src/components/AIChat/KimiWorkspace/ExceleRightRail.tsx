/**
 * ExceleRightRail — prawa szyna ikon dla widoku otwartego arkusza w Excele,
 * za flagą `ff_excele_right_rail` (`src/utils/exceleRightRailFlag.ts`,
 * domyślnie OFF).
 *
 * ZGŁOSZENIE (Piotr, 28.07, żywe demo): „Ustaliliśmy, że to będzie
 * wyglądało jak Word (…) tymczasem po prawej mam coś zupełnie innego."
 * Diagnoza: `ExceleView` montuje `KimiWorkspaceShell` + `ExceleRightPanel`
 * (accordion) — NIGDY `ExecutiveModuleShell`, więc arkusz nigdy nie dostał
 * szyny ikon, którą Word ma dziś naprawdę (`DocumentStudioDocumentPanel`
 * → `RightRail`). `ExceleRightPanel`'s "Komentarze" to jawna atrapa:
 * "Komentarze będą dostępne wkrótce" — dokładnie to, co Piotr zobaczył.
 *
 * Rozwiązanie wybrane w sesji (patrz raport): re-użyj `RightRail`
 * (`ExecutiveModuleShell/RightRail.tsx`, świeżo naprawiony P-01 2026-07-28,
 * NIE MODYFIKOWANY tutaj) jako zawartość `rightPanel` w `KimiWorkspaceShell`
 * — TA SAMA komenda ikon+panel co Word, bez przepisywania całej powłoki
 * (pipeline 8 kroków / Powtórz-Remix / pasek plików na dole żyją bez
 * zmian w `KimiWorkspaceShell`, poza tym plikiem nietknięte).
 *
 * Mapowanie na `Harvard/wdrozenie-100/_KANON_PRAWY_PANEL_2026-07-28.md`
 * (7 pozycji, 3 grupy) — zasada podzbioru §5: narzędzie deklaruje TYLKO to,
 * co ma realną treść, reszta znika (nie szarzeje, nie kłamie):
 *
 *   ✓ 2 Źródła i liczby  — link do tabeli źródłowej (realny, z pipeline'u
 *     materializacji), honest empty state gdy brak.
 *   ✓ 4 Struktura        — lista arkuszy skoroszytu (realna, z preview),
 *     BEZ interakcji przełączania karty — ta interakcja żyje dziś WYŁĄCZNIE
 *     w lokalnym stanie `KimiWorkspaceShell` (zakładki pod podglądem) i
 *     podniesienie jej do tego panelu wymagałoby dotknięcia współdzielonego
 *     `KimiWorkspaceShell` (Wordy/Prezentacje/Tabele) — świadomie odłożone,
 *     żeby nie ryzykować regresji w 3 innych lane'ach jednym posunięciem.
 *   ✓ 5 Wybrane          — dziś BEZ modelu zaznaczenia komórki (Fala 3 w
 *     kanonie), więc pokazuje poziom DOKUMENTU: format/arkusze/jakość/plik
 *     (dokładnie to, co dawniej wisiało w sekcji "Właściwości").
 *   ✓ 7 Historia i wydania — kroki pipeline'u (realne) + przycisk pobrania
 *     na dole (kanon §2 poz.7: "na dole panelu przycisk Eksportuj/Wyślij").
 *   ✗ 1 Asystent        — POMINIĘTE: nie ma per-dokumentowego panelu AI z
 *     chipami kontekstu dla Excela (Teresa żyje tylko w głównym czacie) —
 *     pokazanie ikony bez treści byłoby nową atrapą.
 *   ✗ 3 Do poprawy       — POMINIĘTE: istnieje wyłącznie nieprzezroczysty
 *     `qualityScore` (0..1), zero itemizowanych reguł/bramki dla arkusza w
 *     UI — kanon wprost zakazuje pokazywania samej liczby w tej pozycji
 *     ("zero oceny procentowej"); zbudowanie realnej listy to Fala 2.
 *   ✗ 6 Uwagi i akcept   — POMINIĘTE: to jest DOKŁADNIE ta atrapa, którą
 *     Piotr odrzucił ("Komentarze będą dostępne wkrótce") — usunięta, nie
 *     przemalowana.
 *
 * Tokeny wyłącznie `c-*` (poza klasami dziedziczonymi z `RightRail`, który
 * NIE jest tu modyfikowany — jego dotychczasowy `slate-*`/`navy-*` chrom
 * zostaje 1:1 jak w Wordzie/Decku, żeby ekran wyglądał TAK SAMO jak reszta,
 * nie „poprawiony inaczej").
 *
 * ★ Rozwożenie prawego pasa (2026-08-30, docs/program/grafika/ANALIZA_PRAWY_PANEL.md
 * §7 krok 4): brakującym trybem wobec formuły `ArtifactRightRail` był
 * „Artefakt" — kanoniczny accordion (Akcje·Właściwości·Powiązania·
 * Komentarze·Historia). Za flagą `ff_artifact_right_rail`
 * (`isArtifactRightRailEnabled`, domyślnie OFF) dokłada się PIĄTA ikona,
 * PIERWSZA na szynie (kolejność formuły: Artefakt → Teresa → typeModes; tu
 * nie ma Teresy — Excel oddaje ją głównemu czatowi), przed dotychczasowymi
 * czterema (Źródła i liczby · Struktura · Wybrane · Historia i wydania),
 * które zostają NIETKNIĘTE — to NIE jest zamiana, tylko dołożenie. Treść
 * „Artefakt" pochodzi z `useExceleRightPanelSections` (ten sam hook, którego
 * używa `ExceleRightPanel.tsx` — JEDNO źródło, nie druga kopia ~150 linii
 * budowy sekcji). Przy fladze OFF `tools`/`renderPanel` są dokładnie takie
 * jak dziś — `isArtifactRightRailEnabled`/`artifactSections` martwe.
 */
import {
  Download,
  FileSpreadsheet,
  History as HistoryIcon,
  LayoutGrid,
  Link2,
  ListTree,
  ShieldOff,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  RightRail,
  type RightRailToolDescriptor,
} from '@/components/shared/ExecutiveModuleShell/RightRail';
import { useRailState } from '@/components/shared/ExecutiveModuleShell/useRailState';
import { PreviewActionButton } from '@/components/shared/PreviewPane';
import { ArtifactRightPanel } from '@/components/standard/ArtifactRightPanel';
import { isArtifactRightRailEnabled } from '@/utils/artifactRightRailFlag';

import { useExceleRightPanelSections } from './ExceleRightPanel';
import type { ArtifactPreview, TaskStep } from './KimiWorkspaceShell';

export interface ExceleRightRailProps {
  preview: ArtifactPreview | null;
  workbookId: string | null;
  taskSteps: TaskStep[];
  isGenerating: boolean;
  isFailed?: boolean;
  failureReason?: string | null;
  onDownload?: () => void;
  onPreviewFile?: () => void;
  onAllFiles?: () => void;
  /** MAT-006 (2026-08-02) — workbook lifecycle actions, surfaced in the
   * "Historia i wydania" tool (the natural home for version/checkpoint/
   * share/export per the existing §2 poz.7 kanon: "na dole panelu przycisk
   * Eksportuj/Wyślij", already where `onDownload` lives). */
  onOpenVersionHistory?: () => void;
  onCheckpoint?: () => void;
  onShare?: () => void;
  onRevokeShare?: () => void;
  isShared?: boolean;
  onExportCsv?: () => void;
}

const PANEL_HEADER = (title: string, subtitle: string): React.ReactElement => (
  <div className="mb-3">
    <h3 className="text-sm font-semibold text-c-text">{title}</h3>
    <p className="text-xs text-c-text-secondary">{subtitle}</p>
  </div>
);

export const ExceleRightRail: React.FC<ExceleRightRailProps> = ({
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
}) => {
  const { t } = useTranslation();
  // Wspólny hak trwałości szyny (ten sam co Word/Deck/Tabele) — osobny
  // `moduleKey`, więc szerokość/zwinięcie Excela nie miesza się z innymi
  // modułami dzielącymi ten sam localStorage-owy magazyn.
  const rail = useRailState({ moduleKey: 'excele-right-rail', defaultRightWidth: 320 });
  const [activeToolId, setActiveToolId] = useState<string | null>(null);

  const sheetNames = preview?.sheetNames ?? [];
  const sheetCount = sheetNames.length;
  const qualityScore = preview?.qualityScore;
  const hasSourceTable = Boolean(workbookId && onPreviewFile);

  // Flaga DOMYŚLNIE OFF (src/utils/artifactRightRailFlag.ts) — przy OFF ta
  // zmienna jest `false`, więc ikona „Artefakt" niżej nigdy się nie dokłada
  // i `tools`/`renderPanel` są dokładnie takie jak przed tą zmianą.
  const artifactRailEnabled = isArtifactRightRailEnabled();
  const artifactSections = useExceleRightPanelSections({
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
  });

  const tools: RightRailToolDescriptor[] = [
    // „Artefakt" jest PIERWSZA — kolejność formuły (Artefakt → Teresa →
    // typeModes) narzuca to miejsce, nie preferencja tego pliku.
    ...(artifactRailEnabled
      ? [
          {
            id: 'artefakt',
            label: t('excele.rightRail.artifact', 'Artifact'),
            icon: LayoutGrid,
          } satisfies RightRailToolDescriptor,
        ]
      : []),
    {
      id: 'sources',
      label: t('excele.rightRail.sources', 'Sources and numbers'),
      icon: Link2,
      dotTone: hasSourceTable ? null : 'warning',
    },
    {
      id: 'structure',
      label: t('excele.rightRail.structure', 'Structure'),
      icon: ListTree,
      disabled: sheetCount === 0,
      disabledReason: t(
        'excele.rightRail.structureDisabled',
        'The sheet has no tab to show yet'
      ),
    },
    {
      id: 'selected',
      label: t('excele.rightRail.selected', 'Selected'),
      icon: SlidersHorizontal,
    },
    {
      id: 'history',
      label: t('excele.rightRail.history', 'History and releases'),
      icon: HistoryIcon,
      dotTone: isFailed ? 'danger' : null,
    },
  ];

  const renderSources = (): React.ReactElement => (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      {PANEL_HEADER(
        t('excele.rightRail.sourcesTitle', 'Sources and numbers'),
        t('excele.rightRail.sourcesSubtitle', 'Where the data in this sheet came from.')
      )}
      {hasSourceTable ? (
        <button
          type="button"
          onClick={() => onPreviewFile?.()}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-c-border-subtle px-3 py-2 text-xs text-c-text hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
          data-testid="excele-right-rail-source-table"
        >
          <span className="truncate">{t('excele.rightRail.sourceTable', 'Source table')}</span>
          <span aria-hidden="true">{'→'}</span>
        </button>
      ) : (
        <p className="text-xs italic text-c-text-muted py-1.5">
          {t(
            'excele.rightRail.sourcesEmpty',
            'This sheet has no recorded data source yet — inserting facts with provenance is the next wave of this feature.'
          )}
        </p>
      )}
    </div>
  );

  const renderStructure = (): React.ReactElement => (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      {PANEL_HEADER(
        t('excele.rightRail.structureTitle', 'Structure'),
        t('excele.rightRail.structureSubtitle', {
          defaultValue: '{{count}} arkuszy w tym skoroszycie',
          count: sheetCount,
        })
      )}
      {sheetCount > 0 ? (
        <ul className="space-y-1.5" data-testid="excele-right-rail-structure-list">
          {sheetNames.map((name, i) => {
            const rows = preview?.perSheetData?.[i]?.rows?.length;
            return (
              <li
                key={`${name}-${i}`}
                className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-xs text-c-text"
              >
                <span className="font-medium">
                  {i + 1}. {name}
                </span>
                {typeof rows === 'number' && (
                  <span className="mt-0.5 block text-[10px] text-c-text-secondary">
                    {t('excele.rightRail.structureRows', {
                      defaultValue: '{{count}} wierszy',
                      count: rows,
                    })}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs italic text-c-text-muted py-1.5">
          {t('excele.rightRail.structureEmpty', 'The sheet has no tab yet.')}
        </p>
      )}
    </div>
  );

  const renderSelected = (): React.ReactElement => (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      {PANEL_HEADER(
        t('excele.rightRail.selectedTitle', 'Selected'),
        t(
          'excele.rightRail.selectedSubtitle',
          'Nothing is selected — properties of the whole document.'
        )
      )}
      <dl className="space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-c-text-muted">{t('excele.rightRail.format', 'Format')}</dt>
          <dd className="text-c-text font-medium">XLSX</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-c-text-muted">{t('excele.rightRail.sheets', 'Sheets')}</dt>
          <dd className="text-c-text font-medium tabular-nums">{sheetCount || '—'}</dd>
        </div>
        {typeof qualityScore === 'number' && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-c-text-muted">{t('excele.rightRail.quality', 'Quality')}</dt>
            <dd className="text-c-text font-medium tabular-nums">
              {Math.round(qualityScore * 100)}%
            </dd>
          </div>
        )}
        {preview?.fileName && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-c-text-muted">{t('excele.rightRail.fileName', 'File')}</dt>
            <dd className="text-c-text font-medium truncate max-w-[180px]" title={preview.fileName}>
              {preview.fileName}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );

  const renderHistory = (): React.ReactElement => (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      {PANEL_HEADER(
        t('excele.rightRail.historyTitle', 'History and releases'),
        t('excele.rightRail.historySubtitle', 'Steps for generating this sheet.')
      )}
      {taskSteps.length > 0 ? (
        <ol className="space-y-1.5 flex-1">
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
      ) : (
        <p className="text-xs italic text-c-text-muted py-1.5 flex-1">
          {isFailed
            ? failureReason || t('excele.rightRail.historyFailed', 'Generation failed')
            : t('excele.rightRail.historyEmpty', 'History will appear once the sheet is generated')}
        </p>
      )}
      <div className="pt-2 border-t border-c-border-subtle mt-2 space-y-1.5">
        <PreviewActionButton
          variant="neutral"
          icon={Download}
          label={t('excele.rightRail.download', 'Download XLSX')}
          onClick={() => onDownload?.()}
          disabled={!onDownload || isGenerating || (!workbookId && !preview)}
        />
        {/* MAT-006 (2026-08-02) — versions/checkpoint/share/CSV. */}
        <PreviewActionButton
          variant="neutral"
          icon={HistoryIcon}
          label={t('excele.rightRail.versionHistory', 'Version history')}
          onClick={() => onOpenVersionHistory?.()}
          disabled={!onOpenVersionHistory || !workbookId}
        />
        <PreviewActionButton
          variant="neutral"
          icon={Sparkles}
          label={t('excele.rightRail.checkpoint', 'Create checkpoint')}
          onClick={() => onCheckpoint?.()}
          disabled={!onCheckpoint || !workbookId}
        />
        {isShared ? (
          <PreviewActionButton
            variant="neutral"
            icon={ShieldOff}
            label={t('excele.rightRail.revokeShare', 'Revoke sharing')}
            onClick={() => onRevokeShare?.()}
            disabled={!onRevokeShare || !workbookId}
          />
        ) : (
          <PreviewActionButton
            variant="neutral"
            icon={Link2}
            label={t('excele.rightRail.share', 'Share (copy link)')}
            onClick={() => onShare?.()}
            disabled={!onShare || !workbookId}
          />
        )}
        <PreviewActionButton
          variant="neutral"
          icon={FileSpreadsheet}
          label={t('excele.rightRail.exportCsv', 'Export CSV')}
          onClick={() => onExportCsv?.()}
          disabled={!onExportCsv || !workbookId}
        />
      </div>
    </div>
  );

  const renderArtefakt = (): React.ReactElement => (
    <ArtifactRightPanel
      ariaLabel={t('excele.rightPanel.ariaLabel', 'Sheet details')}
      className="border-l-0"
      width="100%"
      sections={artifactSections}
    />
  );

  const renderPanel = (): React.ReactNode => {
    switch (activeToolId) {
      case 'artefakt':
        return renderArtefakt();
      case 'sources':
        return renderSources();
      case 'structure':
        return renderStructure();
      case 'selected':
        return renderSelected();
      case 'history':
        return renderHistory();
      default:
        return null;
    }
  };

  return (
    <RightRail
      tools={tools}
      activeToolId={activeToolId}
      onSelectTool={setActiveToolId}
      panelContent={renderPanel()}
      panelWidth={rail.rightWidth}
      collapsed={rail.rightCollapsed}
      onToggleCollapse={rail.toggleRight}
      onResize={rail.setRightWidth}
      resizeLabel={t('excele.rightRail.resize', 'Resize right rail')}
      collapseLabel={t('excele.rightRail.collapseLabel', 'Collapse or expand the toolbar')}
      testId="excele-right-rail"
    />
  );
};

export default ExceleRightRail;
