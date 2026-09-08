/**
 * J17 — JEDEN helper zamieniający wartość enuma (z bazy / z API) na etykietę
 * w języku interfejsu.
 *
 * PROBLEM (zasada 6 planu JEZYK_EN_PL_20260908): rejestr Inicjatyw pokazywał
 * „UNKNOWN Pewność: Nieznana" — surowy enum SKLEJONY z polskim zdaniem, i to
 * także użytkownikowi wersji angielskiej. Winne były mapy `*_LABELS` z samymi
 * polskimi napisami (`initiativeRegisterProjection.ts`) plus `|| value`, który
 * przy nieznanej wartości wypuszczał surowy string na ekran.
 *
 * KONTRAKT:
 *   znana wartość   -> t('enums.<domena>.<WARTOSC>', angielski fallback)
 *   nieznana/pusta  -> t('enums.unknown', 'Unknown')  — NIGDY surowy string,
 *                      NIGDY sklejenie enumu ze zdaniem.
 *
 * Fallbacki są po angielsku (zasada 3): `useSuspense: false` pokazuje default
 * z kodu, zanim dojdzie plik tłumaczeń.
 *
 * NOWA DOMENA = dopisz wpis w `ENUM_FALLBACKS_EN` ORAZ klucze `enums.*`
 * w `public/locales/{pl,en}/translation.json`. Bez wpisu wartość jest „nieznana"
 * i użytkownik zobaczy „Unknown" — to celowe, lepsze niż surowy `SOLVER-1:SELECTED`.
 */
export type EnumTranslateFn = (key: string, defaultValue: string) => string;

export const ENUM_UNKNOWN_KEY = 'enums.unknown';
export const ENUM_UNKNOWN_EN = 'Unknown';

export const ENUM_FALLBACKS_EN: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({
    /** `InitiativeRegisterRow['lifecycle']` + legacy statusy z AssessmentHub. */
    initiativeLifecycle: Object.freeze({
      REGISTERED_DRAFT: 'Draft registered',
      DEFINED: 'Defined',
      ANALYZING: 'Analysis',
      READY_FOR_DECISION: 'Ready for decision',
      APPROVED_BACKLOG: 'Approved backlog',
      SCHEDULED: 'Scheduled',
      IN_EXECUTION: 'In execution',
      DELIVERED: 'Delivered',
      BENEFITS_TRACKING: 'Benefits tracking',
      EFFECTIVENESS_REVIEWED: 'Effectiveness reviewed',
      CLOSED: 'Closed',
      ARCHIVED: 'Archived',
      DRAFT: 'Draft',
      PENDING_REVIEW: 'Pending review',
      REVIEW: 'In review',
      PROMOTED: 'Approved',
      PLANNING: 'Planning',
      APPROVED: 'Accepted',
      EXECUTING: 'In execution',
      BLOCKED: 'Blocked',
      DONE: 'Done',
      TRACKING: 'Tracking',
    }),
    /** Nazwy bramek z `nextStepForLifecycle` — stała konfiguracyjna produktu. */
    initiativeGateName: Object.freeze({
      Definition: 'Definition',
      Analysis: 'Analysis',
      Portfolio: 'Portfolio',
      Schedule: 'Schedule',
      Handoff: 'Handoff',
      Delivery: 'Delivery',
      Effectiveness: 'Effectiveness',
      Closure: 'Closure',
    }),
    initiativeGateReadiness: Object.freeze({
      READY: 'Ready',
      PARTIAL: 'Partial',
      NOT_READY: 'Not ready',
      BLOCKED: 'Blocked',
      NOT_EVALUATED: 'Not evaluated',
      UNKNOWN: ENUM_UNKNOWN_EN,
    }),
    initiativeHealthState: Object.freeze({
      ON_TRACK: 'On track',
      WATCH: 'Watch',
      AT_RISK: 'At risk',
      CRITICAL: 'Critical',
      UNKNOWN: ENUM_UNKNOWN_EN,
      'N/A': 'Not applicable',
    }),
    initiativeImpactConfidence: Object.freeze({
      HIGH: 'High',
      MEDIUM: 'Medium',
      LOW: 'Low',
      UNKNOWN: ENUM_UNKNOWN_EN,
    }),
    initiativeSourceFreshness: Object.freeze({
      CURRENT: 'Current',
      STALE: 'Stale',
      SOURCE_UNAVAILABLE: 'Source unavailable',
      UNKNOWN: ENUM_UNKNOWN_EN,
    }),
    /** Akcje bramek cyklu życia (`INITIATIVE_GATE_LABELS`, tablica DEC-424). */
    initiativeGateAction: Object.freeze({
      CREATE_DRAFT: 'Create draft',
      SUBMIT_FOR_REVIEW: 'Submit for approval',
      APPROVE: 'Approve initiative',
      SEND_BACK: 'Send back to draft',
      REJECT: 'Reject initiative',
      START: 'Start execution',
      COMPLETE: 'Close initiative',
      CANCEL: 'Cancel initiative',
      BLOCK: 'Put execution on hold',
      UNBLOCK: 'Resume execution',
      ARCHIVE: 'Archive',
    }),
    priority: Object.freeze({
      CRITICAL: 'Critical',
      HIGH: 'High',
      MEDIUM: 'Medium',
      LOW: 'Low',
    }),
  });

export type EnumDomain = keyof typeof ENUM_FALLBACKS_EN;

/**
 * Domeny, ktore maja JUZ swoja przestrzen kluczy w `public/locales/*` i nie
 * dostaja drugiej pod `enums.*`. Zasada: jeden napis — jeden klucz. Bez tej
 * mapy `initiativeGateAction` mialby dwa komplety tlumaczen (tu i pod
 * `initiatives.lifecycle.action.*`, ktorego uzywa `gateActionLabelKey`
 * w `src/services/initiativeLifecycle.ts`) i rozjechalyby sie przy pierwszej
 * zmianie slownictwa.
 */
const DOMAIN_KEY_NAMESPACE: Readonly<Record<string, string>> = Object.freeze({
  initiativeGateAction: 'initiatives.lifecycle.action',
});

function enumKey(domain: string, value: string): string {
  return `${DOMAIN_KEY_NAMESPACE[domain] ?? `enums.${domain}`}.${value}`;
}

/** Czy dla tej pary (domena, wartość) mamy autoryzowaną etykietę. */
export function isKnownEnumValue(domain: string, value: unknown): boolean {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return false;
  const table = ENUM_FALLBACKS_EN[domain as EnumDomain];
  return Boolean(table && Object.prototype.hasOwnProperty.call(table, raw));
}

/**
 * Etykieta enuma w języku interfejsu. Nigdy nie zwraca surowej wartości bazy
 * ani pustki — nieznana wartość dostaje uczciwe „Unknown" / „Nieznane".
 */
export function enumLabel(domain: string, value: unknown, t: EnumTranslateFn): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const table = ENUM_FALLBACKS_EN[domain as EnumDomain];
  if (raw && table && Object.prototype.hasOwnProperty.call(table, raw)) {
    return t(enumKey(domain, raw), table[raw]);
  }
  return t(ENUM_UNKNOWN_KEY, ENUM_UNKNOWN_EN);
}
