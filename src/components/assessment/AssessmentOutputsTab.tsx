/**
 * AssessmentOutputsTab — P0D kernel Outputs surface.
 *
 * ★ REWRITE (2026-08-13): this tab used to read `GET /api/artifacts`
 * (`originRuntime === 'assessment_report'`) — an unrelated, older registry
 * that a restarted user's real frozen Outputs, Reports, Presentations and
 * Initiative Proposal Drafts never land in. It now reads the method-core
 * kernel exclusively (`@/method-core/api/methodCoreApi`:
 * `listOutputs`/`getOutput`), the same immutable-snapshot store the
 * assessment session actually freezes into (`server/src/method-core/
 * outputs/MethodOutputService.ts`). This is the fix for the CLAUDE.md P0D
 * problem statement: "po restarcie użytkownik nie odnajduje swoich
 * zamrożonych Outputów" — because the tab was looking at the wrong table.
 *
 * ★ Snapshot discipline (hard rule #1): opening a row ALWAYS fetches
 * `getOutput(id)` — the server's persisted, immutable snapshot — and that
 * fetched detail (not the list row, and never anything derived from a live
 * session) drives the preview's properties/status. There is no
 * reconstruction from "current session state" anywhere in this file, and no
 * `RECOVERY_DRAFT`/localStorage read at all (that concept lives entirely in
 * the excluded `src/components/assessment/drd/` tree — grepped, confirmed
 * absent here).
 *
 * Internal structure: the user-facing Insights registry only. Reports and
 * Initiatives remain sibling surfaces in AssessmentHub's canonical module
 * navigation; this component must not duplicate that navigation. From an
 * Insight row, a "View lineage" action swaps the aside for
 * `ArtifactLineagePanel` (session → revisions → Output → Report/
 * Presentation → Initiative Proposal). This design keeps ALL of P0D's UI
 * inside this package's own files — AssessmentHub.tsx needed ZERO changes:
 * it already renders `<AssessmentOutputsTab onCountChange={setOutputsCount} />`
 * at the 'outputs' tab, and that prop contract is unchanged here.
 *
 * List UI = StandardTable/StandardPreview only (TRIADA_KANON.md) — no
 * bespoke table. The segmented switch is a plain neutral pill row (c-* tokens,
 * focus ring c-focus, active state neutral — never crimson/`primary-*`),
 * mirroring the existing `TableTabStrip` pattern used elsewhere in this repo
 * for in-surface tab strips.
 */
import { FileText, GitBranch, Lightbulb, Package, Presentation } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  getOutput,
  isAuthError,
  listOutputs,
  type MethodOutputListItem,
  type MethodOutputSummary,
} from '@/method-core/api/methodCoreApi';
import { fetchWithRetry, getHeaders } from '@/services/api/baseClient';
import { ConclusionsApi } from '@/services/api/conclusions.api';
import { isAssessmentOutputArtifactsEnabled } from '@/utils/assessmentOutputArtifactsFlag';
import { formatListDate } from '@/utils/listDateFormat';

import {
  idOcenyZWierszaZastanego,
  type LegacyAssessmentListRow,
  projektujOceneZastanaNaWierszListy,
  scalOcenyZastaneZOutputami,
} from './assessmentOutputProjection';
import { GeneratorWnioskuModal } from './wnioski/GeneratorWnioskuModal';
import {
  czyWniosekZOceny,
  etykietaStanuWniosku,
  idWnioskuZWiersza,
  projektujWniosekNaWierszListy,
  scalWnioskiZWierszami,
  typWierszaWnioskow,
} from './wnioski/projekcjaWnioskow';

import { PreviewPaneAside } from '../shared/PreviewPane';
import { JedenPrawyPanel } from '../shared/PreviewPane/JedenPrawyPanel';
import { useJedenPanel } from '../shared/PreviewPane/useJedenPanel';
import { EmptyState } from '../shared/states';
import {
  type MetaPill,
  StandardPreview,
  type StandardPreviewAction,
} from '../standard/StandardPreview';
import {
  type StandardRowMenu,
  type StandardRowMenuAction,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../standard/StandardTable';
import { StatusChip } from '../ui/primitives/chips';
import { ArtifactLineagePanel } from './artifacts/ArtifactLineagePanel';

type OutputRow = MethodOutputListItem & { [key: string]: unknown };

function statusTone(isSuperseded: boolean | null): 'success' | 'neutral' {
  return isSuperseded === false ? 'success' : 'neutral';
}

function statusLabel(isPolish: boolean, isSuperseded: boolean | null): string {
  if (isSuperseded === false) return isPolish ? 'Aktualny' : 'Current';
  if (isSuperseded === true) return isPolish ? 'Zastąpiony' : 'Superseded';
  return isPolish ? 'Status nieznany' : 'Status unknown';
}

/** Oceny z magazynu ZASTANEGO (`GET /api/assessments` → tabela `assessments`),
 * znormalizowane do kształtu wiersza listy Outputów. Awaria tego wywołania NIE
 * może wywrócić listy — kanoniczne Outputy muszą się pokazać nawet wtedy. */
async function pobierzOcenyZastane(): Promise<MethodOutputListItem[]> {
  try {
    const res = await fetchWithRetry('/api/assessments', {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { assessments?: LegacyAssessmentListRow[] };
    return (body.assessments ?? [])
      .filter((row) => typeof row?.id === 'string' && row.id.length > 0)
      .map(projektujOceneZastanaNaWierszListy);
  } catch {
    return [];
  }
}

/** WNIOSKI z ocen — warstwa Wniosków (`GET /api/conclusions`). Org-wide, więc
 * filtrujemy do źródeł Oceny; awaria NIE może wywrócić listy zapisów sesji. */
async function pobierzWnioskiOceny(): Promise<OutputRow[]> {
  try {
    const res = await ConclusionsApi.list();
    return (res.conclusions ?? [])
      .filter((c) => typeof c?.id === 'string' && c.id.length > 0 && czyWniosekZOceny(c))
      .map((c) =>
        projektujWniosekNaWierszListy({
          id: c.id,
          title: c.title,
          sourceModule: c.sourceModule,
          status: c.status,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          sourceArtifactRefs: c.sourceArtifactRefs,
        })
      ) as unknown as OutputRow[];
  } catch {
    return [];
  }
}

interface AssessmentOutputsTabProps {
  onCountChange?: (count: number | null) => void;
  onNavigate?: (target: 'reports' | 'initiatives') => void;
  /**
   * Licznik żądań „Nowy wniosek” z CTA Menu 2 (AssessmentHub). Każdy wzrost
   * otwiera generator. Menu 3 Oceny nie ma rzędu chipów (DEC-414) — CTA żyje
   * wyłącznie w Menu 2, dlatego zakładka nie rysuje własnego przycisku.
   */
  sygnalNowyWniosek?: number;
}

export const AssessmentOutputsTab: React.FC<AssessmentOutputsTabProps> = ({
  onCountChange,
  onNavigate,
  sygnalNowyWniosek = 0,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const onCountChangeRef = useRef(onCountChange);

  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const [items, setItems] = useState<OutputRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  // DEC-397b (1.1-K6): klik wiersza / kebab „Podgląd" po zamknięciu panelu
  // (X) mają go ponownie otworzyć — patrz InboxContent.tsx (K5, 2f5161f3b4).
  const jedenPanel = useJedenPanel();
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<{
    output: MethodOutputSummary;
    superseded: boolean;
    supersededByOutputId: string | null;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [lineageSessionId, setLineageSessionId] = useState<string | null>(null);
  const [generatorOtwarty, setGeneratorOtwarty] = useState(false);

  // Deliberately no dependency on `t` (react-i18next's `t` isn't guaranteed
  // referentially stable, and isn't in this suite's mock) — closes only over
  // stable setState functions and the latest parent callback via ref.
  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setHasLoadError(false);
    setForbidden(false);
    Promise.all([listOutputs(), pobierzOcenyZastane(), pobierzWnioskiOceny()])
      .then(([res, zastane, wnioski]) => {
        if (cancelled) return;
        // `/api/method/outputs` is org-wide across Assessment, Tools and
        // Audits. This module must not present another module's immutable
        // output as an Assessment result.
        const assessmentOutputs = res.outputs.filter(
          (output) => output.module === 'assessment'
        );
        // ★ DWA MAGAZYNY. Jądro method-core to nie jedyne miejsce, w którym
        // moduł Ocena trzyma wyniki — realne oceny właściciela leżą w tabeli
        // `assessments` (pomiar 06.09: staging, org właściciela — 10 ocen
        // zastanych wobec 1 Outputu jądra; stanowisko lokalne — 4 wobec 0).
        // Czytanie samego jądra pokazywało mu pustą listę. Reguła scalania
        // 1:1 jak w Inicjatywach — patrz `assessmentOutputProjection.ts`.
        const zapisySesji = scalOcenyZastaneZOutputami(assessmentOutputs, zastane) as OutputRow[];
        // ★ TRZY MAGAZYNY. Wnioski (warstwa `conclusions`) to inny byt niż
        // zapisy sesji — kolumna TYP trzyma ten rozdział widocznym, żeby
        // „Zapis sesji" nigdy nie udawał wniosku (DEC-416).
        const scalone = scalWnioskiZWierszami(wnioski, zapisySesji);
        setItems(scalone);
        onCountChangeRef.current?.(scalone.length);
      })
      .catch((err) => {
        if (cancelled) return;
        setItems([]);
        onCountChangeRef.current?.(null);
        if (isAuthError(err)) {
          setForbidden(true);
        } else {
          setHasLoadError(true);
        }
        // Never echo an exception here: fetch errors can contain internal URLs,
        // SQL fragments or credential-shaped headers. The fixed diagnostic is
        // enough for this surface; request telemetry belongs in the API layer.
        // eslint-disable-next-line no-console
        console.error('[AssessmentOutputsTab] failed to load outputs');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load]);

  // Opening a row ALWAYS re-fetches the immutable server snapshot — see the
  // module doc comment's "snapshot discipline" note. The list row (`items`)
  // is only ever used for the table itself and as a loading-time fallback
  // for the preview header, never substituted for this fetch.
  useEffect(() => {
    if (!selectedOutputId) {
      setSelectedDetail(null);
      return;
    }
    // Wiersz zastany (`ocena~<id>`) nie istnieje w jądrze — pytanie o niego
    // dałoby pewne 404 i wpis w konsoli. Podgląd korzysta wtedy z danych
    // wiersza listy, a pełną treść pokazuje dopiero raport.
    // To samo dotyczy WNIOSKU (`wniosek~<id>`) — żyje w warstwie Wniosków,
    // nie w jądrze metodycznym; pytanie jądra dałoby pewne 404.
    if (idOcenyZWierszaZastanego(selectedOutputId) || idWnioskuZWiersza(selectedOutputId)) {
      setSelectedDetail(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    getOutput(selectedOutputId)
      .then((res) => {
        if (!cancelled) setSelectedDetail(res);
      })
      .catch(() => {
        if (!cancelled) setSelectedDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOutputId]);

  // CTA „Nowy wniosek" z Menu 2 (AssessmentHub). Pierwsze renderowanie ma
  // licznik 0 i nie otwiera niczego samo z siebie.
  useEffect(() => {
    if (sygnalNowyWniosek > 0) setGeneratorOtwarty(true);
  }, [sygnalNowyWniosek]);

  // Derives current/superseded from the fetched page itself when the list
  // endpoint doesn't carry `isSuperseded` per row: an Output is superseded
  // iff some OTHER Output in the SAME fetched list points back at it via
  // `revisionOfOutputId` — the identical rule `MethodOutputService.
  // isSuperseded` applies server-side, just computed over persisted rows
  // already on hand instead of a second read. KNOWN LIMITATION (disclosed,
  // same class as the old file's ARTIFACTS_FETCH_LIMIT note): only correct
  // within the fetched page — a revision chain deep enough to be paginated
  // apart from its predecessor could show a stale "Current" until opened
  // (opening always re-resolves via `getOutput`, which IS authoritative).
  const supersededIds = useMemo(() => {
    const s = new Set<string>();
    for (const item of items) {
      if (item.revisionOfOutputId) s.add(item.revisionOfOutputId);
    }
    return s;
  }, [items]);

  const isRowSuperseded = useCallback(
    (row: OutputRow): boolean | null => {
      if (row.isSuperseded !== null) return row.isSuperseded;
      return supersededIds.has(row.id);
    },
    [supersededIds]
  );

  const selectedRow = useMemo(
    () => items.find((item) => item.id === selectedOutputId) ?? null,
    [items, selectedOutputId]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        // ★ ROZDZIAŁ WNIOSEK / ZAPIS SESJI (DEC-416). Do 06.09 ta lista
        // pokazywała wyłącznie zamrożone zapisy sesji i oceny zastane —
        // wszystkie pod nagłówkiem „Wnioski". Właściciel czytał to jako brak
        // narzędzia do wniosków. Kolumna nazywa rzecz po imieniu w każdym
        // wierszu, jedną regułą (`typWierszaWnioskow`), nie po tytule.
        id: 'typWiersza',
        label: isPolish ? 'Typ' : 'Type',
        width: '132px',
        sortable: true,
        render: (row) => {
          const typ = typWierszaWnioskow(String(row.id));
          if (typ === 'wniosek') {
            return (
              <StatusChip label={isPolish ? 'Wniosek' : 'Conclusion'} tone="info" size="sm" />
            );
          }
          if (typ === 'zapis-sesji') {
            return (
              <StatusChip
                label={isPolish ? 'Zapis sesji' : 'Session record'}
                tone="warning"
                size="sm"
              />
            );
          }
          return (
            <StatusChip
              label={isPolish ? 'Wynik zamrożony' : 'Frozen output'}
              tone="neutral"
              size="sm"
            />
          );
        },
      },
      {
        // Nagłówki kolumn tej tabeli wołały `t()` z kluczami, których nie ma
        // w public/locales/pl (plik wspólny, nie do naprawy stąd) — spadały
        // po cichu na angielski fallback ("Scope"/"Module"/"Frozen at",
        // wielką literą przez CSS nagłówka: SCOPE/MODULE/FROZEN AT) obok
        // reszty ekranu w 100% po polsku. Naprawione tak samo jak
        // `statusLabel(isPolish, …)` niżej w tym pliku — inline po `isPolish`,
        // bez zależności od brakującego klucza. Przegląd nocny 03-wywiad/
        // 05-ocena, 2026-08-30.
        id: 'scope',
        label: isPolish ? 'Zakres' : 'Scope',
        sortable: true,
        render: (row) =>
          (row.scope as string | null) || (isPolish ? 'Bez tytułu' : 'Untitled output'),
      },
      {
        id: 'module',
        label: isPolish ? 'Moduł' : 'Module',
        width: '110px',
        sortable: true,
        render: (row) => {
          const raw = row.module as string | null;
          if (!raw) return '—';
          // Surowy identyfikator modułu ("assessment") pokazywany wprost —
          // ten sam błąd co "Priorytet: medium" w Interview/InterviewHub.tsx
          // naprawione tej samej nocy. Dziś jedyna prawdziwa wartość to
          // 'assessment' (ten hub), więc mapa jest celowo krótka.
          if (raw === 'assessment') return isPolish ? 'Ocena' : 'Assessment';
          return raw;
        },
      },
      {
        id: 'outputVersion',
        label: isPolish ? 'Wersja' : 'Version',
        width: '160px',
        sortable: true,
        render: (row) => {
          const version = row.outputVersion as number | null;
          const typ = typWierszaWnioskow(String(row.id));
          // Wniosek nie ma wersji rewizji jądra — pokazujemy jego WŁASNY stan
          // z warstwy Wniosków zamiast udawać „Aktualny"/„Zastąpiony".
          if (typ === 'wniosek') {
            return (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px]">—</span>
                <StatusChip
                  label={etykietaStanuWniosku(row.statusWniosku as string | null, isPolish)}
                  tone="neutral"
                  size="sm"
                />
              </div>
            );
          }
          const zastany = typ === 'zapis-sesji';
          const superseded = isRowSuperseded(row as OutputRow);
          return (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px]">{version != null ? `v${version}` : '—'}</span>
              <StatusChip
                label={
                  zastany
                    ? isPolish
                      ? 'Zapis sesji'
                      : 'Session record'
                    : statusLabel(isPolish, superseded)
                }
                tone={zastany ? 'warning' : statusTone(superseded)}
                size="sm"
              />
            </div>
          );
        },
      },
      {
        id: 'frozenAt',
        label: isPolish ? 'Zamrożono' : 'Frozen at',
        width: '150px',
        sortable: true,
        render: (row) => (row.frozenAt ? formatListDate(row.frozenAt as string) : '—'),
      },
    ],
    [t, isPolish, isRowSuperseded]
  );

  const metaPills: MetaPill[] = useMemo(() => {
    if (!selectedRow) return [];
    const superseded = selectedDetail ? selectedDetail.superseded : isRowSuperseded(selectedRow);
    const typ = typWierszaWnioskow(String(selectedRow.id));
    const pills: MetaPill[] =
      typ === 'wniosek'
        ? [
            { label: isPolish ? 'Wniosek' : 'Conclusion', tone: 'info' },
            {
              label: etykietaStanuWniosku(selectedRow.statusWniosku as string | null, isPolish),
              tone: 'neutral',
            },
          ]
        : [
            {
              label:
                typ === 'zapis-sesji'
                  ? isPolish
                    ? 'Zapis sesji'
                    : 'Session record'
                  : statusLabel(isPolish, superseded),
              tone: typ === 'zapis-sesji' ? 'warning' : statusTone(superseded),
            },
          ];
    if (typ !== 'wniosek' && selectedRow.module) {
      pills.push({ label: selectedRow.module, tone: 'neutral' });
    }
    if (selectedRow.demoBypassActive) {
      pills.push({ label: isPolish ? 'Tryb demo' : 'Demo bypass', tone: 'warning' });
    }
    return pills;
  }, [selectedRow, selectedDetail, isRowSuperseded, isPolish]);

  // Podgląd musi mówić prawdę o TYM wierszu: wniosek, zapis sesji z magazynu
  // zastanego i zamrożony wynik jądra to trzy różne rzeczy (DEC-416; wcześniej
  // wiersz zastany dostawał zdanie o „zamrożonym snapshocie", którym nie był).
  const typWybranego = selectedOutputId ? typWierszaWnioskow(selectedOutputId) : 'wynik-jadra';
  const previewDetailsText =
    typWybranego === 'wniosek'
      ? isPolish
        ? 'To jest WNIOSEK z oceny — werdykt zbudowany ze streszczenia wykonawczego raportu, z dowodami i ograniczeniami. Pełna karta wniosku otwiera się przyciskiem „Otwórz wniosek”.'
        : 'This is a CONCLUSION from an assessment — a verdict built from the report executive summary, with its evidence and limits. The full card opens with “Open conclusion”.'
      : typWybranego === 'zapis-sesji'
        ? isPolish
          ? 'To jest ZAPIS SESJI oceny z magazynu zastanego — nie został zamrożony, więc liczby mogą się jeszcze zmienić. To nie jest wniosek.'
          : 'This is an assessment SESSION RECORD from the legacy store — not frozen, so the numbers can still change. It is not a conclusion.'
        : isPolish
          ? 'To jest zamrożony, niezmienny snapshot zatwierdzony podczas sesji assessmentu. Pobrany bezpośrednio z serwera.'
          : 'This is the frozen, immutable snapshot approved during the assessment session. Fetched directly from the server.';

  const rowMenu = useCallback(
    (row: TableRow): StandardRowMenu => {
      const sessionId = typeof row.sessionId === 'string' ? row.sessionId : null;
      const rowId = String(row.id);
      const primary: StandardRowMenuAction[] = [];
      // WNIOSEK ma własną kartę w warstwie Wniosków. Podanie mu pozycji
      // „Pokaż raport"/„Pokaż jako prezentację" prowadziłoby pod adres jądra,
      // którego dla wniosku nie ma — kebab pokazuje TYLKO to, co istnieje.
      const conclusionId = idWnioskuZWiersza(rowId);
      if (conclusionId) {
        return {
          primary: [
            {
              id: 'open-conclusion',
              label: isPolish ? 'Otwórz wniosek' : 'Open conclusion',
              icon: Lightbulb,
              onClick: () => navigate(`/conclusions?id=${encodeURIComponent(conclusionId)}`),
            },
          ],
          universalHandlers: {
            preview: () => {
              jedenPanel.otworz();
              setSelectedOutputId(rowId);
            },
          },
        };
      }
      if (sessionId) {
        primary.push({
          id: 'view-lineage',
          label: t('assessment.outputs.rowMenu.viewLineage', 'View lineage'),
          icon: GitBranch,
          onClick: () => setLineageSessionId(sessionId),
        });
      }
      // Flag-gated (default ON since naprawa MVP 06.09 — decyzja CTO, patrz
      // src/utils/assessmentOutputArtifactsFlag.ts).
      if (isAssessmentOutputArtifactsEnabled()) {
        primary.push(
          {
            id: 'open-report',
            label: t(
              'assessment.outputs.rowMenu.openReport',
              isPolish ? 'Pokaż raport' : 'Show report'
            ),
            icon: FileText,
            onClick: () => navigate(`/assessment/outputs/${rowId}/report`),
          },
          {
            id: 'open-presentation',
            label: t(
              'assessment.outputs.rowMenu.openPresentation',
              isPolish ? 'Pokaż jako prezentację' : 'Show as presentation'
            ),
            icon: Presentation,
            onClick: () => navigate(`/assessment/outputs/${rowId}/presentation`),
          }
        );
      }
      return {
        primary: primary.length ? primary : undefined,
        universalHandlers: {
          preview: () => {
            jedenPanel.otworz();
            setSelectedOutputId(String(row.id));
          },
        },
      };
    },
    [t, isPolish, navigate]
  );

  const showLineage = lineageSessionId !== null;

  if (forbidden) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          <EmptyState
            variant="forbidden"
            title={t('assessment.outputs.forbidden.title', 'No access to Insights')}
            description={t(
              'assessment.outputs.forbidden.description',
              'Your account does not have permission to view this organization’s Insights.'
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
          <StandardTable
            columns={columns}
            data={items}
            loading={loading}
            error={
              hasLoadError
                ? isPolish
                  ? 'Nie udało się wczytać insightów. Spróbuj ponownie.'
                  : 'Failed to load Insights. Please try again.'
                : null
            }
            onRetry={load}
            persistKey="assessment.outputs"
            defaultSort={{ columnId: 'frozenAt', direction: 'desc' }}
            selectedRowId={selectedOutputId}
            onRowClick={(row) => {
              jedenPanel.otworz();
              setSelectedOutputId(String(row.id));
            }}
            rowMenu={rowMenu}
            rowDescription={() => null}
            empty={{
              icon: Package,
              title: t('assessment.outputs.emptyState.title', 'No insights yet'),
              description: t(
                'assessment.outputs.emptyState.description',
                'Insights frozen from a completed assessment session will appear here.'
              ),
            }}
          />
        </div>

        {showLineage && lineageSessionId ? (
          // Ten sam slot co podgląd niżej — więc ta sama szerokość z komponentu,
          // żeby przełączenie lineage↔podgląd nie przesuwało tabeli (§7.2).
          <PreviewPaneAside className="!bg-transparent dark:!bg-transparent">
            <ArtifactLineagePanel
              sessionId={lineageSessionId}
              onClose={() => setLineageSessionId(null)}
              onOpenOutput={(outputId) => {
                setLineageSessionId(null);
                setSelectedOutputId(outputId);
              }}
              onOpenReport={() => {
                setLineageSessionId(null);
                onNavigate?.('reports');
              }}
              onOpenInitiativeDraft={() => {
                setLineageSessionId(null);
                onNavigate?.('initiatives');
              }}
            />
          </PreviewPaneAside>
        ) : (
          <JedenPrawyPanel rekord={selectedRow ? (
            <StandardPreview
              title={selectedRow.scope || (isPolish ? 'Bez tytułu' : 'Untitled output')}
              onClose={() => setSelectedOutputId(null)}
              loading={detailLoading}
              meta={{
                pills: metaPills,
                trailing: selectedRow.frozenAt ? (
                  <span className="text-[11px] font-semibold text-c-text-secondary">
                    {formatListDate(selectedRow.frozenAt as string)}
                  </span>
                ) : undefined,
              }}
              details={{
                text: previewDetailsText,
                showWordCount: false,
                properties: [
                  {
                    id: 'sessionId',
                    label: isPolish ? 'Sesja' : 'Session',
                    value: selectedRow.sessionId ?? '—',
                    mono: true,
                  },
                  {
                    id: 'methodPack',
                    label: isPolish ? 'Pakiet metody' : 'Method pack',
                    value:
                      selectedRow.methodPackId && selectedRow.methodPackVersion
                        ? `${selectedRow.methodPackId}@${selectedRow.methodPackVersion}`
                        : '—',
                    mono: true,
                  },
                  {
                    id: 'findings',
                    label: isPolish ? 'Ustalenia' : 'Findings',
                    value: selectedDetail
                      ? selectedDetail.output.findings.length
                      : (selectedRow.findingsCount ?? '—'),
                  },
                  {
                    id: 'limitations',
                    label: isPolish ? 'Ograniczenia' : 'Limitations',
                    value: selectedDetail
                      ? selectedDetail.output.limitations.length
                      : (selectedRow.limitationsCount ?? '—'),
                  },
                  {
                    id: 'contentHash',
                    label: isPolish ? 'Skrót treści' : 'Content hash',
                    value: selectedRow.contentHash
                      ? `${String(selectedRow.contentHash).slice(0, 12)}…`
                      : '—',
                    mono: true,
                  },
                  {
                    id: 'supersededBy',
                    label: isPolish ? 'Zastąpiony przez' : 'Superseded by',
                    value:
                      (selectedDetail?.supersededByOutputId ?? selectedRow.supersededByOutputId) ||
                      '—',
                    mono: true,
                  },
                ],
                propertyLabel: isPolish ? 'Właściwość' : 'Property',
                valueLabel: isPolish ? 'Wartość' : 'Value',
                onCopy: () => {
                  void navigator.clipboard?.writeText(previewDetailsText);
                },
              }}
              relations={[
                {
                  id: 'reports',
                  label: isPolish ? 'Raporty' : 'Reports',
                  icon: FileText,
                  onClick: () => {
                    onNavigate?.('reports');
                  },
                },
                {
                  id: 'initiatives',
                  label: isPolish ? 'Inicjatywy' : 'Initiatives',
                  icon: Lightbulb,
                  onClick: () => {
                    onNavigate?.('initiatives');
                  },
                },
              ]}
              actions={{
                informational: (() => {
                  const informational: StandardPreviewAction[] = [];
                  const idWniosku = idWnioskuZWiersza(String(selectedRow.id));
                  if (idWniosku) {
                    return [
                      {
                        id: 'open-conclusion',
                        variant: 'neutral' as const,
                        label: isPolish ? 'Otwórz wniosek' : 'Open conclusion',
                        icon: Lightbulb,
                        onClick: () =>
                          navigate(`/conclusions?id=${encodeURIComponent(idWniosku)}`),
                      },
                    ];
                  }
                  if (selectedRow.sessionId) {
                    informational.push({
                      id: 'view-lineage',
                      variant: 'neutral',
                      label: t('assessment.outputs.actions.viewLineage', 'View lineage'),
                      icon: GitBranch,
                      onClick: () => setLineageSessionId(selectedRow.sessionId as string),
                    });
                  }
                  // Flag-gated (default ON since naprawa MVP 06.09 — decyzja
                  // CTO, patrz src/utils/assessmentOutputArtifactsFlag.ts).
                  if (isAssessmentOutputArtifactsEnabled()) {
                    const rowId = String(selectedRow.id);
                    informational.push(
                      {
                        id: 'open-report',
                        variant: 'neutral',
                        label: t(
                          'assessment.outputs.rowMenu.openReport',
                          isPolish ? 'Pokaż raport' : 'Show report'
                        ),
                        icon: FileText,
                        onClick: () => navigate(`/assessment/outputs/${rowId}/report`),
                      },
                      {
                        id: 'open-presentation',
                        variant: 'neutral',
                        label: t(
                          'assessment.outputs.rowMenu.openPresentation',
                          isPolish ? 'Pokaż jako prezentację' : 'Show as presentation'
                        ),
                        icon: Presentation,
                        onClick: () => navigate(`/assessment/outputs/${rowId}/presentation`),
                      }
                    );
                  }
                  return informational.length ? informational : undefined;
                })(),
              }}
            />
          ) : null} />
        )}
      </div>

      <GeneratorWnioskuModal
        otwarty={generatorOtwarty}
        onClose={() => setGeneratorOtwarty(false)}
        onWygenerowano={() => {
          // Nowy wniosek musi być widoczny na liście od razu — inaczej
          // użytkownik nie ma dowodu, że cokolwiek powstało.
          load();
        }}
        onOtworzWniosek={(id) => {
          setGeneratorOtwarty(false);
          navigate(`/conclusions?id=${encodeURIComponent(id)}`);
        }}
      />
    </div>
  );
};

export default AssessmentOutputsTab;
