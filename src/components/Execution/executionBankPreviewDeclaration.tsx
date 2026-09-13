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
 *    Kroki te żyją jako ZDANIE w bloku „Co dalej", nie jako martwy przycisk.
 */
import { Copy } from 'lucide-react';
import React from 'react';

import type { MetaPill, RelationItem, StandardPreviewProps } from '@/components/standard/StandardPreview';
import type { MemberNameResolver } from '@/hooks/useOrganizationMemberNames';

import type { ExecutionBankEvidence, ExecutionBankRow } from './executionBankModel';
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
  /** Realny wołacz jedynej akcji stopki — odnośnik do tego wiersza. */
  onCopyLink: () => void;
}

export type ExecutionBankPreviewDeclaration = Pick<
  StandardPreviewProps,
  'meta' | 'details' | 'relations' | 'actions' | 'whatsNext'
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

export function buildExecutionBankPreviewDeclaration({
  row,
  t,
  statusChipTone,
  asOf,
  progressLabel,
  resolveOwnerName,
  relations,
  onCopyLink,
}: ExecutionBankPreviewDeps): ExecutionBankPreviewDeclaration {
  const nextStep = resolveExecutionBankNextStep(row, t);
  const summary = buildExecutionBankSummary(row, t, {
    executionState: executionBankExecutionStateLabel,
    lifecycle: executionBankLifecycleLabel,
  });

  return {
    /* Blok 2 — karta meta: STAN, nie treść. */
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
        {
          /* K5-R3: pigułka meta niosła „Progress Progress not reported" —
             etykieta doklejona do zdania, które już samo mówiło o postępie.
             Chip pokazuje WARTOŚĆ. */
          label: row.progress.status === 'KNOWN' ? `Progress ${row.progress.value}%` : 'Progress —',
          tone: 'neutral',
        },
        /* K5-3: zdrowie realizacji to STAN, więc mieszka w karcie meta, a nie
           w tabeli faktów. Chip pojawia się TYLKO gdy zdrowie jest zgłoszone —
           „Health not reported" jako chip byłoby pustym boksem pod inną nazwą. */
        ...(row.health.status === 'KNOWN'
          ? [
              {
                label: executionBankHealthLabel(String(row.health.value)),
                tone: statusChipTone(String(row.health.value)),
              },
            ]
          : []),
      ],
      trailing: (
        <span className="text-[11px] font-semibold text-c-text-secondary">
          {t('execution.bank.preview.reportingDate', 'Reporting date')}{' '}
          {formatExecutionBankDate(asOf)}
        </span>
      ),
      /* Linia pod chipami = kiedy ten stan ostatnio zmierzono. Bez niej karta
         meta mówi „co", nie mówiąc „kiedy". */
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
      text: summary,
      /*
       * Bank realizacji jest w całości po angielsku (DEC-461). Nagłówki kolumn
       * NAZYWAJĄ zawartość zamiast generycznego „Property/Value": każdy wiersz
       * tej tabeli to zgłoszony fakt realizacji z pokwitowaniem, a nie dowolna
       * właściwość obiektu.
       */
      propertyLabel: t('execution.bank.preview.factLabel', 'Execution fact'),
      valueLabel: t('execution.bank.preview.valueLabel', 'Reported value'),
      properties: [
        {
          id: 'execution-case',
          label: t('execution.bank.preview.fact.case', 'Execution case'),
          value: row.executionCaseId
            ? `Linked · v${row.executionCaseVersion ?? '—'}`
            : t('execution.bank.preview.fact.caseMissing', 'Not linked yet'),
        },
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
      ],
      onCopy: () => void navigator.clipboard?.writeText(`${row.name} — ${progressLabel}`),
    },

    /* Blok 5 — Relations (źródło inicjatywy). */
    relations,

    /*
     * Blok 6 — AKCJE. Anty-duplikacja z §7.3 pkt 4.3: „Open" NIE wchodzi (stoi
     * w nagłówku), eksport/pobieranie NIE wchodzą (mieszkają w ⋮ bloku 3).
     * Zostaje jedna akcja z realnym wołaczem — odnośnik do TEGO wiersza; adres
     * niesie już `selection` i `scope`, bo zapisuje je `selectBankRow`, więc
     * wklejony link otwiera ten sam podgląd.
     */
    actions: {
      informational: [
        {
          id: 'copy-link',
          variant: 'neutral',
          label: t('common.copyLink', 'Copy link'),
          icon: Copy,
          onClick: onCopyLink,
        },
      ],
    },

    /*
     * Blok „Co dalej" — NASTĘPNY KROK WYNIKAJĄCY ZE STANU, nie stała lista
     * chipów. `items: []` jest ŚWIADOME: żaden z tych kroków nie ma dziś
     * wołacza w aplikacji, więc blok mówi CO zrobić, nie udając przycisku,
     * który tego nie robi (`nextStep.hasAction === false`).
     */
    whatsNext: {
      label: t('execution.bank.preview.whatsNext', "What's next"),
      note: nextStep.note,
      items: [],
    },
  };
}
