/**
 * enumLabels — surowy enum / slug → CZYTELNA etykieta (PL/EN).
 *
 * POWÓD (2026-07-24): karty n-Type pokazywały właścicielowi wprost wartości
 * bazodanowe: „AI RISK DETECTED", „ai", „dynamic-swot", „TASK"/„DECISION".
 * To są identyfikatory deweloperskie, nie język produktu.
 *
 * ZASADA: NIE WYMYŚLAMY DANYCH. Mapy poniżej pokrywają wartości, które
 * naprawdę istnieją w kodzie (TYPE_ICONS w NotificationDetailView,
 * NotificationCategory w server/src/types/index.ts, LinkedItemType w
 * MyWork/shared/LinkedItemsSection). Dla wartości spoza mapy zwracamy
 * HUMANIZOWANY slug (podkreślenia/myślniki → spacje, pierwsza litera wielka) —
 * nigdy zmyśloną nazwę i nigdy surowego enuma w wersalikach.
 */

type Bilingual = { en: string; pl: string };

/** `AI_RISK_DETECTED` / `dynamic-swot` → `Ai risk detected` / `Dynamic swot`. */
export function humanizeEnum(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const words = s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!words) return '';
  // Skróty pisane w całości wielkimi literami zostawiamy (AI, KPI, RAID, SWOT).
  const parts = words.split(' ').map((w) => {
    if (w.length <= 4 && w === w.toUpperCase() && /^[A-Z0-9]+$/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
  return parts.join(' ');
}

function pick(map: Record<string, Bilingual>, key: string, isPolish: boolean): string | null {
  const hit = map[key];
  if (!hit) return null;
  return isPolish ? hit.pl : hit.en;
}

// ── Powiadomienia: typ ──────────────────────────────────────────────────────
// Klucze 1:1 z `TYPE_ICONS` (NotificationDetailView.tsx) — jeden zestaw typów.
const NOTIFICATION_TYPE_LABELS: Record<string, Bilingual> = {
  TASK_ASSIGNED: { en: 'Task assigned', pl: 'Przypisane zadanie' },
  TASK_OVERDUE: { en: 'Task overdue', pl: 'Zadanie po terminie' },
  TASK_BLOCKED: { en: 'Task blocked', pl: 'Zadanie zablokowane' },
  DECISION_REQUIRED: { en: 'Decision required', pl: 'Wymagana decyzja' },
  DECISION_OVERDUE: { en: 'Decision overdue', pl: 'Decyzja po terminie' },
  INITIATIVE_STARTED: { en: 'Initiative started', pl: 'Inicjatywa rozpoczęta' },
  INITIATIVE_STALLED: { en: 'Initiative stalled', pl: 'Inicjatywa wstrzymana' },
  INITIATIVE_COMPLETED: { en: 'Initiative completed', pl: 'Inicjatywa zakończona' },
  AI_RISK_DETECTED: { en: 'Risk detected (AI)', pl: 'Wykryte ryzyko (AI)' },
  AI_RECOMMENDATION: { en: 'AI recommendation', pl: 'Rekomendacja AI' },
  AI_OVERLOAD_DETECTED: { en: 'Overload detected (AI)', pl: 'Wykryte przeciążenie (AI)' },
  AI_DEPENDENCY_CONFLICT: { en: 'Dependency conflict (AI)', pl: 'Konflikt zależności (AI)' },
  SYSTEM_ALERT: { en: 'System alert', pl: 'Alert systemowy' },
  PAYMENT_FAILED: { en: 'Payment failed', pl: 'Nieudana płatność' },
  USAGE_ALERT: { en: 'Usage alert', pl: 'Alert zużycia' },
  SUBSCRIPTION_CHANGE: { en: 'Subscription change', pl: 'Zmiana subskrypcji' },
  BILLING_LIMIT_WARNING: { en: 'Billing limit warning', pl: 'Ostrzeżenie o limicie rozliczeń' },
  BILLING_LIMIT_REACHED: { en: 'Billing limit reached', pl: 'Osiągnięty limit rozliczeń' },
  INVOICE_READY: { en: 'Invoice ready', pl: 'Faktura gotowa' },
  DBR77_UPDATE: { en: 'DBR77 update', pl: 'Aktualizacja DBR77' },
  DBR77_RELEASE_NOTES: { en: 'DBR77 release notes', pl: 'Nowości w wersji DBR77' },
  DBR77_KB_NEW: { en: 'New DBR77 knowledge base entry', pl: 'Nowy wpis w bazie wiedzy DBR77' },
  DBR77_INSTRUCTION: { en: 'DBR77 instruction', pl: 'Instrukcja DBR77' },
};

export function notificationTypeLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(NOTIFICATION_TYPE_LABELS, key, isPolish) ?? humanizeEnum(key);
}

// ── Powiadomienia: kategoria ────────────────────────────────────────────────
// `NotificationCategory` = 'ai' | 'task' | 'system' | 'billing' | 'pmo'
// (server/src/types/index.ts) + wartości filtrów listy (decision, alert).
const NOTIFICATION_CATEGORY_LABELS: Record<string, Bilingual> = {
  ai: { en: 'Artificial intelligence', pl: 'Sztuczna inteligencja' },
  task: { en: 'Tasks', pl: 'Zadania' },
  decision: { en: 'Decisions', pl: 'Decyzje' },
  initiative: { en: 'Initiatives', pl: 'Inicjatywy' },
  system: { en: 'System', pl: 'System' },
  alert: { en: 'Alerts', pl: 'Alerty' },
  billing: { en: 'Billing', pl: 'Rozliczenia' },
  pmo: { en: 'PMO', pl: 'PMO' },
};

export function notificationCategoryLabel(
  raw: string | null | undefined,
  isPolish: boolean
): string {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!key) return '';
  return pick(NOTIFICATION_CATEGORY_LABELS, key, isPolish) ?? humanizeEnum(key);
}

// ── Powiązania: typ obiektu ─────────────────────────────────────────────────
// Zestaw = `LinkedItemType` (MyWork/shared/LinkedItemsSection.tsx) rozszerzony
// o typy, którymi karty realnie posługują się w sekcjach „Wynika z"/„Dotyczy".
const LINKED_TYPE_LABELS: Record<string, Bilingual> = {
  task: { en: 'Task', pl: 'Zadanie' },
  decision: { en: 'Decision', pl: 'Decyzja' },
  risk: { en: 'Risk', pl: 'Ryzyko' },
  initiative: { en: 'Initiative', pl: 'Inicjatywa' },
  project: { en: 'Project', pl: 'Projekt' },
  assessment: { en: 'Assessment', pl: 'Ocena' },
  report: { en: 'Report', pl: 'Raport' },
  tool: { en: 'Tool', pl: 'Narzędzie' },
  insight: { en: 'Insight', pl: 'Insight' },
  idea: { en: 'Idea', pl: 'Pomysł' },
  note: { en: 'Note', pl: 'Notatka' },
  notebook: { en: 'Note', pl: 'Notatka' },
  interview: { en: 'Interview', pl: 'Wywiad' },
  presentation: { en: 'Presentation', pl: 'Prezentacja' },
  document: { en: 'Document', pl: 'Dokument' },
  external: { en: 'External link', pl: 'Link zewnętrzny' },
  item: { en: 'Item', pl: 'Obiekt' },
};

export function linkedTypeLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!key) return '';
  return pick(LINKED_TYPE_LABELS, key, isPolish) ?? humanizeEnum(key);
}
