/**
 * executionBankPreviewModel — TREŚĆ podglądu wiersza banku Realizacji.
 *
 * PO CO OSOBNY PLIK (K5-3, warunek właściciela przy odbiorze Realizacji,
 * DEC-491): podgląd banku był jedynym blokiem kanonu, o którym właściciel
 * powiedział „preview nie jest zgodne ze standardem, reszta ok". Braki były
 * TREŚCIOWE, nie stylistyczne — powłoka (`StandardPreview`) była już
 * poprawna, ale ekran deklarował tylko dwa z sześciu bloków:
 *
 *   · blok 3 (Treść) nie miał ŻADNEJ prozy — wiersze banku nie mają opisu,
 *     więc `details.text` był `undefined` i podgląd otwierał się od razu
 *     tabelą właściwości, jak zrzut pól z bazy (dokładnie ten kształt, który
 *     TABLE_AND_PREVIEW_CANON §7.3 pkt 3 nazywa „nie jednolinijkowy opis…
 *     bogaty domyślny szablon"),
 *   · bloku „Co dalej" nie było wcale — a to JEDYNE miejsce, w którym wiersz
 *     „No execution case yet" może powiedzieć, czego mu brakuje,
 *   · bloku 6 (Akcje) nie było wcale.
 *
 * Logika jest TUTAJ, a nie w JSX-ie `ExecutionHub`, bo to jedyny sposób, żeby
 * dało się ją przetestować bez renderu całego huba (6,4 tys. linii) — i żeby
 * mutacja w regule „czego brakuje" wywracała test, a nie przechodziła
 * niezauważona pod zielonym smoke-testem.
 *
 * JĘZYK (DEC-461): angielski `defaultValue` + klucz i18n (`execution.bank.
 * preview.*`) — ten sam wzorzec co `execution.bank.lifecycleUnknownHint`.
 * `t` wstrzykujemy propem, NIE importem z `@/i18n` — bootstrap i18n wywraca
 * zestawy testów banku, które mockują `react-i18next` bez `initReactI18next`.
 */
import type { ExecutionBankEvidence, ExecutionBankRow } from './executionBankModel';

/** `t(klucz, domyślnaAngielska, zmienne?)` — podzbiór i18next, jaki tu wystarcza. */
export type ExecutionBankPreviewT = (
  key: string,
  defaultValue: string,
  vars?: Record<string, string | number>
) => string;

/**
 * Brak wartości, który JEST stanem, a nie luką: ktoś świadomie wyczyścił
 * datę i jest na to pokwitowanie. Ta sama reguła co `GapCell` w tabeli —
 * `VALUE_CLEARED` nie jest powodem do żądania uzupełnienia danych.
 */
const isGap = (evidence: ExecutionBankEvidence<unknown>): boolean =>
  evidence.status !== 'KNOWN' && evidence.reason !== 'VALUE_CLEARED';

export type ExecutionBankNextStepKey =
  | 'NO_EXECUTION_CASE'
  | 'SET_BASELINE'
  | 'REPORT_FORECAST'
  | 'REPORT_PROGRESS'
  | 'NEXT_ACTION'
  | 'ON_TRACK';

export interface ExecutionBankNextStep {
  key: ExecutionBankNextStepKey;
  /** Zdanie dla bloku „Co dalej" — JEDEN dopisek dla całej grupy (ANEKS #4). */
  note: string;
  /**
   * Czy w aplikacji ISTNIEJE wołacz, który ten krok wykonuje.
   *
   * Twardo `false` dla wszystkiego poza otwarciem rekordu: front NIE MA dziś
   * ani trasy „utwórz realizację" (realizacja powstaje wyłącznie przez
   * przekazanie z karty inicjatywy — `requestHandoffAcceptance` →
   * `decideHandoffAcceptance` w kolejce My Work), ani „zgłoś postęp"/„ustaw
   * bazę odniesienia" z poziomu banku. Przycisk bez wołacza to martwy
   * przycisk — kanon każe go NIE rysować, a nie rysować i wyszarzać.
   */
  hasAction: false;
}

/**
 * NASTĘPNY KROK wynikający ZE STANU wiersza — kolejność reguł jest kolejnością
 * zależności: bez realizacji nie ma czego planować, bez bazy odniesienia nie ma
 * od czego liczyć wariancji, bez prognozy nie ma czego z nią porównać.
 */
export function resolveExecutionBankNextStep(
  row: ExecutionBankRow,
  t: ExecutionBankPreviewT
): ExecutionBankNextStep {
  if (!row.executionCaseId) {
    return {
      key: 'NO_EXECUTION_CASE',
      note: t(
        'execution.bank.preview.next.noExecutionCase',
        'No execution case yet. Execution starts when this initiative is handed off from its initiative record — schedule, forecast and progress are reported only after that.'
      ),
      hasAction: false,
    };
  }
  if (isGap(row.baselineFinish)) {
    return {
      key: 'SET_BASELINE',
      note: t(
        'execution.bank.preview.next.setBaseline',
        'Set the schedule baseline on the execution case. Without it variance has nothing to measure against.'
      ),
      hasAction: false,
    };
  }
  if (isGap(row.forecastFinish)) {
    return {
      key: 'REPORT_FORECAST',
      note: t(
        'execution.bank.preview.next.reportForecast',
        'Report a forecast finish date. The baseline is set, but there is no forecast to compare it with.'
      ),
      hasAction: false,
    };
  }
  if (isGap(row.progress)) {
    return {
      key: 'REPORT_PROGRESS',
      note: t(
        'execution.bank.preview.next.reportProgress',
        'Report progress on the execution case. The schedule is complete, but no progress has been reported.'
      ),
      hasAction: false,
    };
  }
  if (row.nextAction?.trim()) {
    return { key: 'NEXT_ACTION', note: row.nextAction.trim(), hasAction: false };
  }
  return {
    key: 'ON_TRACK',
    note: t(
      'execution.bank.preview.next.onTrack',
      'Schedule evidence is complete — baseline, forecast and progress are all reported.'
    ),
    hasAction: false,
  };
}

/**
 * PROZA bloku 3 — „bogaty domyślny szablon" z §7.3 pkt 3.
 *
 * Opis inicjatywy, gdy jest. Gdy go nie ma (a w banku nie ma go prawie nigdy —
 * `description` idzie z rekordu inicjatywy, którego cztery realizacje
 * `demo-story-…` w ogóle nie mają), składamy zdania Z DOWODÓW, którymi wiersz
 * dysponuje: stan realizacji, profil dostawy, postęp, wariancja. To NIE jest
 * ozdobnik — bez tego blok treści jest pusty i podgląd zaczyna się tabelą.
 */
export function buildExecutionBankSummary(
  row: ExecutionBankRow,
  t: ExecutionBankPreviewT,
  labels: { executionState: (value: string) => string; lifecycle: (value: string) => string }
): string {
  const described = row.description?.trim();
  if (described) return described;

  const sentences: string[] = [];

  if (row.executionCaseId) {
    sentences.push(
      t(
        'execution.bank.preview.summary.caseState',
        'Execution case {{state}}, version {{version}}.',
        {
          state: labels.executionState(row.executionState).toLowerCase(),
          version: row.executionCaseVersion ?? 1,
        }
      )
    );
    if (row.executionPhase?.trim()) {
      sentences.push(
        t('execution.bank.preview.summary.phase', 'Execution phase: {{phase}}.', {
          phase: row.executionPhase.trim(),
        })
      );
    }
    if (row.deliveryProfile?.trim()) {
      sentences.push(
        t('execution.bank.preview.summary.deliveryProfile', 'Delivery profile: {{profile}}.', {
          profile: row.deliveryProfile.trim(),
        })
      );
    }
  } else {
    sentences.push(
      t(
        'execution.bank.preview.summary.noCase',
        'Initiative {{lifecycle}} on the portfolio record, with no execution case behind it yet.',
        { lifecycle: labels.lifecycle(row.lifecycleStatus).toLowerCase() }
      )
    );
  }

  if (row.progress.status === 'KNOWN') {
    sentences.push(
      t('execution.bank.preview.summary.progress', 'Reported progress {{value}}%.', {
        value: row.progress.value,
      })
    );
  }

  if (row.varianceDays.status === 'KNOWN') {
    const days = row.varianceDays.value;
    sentences.push(
      days === 0
        ? t('execution.bank.preview.summary.varianceOnPlan', 'Finish date matches the baseline.')
        : days > 0
          ? t(
              'execution.bank.preview.summary.varianceLate',
              'Finish date is {{days}} days later than the baseline.',
              { days }
            )
          : t(
              'execution.bank.preview.summary.varianceEarly',
              'Finish date is {{days}} days earlier than the baseline.',
              { days: Math.abs(days) }
            )
    );
  }

  if (row.blockerCount && row.blockerCount > 0) {
    sentences.push(
      t('execution.bank.preview.summary.blockers', '{{count}} open blockers.', {
        count: row.blockerCount,
      })
    );
  }

  return sentences.join(' ');
}

/**
 * WARIANCJA jako tekst wiersza właściwości — „+12 d vs baseline" / „—".
 * Osobno, bo `varianceDays` niesie też `reference` (FORECAST/ACTUAL), czyli
 * informację, względem CZEGO liczona jest różnica; bez niej liczba kłamie.
 */
export function formatExecutionBankVariance(
  row: ExecutionBankRow,
  t: ExecutionBankPreviewT
): string {
  const variance = row.varianceDays;
  if (variance.status !== 'KNOWN') return '—';
  const reference =
    variance.reference === 'ACTUAL'
      ? t('execution.bank.preview.variance.actual', 'actual vs baseline')
      : t('execution.bank.preview.variance.forecast', 'forecast vs baseline');
  const days = variance.value;
  const signed = days > 0 ? `+${days}` : String(days);
  return t('execution.bank.preview.variance.value', '{{signed}} d ({{reference}})', {
    signed,
    reference,
  });
}
