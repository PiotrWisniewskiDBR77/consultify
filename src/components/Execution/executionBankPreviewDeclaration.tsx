/**
 * executionBankPreviewDeclaration — DEKLARACJA podglądu wiersza banku Realizacji.
 *
 * K5-3 (warunek właściciela przy odbiorze Realizacji, DEC-491): „preview nie
 * jest zgodne ze standardem, reszta ok".
 *
 * DLACZEGO OSOBNY PLIK, A NIE JSX W HUBIE: `ExecutionHub.tsx` ma 6,4 tys. linii
 * i żeby go zamontować, trzeba kilkunastu dostawców kontekstu — więc podgląd
 * banku nigdy nie miał testu RENDERU, tylko testy źródła (grep), które
 * przechodzą także wtedy, gdy wyrenderowany DOM jest zły. Ta funkcja zwraca
 * DOKŁADNIE te propsy, które hub przekazuje do `<StandardPreview>`, więc test
 * montuje realną powłokę kanonu na realnej deklaracji — a nie jej kopię.
 * (Ten sam zabieg co `executionSourceRelations.ts`, tylko na całej deklaracji.)
 *
 * CZEGO TU NIE MA I DLACZEGO:
 *  · `pin` — `JedenPrawyPanel` (powłoka podglądu Realizacji) nie ma trybu
 *    porównania, który pinezka obsługuje w `TableWithPreviewLayout`; drugi
 *    `<aside>` złamałby regułę „aside ≤ 1". Pinezka bez trybu porównania to
 *    przycisk bez skutku.
 *  · blok AI — bank nie ma wołacza AI per wiersz.
 *  · „Report progress" / „Create execution case" jako PRZYCISKI — front nie ma
 *    dla nich trasy (realizacja powstaje wyłącznie przez przekazanie z karty
 *    inicjatywy: `requestHandoffAcceptance` → `decideHandoffAcceptance`).
 *    Kroki te żyją jako OSTATNIE ZDANIE prozy bloku 3, nie jako martwy przycisk.
 *  · blok „Co dalej" (create-strip) — USUNIĘTY w K5-4. §7.0–§7.3b dopuszcza go
 *    WYŁĄCZNIE dla encji będącej źródłem cross-module (Insight → Raport/Deck/
 *    Idea…). Wiersz banku nie tworzy niczego w innym module, więc blok był
 *    niekanoniczny w tym miejscu — a razem z blokiem 6 rozpychał panel poniżej
 *    krawędzi okna (odrzut właściciela, staging `cf3fded7e4`).
 *  · blok 6 (akcje) — pill „Copy link" mieszka teraz w STOPCE powłoki
 *    (`TableWithPreviewLayout.renderPreviewFooter` → `PreviewActionBar`),
 *    dokładnie jak w zaakceptowanym podglądzie Inicjatyw
 *    (`CanonicalInitiativeRegister.tsx`). Stopka powłoki jest `shrink-0`, więc
 *    akcja jest widoczna BEZ przewijania; wewnątrz treści nie była.
 */
import React from 'react';

import type { MetaPill, RelationItem, StandardPreviewProps } from '@/components/standard/StandardPreview';
import type { MemberNameResolver } from '@/hooks/useOrganizationMemberNames';

import type { ExecutionBankEvidence, ExecutionBankRow } from './executionBankModel';
import type { ExecutionRiskSignal } from './executionRiskSignal';
import {
  ExecutionHandoffBadge,
  ExecutionRiskAxisPill,
  executionRiskAxisLabel,
} from './executionRiskSignalView';
import {
  buildExecutionBankSummary,
  type ExecutionBankPreviewT,
  formatExecutionBankVariance,
  resolveExecutionBankNextStep,
} from './executionBankPreviewModel';
import {
  describeExecutionBankUnknown,
  executionBankExecutionStateLabel,
  executionBankHealthLabel,
  executionBankLifecycleLabel,
  executionBankOwnerLabel,
  formatExecutionBankDate,
} from './ExecutionBankViews';

export interface ExecutionBankPreviewDeps {
  row: ExecutionBankRow;
  t: ExecutionBankPreviewT;
  /** Ton chipa statusu — wstrzykiwany, bo pochodzi z rodziny chipów `c.*`. */
  statusChipTone: (value: string) => MetaPill['tone'];
  /** Data raportowania okna kalendarza banku. */
  asOf: string;
  /** Gotowa etykieta postępu (używana też przez znacznik testowy huba). */
  progressLabel: string;
  resolveOwnerName?: MemberNameResolver;
  relations: RelationItem[];
  /**
   * B-E0 — sygnał 3 osi dla TEJ inicjatywy. `null`/`undefined` = flaga
   * `VITE_EXEC_RISK_SIGNAL` wyłączona albo raport nie zna wiersza; wtedy
   * wierszy ryzyka w tabeli faktów NIE MA (parytet z linią przy OFF).
   */
  riskSignal?: ExecutionRiskSignal | null;
  /** H2 — patrz `showHandoffTrace` w `ExecutionBankViewsProps`. */
  showHandoffTrace?: boolean;
}

export type ExecutionBankPreviewDeclaration = Pick<
  StandardPreviewProps,
  'meta' | 'details' | 'relations'
>;

/**
 * K5-R3: w TABELI FAKTÓW klucz już nazywa pole, więc wartość „Baseline not set"
 * w wierszu „Baseline finish" powtarzałaby to samo słowo dwa razy. Brak =
 * myślnik, powód idzie w podpowiedź (`title`) — jak w komórkach tabeli.
 * Wyjątek: `VALUE_CLEARED` („Not scheduled") to STAN, nie brak.
 */
export const executionBankPreviewDateLabel = (
  evidence: ExecutionBankEvidence<string>
): React.ReactNode => {
  if (evidence.status === 'KNOWN') return formatExecutionBankDate(evidence.value);
  const reason = describeExecutionBankUnknown(evidence.reason);
  if (evidence.reason === 'VALUE_CLEARED') return reason;
  return (
    <span className="text-c-text-muted" title={reason} aria-label={reason}>
      —
    </span>
  );
};

/**
 * K5-4 — ta sama reguła co `executionBankPreviewDateLabel` (K5-R3): w TABELI
 * FAKTÓW klucz już nazywa pole, więc wartość „Progress not reported" w wierszu
 * „Progress" powtarzałaby to samo słowo dwa razy. Brak = myślnik, powód idzie
 * w podpowiedź (`title`).
 */
export const executionBankPreviewProgressLabel = (
  evidence: ExecutionBankEvidence<number>
): React.ReactNode => {
  if (evidence.status === 'KNOWN') return `${evidence.value}%`;
  const reason = describeExecutionBankUnknown(evidence.reason);
  return (
    <span className="text-c-text-muted" title={reason} aria-label={reason}>
      —
    </span>
  );
};

export function buildExecutionBankPreviewDeclaration({
  row,
  t,
  statusChipTone,
  asOf,
  progressLabel,
  resolveOwnerName,
  relations,
  riskSignal,
  showHandoffTrace,
}: ExecutionBankPreviewDeps): ExecutionBankPreviewDeclaration {
  const nextStep = resolveExecutionBankNextStep(row, t);
  const summary = buildExecutionBankSummary(row, t, {
    executionState: executionBankExecutionStateLabel,
    lifecycle: executionBankLifecycleLabel,
  });

  return {
    /* Blok 2 — karta meta: STAN, nie treść.
     *
     * K5-4 (odrzut właściciela na żywym stagingu): karta miała CZTERY chipy
     * (lifecycle · stan realizacji · „Progress 45%" · zdrowie), które łamały
     * się na DWA rzędy, a do tego długie `trailing` („Reporting date …") i
     * trzecią linię („Updated …") — razem ~3 linie stanu nad treścią.
     * Zaakceptowany podgląd Inicjatyw (`CanonicalInitiativeRegister.tsx`) ma
     * DOKŁADNIE: dwa chipy w JEDNYM rzędzie + krótkie `trailing` + jedną linię
     * małym drukiem. Odwzorowujemy to 1:1.
     *
     * Postęp i zdrowie nie znikają — schodzą do TABELI FAKTÓW bloku 3 (niżej),
     * gdzie i tak mieszka reszta zgłoszonych wartości. Chip „Progress 45%" był
     * przy tym potrójnie zdublowany: kolumna tabeli, proza bloku 3 i chip.
     */
    meta: {
      pills: [
        ...(row.lifecycleStatus && row.lifecycleStatus !== 'UNKNOWN'
          ? [
              {
                label: executionBankLifecycleLabel(row.lifecycleStatus),
                tone: statusChipTone(row.lifecycleStatus),
              },
            ]
          : []),
        row.executionCaseId
          ? {
              label: executionBankExecutionStateLabel(row.executionState),
              tone: statusChipTone(row.executionState),
            }
          : {
              label: t('execution.bank.noExecutionCase', 'No execution case yet'),
              tone: 'neutral',
            },
      ],
      /* Krótkie `trailing` jak „v—" w Inicjatywach: sama data, a jej znaczenie
         w podpowiedzi — długa etykieta zjadała szerokość i wypychała chipy do
         drugiego rzędu przy 1280 px. */
      trailing: (
        <span
          className="text-[11px] font-semibold text-c-text-secondary"
          title={t('execution.bank.preview.reportingDate', 'Reporting date')}
        >
          {formatExecutionBankDate(asOf)}
        </span>
      ),
      /* Linia pod chipami = kiedy ten stan ostatnio zmierzono (odpowiednik
         linii rekomendacji w Inicjatywach). */
      recommendation:
        row.updatedAt.status === 'KNOWN'
          ? t('execution.bank.preview.updatedAt', 'Updated {{date}}', {
              date: formatExecutionBankDate(row.updatedAt.value),
            })
          : undefined,
    },

    /* Blok 3 — Treść: PROZA + tabela faktów, w tej kolejności. */
    details: {
      /*
       * Do 13.09 `text` był `undefined` dla KAŻDEGO wiersza banku (opis idzie
       * z rekordu inicjatywy, a cztery realizacje `demo-story-…` takiego
       * rekordu nie mają), więc podgląd otwierał się od razu tabelą pól —
       * dokładnie ten kształt, który §7.3 pkt 3 zakazuje („bogaty domyślny
       * szablon", nie zrzut pól). `buildExecutionBankSummary` składa zdania
       * Z DOWODÓW, którymi wiersz naprawdę dysponuje — nie wymyśla treści.
       */
      label: t('execution.bank.preview.detailsLabel', 'Execution context'),
      /*
       * K5-4: następny krok („Set the schedule baseline…") był osobnym blokiem
       * „Co dalej" pod akcjami — miejsce zarezerwowane kanonem dla create-stripa
       * encji źródłowej cross-module. Bank nią nie jest, więc zdanie wraca tam,
       * gdzie jest jego miejsce: jako OSTATNIE zdanie prozy bloku 3.
       */
      text: [summary, nextStep.note].filter(Boolean).join(' '),
      /*
       * K5-4: nagłówki tabeli faktów to „Property / Value" — ten sam komponent
       * i te same nagłówki co w zaakceptowanym podglądzie Inicjatyw
       * (`StandardPreview` bierze je z `standardPreview.property`/`.value`).
       * Wcześniejsze „Execution fact / Reported value" było wariantem tylko
       * tego jednego ekranu — czyli dokładnie tym, czego kanon zabrania.
       */
      properties: [
        {
          id: 'execution-case',
          label: t('execution.bank.preview.fact.case', 'Execution case'),
          value: row.executionCaseId
            ? `Linked · v${row.executionCaseVersion ?? '—'}`
            : t('execution.bank.preview.fact.caseMissing', 'Not linked yet'),
        },
        ...(showHandoffTrace
          ? [
              {
                /*
                 * H2 — przekazanie jako FAKT podglądu, nie tylko plakietka w
                 * tabeli. Stoi zaraz pod realizacją, bo odpowiada na to samo
                 * pytanie: skąd ten byt wziął się w Realizacji. Ta sama
                 * plakietka co w wierszu (jeden przekład stanu, nie dwa).
                 */
                id: 'handoff',
                label: t('execution.bank.preview.fact.handoff', 'Handoff'),
                value: (
                  <span className="flex justify-end">
                    <ExecutionHandoffBadge
                      handoff={row.handoff}
                      formatDate={formatExecutionBankDate}
                      t={t}
                    />
                  </span>
                ),
              },
            ]
          : []),
        {
          id: 'owner',
          label: t('execution.bank.preview.fact.owner', 'Owner'),
          value: executionBankOwnerLabel(row, resolveOwnerName),
        },
        {
          id: 'execution-phase',
          label: t('execution.bank.preview.fact.phase', 'Execution phase'),
          value: row.executionPhase?.trim() || '—',
        },
        {
          /* K5-4: zeszło z karty meta (chip „Progress 45%") — patrz nota przy
             `meta` wyżej. Wartość ta sama, miejsce kanoniczne. */
          id: 'progress',
          label: t('execution.bank.preview.fact.progress', 'Progress'),
          value: executionBankPreviewProgressLabel(row.progress),
        },
        {
          /* K5-4: zdrowie realizacji też zeszło z karty meta. Wiersz z samym
             „—" zostaje (tak robi tabela faktów w Inicjatywach) — panel się
             przewija, nie rośnie. */
          id: 'health',
          label: t('execution.bank.preview.fact.health', 'Health'),
          value:
            row.health.status === 'KNOWN' ? executionBankHealthLabel(String(row.health.value)) : '—',
        },
        {
          id: 'baseline-finish',
          label: t('execution.bank.preview.fact.baselineFinish', 'Baseline finish'),
          value: executionBankPreviewDateLabel(row.baselineFinish),
          mono: true,
        },
        {
          id: 'current-plan-finish',
          label: t('execution.bank.preview.fact.currentPlanFinish', 'Current plan finish'),
          value: executionBankPreviewDateLabel(row.currentPlanFinish),
          mono: true,
        },
        {
          id: 'forecast-finish',
          label: t('execution.bank.preview.fact.forecastFinish', 'Forecast finish'),
          value: executionBankPreviewDateLabel(row.forecastFinish),
          mono: true,
        },
        {
          id: 'actual-finish',
          label: t('execution.bank.preview.fact.actualFinish', 'Actual finish'),
          value: executionBankPreviewDateLabel(row.actualFinish),
          mono: true,
        },
        {
          id: 'variance',
          label: t('execution.bank.preview.fact.variance', 'Variance'),
          value: formatExecutionBankVariance(row, t),
          mono: true,
        },
        /*
         * B-E0 — BLOK RYZYKA. Kanon podglądu ma SZEŚĆ bloków i nie wolno
         * dostawić siódmego, więc trzy osie wchodzą jako trzy wiersze TABELI
         * FAKTÓW bloku 3 — tam, gdzie mieszka reszta zmierzonych wartości
         * (dokładnie ta sama decyzja, którą K5-4 podjęło dla postępu i
         * zdrowia, sprowadzając je z karty meta). Każdy wiersz = kolor +
         * tekst + ikona, z pełnym zdaniem w podpowiedzi.
         */
        ...(riskSignal
          ? riskSignal.axes.map((axis) => ({
              id: `risk-${axis.id}`,
              label: executionRiskAxisLabel(axis.id, t),
              // Opakowanie, bo pastylka jest `flex` (musi się kurczyć w wąskiej
              // komórce tabeli) — w tabeli faktów bez tego rozciągałaby się na
              // całą szerokość kolumny wartości i czytała jak pasek, nie chip.
              value: (
                <span className="flex justify-end">
                  <ExecutionRiskAxisPill axis={axis} t={t} />
                </span>
              ),
            }))
          : []),
      ],
      onCopy: () => void navigator.clipboard?.writeText(`${row.name} — ${progressLabel}`),
    },

    /* Blok 5 — Relations (źródło inicjatywy).
       SCALENIE 2026-09-13: deklaracja podaje SAMĄ LISTĘ i nic nie wie o pustce.
       Blok bez danych jest UKRYTY (TRIADA §A7) — robi to `PreviewRelations`
       w komponencie wspólnym, jednakowo dla banku Realizacji, Inicjatyw, Planu,
       Load, Work i Risk. Wcześniejszy komentarz mówił tu „renderowany ZAWSZE,
       także pusty" — to opis stanu sprzed partii A i przestał być prawdą. */
    relations,
  };
}
