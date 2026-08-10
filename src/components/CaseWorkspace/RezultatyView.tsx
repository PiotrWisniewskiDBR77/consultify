/**
 * Zlecenie → sekcja REZULTATY (centrum powłoki artefaktu, archetyp C).
 *
 * Rezultaty to OBIEKTY DOMENOWE, nie lista wygenerowanych plików
 * (`02_INFORMATION_ARCHITECTURE_AND_UX.md` §7): cztery osie zamknięcia,
 * zmierzona wartość i powiązane obiekty z innych modułów.
 *
 * ★ CO SIĘ TU ZMIENIŁO (2026-08-10) — wyniki i rezultaty REALNIE SIĘ OTWIERAJĄ.
 * Do tej pory ten plik nie miał ANI JEDNEGO `href`/`navigate`/`window.open`:
 * tabela „Powiązane obiekty" pokazywała, że dokument istnieje, i na tym się
 * kończyło. Otwieranie idzie teraz KANONICZNĄ drogą całej aplikacji —
 * `getArtifactPath(type, id)` z `src/utils/artifactLinks.ts`, czyli dokładnie
 * ten sam adres, którym otwierają swoje obiekty Decyzje
 * (`DecisionWorkspace.tsx:332`), Rezultaty (`ReportDocumentView.tsx:593`) i
 * podgląd Materiałów (`ReportsAndPresentations/artifactNavigation.ts:36-38`).
 * Zero własnej tablicy tras — jedno źródło prawdy dla całego produktu.
 *
 * ★ UCZCIWE STANY zamiast ślepej uliczki. Backend trzyma `artifact_type` jako
 * ZWYKŁY STRING (`artifactLinkService.ts:180-199` — „NOT a DB CHECK enum"),
 * a `link_status` osobno niesie `UNAVAILABLE`/`UNLINKED`. Dlatego przycisk
 * „Otwórz" nie zgaduje adresu: gdy typ jest spoza mapy modułów albo obiekt
 * jest niedostępny/odpięty, przycisk jest wyłączony, a podgląd MÓWI DLACZEGO
 * i zostawia bezpieczne wyjście (powrót do zlecenia i do listy). Nigdy cicha
 * pustka, nigdy skok pod zmyślony adres.
 *
 * Wartość rozróżnia punkt wyjścia, cel, wynik i pewność pomiaru — a stan
 * „brak dowodu" jest osobny od „nieosiągnięte". UI tego nie spłaszcza.
 */

import { AlertTriangle, ArrowUpRight, BarChart3, Link2, Unlink } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { StandardPreview } from '@/components/standard/StandardPreview';
import { StandardTable, type TableColumn } from '@/components/standard/StandardTable';
import {
  ARTIFACT_IDENTITY,
  type ArtifactType,
  getArtifactPath,
  parseArtifactRef,
} from '@/utils/artifactLinks';
import {
  artifactLinkRelationLabel,
  artifactLinkStatusLabel,
  closureAxisLabel,
  closureAxisStatusLabel,
  closureTypeLabel,
  linkedTypeLabel,
  measurementConfidenceLabel,
  valueMeasurementStatusLabel,
} from '@/utils/enumLabels';

import type { CaseArtifactLink, CaseCoreView, ValueMeasurement } from './types';
import { FOCUS_RING, formatDate, formatDateTime, StatusTag, TechnicalId } from './ui';

// ═══════════════════════════════════════════════════════════════════════════
// OTWIERANIE OBIEKTÓW — jedno miejsce dla całego modułu
// ═══════════════════════════════════════════════════════════════════════════
//
// Powłoka zlecenia (`CaseDetailScreen`) importuje te funkcje, zamiast pisać
// własne: przycisk główny Menu 1, sekcja „Powiązania" prawego panelu i tabela
// niżej MUSZĄ prowadzić pod ten sam adres. Gdyby każde z tych trzech miejsc
// liczyło trasę osobno, rozjazd byłby kwestią czasu — a rozjazd tras to
// dokładnie ta klasa błędu, którą `getArtifactPath` w tym repo już raz
// zlikwidował („preview »Otwórz« must not fork truth").

/**
 * `case_workspace_artifact_links.artifact_type` → typ artefaktu aplikacji.
 *
 * Lewa strona to wartości, których realnie używa backend Zleceń
 * (`KNOWN_ARTIFACT_TYPES` w `artifactLinkService.ts:187-199`) plus warianty
 * zapisu spotykane w innych modułach. Prawa strona to `ArtifactType` —
 * jedyny wejściowy typ `getArtifactPath`.
 *
 * ŚWIADOMIE NIEKOMPLETNA. `mind_map`, `whiteboard`, `process_flow` i `raid`
 * NIE mają dziś w `getArtifactPath` własnego celu (`artifactLinks.ts:258-303`
 * — te typy nie występują w `getBasePath`), więc każde ich „otwarcie"
 * lądowałoby na domyślnym `/my-work` bez wskazanego obiektu, czyli w pustce
 * udającej sukces. Wolimy powiedzieć wprost „tego typu jeszcze nie umiemy
 * otworzyć" niż wysłać użytkownika w ślepą uliczkę.
 */
export const TYP_OBIEKTU_NA_MODUL: Record<string, ArtifactType> = {
  decision: 'decision',
  initiative: 'initiative',
  task: 'task',
  kpi: 'kpi',
  insight: 'insight',
  assessment: 'assessment',
  project: 'project',
  risk: 'risk',
  idea: 'idea',
  meeting: 'meeting',
  tool: 'tool',
  tool_session: 'tool_session',
  notification: 'notification',
  notebook: 'notebook',
  note: 'notebook',
  // Materiały — dokument, prezentacja, arkusz (trzy generatory, trzy moduły).
  document: 'report',
  report: 'report',
  wordy: 'report',
  presentation: 'presentation',
  deck: 'presentation',
  sheet: 'sheet',
  table: 'sheet',
  workbook: 'sheet',
  spreadsheet: 'sheet',
  // Finanse.
  financial_model: 'financial_model',
  budget: 'budget',
  valuation: 'valuation',
  analysis: 'analysis',
  knowledge: 'knowledge',
};

export type OtwarcieObiektu =
  | { status: 'otwieralny'; sciezka: string; etykieta: string }
  | { status: 'niedostepny'; powod: string }
  | { status: 'odpiety'; powod: string }
  | { status: 'nieznany-typ'; powod: string };

/** Stabilny klucz fokusu elementu „Otwórz" — powłoka przywraca po nim fokus. */
export function kluczFokusuObiektu(linkId: string): string {
  return `obiekt:${linkId}`;
}

/** Stabilny klucz fokusu dowodu przy pomiarze wartości. */
export function kluczFokusuDowodu(measurementId: string): string {
  return `dowod:${measurementId}`;
}

/**
 * Czy i jak da się otworzyć obiekt powiązany ze zleceniem.
 *
 * Kolejność sprawdzeń jest istotna: najpierw stan POWIĄZANIA (to fakt z bazy,
 * `link_status`), potem znajomość typu (to ograniczenie naszej nawigacji).
 * Odwrotna kolejność kazałaby nam mówić „nie znamy typu" o obiekcie, który
 * backend już oznaczył jako niedostępny — czyli mylić własną lukę z faktem.
 */
export function rozstrzygnijOtwarcie(link: CaseArtifactLink): OtwarcieObiektu {
  const etykietaTypu = linkedTypeLabel(link.artifactType, true) || link.artifactType;

  if (link.linkStatus === 'UNAVAILABLE') {
    return {
      status: 'niedostepny',
      powod:
        `Moduł źródłowy zgłosił, że tego obiektu nie da się dziś otworzyć ` +
        `(usunięty, wycofany albo poza Twoją organizacją). Zlecenie pamięta, ` +
        `że był — dlatego nie znika z listy.`,
    };
  }
  if (link.linkStatus === 'UNLINKED') {
    return {
      status: 'odpiety',
      powod:
        `Powiązanie zostało odpięte od tego zlecenia. Obiekt może nadal ` +
        `istnieć w swoim module, ale nie jest już rezultatem tego zlecenia.`,
    };
  }

  const typ = TYP_OBIEKTU_NA_MODUL[String(link.artifactType || '').toLowerCase()];
  if (!typ) {
    return {
      status: 'nieznany-typ',
      powod:
        `Consultify nie ma jeszcze ekranu, który otwiera obiekt rodzaju ` +
        `„${etykietaTypu}". Nie zgadujemy adresu — zgadnięty link wyrzuciłby ` +
        `Cię na pustą stronę zamiast pokazać rezultat.`,
    };
  }

  return {
    status: 'otwieralny',
    sciezka: getArtifactPath(typ, link.artifactId),
    etykieta: etykietaTypu,
  };
}

/**
 * Dowód przy pomiarze wartości.
 *
 * `value_measurements.evidence_ref` to pole tekstowe: bywa odwołaniem do
 * obiektu w postaci `typ:id` (konwencja `buildArtifactRef`), a bywa zwykłym
 * opisem. Otwieramy WYŁĄCZNIE pierwszy przypadek i tylko wtedy, gdy typ jest
 * nam znany — reszta zostaje uczciwym tekstem.
 */
export function rozstrzygnijOtwarcieDowodu(
  evidenceRef: string | null | undefined
): OtwarcieObiektu | null {
  const surowy = String(evidenceRef ?? '').trim();
  if (!surowy) return null;

  const ref = parseArtifactRef(surowy);
  if (!ref) {
    return {
      status: 'nieznany-typ',
      powod:
        'Dowód jest zapisany jako opis, a nie jako odwołanie do obiektu — ' +
        'nie ma czego otworzyć. Treść widać niżej.',
    };
  }
  const typ = TYP_OBIEKTU_NA_MODUL[String(ref.type).toLowerCase()];
  if (!typ || !ARTIFACT_IDENTITY[typ]) {
    return {
      status: 'nieznany-typ',
      powod: `Dowód wskazuje obiekt rodzaju „${ref.type}", którego nie umiemy jeszcze otworzyć.`,
    };
  }
  return {
    status: 'otwieralny',
    sciezka: getArtifactPath(typ, ref.id),
    etykieta: linkedTypeLabel(ref.type, true) || ref.type,
  };
}

// ═══════════════════════════════════════════════════════════════════════════

export interface OtwarcieZadanie {
  sciezka: string;
  kluczFokusu: string;
  etykieta: string;
}

export type RezultatSelection =
  | { kind: 'pomiar'; id: string }
  | { kind: 'obiekt'; id: string }
  | null;

export interface RezultatyViewProps {
  caseItem: CaseCoreView;
  measurements: ValueMeasurement[];
  artifactLinks: CaseArtifactLink[];
  expert?: boolean;
  /**
   * Otwarcie obiektu w JEGO module. Powłoka (nie ten widok) wykonuje
   * nawigację, bo to ona wie, co trzeba zapamiętać na powrót: adres listy,
   * zakładkę, krok planu, pozycję przewijania i element, z którego wyszliśmy.
   */
  onOpenDeliverable?: (zadanie: OtwarcieZadanie) => void;
  /**
   * Zaznaczony wiersz (otwarty podgląd) STEROWANY Z POWŁOKI.
   *
   * ★ ZMIERZONE, nie wymyślone: gdy zaznaczenie żyło wyłącznie tutaj, powrót z
   * otwartego obiektu przywracał przewinięcie na 213 px zamiast zapisanych
   * 237 px. Powód nie miał nic wspólnego z samym przewijaniem: przed wyjściem
   * podgląd był OTWARTY (układ dwukolumnowy, treść wyższa), a po powrocie —
   * zamknięty, więc 237 px po prostu przestawało istnieć. Zaznaczenie musi
   * więc wracać razem z resztą stanu, inaczej „ta sama pozycja" jest niemożliwa.
   */
  wybor?: RezultatSelection;
  onWybor?: (wybor: RezultatSelection) => void;
}

type Selection = RezultatSelection;

function axisTone(status: string): 'success' | 'warning' | 'neutral' {
  if (status === 'COMPLETED' || status === 'VALIDATED') return 'success';
  if (status === 'PENDING') return 'warning';
  return 'neutral';
}

function measurementTone(
  status: ValueMeasurement['measurementStatus']
): 'success' | 'warning' | 'critical' | 'neutral' {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'NOT_ACHIEVED') return 'critical';
  if (status === 'PARTIAL' || status === 'EVIDENCE_MISSING') return 'warning';
  return 'neutral';
}

function formatValue(value: number | null, unit: string | null): string {
  if (value === null || value === undefined) return '—';
  const number = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(value);
  return unit ? `${number} ${unit}` : number;
}

/**
 * Przycisk „Otwórz" — jedyny kształt otwierania rezultatu w tym module.
 *
 * Wyłączony przycisk ZOSTAJE widoczny i zachowuje `title` z powodem: „nie da
 * się otworzyć" jest informacją o obiekcie, a znikający przycisk kazałby
 * użytkownikowi zgadywać, czy funkcji nie ma, czy obiekt jest wyjątkiem.
 */
const OpenButton: React.FC<{
  otwarcie: OtwarcieObiektu;
  kluczFokusu: string;
  etykietaDostepna: string;
  onOpen: (zadanie: OtwarcieZadanie) => void;
  szeroki?: boolean;
}> = ({ otwarcie, kluczFokusu, etykietaDostepna, onOpen, szeroki }) => {
  const otwieralny = otwarcie.status === 'otwieralny';
  return (
    <button
      type="button"
      data-cw-focus={kluczFokusu}
      disabled={!otwieralny}
      title={otwieralny ? `Otwórz: ${otwarcie.etykieta}` : otwarcie.powod}
      aria-label={etykietaDostepna}
      onClick={(event) => {
        event.stopPropagation();
        if (otwarcie.status !== 'otwieralny') return;
        onOpen({
          sciezka: otwarcie.sciezka,
          kluczFokusu,
          etykieta: otwarcie.etykieta,
        });
      }}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border border-c-border px-2.5 text-xs font-medium transition ${FOCUS_RING} ${
        szeroki ? 'w-full justify-center' : ''
      } ${
        otwieralny
          ? 'text-c-text hover:bg-c-surface-raised'
          : 'cursor-not-allowed text-c-text-muted opacity-60'
      }`}
    >
      <ArrowUpRight size={14} aria-hidden />
      Otwórz
    </button>
  );
};

export const RezultatyView: React.FC<RezultatyViewProps> = ({
  caseItem,
  measurements,
  artifactLinks,
  expert,
  onOpenDeliverable,
  wybor,
  onWybor,
}) => {
  // Sterowanie z powłoki, gdy powłoka je podaje; własny stan, gdy widok stoi sam
  // (np. w harnessie zrzutowym) — bez tego fallbacku komponent przestałby działać
  // wszędzie poza jednym wywołaniem.
  const [wlasnyWybor, setWlasnyWybor] = useState<Selection>(null);
  const selection = wybor !== undefined ? wybor : wlasnyWybor;
  const setSelection = useCallback(
    (next: Selection) => {
      if (onWybor) onWybor(next);
      else setWlasnyWybor(next);
    },
    [onWybor]
  );

  const otworz = useCallback(
    (zadanie: OtwarcieZadanie) => {
      onOpenDeliverable?.(zadanie);
    },
    [onOpenDeliverable]
  );

  const axes = useMemo(
    () => [
      { key: 'delivery', status: caseItem.deliveryStatus },
      { key: 'decision', status: caseItem.decisionStatus },
      { key: 'implementation', status: caseItem.implementationStatus },
      { key: 'outcome', status: caseItem.outcomeStatus },
    ],
    [caseItem]
  );

  /** Stan otwarcia liczony RAZ per obiekt — tabela i podgląd czytają to samo. */
  const otwarciaObiektow = useMemo(() => {
    const mapa = new Map<string, OtwarcieObiektu>();
    artifactLinks.forEach((link) => mapa.set(link.linkId, rozstrzygnijOtwarcie(link)));
    return mapa;
  }, [artifactLinks]);

  const measurementRows = useMemo(
    () =>
      measurements.map((item) => ({
        id: item.measurementId,
        wskaznik: item.metricName || item.metricKey,
        punktWyjscia: formatValue(item.baselineValue, item.baselineUnit),
        cel: formatValue(item.targetValue, item.targetUnit),
        wynik: formatValue(item.actualValue, item.actualUnit),
        stan: valueMeasurementStatusLabel(item.measurementStatus, true),
        stanTone: measurementTone(item.measurementStatus),
        pewnosc: measurementConfidenceLabel(item.confidence, true),
        pomiar: item.measurementDate,
      })),
    [measurements]
  );

  const linkRows = useMemo(
    () =>
      artifactLinks.map((link) => {
        const otwarcie = otwarciaObiektow.get(link.linkId);
        return {
          id: link.linkId,
          obiekt: linkedTypeLabel(link.artifactType, true) || link.artifactType,
          rola: artifactLinkRelationLabel(link.relation, true),
          stan: link.isStale ? 'Nieaktualny' : artifactLinkStatusLabel(link.linkStatus, true),
          stanTone:
            link.isStale || link.linkStatus === 'UNAVAILABLE'
              ? ('warning' as const)
              : ('neutral' as const),
          dodane: link.linkedAt,
          otwieralny: otwarcie?.status === 'otwieralny' ? 'tak' : 'nie',
        };
      }),
    [artifactLinks, otwarciaObiektow]
  );

  const measurementColumns: TableColumn[] = [
    {
      id: 'wskaznik',
      label: 'Co mierzymy',
      /*
       * ★ SZEROKOŚCI DOBRANE POMIAREM, nie na oko. Suma zadeklarowanych
       * szerokości JEST szerokością tabeli (`table-fixed`, `parsePx` w
       * `FilterableTable.tsx:749`), więc samo zdjęcie `min-width: 980px`
       * niczego nie dało: 240+140+120+120+180+140 = 940 px w kontenerze
       * 700 px = 240 px nadal schowane. Nowa suma (135+100+90+90+175+95
       * = 685) mieści się w środkowej kolumnie powłoki, a `w-full` rozciąga
       * tabelę na szerszych ekranach. Pełne wartości bez skracania pokazuje
       * podgląd po kliknięciu wiersza.
       */
      width: '135px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm font-medium text-c-text">{String(row.wskaznik)}</span>
      ),
    },
    { id: 'punktWyjscia', label: 'Punkt wyjścia', width: '100px', align: 'right' },
    { id: 'cel', label: 'Cel', width: '90px', align: 'right' },
    { id: 'wynik', label: 'Wynik', width: '90px', align: 'right' },
    {
      id: 'stan',
      label: 'Stan pomiaru',
      // Pigułka „Zmierzone częściowo” nie łamie się w linii — na zrzucie przy
      // 120 px nachodziła na kolumnę daty. 175 px ją mieści.
      width: '175px',
      filterable: true,
      render: (row: Record<string, unknown>) => (
        <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
      ),
    },
    {
      id: 'pomiar',
      label: 'Data pomiaru',
      width: '95px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm text-c-text-secondary">{formatDate(String(row.pomiar))}</span>
      ),
    },
  ];

  const linkColumns: TableColumn[] = [
    {
      // Suma szerokości = szerokość tabeli (patrz komentarz przy 'wskaznik'):
      // 160+170+130+110+95 = 665 px mieści się w kolumnie 700 px.
      id: 'obiekt',
      label: 'Obiekt',
      width: '160px',
      sortable: true,
      filterable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm font-medium text-c-text">{String(row.obiekt)}</span>
      ),
    },
    { id: 'rola', label: 'Rola w zleceniu', width: '170px', filterable: true },
    {
      id: 'stan',
      label: 'Stan powiązania',
      width: '130px',
      render: (row: Record<string, unknown>) => (
        <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
      ),
    },
    {
      id: 'dodane',
      label: 'Powiązane',
      width: '110px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm text-c-text-secondary">{formatDate(String(row.dodane))}</span>
      ),
    },
    {
      id: 'otwieralny',
      label: 'Otwórz',
      width: '95px',
      align: 'right',
      render: (row: Record<string, unknown>) => {
        const linkId = String(row.id);
        const link = artifactLinks.find((item) => item.linkId === linkId);
        const otwarcie = otwarciaObiektow.get(linkId);
        if (!link || !otwarcie) return null;
        return (
          <OpenButton
            otwarcie={otwarcie}
            kluczFokusu={kluczFokusuObiektu(linkId)}
            etykietaDostepna={`Otwórz obiekt: ${linkedTypeLabel(link.artifactType, true) || link.artifactType}`}
            onOpen={otworz}
          />
        );
      },
    },
  ];

  const selectedMeasurement =
    selection?.kind === 'pomiar'
      ? (measurements.find((item) => item.measurementId === selection.id) ?? null)
      : null;
  const selectedLink =
    selection?.kind === 'obiekt'
      ? (artifactLinks.find((item) => item.linkId === selection.id) ?? null)
      : null;
  const selectedLinkOtwarcie = selectedLink ? otwarciaObiektow.get(selectedLink.linkId) : undefined;
  const selectedEvidence = selectedMeasurement
    ? rozstrzygnijOtwarcieDowodu(selectedMeasurement.evidenceRef)
    : null;

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="rounded-xl border border-c-border bg-c-surface p-3 sm:p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold text-c-text">Czy zlecenie jest domknięte</h3>
            <span className="text-xs text-c-text-muted">
              Umówione zamknięcie: {closureTypeLabel(caseItem.contractedClosureType, true)}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {axes.map((axis) => (
              <div
                key={axis.key}
                className="rounded-lg border border-c-border bg-c-surface-raised px-3 py-2"
              >
                <div className="text-xs uppercase tracking-wide text-c-text-muted">
                  {closureAxisLabel(axis.key, true)}
                </div>
                <div className="mt-1">
                  <StatusTag tone={axisTone(axis.status)}>
                    {closureAxisStatusLabel(axis.status, true)}
                  </StatusTag>
                </div>
              </div>
            ))}
          </div>
          {caseItem.closedAt ? (
            <p className="mt-3 text-sm text-c-text-secondary">
              Zamknięte {formatDateTime(caseItem.closedAt)} jako{' '}
              {closureTypeLabel(caseItem.closureType, true).toLowerCase()}.
            </p>
          ) : null}
        </div>

        <section aria-labelledby="zlecenia-wartosc" className="min-w-0">
          <h3 id="zlecenia-wartosc" className="mb-2 text-sm font-semibold text-c-text">
            Zmierzona wartość
          </h3>
          <div className="min-w-0 overflow-hidden rounded-xl border border-c-border bg-c-surface p-2 sm:p-3">
            <StandardTable
              columns={measurementColumns}
              data={measurementRows}
              selectedRowId={selection?.kind === 'pomiar' ? selection.id : null}
              onRowClick={(row) => setSelection({ kind: 'pomiar', id: String(row.id) })}
              rowDescription={() => null}
              /*
               * ★ ZMIERZONE W PRZEGLĄDARCE przy 1440 px (getComputedStyle):
               * `StandardTable` wymusza domyślnie `min-width: 980px`
               * (`FilterableTable.tsx:188`), a ta tabela stoi w środkowej
               * kolumnie powłoki artefaktu szerokiej na 700 px. Efekt:
               * scrollWidth 980 przy clientWidth 700, czyli 280 px tabeli
               * (kolumna „Stan pomiaru" i „Data pomiaru") schowane za
               * przewijaniem BEZ ŻADNEJ oznaki, że jest co przewijać —
               * dokładnie ta pułapka, którą lista zleceń rozbroiła u siebie.
               *
               * `'columns'` tu NIE pomoże: znosi min-width dopiero przy ≤2
               * kolumnach danych (`AUTO_MIN_WIDTH_COLUMN_THRESHOLD`), a mamy
               * ich sześć. `'auto'` znosi wymuszenie, tabela (`table-fixed
               * w-full`) zwęża się do kontenera i WSZYSTKIE kolumny są
               * widoczne. Kanon nietknięty: moduł deklaruje próg, wygląd dalej
               * narzuca komponent wspólny; pełne wartości i tak pokazuje
               * podgląd po kliknięciu wiersza.
               */
              minTableWidth="auto"
              persistKey="caseWorkspace.results.measurements"
              density="compact"
              defaultSort={{ columnId: 'pomiar', direction: 'desc' }}
              empty={{
                icon: BarChart3,
                title: 'Nic jeszcze nie zmierzono',
                description:
                  'Efekt zlecenia mierzy się po wdrożeniu. Do tego czasu ta lista pozostaje pusta — to nie jest błąd.',
              }}
            />
          </div>
        </section>

        <section aria-labelledby="zlecenia-obiekty" className="min-w-0">
          <h3 id="zlecenia-obiekty" className="mb-2 text-sm font-semibold text-c-text">
            Powiązane obiekty
          </h3>
          <div className="min-w-0 overflow-hidden rounded-xl border border-c-border bg-c-surface p-2 sm:p-3">
            <StandardTable
              columns={linkColumns}
              data={linkRows}
              selectedRowId={selection?.kind === 'obiekt' ? selection.id : null}
              onRowClick={(row) => setSelection({ kind: 'obiekt', id: String(row.id) })}
              rowDescription={() => null}
              // Ten sam pomiar co wyżej: 980 px wymuszone w kontenerze 700 px.
              minTableWidth="auto"
              persistKey="caseWorkspace.results.links"
              density="compact"
              defaultSort={{ columnId: 'dodane', direction: 'desc' }}
              empty={{
                icon: Link2,
                title: 'Brak powiązanych obiektów',
                description:
                  'Tu trafiają dokumenty, decyzje, inicjatywy i dowody, na których opiera się to zlecenie.',
              }}
            />
          </div>
        </section>
      </div>

      {selectedMeasurement ? (
        <aside className="w-full shrink-0 lg:w-[380px]">
          <StandardPreview
            title={selectedMeasurement.metricName || selectedMeasurement.metricKey}
            onClose={() => setSelection(null)}
            meta={{
              pills: [
                {
                  label: valueMeasurementStatusLabel(selectedMeasurement.measurementStatus, true),
                  tone: 'info',
                },
                {
                  label: measurementConfidenceLabel(selectedMeasurement.confidence, true),
                  tone: 'neutral',
                },
              ],
            }}
            details={{
              text: 'Pomiar efektu tego zlecenia.',
              showWordCount: false,
              propertyLabel: 'Właściwość',
              valueLabel: 'Wartość',
              properties: [
                {
                  id: 'baza',
                  label: 'Punkt wyjścia',
                  value: formatValue(
                    selectedMeasurement.baselineValue,
                    selectedMeasurement.baselineUnit
                  ),
                },
                {
                  id: 'cel',
                  label: 'Cel',
                  value: formatValue(
                    selectedMeasurement.targetValue,
                    selectedMeasurement.targetUnit
                  ),
                },
                {
                  id: 'wynik',
                  label: 'Wynik',
                  value: formatValue(
                    selectedMeasurement.actualValue,
                    selectedMeasurement.actualUnit
                  ),
                },
                {
                  id: 'data',
                  label: 'Data pomiaru',
                  value: formatDate(selectedMeasurement.measurementDate),
                },
                {
                  id: 'nastepny',
                  label: 'Następny pomiar',
                  value: selectedMeasurement.nextMeasurementDueAt
                    ? formatDate(selectedMeasurement.nextMeasurementDueAt)
                    : 'nie zaplanowano',
                },
                {
                  id: 'dowod',
                  label: 'Dowód',
                  value: selectedMeasurement.evidenceRef ? 'dołączony' : 'brak',
                },
              ],
            }}
          >
            {/* Dowód pomiaru — otwieralny, gdy wskazuje realny obiekt. */}
            <div className="rounded-lg border border-c-border-subtle p-3">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                Dowód pomiaru
              </div>
              {selectedEvidence === null ? (
                <p className="text-xs italic text-c-text-muted">
                  Do tego pomiaru nie dołączono dowodu. Stan „brak dowodu" jest czymś innym niż
                  „nieosiągnięte" — sam wynik nie jest przez to unieważniony.
                </p>
              ) : selectedEvidence.status === 'otwieralny' ? (
                <div className="space-y-2">
                  <p className="text-xs text-c-text-secondary">
                    Dowód wskazuje obiekt: {selectedEvidence.etykieta}.
                  </p>
                  <OpenButton
                    otwarcie={selectedEvidence}
                    kluczFokusu={kluczFokusuDowodu(selectedMeasurement.measurementId)}
                    etykietaDostepna={`Otwórz dowód pomiaru: ${selectedEvidence.etykieta}`}
                    onOpen={otworz}
                    szeroki
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-c-text-secondary">{selectedEvidence.powod}</p>
                  {expert ? <TechnicalId value={selectedMeasurement.evidenceRef} /> : null}
                </div>
              )}
            </div>
          </StandardPreview>
        </aside>
      ) : selectedLink ? (
        <aside className="w-full shrink-0 lg:w-[380px]">
          <StandardPreview
            title={linkedTypeLabel(selectedLink.artifactType, true) || selectedLink.artifactType}
            onClose={() => setSelection(null)}
            /* Kanon podglądu: „Otwórz" mieszka w nagłówku podglądu, nie w
               dorobionym przycisku w treści. Podajemy go WYŁĄCZNIE wtedy, gdy
               obiekt naprawdę da się otworzyć — przycisk, który po kliknięciu
               nic nie robi, byłby gorszy niż jego brak. */
            onOpenFull={
              selectedLinkOtwarcie?.status === 'otwieralny'
                ? () =>
                    otworz({
                      sciezka: selectedLinkOtwarcie.sciezka,
                      kluczFokusu: kluczFokusuObiektu(selectedLink.linkId),
                      etykieta: selectedLinkOtwarcie.etykieta,
                    })
                : undefined
            }
            openLabel="Otwórz obiekt"
            meta={{
              pills: [
                { label: artifactLinkRelationLabel(selectedLink.relation, true), tone: 'info' },
                ...(selectedLink.isStale
                  ? [{ label: 'Nieaktualny', tone: 'warning' as const }]
                  : []),
              ],
            }}
            details={{
              text: selectedLink.isStale
                ? 'Obiekt zmienił się po powiązaniu — sprawdź, czy nadal potwierdza to, co miał potwierdzać.'
                : 'Obiekt powiązany z tym zleceniem.',
              showWordCount: false,
              propertyLabel: 'Właściwość',
              valueLabel: 'Wartość',
              properties: [
                {
                  id: 'rola',
                  label: 'Rola w zleceniu',
                  value: artifactLinkRelationLabel(selectedLink.relation, true),
                },
                {
                  id: 'stan',
                  label: 'Stan powiązania',
                  value: artifactLinkStatusLabel(selectedLink.linkStatus, true),
                },
                { id: 'dodane', label: 'Powiązane', value: formatDateTime(selectedLink.linkedAt) },
                {
                  id: 'wersja',
                  label: 'Przypięta wersja',
                  value: selectedLink.artifactRevision ?? 'zawsze najnowsza',
                },
                ...(expert
                  ? [
                      {
                        id: 'id',
                        label: 'Identyfikator obiektu',
                        value: <TechnicalId value={selectedLink.artifactId} />,
                      },
                    ]
                  : []),
              ],
            }}
          >
            {/* Gdy otworzyć NIE można — powód wprost, zamiast martwego przycisku. */}
            {selectedLinkOtwarcie && selectedLinkOtwarcie.status !== 'otwieralny' ? (
              <div className="flex items-start gap-2 rounded-lg border border-c-border bg-c-surface-raised px-3 py-2">
                {selectedLinkOtwarcie.status === 'odpiety' ? (
                  <Unlink className="mt-0.5 h-4 w-4 shrink-0 text-c-text-muted" aria-hidden />
                ) : (
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-c-text-muted"
                    aria-hidden
                  />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-c-text">Tego obiektu nie otworzymy</p>
                  <p className="mt-0.5 text-xs text-c-text-secondary">
                    {selectedLinkOtwarcie.powod}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-c-text-muted">
                „Otwórz obiekt" w nagłówku podglądu przeniesie Cię do modułu, do którego ten obiekt
                należy. Wrócisz tu tym samym zleceniem, w tej samej sekcji.
              </p>
            )}
          </StandardPreview>
        </aside>
      ) : null}
    </div>
  );
};

export default RezultatyView;
