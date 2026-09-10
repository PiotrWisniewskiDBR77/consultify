/**
 * Kody reguł serwera → komunikat dla użytkownika.
 *
 * Serwer NIGDY nie wysyła zdania — wysyła `rule`. Tłumaczenie żyje wyłącznie tutaj
 * i w plikach `public/locales/*`, więc jeden komunikat nie rozjeżdża się na dwa
 * repozytoria.
 *
 * J17 (2026-09-08): pole nazywa się dalej `pl` ze względu na wołaczy, ale NIESIE
 * ANGIELSKI tekst. Powód: `src/i18n.ts` ma `fallbackLng: { en: ['en'] }` i
 * `react.useSuspense: false` — brak klucza NIE spada na plik polski, tylko na ten
 * fallback, a do czasu dojścia pliku tłumaczeń `t()` zwraca go przy KAŻDYM
 * pierwszym malowaniu. Polski fallback = polskie zdanie u użytkownika EN.
 * Polski żyje wyłącznie w `public/locales/pl/translation.json`.
 */

import { enumLabel } from '@/utils/enumLabel';

export const INITIATIVE_RULE_MESSAGE_KEYS: Record<string, { key: string; pl: string }> = {
  TITLE_AND_JUSTIFICATION_REQUIRED: {
    key: 'initiatives.lifecycle.blocked.TITLE_AND_JUSTIFICATION_REQUIRED',
    pl: 'Add the initiative title and rationale.',
  },
  REASON_REQUIRED: {
    key: 'initiatives.lifecycle.blocked.REASON_REQUIRED',
    pl: 'This action requires a reason.',
  },
  INITIATIVE_CARD_INCOMPLETE: {
    key: 'initiatives.lifecycle.blocked.INITIATIVE_CARD_INCOMPLETE',
    pl: 'The card is incomplete — add the description, owner and scope.',
  },
  GATE_DECISION_REQUIRED: {
    key: 'initiatives.lifecycle.blocked.GATE_DECISION_REQUIRED',
    pl: 'A current GO decision from the committee is missing.',
  },
  HANDOFF_AND_START_DATE_REQUIRED: {
    key: 'initiatives.lifecycle.blocked.HANDOFF_AND_START_DATE_REQUIRED',
    pl: 'An accepted handoff and an execution start date are required.',
  },
  OPEN_WORK_BLOCKS_CLOSURE: {
    key: 'initiatives.lifecycle.blocked.OPEN_WORK_BLOCKS_CLOSURE',
    pl: 'Closure is blocked by open tasks or undecided decisions.',
  },
  GATE_BLOCKED: {
    key: 'initiatives.lifecycle.blocked.GATE_BLOCKED',
    pl: 'Gate readiness not met — complete: {{items}}.',
  },
  AUTHOR_ONLY: {
    key: 'initiatives.lifecycle.blocked.AUTHOR_ONLY',
    pl: 'Only the author or an administrator can submit the draft for approval.',
  },
  INVALID_TRANSITION: {
    key: 'initiatives.lifecycle.blocked.INVALID_TRANSITION',
    pl: 'This transition does not exist for the current status.',
  },
  UNEXPECTED_CURRENT_STATUS: {
    key: 'initiatives.lifecycle.blocked.UNEXPECTED_CURRENT_STATUS',
    pl: 'The initiative status changed in the meantime — refresh the view.',
  },
  MISSING_TRANSITION_GATE: {
    key: 'initiatives.lifecycle.blocked.MISSING_TRANSITION_GATE',
    pl: 'This transition has no gate defined and cannot be performed.',
  },
  INVALID_FLAG_OPERATION: {
    key: 'initiatives.lifecycle.blocked.INVALID_FLAG_OPERATION',
    pl: 'This operation is not allowed in the current initiative state.',
  },
  UNSUPPORTED_FLAG_OPERATION: {
    key: 'initiatives.lifecycle.blocked.UNSUPPORTED_FLAG_OPERATION',
    pl: 'Unsupported lifecycle flag operation.',
  },
  // E1c/F2 (10.09, po E2/E2b): trzy nowe kody odmowy z bramki uprawnien
  // (`effectiveCapability.middleware.ts`). `readInitiativeFailureRule`
  // (lifecycleApi.ts) czyta je jako fallback, gdy `data.rule` nie przyszlo —
  // odpowiedz bramki niesie `code`, nie `rule`. Jedno, uczciwe zdanie dla
  // wszystkich trzech: rozroznienie jest techniczne dla serwera, nie dla
  // uzytkownika.
  CAPABILITY_OBJECT_OWNERSHIP_REQUIRED: {
    key: 'initiatives.lifecycle.blocked.CAPABILITY_OBJECT_OWNERSHIP_REQUIRED',
    pl: 'You can only change the status of initiatives you own or created.',
  },
  CAPABILITY_OWNERSHIP_PREDICATE_MISSING: {
    key: 'initiatives.lifecycle.blocked.CAPABILITY_OBJECT_OWNERSHIP_REQUIRED',
    pl: 'You can only change the status of initiatives you own or created.',
  },
  CAPABILITY_OWNERSHIP_CHECK_FAILED: {
    key: 'initiatives.lifecycle.blocked.CAPABILITY_OBJECT_OWNERSHIP_REQUIRED',
    pl: 'You can only change the status of initiatives you own or created.',
  },
};

export const INITIATIVE_RULE_FALLBACK = {
  key: 'initiatives.lifecycle.blocked.UNKNOWN',
  pl: 'The action could not be completed. Refresh the view and try again.',
} as const;

export type TranslateFn = (key: string, fallback: string) => string;

/**
 * Klucze wymagań gotowości z `getBlockingReadinessItems` (serwer) → polski opis.
 * Serwer trzyma tylko angielską etykietę techniczną; użytkownik ma zobaczyć zdanie.
 */
export const INITIATIVE_READINESS_ITEM_KEYS: Record<string, { key: string; pl: string }> = {
  title: { key: 'initiatives.lifecycle.readiness.title', pl: 'title' },
  owner: { key: 'initiatives.lifecycle.readiness.owner', pl: 'owner' },
  timeline_dates: { key: 'initiatives.lifecycle.readiness.timeline_dates', pl: 'planned start and end dates' },
  schedule_milestones: { key: 'initiatives.lifecycle.readiness.schedule_milestones', pl: 'at least one milestone' },
  timeline: { key: 'initiatives.lifecycle.readiness.timeline', pl: 'baseline schedule (dates)' },
  benefits_owner: { key: 'initiatives.lifecycle.readiness.benefits_owner', pl: 'business benefits owner' },
  benefits_kpis: { key: 'initiatives.lifecycle.readiness.benefits_kpis', pl: 'KPIs' },
};

export function initiativeReadinessItemsLabel(
  items: Array<{ key: string; label: string }> | undefined,
  t: TranslateFn
): string {
  return (items || [])
    .map((item) => {
      const entry = INITIATIVE_READINESS_ITEM_KEYS[item.key];
      return entry ? t(entry.key, entry.pl) : item.label;
    })
    .filter(Boolean)
    .join(', ');
}

/** Zwraca gotowe, ludzkie zdanie dla kodu reguły — nigdy kodu i nigdy pustki. */
export function initiativeRuleMessage(
  rule: string | null | undefined,
  t: TranslateFn,
  details?: { items?: Array<{ key: string; label: string }> }
): string {
  const entry = (rule && INITIATIVE_RULE_MESSAGE_KEYS[rule]) || INITIATIVE_RULE_FALLBACK;
  const text = t(entry.key, entry.pl);
  if (rule === 'GATE_BLOCKED') {
    const items = initiativeReadinessItemsLabel(details?.items, t) || t('initiatives.lifecycle.readiness.unknown', 'the gate requirements');
    return text.replace('{{items}}', items);
  }
  return text;
}

/**
 * ODMOWA ZMIANY STATUSU MUSI DOJŚĆ DO CZŁOWIEKA PO POLSKU — E3/P1 (10.09).
 *
 * Zmierzone na własnym API (kopia `consultify_kopia_e3`, konto ADMIN DBR77):
 *   `PATCH /api/initiatives/:id/status` `{"status":"APPROVED"}`
 *   → 400 `{"error":"A current GO decision is required","rule":"GATE_DECISION_REQUIRED"}`
 *
 * Wszystkie trzy powierzchnie zmiany statusu (`InitiativeDocumentView`,
 * `InitiativesHub`, `InitiativeCompactPanel`) pokazywały `e?.message` wprost,
 * czyli ANGIELSKIE zdanie serwera — mimo że polski komunikat dla tej reguły
 * leży w `INITIATIVE_RULE_MESSAGE_KEYS` powyżej i w `public/locales/pl`.
 * Klasyczna „biblioteka bez wywołania": słownik istniał, nikt go nie wołał.
 *
 * Tłumaczenie siedzi TU, w jednym lejku dla trzech ekranów. Kodu, którego
 * słownik nie zna, NIE chowamy — wraca oryginalny błąd, bo cisza jest gorsza
 * niż obcy język.
 */
export function opiszOdmoweZmianyStatusu(error: unknown, t: TranslateFn): Error {
  // `ApiError.errorCode` czyta kolejno `errorCode` → `code` → `rule`
  // (`src/services/api.ts`). Odczyt jest strukturalny, żeby słownik komunikatów
  // nie musiał zaciągać całego modułu API.
  const kod = String(
    (error as { errorCode?: unknown } | null | undefined)?.errorCode ?? ''
  ).trim();
  if (!kod || !INITIATIVE_RULE_MESSAGE_KEYS[kod]) return error as Error;
  return new Error(initiativeRuleMessage(kod, t));
}

/**
 * Etykieta akcji per bramka — słownictwo z tablicy DEC-424.
 *
 * J17: jedno źródło etykiet enumów (`src/utils/enumLabel.ts`, domena
 * `initiativeGateAction`). Nieznana bramka daje uczciwe „Unknown"/„Nieznane",
 * a nie polskie „Zmień status" pokazane użytkownikowi angielskiemu.
 */
export function initiativeGateLabel(gate: string | null | undefined, t: TranslateFn): string {
  return enumLabel('initiativeGateAction', String(gate || ''), t);
}

/**
 * SPRAWDZENIA GOTOWOŚCI BRAMY — 18. kształt fałszywego „gotowe" (E3b, 10.09).
 *
 * `GET /api/initiatives/:id/gate-readiness-check` odsyła listę pozycji z
 * ANGIELSKĄ etykietą techniczną (`label`), angielską podpowiedzią
 * (`suggestedAction`) i angielską nazwą roli (`suggestedActor`) —
 * `InitiativeController.getGateReadinessCheck` woła `addCheck(key, label, …)`
 * i nigdy nie tłumaczy. `GateReadinessSection` malowała te trzy pola WPROST,
 * więc polski użytkownik czytał „Owner assigned" pod polskim nagłówkiem.
 *
 * Powyższy `INITIATIVE_READINESS_ITEM_KEYS` NIE rozwiązywał tego: on niesie
 * krótkie rzeczowniki do ZDANIA „uzupełnij: właściciel, tytuł" (reguła
 * `GATE_BLOCKED`), a nie etykiety pozycji listy kontrolnej. To dwa różne
 * rejestry językowe i dwa różne słowniki — nie jeden.
 *
 * RODZINA (zasada „zlecenie obejmuje rodzeństwo"): serwer wystawia 14 kluczy
 * stałych + rodzinę dynamiczną `gate_role_<BRAMKA>`. Wszystkie 15 są tutaj;
 * klucz spoza słownika oddaje ORYGINALNY napis serwera — cisza byłaby gorsza
 * niż obcy język.
 *
 * J17: pole `pl` niesie ANGIELSKI (fallback `useSuspense:false`), polski żyje
 * w `public/locales/pl/translation.json`.
 */
export const INITIATIVE_READINESS_CHECK_KEYS: Record<string, { key: string; pl: string }> = {
  title: { key: 'initiatives.lifecycle.readinessCheck.title', pl: 'Title defined' },
  owner: { key: 'initiatives.lifecycle.readinessCheck.owner', pl: 'Owner assigned' },
  summary: { key: 'initiatives.lifecycle.readinessCheck.summary', pl: 'Summary / problem statement' },
  sponsor: { key: 'initiatives.lifecycle.readinessCheck.sponsor', pl: 'Sponsor assigned' },
  timeline_dates: {
    key: 'initiatives.lifecycle.readinessCheck.timeline_dates',
    pl: 'Planned dates set (start + end)',
  },
  schedule_milestones: {
    key: 'initiatives.lifecycle.readinessCheck.schedule_milestones',
    pl: 'Milestones defined',
  },
  timeline: { key: 'initiatives.lifecycle.readinessCheck.timeline', pl: 'Timeline set' },
  baseline: { key: 'initiatives.lifecycle.readinessCheck.baseline', pl: 'Schedule baseline locked' },
  scope: { key: 'initiatives.lifecycle.readinessCheck.scope', pl: 'Scope defined' },
  risks: { key: 'initiatives.lifecycle.readinessCheck.risks', pl: 'Risks identified' },
  tasks: { key: 'initiatives.lifecycle.readinessCheck.tasks', pl: 'Tasks created' },
  benefits_owner: {
    key: 'initiatives.lifecycle.readinessCheck.benefits_owner',
    pl: 'Business Owner assigned (benefits owner)',
  },
  benefits_kpis: { key: 'initiatives.lifecycle.readinessCheck.benefits_kpis', pl: 'KPIs defined' },
  benefits_kpi_targets: {
    key: 'initiatives.lifecycle.readinessCheck.benefits_kpi_targets',
    pl: 'KPI targets + units defined',
  },
};

/**
 * Wariant awaryjny jednej pozycji: serwer podmienia etykietę i podpowiedź, gdy
 * tabela kamieni milowych nie istnieje (`catch` w `getGateReadinessCheck`).
 * Rozpoznajemy go po treści serwera, bo klucz jest ten sam.
 */
const READINESS_SCHEMA_FALLBACK = {
  label: {
    serwer: 'Milestones schema available',
    key: 'initiatives.lifecycle.readinessCheck.schedule_milestones_schema',
    pl: 'Milestones schema available',
  },
  action: {
    serwer: 'Milestones table is missing. Run migrations (initiative_milestones).',
    key: 'initiatives.lifecycle.readinessAction.schedule_milestones_schema',
    pl: 'Milestones table is missing. Run migrations (initiative_milestones).',
  },
} as const;

export const INITIATIVE_READINESS_ACTION_KEYS: Record<string, { key: string; pl: string }> = {
  title: {
    key: 'initiatives.lifecycle.readinessAction.title',
    pl: 'Add a concise initiative title that clearly describes the change.',
  },
  owner: {
    key: 'initiatives.lifecycle.readinessAction.owner',
    pl: 'Assign a business or execution owner who will be accountable.',
  },
  summary: {
    key: 'initiatives.lifecycle.readinessAction.summary',
    pl: 'Write a 2-3 sentence summary explaining the business problem this initiative addresses.',
  },
  sponsor: {
    key: 'initiatives.lifecycle.readinessAction.sponsor',
    pl: 'Nominate a senior leader who will champion and fund this initiative.',
  },
  timeline_dates: {
    key: 'initiatives.lifecycle.readinessAction.timeline_dates',
    pl: 'Set planned start and end dates before scheduling (baseline lock).',
  },
  schedule_milestones: {
    key: 'initiatives.lifecycle.readinessAction.schedule_milestones',
    pl: 'Add at least one milestone to lock the schedule baseline.',
  },
  timeline: {
    key: 'initiatives.lifecycle.readinessAction.timeline',
    pl: 'Set planned start and end dates for baseline scheduling.',
  },
  baseline: {
    key: 'initiatives.lifecycle.readinessAction.baseline',
    pl: 'Create a schedule baseline snapshot (re-schedule) to enable variance tracking.',
  },
  scope: {
    key: 'initiatives.lifecycle.readinessAction.scope',
    pl: 'Define the scope or objectives so reviewers understand boundaries.',
  },
  risks: {
    key: 'initiatives.lifecycle.readinessAction.risks',
    pl: 'Identify at least one risk and its mitigation strategy.',
  },
  tasks: {
    key: 'initiatives.lifecycle.readinessAction.tasks',
    pl: 'Break down the initiative into executable tasks.',
  },
  benefits_owner: {
    key: 'initiatives.lifecycle.readinessAction.benefits_owner',
    pl: 'Assign the business owner who will track realized benefits.',
  },
  benefits_kpis: {
    key: 'initiatives.lifecycle.readinessAction.benefits_kpis',
    pl: 'Define measurable KPIs that will prove business value.',
  },
  benefits_kpi_targets: {
    key: 'initiatives.lifecycle.readinessAction.benefits_kpi_targets',
    pl: 'Set numeric targets and units for each KPI.',
  },
};

/**
 * Sugerowany wykonawca. Serwer skleja role ukośnikiem („PMO / Project
 * Manager"), więc tłumaczymy CZŁON po członie — inaczej każda nowa kombinacja
 * wymagałaby osobnego klucza.
 */
export const INITIATIVE_READINESS_ACTOR_KEYS: Record<string, { key: string; pl: string }> = {
  'initiative owner': {
    key: 'initiatives.lifecycle.readinessActor.initiativeOwner',
    pl: 'Initiative Owner',
  },
  pmo: { key: 'initiatives.lifecycle.readinessActor.pmo', pl: 'PMO' },
  'project manager': {
    key: 'initiatives.lifecycle.readinessActor.projectManager',
    pl: 'Project Manager',
  },
  'portfolio owner': {
    key: 'initiatives.lifecycle.readinessActor.portfolioOwner',
    pl: 'Portfolio Owner',
  },
  'platform admin': {
    key: 'initiatives.lifecycle.readinessActor.platformAdmin',
    pl: 'Platform Admin',
  },
  'risk manager': { key: 'initiatives.lifecycle.readinessActor.riskManager', pl: 'Risk Manager' },
  sponsor: { key: 'initiatives.lifecycle.readinessActor.sponsor', pl: 'Sponsor' },
  'business owner': {
    key: 'initiatives.lifecycle.readinessActor.businessOwner',
    pl: 'Business Owner',
  },
};

const GATE_ROLE_PREFIX = 'gate_role_';

/** Lista ról z etykiety/podpowiedzi serwera („PROJECT_SPONSOR, STEERING_COMMITTEE"). */
function rolePartFromServerText(text: string, separator: string): string {
  const index = text.indexOf(separator);
  return index >= 0 ? text.slice(index + separator.length).trim() : '';
}

/** Etykieta pozycji listy gotowości. Nieznany klucz → oryginał serwera. */
export function initiativeReadinessCheckLabel(
  key: string | null | undefined,
  serverLabel: string,
  t: TranslateFn
): string {
  const id = String(key || '').trim();
  if (id.startsWith(GATE_ROLE_PREFIX)) {
    const gate = initiativeGateLabel(id.slice(GATE_ROLE_PREFIX.length), t);
    const roles = rolePartFromServerText(serverLabel, ': ');
    if (!roles) return serverLabel;
    return t(
      'initiatives.lifecycle.readinessCheck.gate_role',
      'Gate approver assigned for {{gate}}: {{roles}}'
    )
      .replace('{{gate}}', gate)
      .replace('{{roles}}', roles);
  }
  if (serverLabel === READINESS_SCHEMA_FALLBACK.label.serwer) {
    return t(READINESS_SCHEMA_FALLBACK.label.key, READINESS_SCHEMA_FALLBACK.label.pl);
  }
  const entry = INITIATIVE_READINESS_CHECK_KEYS[id];
  return entry ? t(entry.key, entry.pl) : serverLabel;
}

/** Podpowiedź „co zrobić". Nieznany klucz → oryginał serwera. */
export function initiativeReadinessActionText(
  key: string | null | undefined,
  serverAction: string,
  t: TranslateFn
): string {
  const id = String(key || '').trim();
  if (id.startsWith(GATE_ROLE_PREFIX)) {
    const roles = rolePartFromServerText(serverAction, 'roles: ').replace(
      / so the gate can be approved\.$/,
      ''
    );
    if (!roles) return serverAction;
    return t(
      'initiatives.lifecycle.readinessAction.gate_role',
      'Assign users to roles: {{roles}} so the gate can be approved.'
    ).replace('{{roles}}', roles);
  }
  if (serverAction === READINESS_SCHEMA_FALLBACK.action.serwer) {
    return t(READINESS_SCHEMA_FALLBACK.action.key, READINESS_SCHEMA_FALLBACK.action.pl);
  }
  const entry = INITIATIVE_READINESS_ACTION_KEYS[id];
  return entry ? t(entry.key, entry.pl) : serverAction;
}

/** Sugerowany wykonawca; człony rozdzielone „/" tłumaczone osobno. */
export function initiativeReadinessActorLabel(
  serverActor: string | null | undefined,
  t: TranslateFn
): string {
  const raw = String(serverActor || '').trim();
  if (!raw) return '';
  return raw
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const entry = INITIATIVE_READINESS_ACTOR_KEYS[part.toLowerCase()];
      return entry ? t(entry.key, entry.pl) : part;
    })
    .join(' / ');
}
