/**
 * AssessmentLibraryTab — ASM-001A Library surface.
 *
 * Thin adapter, NOT a new store: reads published DRD assessment definitions
 * from the existing V8 definitions endpoint and starts a new assessment
 * bound to the newest published version. SIRI/ADMA/CMMI/Lean are shown as
 * disabled catalog rows (no engine yet) — per ASM-001 audit, "cards not
 * supported in MVP can be disabled with an explicit status" rather than
 * hidden (TRIADA_KANON.md C3: a disabled row explains WHY, it never lies by
 * omission).
 *
 * List UI follows the canonical StandardTable + StandardPreview pair. Every
 * catalog row is readable even when its execution engine is unavailable;
 * only the Start action is gated. This keeps Library a knowledge surface
 * instead of making unavailable methodologies inert dead rows.
 *
 * MVP compromise (ASM-001 audit, explicitly sanctioned): the backend does
 * NOT expose a "published only" filter endpoint yet — only
 * `GET /definitions/:methodologyId`, which returns draft+published+
 * deprecated rows. This component fetches that list and filters to
 * `status === 'published'` client-side, picking the newest version. Do not
 * ask the backend for a new endpoint here — one already exists.
 */
import {
  AlertTriangle,
  BookOpen,
  Library as LibraryIcon,
  PlayCircle,
  RefreshCw,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { PreviewPaneAside } from '@/components/shared/PreviewPane';
import { JedenPrawyPanel } from '@/components/shared/PreviewPane/JedenPrawyPanel';
import { useJedenPanel } from '@/components/shared/PreviewPane/useJedenPanel';
import {
  StandardPreview,
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
} from '@/components/standard';
import { StatusChip } from '@/components/ui/primitives/chips';
import {
  createSession as createMethodCoreSession,
  getSession as getMethodCoreSession,
  MethodCoreApiError,
  newIdempotencyKey,
} from '@/method-core/api/methodCoreApi';
import {
  compileDrdPack,
  DRD_METHOD_PACK_ID,
  DRD_METHOD_PACK_VERSION,
} from '@/method-core/methods/drd/compileDrdPack';
import { compileSiriPackOnly } from '@/method-core/methods/siri/compileSiriPack';
import { DRD_STRUCTURE } from '@/services/drdStructure';
import { FRAMEWORK_CONFIGS } from '@/services/frameworkRegistry';

export type MethodologyId = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

// Etykieta dwujęzyczna — reszta pliku już stosuje ten wzorzec przez `isPolish`
// (nagłówki kolumn, przyciski, panel podglądu). Dane katalogu poniżej go NIE
// stosowały — cały katalog (opis, obszar, warunek dostępu, "co dostajesz")
// renderował się WYŁĄCZNIE po angielsku niezależnie od języka aplikacji.
// Znalezione w przeglądzie nocnym 03-wywiad/05-ocena 2026-08-30.
interface Bilingual {
  pl: string;
  en: string;
}

export interface MethodologyRow {
  id: MethodologyId;
  name: string;
  description: Bilingual;
  supported: boolean;
  area: Bilingual;
  accessCondition: Bilingual;
  whatYouGet: Bilingual[];
  legalNotice: string | null;
  axes: Bilingual[];
  questionCount: number | null;
  duration: null;
  lastUsed: null;
  status: 'active' | 'draft';
}

const bilingual = (value: string): Bilingual => ({ pl: value, en: value });
const configuredAxes = (id: MethodologyId): Bilingual[] => {
  if (id === 'DRD') {
    return DRD_STRUCTURE.map((axis) => ({
      pl: axis.namePL || axis.name,
      en: axis.name,
    }));
  }
  return (FRAMEWORK_CONFIGS[id].categories ?? []).map((category) => bilingual(category.name));
};

const QUESTION_COUNTS: Partial<Record<MethodologyId, number>> = {
  DRD: compileDrdPack().pack.questions.length,
  SIRI: compileSiriPackOnly().questions.length,
};

// Static catalog — only DRD has a real published-definition-backed engine
// today. The other four are declared (not hidden) so the Library reads as a
// complete map of what Consultify assesses, not just what's finished.
export const METHODOLOGY_CATALOG: MethodologyRow[] = [
  {
    id: 'DRD',
    name: 'Digital Readiness Diagnosis',
    description: {
      pl: 'Ocena dojrzałości cyfrowej w 5 osiach, obszar po obszarze.',
      en: 'Assess digital maturity across 5 axes, area by area.',
    },
    supported: true,
    area: { pl: 'Transformacja cyfrowa', en: 'Digital transformation' },
    accessCondition: { pl: 'Dostępny Method Core', en: 'Method Core available' },
    whatYouGet: [
      { pl: 'Dojrzałość obecna i docelowa per obszar', en: 'Current and target maturity by area' },
      { pl: 'Wnioski poparte dowodami', en: 'Evidence-backed findings' },
      { pl: 'Dane wejściowe do raportu i inicjatyw', en: 'Report and initiative inputs' },
    ],
    legalNotice: FRAMEWORK_CONFIGS.DRD.legalNotice ?? null,
    axes: configuredAxes('DRD'),
    questionCount: QUESTION_COUNTS.DRD ?? null,
    duration: null,
    lastUsed: null,
    status: 'active',
  },
  {
    id: 'SIRI',
    name: 'Smart Industry Readiness Index',
    description: {
      pl: 'Singapurskie ramy dojrzałości Przemysłu 4.0 (SIRI).',
      en: 'Singapore SIRI Industry 4.0 maturity framework.',
    },
    supported: false,
    area: { pl: 'Inteligentna produkcja', en: 'Smart manufacturing' },
    accessCondition: {
      pl: 'Wiedza dostępna; uruchomienie wkrótce',
      en: 'Knowledge available; execution coming soon',
    },
    whatYouGet: [
      {
        pl: 'Widok procesu, technologii i organizacji',
        en: 'Process, technology and organization view',
      },
      { pl: 'Skala dojrzałości Przemysłu 4.0', en: 'Industry 4.0 maturity scale' },
      { pl: 'Kontekst edukacyjny metodyki', en: 'Educational framework context' },
    ],
    legalNotice: FRAMEWORK_CONFIGS.SIRI.legalNotice ?? null,
    axes: configuredAxes('SIRI'),
    questionCount: QUESTION_COUNTS.SIRI ?? null,
    duration: null,
    lastUsed: null,
    status: 'draft',
  },
  {
    id: 'ADMA',
    name: 'Advanced Digital Maturity Assessment',
    description: {
      pl: 'Rozszerzony model dojrzałości cyfrowej w wymiarach procesowych.',
      en: 'Extended digital maturity model across process dimensions.',
    },
    supported: false,
    area: { pl: 'Produkcja cyfrowa', en: 'Digital manufacturing' },
    accessCondition: {
      pl: 'Wiedza dostępna; uruchomienie wkrótce',
      en: 'Knowledge available; execution coming soon',
    },
    whatYouGet: [
      { pl: 'Widok pięciu filarów dojrzałości', en: 'Five-pillar maturity view' },
      { pl: 'Struktura oceny na poziomie wymiarów', en: 'Dimension-level assessment structure' },
      { pl: 'Kontekst edukacyjny metodyki', en: 'Educational framework context' },
    ],
    legalNotice: FRAMEWORK_CONFIGS.ADMA.legalNotice ?? null,
    axes: configuredAxes('ADMA'),
    questionCount: null,
    duration: null,
    lastUsed: null,
    status: 'draft',
  },
  {
    id: 'CMMI',
    name: 'Capability Maturity Model Integration',
    description: {
      pl: 'Model dojrzałości i zdolności procesowych organizacji.',
      en: 'Process capability and maturity model.',
    },
    supported: false,
    area: { pl: 'Zdolność procesowa', en: 'Process capability' },
    accessCondition: {
      pl: 'Wiedza dostępna; uruchomienie wkrótce',
      en: 'Knowledge available; execution coming soon',
    },
    whatYouGet: [
      { pl: 'Pięć poziomów dojrzałości', en: 'Five maturity levels' },
      { pl: 'Struktura wg obszarów praktyk', en: 'Practice-area structure' },
      { pl: 'Kontekst edukacyjny metodyki', en: 'Educational framework context' },
    ],
    legalNotice: FRAMEWORK_CONFIGS.CMMI.legalNotice ?? null,
    axes: configuredAxes('CMMI'),
    questionCount: null,
    duration: null,
    lastUsed: null,
    status: 'draft',
  },
  {
    id: 'LEAN',
    name: 'Lean 4.0',
    description: {
      pl: 'Ocena dojrzałości Lean w produkcji.',
      en: 'Lean manufacturing maturity assessment.',
    },
    supported: false,
    area: { pl: 'Lean i automatyzacja', en: 'Lean and automation' },
    accessCondition: {
      pl: 'Wiedza dostępna; uruchomienie wkrótce',
      en: 'Knowledge available; execution coming soon',
    },
    whatYouGet: [
      {
        pl: 'Ścieżka Zmierz → Optymalizuj → Automatyzuj',
        en: 'Measure → Optimize → Automate path',
      },
      { pl: 'Perspektywa dojrzałości Lean', en: 'Lean maturity perspective' },
      { pl: 'Kontekst szans automatyzacji i AI', en: 'Automation and AI opportunity context' },
    ],
    legalNotice: FRAMEWORK_CONFIGS.LEAN.legalNotice ?? null,
    axes: configuredAxes('LEAN'),
    questionCount: null,
    duration: null,
    lastUsed: null,
    status: 'draft',
  },
];

// ---------------------------------------------------------------------------
// ASM-BVP-001 — double-click guard for the method-core create-session path.
//
// Pure, ref-driven (never React state): a `useState` re-render gap means two
// rapid clicks can both read the SAME pre-update `startingId` value — state
// updates are not visible to a second synchronous event handler invocation
// until the component actually re-renders. A plain mutable ref has no such
// gap (JS is single-threaded; the first call's synchronous `.add()` is
// visible to the second call immediately), so it is the one used to decide
// whether a click may dispatch a create request at all. Exported so the
// double-click guarantee is testable without mounting the full component
// (see tests/assessmentBvp/AssessmentLibraryTab.methodCoreStart.test.ts).
// ---------------------------------------------------------------------------
export function shouldDispatchMethodCoreStart(inFlight: Set<string>, rowId: string): boolean {
  if (inFlight.has(rowId)) return false;
  inFlight.add(rowId);
  return true;
}

/**
 * Returns a stable Idempotency-Key for THIS in-flight start attempt on
 * `rowId` — generated once (via `generate`) and reused for as long as the
 * attempt is in flight (including any underlying HTTP retry inside
 * `fetchWithRetry`), never re-randomized mid-attempt. Combined with
 * `shouldDispatchMethodCoreStart`'s synchronous re-entrancy guard above, a
 * double-click can therefore never reach the network as two distinct
 * `POST /api/method/sessions` calls with two different keys.
 */
export function getOrCreateStartIdempotencyKey(
  keys: Map<string, string>,
  rowId: string,
  generate: () => string
): string {
  const existing = keys.get(rowId);
  if (existing) return existing;
  const created = generate();
  keys.set(rowId, created);
  return created;
}

interface AssessmentLibraryTabProps {
  areaFilter?: MethodologyId | 'all';
  statusFilter?: MethodologyRow['status'] | 'all';
}

export const AssessmentLibraryTab: React.FC<AssessmentLibraryTabProps> = ({
  areaFilter = 'all',
  statusFilter = 'all',
}) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const [startError, setStartError] = useState<string | null>(null);
  // DEC-397b (1.1-K6): klik wiersza / kebab „Podgląd" po zamknięciu panelu
  // (X) mają go ponownie otworzyć — patrz InboxContent.tsx (K5, 2f5161f3b4).
  const jedenPanel = useJedenPanel();
  const [selectedId, setSelectedId] = useState<MethodologyId | null>(null);
  /*
   * Odbiór 05.09 (05-ocena, defekt 3) — USUNIĘTY zasiew widoczności kolumn.
   *
   * Stał tu blok, który przy pierwszym wejściu WPISYWAŁ do localStorage klucz
   * `filterableTable.cols.assessment.hub.library` z `visibility` = wszystko
   * widoczne (poniżej 1200 px: cztery kolumny). FilterableTable czyta ten klucz
   * PRZED zastosowaniem domyślnej widoczności kolumn, więc zasiew skutecznie
   * unieważniał `defaultVisible` — zmierzone na żywo: tabela dalej rysowała
   * osiem kolumn, a w localStorage siedziało `"description":true`.
   *
   * Zasiew był też nieaktualny: jego lista id nie znała kolumny `actions`,
   * dodanej razem z przyciskiem „Uruchom".
   *
   * Domyślny zestaw deklarują teraz same kolumny (`defaultVisible`), zgodnie
   * z zatwierdzonym obrazem, a użytkownik dokłada resztę pstryczkiem — jego
   * wybór nadal wygrywa, bo zapisany układ ma pierwszeństwo.
   */

  // ASM-BVP-001 production cutover: the mounted DRD Library row has exactly
  // one writer. It always creates a method-core session and the editor always
  // resumes that session over HTTP. Feature flags remain available to dev
  // harnesses, but are no longer allowed to route a production Start click to
  // the legacy assessments table (or to the localStorage demo runtime).
  const drdMethodCoreActive = true;

  // Double-click guards for the method-core create path — refs, not state,
  // see `shouldDispatchMethodCoreStart`'s header comment for why.
  const startInFlightRef = useRef<Set<MethodologyId>>(new Set());
  const startIdempotencyKeysRef = useRef<Map<MethodologyId, string>>(new Map());
  const failedStartRowRef = useRef<MethodologyRow | null>(null);

  // The DRD pack is bootstrapped and governed server-side. Non-DRD rows are
  // intentionally visible but disabled in this MVP.
  const canStartRow = useCallback(
    (row: MethodologyRow): boolean => {
      return row.id === 'DRD' && row.supported && drdMethodCoreActive;
    },
    [drdMethodCoreActive]
  );

  const handleStart = useCallback(
    async (row: MethodologyRow) => {
      if (!canStartRow(row)) return;
      // Synchronous re-entrancy guard — see `shouldDispatchMethodCoreStart`'s
      // header comment. Applied uniformly (not just the method-core branch)
      // so a double-click can never dispatch two legacy creates either.
      if (!shouldDispatchMethodCoreStart(startInFlightRef.current, row.id)) return;

      setStartError(null);
      failedStartRowRef.current = row;
      const toastId = toast.loading(`Starting ${row.name}…`);
      try {
        const idempotencyKey = getOrCreateStartIdempotencyKey(
          startIdempotencyKeysRef.current,
          row.id,
          newIdempotencyKey
        );
        const res = await createMethodCoreSession(
          {
            module: 'assessment',
            methodPackId: DRD_METHOD_PACK_ID,
            methodPackVersion: DRD_METHOD_PACK_VERSION,
            mode: 'guided_manual',
            projectId: null,
          },
          idempotencyKey
        );
        const readback = await getMethodCoreSession(res.session.id);
        if (
          readback.session.id !== res.session.id ||
          readback.session.module !== 'assessment' ||
          readback.session.methodPackId !== DRD_METHOD_PACK_ID ||
          readback.session.methodPackVersion !== DRD_METHOD_PACK_VERSION
        ) {
          throw new MethodCoreApiError(
            isPolish
              ? 'Serwer zwrócił sesję o innej tożsamości lub wersji metody.'
              : 'The server returned a session with a different identity or method version.',
            409,
            { error: 'session_readback_mismatch' }
          );
        }
        startIdempotencyKeysRef.current.delete(row.id);
        failedStartRowRef.current = null;
        toast.success(`${row.name} started`, { id: toastId });
        navigate(`/assessment/drd/${readback.session.id}`);
      } catch (e: any) {
        if (e instanceof MethodCoreApiError) {
          const reason =
            e.body?.error === 'pack_not_released'
              ? 'The DRD method pack is not yet registered for production sessions.'
              : e.status === 403
                ? isPolish
                  ? 'Nie masz uprawnień do uruchomienia lub odczytu tej sesji DRD.'
                  : 'You do not have permission to start or read this DRD session.'
                : e.status === 404
                  ? isPolish
                    ? 'Utworzona sesja DRD nie została znaleziona podczas odczytu kontrolnego.'
                    : 'The created DRD session was not found during canonical readback.'
                  : e.status === 409
                    ? isPolish
                      ? 'Sesja DRD jest w konflikcie wersji lub tożsamości. Ponów bez tworzenia kolejnej sesji.'
                      : 'The DRD session has a version or identity conflict. Retry without creating another session.'
                    : e.isNetworkError
                      ? isPolish
                        ? 'Brak połączenia. Ponówienie użyje tego samego klucza i nie utworzy drugiej sesji.'
                        : 'Offline. Retry will reuse the same key and cannot create a second session.'
                      : e.message || `Failed to start ${row.name}`;
          toast.error(reason, { id: toastId });
          setStartError(reason);
          // Every refusal/readback failure is ambiguous after POST dispatch.
          // Preserve the exact key until an exact canonical readback succeeds.
        } else {
          const reason = e?.message || `Failed to start ${row.name}`;
          toast.error(reason, { id: toastId });
          setStartError(reason);
        }
      } finally {
        startInFlightRef.current.delete(row.id);
      }
    },
    [canStartRow, isPolish, navigate]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: isPolish ? 'Metodyka' : 'Methodology',
        sortable: true,
        render: (row: any) => (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-c-text">{row.name}</span>
            {/* c-text-secondary, nie c-text-muted: ta komórka renderuje się też na
                podbarwionym tle wiersza zaznaczonego — muted dawał tam 4.02:1
                zamiast 4,5:1 (axe: color-contrast, zmierzone po otwarciu podglądu). */}
            <span className="font-mono text-[11px] font-bold text-c-text-secondary">{row.id}</span>
          </div>
        ),
      },
      {
        id: 'area',
        label: isPolish ? 'Obszar' : 'Area',
        width: '180px',
        sortable: true,
        filterable: true,
        filterOptions: METHODOLOGY_CATALOG.map((row) => ({
          value: isPolish ? row.area.pl : row.area.en,
          label: isPolish ? row.area.pl : row.area.en,
        })),
        render: (row: MethodologyRow) => (isPolish ? row.area.pl : row.area.en),
      },
      /* Odbiór 05.09 (05-ocena, defekt 3): zatwierdzony obraz biblioteki ma
         CZTERY kolumny — METODYKA | OBSZAR | STATUS | DZIAŁANIA. Na żywo było
         ich siedem, bez kolumny DZIAŁANIA. Te trzy (plus „Ostatnio użyta")
         zostają dostępne w pstryczku, ale wychodzą z domyślnego zestawu. */
      {
        id: 'description',
        label: isPolish ? 'Opis w jednym zdaniu' : 'One-sentence description',
        width: '280px',
        defaultVisible: false,
        render: (row: MethodologyRow) => (isPolish ? row.description.pl : row.description.en),
      },
      {
        id: 'questionCount',
        label: isPolish ? 'Liczba pytań' : 'Questions',
        width: '120px',
        align: 'right',
        defaultVisible: false,
        render: (row: MethodologyRow) => row.questionCount ?? '—',
      },
      {
        id: 'duration',
        label: isPolish ? 'Czas trwania' : 'Duration',
        width: '120px',
        defaultVisible: false,
        render: () => '—',
      },
      {
        id: 'status',
        label: 'Status',
        width: '120px',
        sortable: true,
        filterable: true,
        filterOptions: [
          { value: 'active', label: isPolish ? 'Rdzeń metody' : 'Method core' },
          { value: 'draft', label: isPolish ? 'Planowane' : 'Planned' },
        ],
        /* Odbiór 05.09: obraz nazywa te dwa stany po ich znaczeniu dla
           użytkownika — „Rdzeń metody" (silnik działa dziś) i „Planowane"
           (wiedza jest, uruchomienia jeszcze nie ma) — a nie „Aktywna/Szkic",
           które opisują wpis w katalogu, nie dostępność metodyki. */
        render: (row: MethodologyRow) => {
          return row.status === 'active' ? (
            <StatusChip label={isPolish ? 'Rdzeń metody' : 'Method core'} tone="success" />
          ) : (
            <StatusChip label={isPolish ? 'Planowane' : 'Planned'} tone="neutral" />
          );
        },
      },
      {
        id: 'lastUsed',
        label: isPolish ? 'Ostatnio użyta' : 'Last used',
        width: '130px',
        defaultVisible: false,
        render: () => '—',
      },
      /* Odbiór 05.09 (05-ocena, defekt 3): „Uruchom" istniało wyłącznie
         w kebabie wiersza — na obrazie jest własną kolumną DZIAŁANIA
         z przyciskiem w każdym wierszu. Ten sam handler, ta sama bramka
         `canStartRow`, więc metodyki planowane mają go wyszarzonego. */
      {
        id: 'actions',
        label: isPolish ? 'Działania' : 'Actions',
        width: '160px',
        render: (row: MethodologyRow) => {
          const startable = canStartRow(row);
          return (
            <button
              type="button"
              data-testid={`library-start-${row.id}`}
              disabled={!startable}
              title={
                startable
                  ? isPolish
                    ? 'Uruchom ocenę tą metodyką'
                    : 'Start an assessment with this methodology'
                  : isPolish
                    ? 'Ta metodyka nie ma jeszcze uruchomienia'
                    : 'This methodology cannot be started yet'
              }
              onClick={(e) => {
                e.stopPropagation();
                if (!startable) return;
                void handleStart(row);
              }}
              className={`inline-flex items-center gap-2 h-8 px-3 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus:ring-[color:var(--c-focus)] ${
                startable
                  ? 'border-c-border bg-c-surface text-c-text hover:bg-c-surface-raised'
                  : 'border-c-border-subtle bg-c-surface-raised text-c-text-muted cursor-not-allowed'
              }`}
            >
              <PlayCircle size={14} />
              {isPolish ? 'Uruchom' : 'Start'}
            </button>
          );
        },
      },
    ],
    [canStartRow, handleStart, isPolish]
  );

  const data = useMemo(
    () =>
      METHODOLOGY_CATALOG.filter(
        (row) =>
          (areaFilter === 'all' || row.id === areaFilter) &&
          (statusFilter === 'all' || row.status === statusFilter)
      ).map((row) => ({ ...row })),
    [areaFilter, statusFilter]
  );

  const rowMenu = useCallback(
    (row: any): StandardRowMenu => {
      const methodology = row as MethodologyRow;
      return {
        primary: [
          {
            id: 'read',
            label: isPolish ? 'Przeczytaj o metodzie' : 'Read about methodology',
            icon: BookOpen,
            onClick: () => setSelectedId(methodology.id),
          },
          ...(canStartRow(methodology)
            ? [
                {
                  id: 'start',
                  label: isPolish ? 'Uruchom' : 'Start',
                  icon: PlayCircle,
                  onClick: () => void handleStart(methodology),
                },
              ]
            : []),
        ],
        universalHandlers: {
          preview: () => {
            jedenPanel.otworz();
            setSelectedId(methodology.id);
          },
        },
      };
    },
    [canStartRow, handleStart, isPolish]
  );

  return (
    <div className="flex h-full min-w-0 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-4">
        {startError && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
          >
            <div className="flex min-w-0 items-start gap-2">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              <span>{startError}</span>
            </div>
            <button
              type="button"
              onClick={() =>
                failedStartRowRef.current ? void handleStart(failedStartRowRef.current) : undefined
              }
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-current px-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
            >
              <RefreshCw size={13} />
              {isPolish ? 'Ponów' : 'Retry'}
            </button>
          </div>
        )}
        <StandardTable
          columns={columns}
          data={data}
          loading={false}
          rowMenu={rowMenu}
          selectedRowId={selectedId}
          onRowClick={(row: any) => {
            jedenPanel.otworz();
            setSelectedId((row as MethodologyRow).id);
          }}
          rowDescription={(row: any) =>
            isPolish
              ? (row as MethodologyRow).description.pl
              : (row as MethodologyRow).description.en
          }
          persistKey="assessment.hub.library"
          defaultSort={{ columnId: 'name', direction: 'asc' }}
          empty={{
            icon: LibraryIcon,
            title: isPolish
              ? 'Brak dostępnych metodyk oceny'
              : 'No assessment frameworks available',
            // Stan PUSTY, nie stan bledu. Oryginal (obie wersje jezykowe) mowil
            // "nie udalo sie wczytac" w bloku opisujacym pustke — czyli komunikat
            // o awarii tam, gdzie awarii nie ma. Uzgodnione z torem grafiki 2026-09-01.
            // Osobny stan bledu wczytywania to zadanie na osobny dyzur.
            description: isPolish
              ? 'Katalog metodyk jest pusty.'
              : 'The methodology catalog is empty.',
          }}
        />
      </div>
      <JedenPrawyPanel
        rekord={selectedId ? (() => {
            const item = METHODOLOGY_CATALOG.find((row) => row.id === selectedId);
            if (!item) return null;
            return (
              <StandardPreview
                title={item.name}
                onClose={() => setSelectedId(null)}
                meta={{
                  pills: [
                    { label: item.id, tone: 'neutral' },
                    {
                      label: item.supported
                        ? isPolish
                          ? 'Dostępna'
                          : 'Available'
                        : isPolish
                          ? 'Planowane'
                          : 'Planned',
                      tone: item.supported ? 'success' : 'neutral',
                    },
                  ],
                }}
                details={{
                  text: `${isPolish ? item.description.pl : item.description.en}\n\n${item.whatYouGet
                    .map((value) => `• ${isPolish ? value.pl : value.en}`)
                    .join('\n')}\n\n${isPolish ? 'Osie i obszary' : 'Axes and areas'}:\n${item.axes
                    .map((axis) => `• ${isPolish ? axis.pl : axis.en}`)
                    .join('\n')}${item.legalNotice ? `\n\n${item.legalNotice}` : ''}`,
                  /* ★ 2026-09-02 — było `showWordCount: false`. Kanon §7.3 pkt 3
                     mówi: licznik słów widoczny, gdy treść > 0. Wyłączenie go
                     TU i tylko tu sprawiało, że podgląd Biblioteki różnił się
                     od wzorca jednym elementem bloku 3 — dokładnie ta klasa
                     rozjazdu, którą właściciel nazwał „tabela preview nie
                     trzyma się opisanego standardu" (30.08). */
                  properties: [
                    {
                      id: 'area',
                      label: isPolish ? 'Obszar' : 'Area',
                      value: isPolish ? item.area.pl : item.area.en,
                    },
                    {
                      id: 'access',
                      label: isPolish ? 'Dostęp' : 'Access',
                      value: isPolish ? item.accessCondition.pl : item.accessCondition.en,
                    },
                    {
                      id: 'commercial',
                      label: isPolish ? 'Warunki komercyjne' : 'Commercial terms',
                      value: isPolish
                        ? 'Nie skonfigurowano w katalogu'
                        : 'Not configured in catalog',
                    },
                  ],
                  propertyLabel: isPolish ? 'Właściwość' : 'Property',
                  valueLabel: isPolish ? 'Wartość' : 'Value',
                }}
                actions={
                  item.supported
                    ? {
                        informational: [
                          {
                            id: 'start',
                            variant: 'neutral',
                            // PRZEWODY ODBIORU 2026-09-03: polska gałąź mówiła
                            // „Uruchom assessment" — pół zdania po polsku, pół po
                            // angielsku, w module, który wszędzie indziej nazywa się
                            // „Ocena" (assessment.hub.tabs.assessment).
                            label: isPolish ? 'Rozpocznij ocenę' : 'Start assessment',
                            icon: PlayCircle,
                            onClick: () => void handleStart(item),
                          },
                        ],
                      }
                    : undefined
                }
              />
            );
          })() : null}
      />
    </div>
  );
};

export default AssessmentLibraryTab;
