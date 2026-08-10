/**
 * Zlecenie — POWŁOKA OBIEKTU (SPEC-A, archetyp Rekord).
 *
 * Menu 1 = ścieżka „Zlecenia › [nazwa]" (powrót do listy), Menu 2 = trzy
 * stałe zakładki Plan · Realizacja · Rezultaty, Menu 3 = przełącznik projekcji
 * planu. Wszystko przez `StandardModuleBar` — powłoka nie klei własnego menu.
 *
 * Stan ekranu żyje w adresie (`?zakladka=&widok-planu=&krok=`), więc:
 *  · Wstecz z zakładki wraca na poprzednią zakładkę, nie od razu do listy,
 *  · Wstecz z zlecenia wraca do listy z zachowanym filtrem i fokusem,
 *  · adres da się wysłać drugiej osobie i pokaże jej to samo.
 *
 * Ładowanie jest ROZDZIELONE na sekcje (`settleSection`): padnięcie jednej
 * z nich daje jawny stan CZĘŚCIOWY z nazwą brakującej sekcji, a nie cichą
 * pustkę i nie błąd całego ekranu.
 */

import { ArrowLeft } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { StandardModuleBar } from '@/components/standard/StandardModuleBar';
import { caseStatusLabel } from '@/utils/enumLabels';

import {
  getCase,
  listArtifactLinks,
  listHistoryEvents,
  listPlanVersions,
  listProposals,
  listValueMeasurements,
  listWaits,
  settleSection,
  toFailure,
  getPlanGraph,
  validatePlanVersion,
} from './api';
import { PlanView, PLAN_PROJECTIONS, type PlanProjection } from './PlanView';
import { RealizacjaView } from './RealizacjaView';
import { rememberOpenedCase } from './CasesListScreen';
import { RezultatyView } from './RezultatyView';
import type {
  CanonicalGraph,
  CaseActionProposal,
  CaseApiFailure,
  CaseArtifactLink,
  CaseCoreView,
  CaseHistoryEvent,
  CasePlanVersion,
  CaseWait,
  PlanValidationResult,
  ValueMeasurement,
} from './types';
import {
  CaseStateBlock,
  FOCUS_RING,
  MoreTabsMenu,
  PartialBanner,
  StatusTag,
  useViewportWidth,
} from './ui';

type Tab = 'plan' | 'realizacja' | 'rezultaty';

const TABS: Array<{ id: Tab; label: string; description: string }> = [
  { id: 'plan', label: 'Plan', description: 'Co i w jakiej kolejności ma się wydarzyć.' },
  { id: 'realizacja', label: 'Realizacja', description: 'Co się dzieje teraz i na co czekamy.' },
  { id: 'rezultaty', label: 'Rezultaty', description: 'Co powstało i czy efekt został potwierdzony.' },
];

interface CaseBundle {
  caseItem: CaseCoreView;
  planVersions: CasePlanVersion[];
  graph: CanonicalGraph | null;
  validation: PlanValidationResult | null;
  waits: CaseWait[];
  proposals: CaseActionProposal[];
  measurements: ValueMeasurement[];
  artifactLinks: CaseArtifactLink[];
  history: CaseHistoryEvent[];
  failedSections: string[];
  blocked: boolean;
}

export const CaseDetailScreen: React.FC = () => {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewportWidth = useViewportWidth();
  const isNarrow = viewportWidth < 768;

  const tab = (searchParams.get('zakladka') as Tab | null) ?? 'plan';
  const projection = (searchParams.get('widok-planu') as PlanProjection | null) ?? 'prosty';
  const selectedNodeId = searchParams.get('krok');

  const [bundle, setBundle] = useState<CaseBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<CaseApiFailure | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setFailure(null);
    try {
      // Rdzeń zlecenia MUSI się udać — bez niego nie ma czego pokazywać, więc
      // jego błąd jest błędem ekranu (404 = enumeration-safe „nie znaleziono").
      const caseItem = await getCase(caseId);
      const failedSections: string[] = [];
      const blockedFlag = { blocked: false };

      const [planVersions, waits, proposals, measurements, artifactLinks, history] =
        await Promise.all([
          settleSection('plan', listPlanVersions(caseId), [] as CasePlanVersion[], failedSections, blockedFlag),
          settleSection('oczekiwania', listWaits(caseId), [] as CaseWait[], failedSections, blockedFlag),
          settleSection('sprawy do zatwierdzenia', listProposals(caseId), [] as CaseActionProposal[], failedSections, blockedFlag),
          settleSection('pomiary wartości', listValueMeasurements(caseId), [] as ValueMeasurement[], failedSections, blockedFlag),
          settleSection('powiązane obiekty', listArtifactLinks(caseId), [] as CaseArtifactLink[], failedSections, blockedFlag),
          settleSection('przebieg zlecenia', listHistoryEvents(caseId), [] as CaseHistoryEvent[], failedSections, blockedFlag),
        ]);

      // Wersja planu do pokazania: najpierw ta wskazana przez zlecenie,
      // potem ostatnia zatwierdzona, na końcu po prostu najnowsza.
      const current =
        planVersions.find((v) => v.casePlanVersionId === caseItem.currentPlanVersionId) ??
        planVersions.find((v) => v.status === 'PUBLISHED') ??
        planVersions[0] ??
        null;

      let graph: CanonicalGraph | null = current?.semanticGraph ?? null;
      let validation: PlanValidationResult | null = null;
      if (current) {
        graph = await settleSection('graf planu', getPlanGraph(current.casePlanVersionId), graph, failedSections, blockedFlag);
        validation = await settleSection(
          'sprawdzenie planu',
          validatePlanVersion(current.casePlanVersionId),
          null,
          failedSections,
          blockedFlag
        );
      }

      setBundle({
        caseItem,
        planVersions,
        graph,
        validation,
        waits,
        proposals,
        measurements,
        artifactLinks,
        history,
        failedSections,
        blocked: blockedFlag.blocked,
      });
      setLoading(false);
    } catch (error) {
      setFailure(toFailure(error));
      setBundle(null);
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Wejście na zlecenie zawsze zaczyna się od nagłówka — czytnik ekranu
  // i klawiatura nie mogą zostać na dole poprzedniej listy.
  useEffect(() => {
    if (!loading && bundle) headingRef.current?.focus();
  }, [loading, bundle]);

  /*
   * Tożsamość `setParam` MUSI być stabilna, a nawigacja pomijana, gdy adres się
   * nie zmienia — dokładnie z tego samego powodu co w `CasesListScreen`
   * (`ModuleNavBar` woła handlery z wnętrza `useEffect`; niestabilny handler =
   * pętla renderowania). Ta powłoka nie podaje `onSearch`, ale reguła jest
   * wspólna i tańsza do utrzymania niż wyjątek.
   */
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const prev = searchParamsRef.current;
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (next.toString() === prev.toString()) return;
      setSearchParams(next, { replace: false });
    },
    [setSearchParams]
  );

  const goToList = useCallback(() => {
    rememberOpenedCase(caseId);
    navigate(-1);
  }, [caseId, navigate]);

  const currentPlanVersion = useMemo(() => {
    if (!bundle) return null;
    return (
      bundle.planVersions.find(
        (v) => v.casePlanVersionId === bundle.caseItem.currentPlanVersionId
      ) ??
      bundle.planVersions.find((v) => v.status === 'PUBLISHED') ??
      bundle.planVersions[0] ??
      null
    );
  }, [bundle]);

  const visibleTabs = isNarrow ? TABS.filter((item) => item.id === tab) : TABS;
  const hiddenTabs = isNarrow ? TABS.filter((item) => item.id !== tab) : [];

  /**
   * Przełącznik projekcji planu.
   *
   * ★ POMIAR, NIE PRZECZUCIE: dopóki ten przełącznik siedział w pasku modułu,
   * na telefonie wymuszał minimalną szerokość STRONY — `window.innerWidth`
   * rósł do 436 px przy żądanych 320/375/430, czyli cała strona przewijała się
   * w poziomie (warunek właściciela #4 złamany). Trzy pigułki z polskimi
   * etykietami po prostu nie mieszczą się obok zakładek na 320 px.
   *
   * Dlatego na wąskim ekranie przełącznik NIE jest w pasku, tylko nad treścią,
   * gdzie wolno mu się zawinąć (`flex-wrap`) i zająć dwie linie. Nic nie znika
   * i nic nie chowa się pod gest — zmienia się wyłącznie miejsce.
   */
  const renderProjectionSwitch = (wrap: boolean) => (
    <div
      role="radiogroup"
      aria-label="Sposób pokazania planu"
      className={`flex items-center gap-1 rounded-full border border-c-border p-0.5 ${
        wrap ? 'w-full flex-wrap justify-start' : ''
      }`}
    >
      {PLAN_PROJECTIONS.map((item) => {
        const active = item.id === projection;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={item.description}
            onClick={() => setParam({ 'widok-planu': item.id })}
            className={`h-8 whitespace-nowrap rounded-full px-3 text-xs font-medium transition ${FOCUS_RING} ${
              active
                ? 'bg-c-surface-raised text-c-text'
                : 'text-c-text-secondary hover:bg-c-surface-raised'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );

  const projectionSwitchInBar = tab === 'plan' && !isNarrow ? renderProjectionSwitch(false) : null;

  const body = (() => {
    const state = (
      <CaseStateBlock loading={loading} failure={failure} onRetry={() => void load()} onBack={goToList} />
    );
    if (loading || failure || !bundle) {
      return <div className="rounded-xl border border-c-border bg-c-surface">{state}</div>;
    }

    return (
      <>
        <PartialBanner sections={bundle.failedSections} onRetry={() => void load()} />
        {tab === 'plan' && isNarrow ? (
          <div className="mb-3 min-w-0">{renderProjectionSwitch(true)}</div>
        ) : null}
        {tab === 'plan' ? (
          <PlanView
            caseItem={bundle.caseItem}
            planVersion={currentPlanVersion}
            graph={bundle.graph}
            validation={bundle.validation}
            projection={projection}
            selectedNodeId={selectedNodeId}
            onSelectNode={(id) => setParam({ krok: id })}
          />
        ) : null}
        {tab === 'realizacja' ? (
          <RealizacjaView
            caseItem={bundle.caseItem}
            waits={bundle.waits}
            proposals={bundle.proposals}
            history={bundle.history}
            expert={projection === 'ekspercki'}
          />
        ) : null}
        {tab === 'rezultaty' ? (
          <RezultatyView
            caseItem={bundle.caseItem}
            measurements={bundle.measurements}
            artifactLinks={bundle.artifactLinks}
            expert={projection === 'ekspercki'}
          />
        ) : null}
      </>
    );
  })();

  const title = bundle?.caseItem.projectName || 'Zlecenie';

  return (
    <div className="h-full min-w-0" data-testid="zlecenie-szczegol">
      <StandardModuleBar
        breadcrumbs={[{ label: 'Zlecenia', onClick: goToList }, { label: title }]}
        tabs={visibleTabs.map((item) => ({ id: item.id, label: item.label }))}
        activeTab={tab}
        onTabChange={(id) => setParam({ zakladka: id })}
        viewModes={['table']}
        filterControls={
          <div className="flex items-center gap-2">
            {projectionSwitchInBar}
            {hiddenTabs.length ? (
              <MoreTabsMenu
                items={hiddenTabs}
                activeId={tab}
                onSelect={(id) => setParam({ zakladka: id })}
                label="Więcej"
                ariaLabel="Więcej sekcji zlecenia"
              />
            ) : null}
          </div>
        }
      >
        <div className="mx-auto min-w-0 max-w-[1400px] px-3 py-4 sm:px-6 sm:py-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <button
                type="button"
                onClick={goToList}
                className={`mb-1 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-c-text-secondary hover:text-c-text ${FOCUS_RING}`}
              >
                <ArrowLeft size={14} aria-hidden />
                Wróć do listy zleceń
              </button>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="truncate text-lg font-semibold text-c-text outline-none"
              >
                {title}
              </h1>
              {bundle?.caseItem.projectDescription ? (
                <p className="mt-0.5 line-clamp-2 text-sm text-c-text-secondary">
                  {bundle.caseItem.projectDescription}
                </p>
              ) : null}
            </div>
            {bundle ? (
              <StatusTag
                tone={
                  bundle.caseItem.caseStatus === 'BLOCKED' || bundle.caseItem.caseStatus === 'FAILED'
                    ? 'critical'
                    : bundle.caseItem.caseStatus === 'CLOSED'
                      ? 'success'
                      : 'info'
                }
              >
                {caseStatusLabel(bundle.caseItem.caseStatus, true)}
              </StatusTag>
            ) : null}
          </div>
          {body}
        </div>
      </StandardModuleBar>
    </div>
  );
};

export default CaseDetailScreen;
