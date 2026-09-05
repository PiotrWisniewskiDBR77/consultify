/**
 * `/results/okr/:objectiveId/rezultaty/:keyResultId` — POZIOM 4
 * czteropoziomowej formuły OKR: KARTA KLUCZOWEGO REZULTATU.
 *
 * „(…) piętro niżej – zbiór kart, a poniżej kolejna karta." (właściciel,
 * 2026-09-05). To jest ta „kolejna karta": ta sama powłoka SPEC-A co karta
 * celu (`ArtifactBreadcrumb` + `NModeShell` + `ArtifactRightPanel`), inny byt.
 *
 * ── DLACZEGO OSOBNY KOMPONENT, A NIE `OkrObjectiveCardPage` Z INNYM ID ─────
 * W rodzinie KPI poziom 4 to TEN SAM byt co poziom 2 (wskaźnik), więc tam
 * reużyto jednego komponentu. Tutaj poziom 4 to Kluczowy Rezultat — inny
 * kształt danych (kontrakt pomiaru: kierunek, jednostka, wartości bazowa/
 * startowa/docelowa/zakres, waga, źródło), inny cykl życia (`achieved`/
 * `not_achieved`/`cancelled`) i inna historia (check-iny per KR). Wciskanie
 * tego w komponent celu wymagałoby dwóch rozgałęzień w każdej sekcji —
 * czyli dwóch ekranów w jednym pliku, nie reużycia.
 *
 * ── SKĄD DANE (nie ma trasy „pobierz jeden KR" dla klienta) ────────────────
 * `okrObjectiveApi.ts` udokumentował zmierzoną lukę: backend NIE MA
 * `GET /key-results/:id` w powierzchni tego pakietu — KR-y przychodzą
 * ZAGNIEŻDŻONE w celu. Ta karta pobiera więc cel
 * (`getObjectiveWithKeyResults`) i wybiera z niego swój rezultat. To nie jest
 * obejście: to jedyna droga, jaką API daje, a przy okazji daje rodzica do
 * ścieżki poziomów bez drugiego żądania.
 *
 * Wyłącznie tokeny `c-*`, zero `primary-*`/crimson.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Blocks,
  CalendarClock,
  Gauge,
  Link2,
  ListChecks,
  Settings2,
  Target,
  TrendingUp,
} from 'lucide-react';

import { EmptyState } from '@/components/shared/states';
import { NModeShell } from '@/components/shared/NModeLayout/NModeShell';
import { NModeContentBlock } from '@/components/shared/NModeLayout/NModeContentBlock';
import type { NModeHeaderConfig, NModeSection } from '@/components/shared/NModeLayout/types';
import { ArtifactBreadcrumb } from '@/components/standard/ArtifactBreadcrumb';
import { ArtifactPropertiesTable, type ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { ArtifactRightPanel, type ArtifactRightPanelSection } from '@/components/standard/ArtifactRightPanel';
import { StatusChip } from '@/components/ui/primitives';
import { memberNameOrUnknown, useOrganizationMemberNames } from '@/hooks/useOrganizationMemberNames';
import { ROUTES } from '@/routes/routeConfig';

import { HonestValueCell } from '../HonestValue';
import { isResultsVNextFlagEnabled } from '../resultsVNextFeatureFlags';
import { toUserFacingErrorMessage } from '../shared/errorMessage';
import { getOkrSet, type OkrSetDto } from './okrApi';
import { listCheckIns, type OkrCheckInDto } from './okrCheckInApi';
import {
  getObjectiveWithKeyResults,
  type OkrKeyResultDto,
  type OkrObjectiveWithKeyResultsDto,
} from './okrObjectiveApi';
import {
  formatOkrDate,
  formatOkrNumeric,
  formatOkrProgressPercent,
  OKR_KEY_RESULT_HEADER_STATUS_TONE,
  OKR_KEY_RESULT_STATUS_TONE,
  okrKeyResultConfidenceLabel,
  okrKeyResultDirectionLabel,
  okrKeyResultMeasurementTypeLabel,
  okrKeyResultSourceTypeLabel,
  okrKeyResultStatusLabel,
  parseOkrKeyResultProgress,
  parseOkrNumericField,
} from './okrObjectiveMappers';
import {
  OKR_KEY_RESULT_CARD_DEFAULT_SECTION,
  OKR_KEY_RESULT_CARD_SECTIONS,
  type OkrKeyResultCardSectionId,
} from './OkrObjectiveCardSections';
import { okrKeyResultSetPath, okrObjectiveCardPath, withOwnerSampleData } from './okrObjectiveCardPath';
import { OKR_TONE_TEXT_CLASS, OkrKeyValueGrid, OkrProgressBar, OkrStatTile } from './okrCardPrimitives';
import { okrToneToCardTone, OKR_CARD_SECTION_PARAM } from './OkrObjectiveCardPage';

function sectionMeta(id: OkrKeyResultCardSectionId) {
  const def = OKR_KEY_RESULT_CARD_SECTIONS.find((section) => section.id === id);
  if (!def) throw new Error(`Unknown OKR key result card section: ${id}`);
  return { label: def.label, title: def.title };
}

function isKeyResultSectionId(value: string | null): value is OkrKeyResultCardSectionId {
  return !!value && OKR_KEY_RESULT_CARD_SECTIONS.some((section) => section.id === value);
}

export const OkrKeyResultCardPage: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);
  const navigate = useNavigate();
  const { objectiveId, keyResultId } = useParams<{ objectiveId: string; keyResultId: string }>();
  const enabled = isResultsVNextFlagEnabled('okrRegistry');

  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get(OKR_CARD_SECTION_PARAM);
  const activeSection = isKeyResultSectionId(sectionParam) ? sectionParam : OKR_KEY_RESULT_CARD_DEFAULT_SECTION;
  const setActiveSection = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams);
      params.set(OKR_CARD_SECTION_PARAM, next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const resolveMemberNameRaw = useOrganizationMemberNames();
  const resolveMemberName = useCallback(
    (userId: string | null | undefined): string => memberNameOrUnknown(resolveMemberNameRaw, userId, isPolish),
    [resolveMemberNameRaw, isPolish]
  );

  const [objective, setObjective] = useState<OkrObjectiveWithKeyResultsDto | null | 'loading'>('loading');
  const [parentSet, setParentSet] = useState<OkrSetDto | null>(null);
  const [checkIns, setCheckIns] = useState<OkrCheckInDto[] | 'loading'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadObjective = useCallback(() => {
    if (!objectiveId) return;
    setObjective('loading');
    setLoadError(null);
    getObjectiveWithKeyResults(objectiveId)
      .then(setObjective)
      .catch((err) => {
        setObjective(null);
        setLoadError(toUserFacingErrorMessage(err, isPolish));
      });
  }, [isPolish, objectiveId]);

  useEffect(() => {
    if (!enabled) return;
    loadObjective();
  }, [enabled, loadObjective]);

  const setId = objective && objective !== 'loading' ? objective.setId : null;
  useEffect(() => {
    if (!enabled || !setId) return;
    getOkrSet(setId)
      .then(setParentSet)
      .catch(() => setParentSet(null));
  }, [enabled, setId]);

  useEffect(() => {
    if (!enabled || !keyResultId) return;
    setCheckIns('loading');
    listCheckIns(keyResultId)
      .then(setCheckIns)
      .catch(() => setCheckIns([]));
  }, [enabled, keyResultId]);

  const keyResult: OkrKeyResultDto | null = useMemo(() => {
    if (!objective || objective === 'loading') return null;
    return objective.keyResults.find((kr) => kr.keyResultId === keyResultId) ?? null;
  }, [keyResultId, objective]);

  const goToSet = useCallback(
    () => (objectiveId ? navigate(withOwnerSampleData(okrKeyResultSetPath(objectiveId))) : undefined),
    [navigate, objectiveId]
  );

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-okr-key-result-card-disabled">
        <EmptyState
          variant="new"
          icon={Blocks}
          title={t('Karta kluczowego rezultatu — jeszcze nie włączona', 'Key result card — not yet enabled')}
          description={t(
            'Ten ekran jest w budowie. Wróć później albo poproś administratora o dostęp za flagą.',
            'This screen is still being built. Check back later, or ask an administrator for flag access.'
          )}
          compact
        />
      </div>
    );
  }

  if (objective === 'loading') {
    return (
      <div className="h-full flex items-center justify-center" data-testid="results-vnext-okr-key-result-card-loading">
        <div className="text-sm text-c-text-muted">{t('Ładowanie kluczowego rezultatu…', 'Loading key result…')}</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-okr-key-result-card-error">
        <EmptyState
          variant="error"
          icon={AlertTriangle}
          title={t('Nie udało się wczytać kluczowego rezultatu', 'Could not load the key result')}
          description={loadError}
          onRetry={loadObjective}
          compact
        />
      </div>
    );
  }

  if (!keyResult) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-okr-key-result-card-missing">
        <EmptyState
          variant="new"
          icon={ListChecks}
          title={t('Nie widzisz tego kluczowego rezultatu', 'You cannot see this key result')}
          description={t(
            'Rezultat nie istnieje, nie należy do tego celu, albo nie masz do niego dostępu — serwer nie rozróżnia tych przypadków, więc my też nie zgadujemy.',
            'The key result does not exist, does not belong to this objective, or you have no access — the server does not distinguish these cases, so neither do we.'
          )}
          onRetry={goToSet}
          compact
        />
      </div>
    );
  }

  const scope = `okr-key-result:${keyResult.keyResultId}`;
  const tone = okrToneToCardTone(OKR_KEY_RESULT_STATUS_TONE[keyResult.status]);
  const progress = parseOkrKeyResultProgress(keyResult.progress, keyResult.progressCalcReason);
  const start = parseOkrNumericField(keyResult.startValue);
  const target = parseOkrNumericField(keyResult.targetValue);
  const current = parseOkrNumericField(keyResult.currentValue);
  const baseline = parseOkrNumericField(keyResult.baselineValue);
  const checkInList = checkIns === 'loading' ? [] : checkIns;

  const numericValue = (value: number | null) => (
    <HonestValueCell isPolish={isPolish} value={value} format={(v) => formatOkrNumeric(v, isPolish, keyResult.unit)} />
  );

  // ── SEKCJA 1: REZULTAT (kontrakt pomiaru) ────────────────────────────────
  const contractSection: NModeSection = {
    id: 'rezultat',
    icon: Target,
    ...sectionMeta('rezultat'),
    hasData: true,
    alwaysShow: true,
    component: (
      <div className="flex flex-col gap-4" data-testid="okr-key-result-card-section-contract">
        <NModeContentBlock blockId="kr-opis" scope={scope} title={t('Co mierzymy', 'What we measure')} readMode>
          {keyResult.description ? (
            <p className="whitespace-pre-line text-xs leading-relaxed text-c-text-secondary">
              {keyResult.description}
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-c-text-muted">
              {t(
                'Ten kluczowy rezultat nie ma opisu. Sam kontrakt pomiaru poniżej mówi, co dokładnie jest liczone.',
                'This key result has no description. The measurement contract below states exactly what is counted.'
              )}
            </p>
          )}
        </NModeContentBlock>

        <NModeContentBlock blockId="kr-kontrakt" scope={scope} title={t('Kontrakt pomiaru', 'Measurement contract')} readMode>
          <OkrKeyValueGrid
            rows={[
              { label: t('Właściciel', 'Owner'), value: resolveMemberName(keyResult.ownerUserId) },
              {
                label: t('Typ pomiaru', 'Measurement type'),
                value: okrKeyResultMeasurementTypeLabel(keyResult.measurementType, isPolish),
              },
              { label: t('Geometria', 'Geometry'), value: okrKeyResultDirectionLabel(keyResult.direction, isPolish) },
              { label: t('Jednostka', 'Unit'), value: keyResult.unit ?? '—' },
              { label: t('Wartość bazowa', 'Baseline value'), value: numericValue(baseline) },
              { label: t('Wartość startowa', 'Start value'), value: numericValue(start) },
              { label: t('Wartość docelowa', 'Target value'), value: numericValue(target) },
              ...(keyResult.direction === 'maintain_range'
                ? [
                    { label: t('Zakres — min', 'Range — min'), value: numericValue(parseOkrNumericField(keyResult.rangeMin)) },
                    { label: t('Zakres — max', 'Range — max'), value: numericValue(parseOkrNumericField(keyResult.rangeMax)) },
                  ]
                : []),
              {
                label: t('Waga', 'Weight'),
                value: (
                  <HonestValueCell
                    isPolish={isPolish}
                    value={parseOkrNumericField(keyResult.weight)}
                    format={(v) => formatOkrNumeric(v, isPolish)}
                  />
                ),
              },
              { label: t('Źródło', 'Source'), value: okrKeyResultSourceTypeLabel(keyResult.sourceType, isPolish) },
              { label: t('Odniesienie źródła', 'Source reference'), value: keyResult.sourceReference ?? '—' },
              {
                label: t('Pewność', 'Confidence'),
                value: keyResult.confidence ? okrKeyResultConfidenceLabel(keyResult.confidence, isPolish) : '—',
              },
            ]}
          />
        </NModeContentBlock>
      </div>
    ),
  };

  // ── SEKCJA 2: POMIAR I POSTĘP ────────────────────────────────────────────
  const measurementSection: NModeSection = {
    id: 'pomiar',
    icon: TrendingUp,
    ...sectionMeta('pomiar'),
    hasData: current !== null || typeof progress === 'number',
    alwaysShow: true,
    component: (
      <div className="flex flex-col gap-4" data-testid="okr-key-result-card-section-measurement">
        <NModeContentBlock blockId="kr-wartosci" scope={scope} title={t('Wartości', 'Values')} readMode>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <OkrStatTile label={t('Start', 'Start')} icon={Gauge} value={numericValue(start)} />
            <OkrStatTile label={t('Cel', 'Target')} icon={Target} value={numericValue(target)} />
            <OkrStatTile
              label={t('Bieżąca', 'Current')}
              icon={TrendingUp}
              tone={tone}
              value={numericValue(current)}
              sub={formatOkrDate(keyResult.updatedAt, isPolish)}
            />
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-c-text-muted">
              <span>{t('Postęp', 'Progress')}</span>
              <span className="font-semibold">
                <HonestValueCell
                  isPolish={isPolish}
                  value={progress}
                  notCalculableReason={keyResult.progressCalcReason ?? undefined}
                  format={(v) => (
                    <span className={OKR_TONE_TEXT_CLASS[tone]}>
                      {formatOkrProgressPercent(v, isPolish)} · {okrKeyResultStatusLabel(keyResult.status, isPolish)}
                    </span>
                  )}
                />
              </span>
            </div>
            <OkrProgressBar
              pct={typeof progress === 'number' ? Math.round(progress * 1000) / 10 : 0}
              tone={tone}
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-c-text-muted">
            {t(
              'Postęp liczy silnik po stronie serwera z kontraktu powyżej; karta go nie przelicza po swojemu. Gdy silnik zwróci „nie da się policzyć", widzisz ten napis, a nie zero.',
              'Progress is computed by the server-side engine from the contract above; this card never recomputes it its own way. When the engine returns "not calculable" you see that, not a zero.'
            )}
          </p>
        </NModeContentBlock>
      </div>
    ),
  };

  // ── SEKCJA 3: CHECK-INY ──────────────────────────────────────────────────
  const checkInSection: NModeSection = {
    id: 'check-iny',
    icon: CalendarClock,
    ...sectionMeta('check-iny'),
    hasData: checkInList.length > 0,
    alwaysShow: true,
    component: (
      <div className="flex flex-col gap-4" data-testid="okr-key-result-card-section-checkins">
        {checkIns === 'loading' ? (
          <p className="text-sm text-c-text-muted">{t('Ładowanie…', 'Loading…')}</p>
        ) : checkInList.length === 0 ? (
          <EmptyState
            variant="new"
            icon={CalendarClock}
            title={t('Brak check-inów', 'No check-ins')}
            description={t(
              'Dla tego rezultatu nie zapisano jeszcze żadnego pomiaru. Check-in zapisuje właściciel rezultatu w oknie wyznaczonym przez cykl.',
              'No measurement has been recorded for this key result yet. The owner records a check-in inside the window set by the cycle.'
            )}
            compact
          />
        ) : (
          <ul className="flex flex-col gap-2" data-testid="okr-key-result-card-checkins">
            {checkInList.map((entry) => (
              <li key={entry.checkInId} className="rounded-xl border border-c-border-subtle p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium tabular-nums text-c-text">
                    <HonestValueCell
                      isPolish={isPolish}
                      value={parseOkrNumericField(entry.newValue)}
                      format={(v) => formatOkrNumeric(v, isPolish, keyResult.unit)}
                    />
                  </span>
                  <span className="text-[11px] tabular-nums text-c-text-muted">
                    {formatOkrDate(entry.submittedAt, isPolish)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-c-text-secondary">
                  {entry.ownerDeclaredStatus ? <StatusChip label={entry.ownerDeclaredStatus} tone="neutral" /> : null}
                  <span>{resolveMemberName(entry.submittedBy)}</span>
                  {entry.correctionOfCheckInId ? (
                    <span className="text-c-warning">{t('korekta', 'correction')}</span>
                  ) : null}
                </div>
                {entry.note ? <p className="mt-1 text-[11px] text-c-text-muted">{entry.note}</p> : null}
                {entry.blocker ? (
                  <p className="mt-1 text-[11px] text-c-warning">
                    {t('Blokada: ', 'Blocker: ')}
                    {entry.blocker}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    ),
  };

  const sections: NModeSection[] = [contractSection, measurementSection, checkInSection];

  const header: NModeHeaderConfig = {
    title: `${t('Kluczowy rezultat', 'Key result')} — ${keyResult.title}`,
    onTitleChange: () => {},
    titleReadOnly: true,
    statusLabel: okrKeyResultStatusLabel(keyResult.status, isPolish),
    statusTone: OKR_KEY_RESULT_HEADER_STATUS_TONE[keyResult.status],
    artifactType: 'okr',
    artifactId: keyResult.keyResultId,
    onSave: () => {},
    saveState: 'saved',
    onClose: goToSet,
  };

  const propertyRows: ArtifactPropertyRow[] = [
    { id: 'owner', label: t('Właściciel', 'Owner'), value: resolveMemberName(keyResult.ownerUserId) },
    { id: 'status', label: t('Status', 'Status'), value: okrKeyResultStatusLabel(keyResult.status, isPolish) },
    { id: 'direction', label: t('Geometria', 'Geometry'), value: okrKeyResultDirectionLabel(keyResult.direction, isPolish) },
    { id: 'current', label: t('Wartość bieżąca', 'Current value'), value: numericValue(current) },
    { id: 'target', label: t('Wartość docelowa', 'Target value'), value: numericValue(target) },
    {
      id: 'progress',
      label: t('Postęp', 'Progress'),
      value: (
        <HonestValueCell
          isPolish={isPolish}
          value={progress}
          notCalculableReason={keyResult.progressCalcReason ?? undefined}
          format={(v) => formatOkrProgressPercent(v, isPolish)}
        />
      ),
    },
    { id: 'checkIns', label: t('Check-iny', 'Check-ins'), value: String(checkInList.length) },
    { id: 'created', label: t('Utworzono', 'Created'), value: formatOkrDate(keyResult.createdAt, isPolish) },
    { id: 'updated', label: t('Zaktualizowano', 'Updated'), value: formatOkrDate(keyResult.updatedAt, isPolish) },
  ];

  const rightPanelSections: ArtifactRightPanelSection[] = [
    {
      id: 'actions',
      label: t('Akcje', 'Actions'),
      icon: Settings2,
      defaultOpen: true,
      children: (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="w-full rounded-lg border border-c-border px-3 py-1.5 text-left text-xs text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            onClick={goToSet}
          >
            {t('Wróć do zbioru kart', 'Back to the card set')}
          </button>
          <button
            type="button"
            className="w-full rounded-lg border border-c-border px-3 py-1.5 text-left text-xs text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            onClick={() => (objectiveId ? navigate(withOwnerSampleData(okrObjectiveCardPath(objectiveId))) : undefined)}
          >
            {t('Otwórz kartę celu', 'Open the objective card')}
          </button>
        </div>
      ),
    },
    {
      id: 'properties',
      label: t('Właściwości', 'Properties'),
      icon: ListChecks,
      defaultOpen: true,
      children: (
        <ArtifactPropertiesTable
          rows={propertyRows}
          propertyLabel={t('Właściwość', 'Property')}
          valueLabel={t('Wartość', 'Value')}
        />
      ),
    },
    {
      id: 'relations',
      label: t('Powiązania', 'Relations'),
      icon: Link2,
      defaultOpen: false,
      children: (
        <button
          type="button"
          className="text-xs text-c-info underline underline-offset-2"
          onClick={() => (objectiveId ? navigate(withOwnerSampleData(okrObjectiveCardPath(objectiveId))) : undefined)}
        >
          {objective ? objective.title : t('Cel nadrzędny', 'Parent objective')}
        </button>
      ),
    },
  ];

  const objectiveTitle = objective ? objective.title : t('Karta celu', 'Objective card');
  const breadcrumbItems: { label: string; onClick?: () => void }[] = [
    { label: t('Rejestr OKR', 'OKR registry'), onClick: () => navigate(ROUTES.RESULTS_OKR.ROOT) },
    {
      label: parentSet?.title ?? t('Zestaw OKR', 'OKR set'),
      onClick: () => (setId ? navigate(`/results/okr/sets/${setId}`) : undefined),
    },
    {
      label: objectiveTitle,
      onClick: () => (objectiveId ? navigate(withOwnerSampleData(okrObjectiveCardPath(objectiveId))) : undefined),
    },
    { label: t('Kluczowe rezultaty', 'Key results'), onClick: goToSet },
    { label: keyResult.title },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="results-vnext-okr-key-result-card-page">
      <ArtifactBreadcrumb items={breadcrumbItems} />
      <div className="min-h-0 flex-1">
        <NModeShell
          header={header}
          sections={sections}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          presentationMode="n"
          onPresentationModeChange={() => {}}
          showModeSwitcher={false}
          rightPanel={
            <ArtifactRightPanel
              sections={rightPanelSections}
              ariaLabel={t('Panel kluczowego rezultatu', 'Key result panel')}
            />
          }
        />
      </div>
    </div>
  );
};

export default OkrKeyResultCardPage;
