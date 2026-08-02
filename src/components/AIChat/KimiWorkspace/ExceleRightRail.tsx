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
 */
import {
  Download,
  FileSpreadsheet,
  History as HistoryIcon,
  Link2,
  ListTree,
  ShieldOff,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RightRail, type RightRailToolDescriptor } from '@/components/shared/ExecutiveModuleShell/RightRail';
import { useRailState } from '@/components/shared/ExecutiveModuleShell/useRailState';
import { PreviewActionButton } from '@/components/shared/PreviewPane';

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

  const tools: RightRailToolDescriptor[] = [
    {
      id: 'sources',
      label: t('excele.rightRail.sources', 'Źródła i liczby'),
      icon: Link2,
      dotTone: hasSourceTable ? null : 'warning',
    },
    {
      id: 'structure',
      label: t('excele.rightRail.structure', 'Struktura'),
      icon: ListTree,
      disabled: sheetCount === 0,
      disabledReason: t(
        'excele.rightRail.structureDisabled',
        'Arkusz nie ma jeszcze żadnej karty do pokazania'
      ),
    },
    {
      id: 'selected',
      label: t('excele.rightRail.selected', 'Wybrane'),
      icon: SlidersHorizontal,
    },
    {
      id: 'history',
      label: t('excele.rightRail.history', 'Historia i wydania'),
      icon: HistoryIcon,
      dotTone: isFailed ? 'danger' : null,
    },
  ];

  const renderSources = (): React.ReactElement => (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      {PANEL_HEADER(
        t('excele.rightRail.sourcesTitle', 'Źródła i liczby'),
        t('excele.rightRail.sourcesSubtitle', 'Skąd wzięły się dane w tym arkuszu.')
      )}
      {hasSourceTable ? (
        <button
          type="button"
          onClick={() => onPreviewFile?.()}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-c-border-subtle px-3 py-2 text-xs text-c-text hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
          data-testid="excele-right-rail-source-table"
        >
          <span className="truncate">{t('excele.rightRail.sourceTable', 'Tabela źródłowa')}</span>
          <span aria-hidden="true">{'→'}</span>
        </button>
      ) : (
        <p className="text-xs italic text-c-text-muted py-1.5">
          {t(
            'excele.rightRail.sourcesEmpty',
            'Ten arkusz nie ma dziś zapisanego źródła danych — wstawianie faktów z liczbą pochodzenia to kolejna fala tej funkcji.'
          )}
        </p>
      )}
    </div>
  );

  const renderStructure = (): React.ReactElement => (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      {PANEL_HEADER(
        t('excele.rightRail.structureTitle', 'Struktura'),
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
          {t('excele.rightRail.structureEmpty', 'Arkusz jeszcze nie ma żadnej karty.')}
        </p>
      )}
    </div>
  );

  const renderSelected = (): React.ReactElement => (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      {PANEL_HEADER(
        t('excele.rightRail.selectedTitle', 'Wybrane'),
        t(
          'excele.rightRail.selectedSubtitle',
          'Nic nie jest zaznaczone — właściwości całego dokumentu.'
        )
      )}
      <dl className="space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-c-text-muted">{t('excele.rightRail.format', 'Format')}</dt>
          <dd className="text-c-text font-medium">XLSX</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-c-text-muted">{t('excele.rightRail.sheets', 'Arkusze')}</dt>
          <dd className="text-c-text font-medium tabular-nums">{sheetCount || '—'}</dd>
        </div>
        {typeof qualityScore === 'number' && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-c-text-muted">{t('excele.rightRail.quality', 'Jakość')}</dt>
            <dd className="text-c-text font-medium tabular-nums">
              {Math.round(qualityScore * 100)}%
            </dd>
          </div>
        )}
        {preview?.fileName && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-c-text-muted">{t('excele.rightRail.fileName', 'Plik')}</dt>
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
        t('excele.rightRail.historyTitle', 'Historia i wydania'),
        t('excele.rightRail.historySubtitle', 'Kroki generowania tego arkusza.')
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
            ? failureReason || t('excele.rightRail.historyFailed', 'Generowanie nie powiodło się')
            : t('excele.rightRail.historyEmpty', 'Historia pojawi się po wygenerowaniu')}
        </p>
      )}
      <div className="pt-2 border-t border-c-border-subtle mt-2 space-y-1.5">
        <PreviewActionButton
          variant="neutral"
          icon={Download}
          label={t('excele.rightRail.download', 'Pobierz XLSX')}
          onClick={() => onDownload?.()}
          disabled={!onDownload || isGenerating || (!workbookId && !preview)}
        />
        {/* MAT-006 (2026-08-02) — versions/checkpoint/share/CSV. */}
        <PreviewActionButton
          variant="neutral"
          icon={HistoryIcon}
          label={t('excele.rightRail.versionHistory', 'Historia wersji')}
          onClick={() => onOpenVersionHistory?.()}
          disabled={!onOpenVersionHistory || !workbookId}
        />
        <PreviewActionButton
          variant="neutral"
          icon={Sparkles}
          label={t('excele.rightRail.checkpoint', 'Utwórz punkt kontrolny')}
          onClick={() => onCheckpoint?.()}
          disabled={!onCheckpoint || !workbookId}
        />
        {isShared ? (
          <PreviewActionButton
            variant="neutral"
            icon={ShieldOff}
            label={t('excele.rightRail.revokeShare', 'Cofnij udostępnienie')}
            onClick={() => onRevokeShare?.()}
            disabled={!onRevokeShare || !workbookId}
          />
        ) : (
          <PreviewActionButton
            variant="neutral"
            icon={Link2}
            label={t('excele.rightRail.share', 'Udostępnij (kopiuj link)')}
            onClick={() => onShare?.()}
            disabled={!onShare || !workbookId}
          />
        )}
        <PreviewActionButton
          variant="neutral"
          icon={FileSpreadsheet}
          label={t('excele.rightRail.exportCsv', 'Eksportuj CSV')}
          onClick={() => onExportCsv?.()}
          disabled={!onExportCsv || !workbookId}
        />
      </div>
    </div>
  );

  const renderPanel = (): React.ReactNode => {
    switch (activeToolId) {
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
      collapseLabel={t('excele.rightRail.collapseLabel', 'Zwiń/rozwiń pasek narzędzi')}
      testId="excele-right-rail"
    />
  );
};

export default ExceleRightRail;
