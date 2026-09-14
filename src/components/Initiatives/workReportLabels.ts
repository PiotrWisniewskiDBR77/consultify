/**
 * P1 · RP1b — ETYKIETY „Raportu z pracy" (skaza 2 przejazdu kanonu Z-29).
 *
 * DLACZEGO OSOBNY PLIK: kolumny tabeli, plakietki podglądu i pozycje kebaba
 * muszą mówić TYM SAMYM słowem. Do 14.09 `InitiativeWorkReportView` wypisywał
 * `String(row.status)` i `String(row.workReport.cadence)`, więc na ekranie
 * stały surowe kody enuma silnika — `PUBLISHED`, `WEEKLY`, `ON_DEMAND`,
 * `APPROVED`. Kanon §7.3 (TABLE_AND_PREVIEW_CANON) zakazuje surowych kluczy
 * UPPER_SNAKE w tabeli i w podglądzie; wzorzec rozwiązania 1:1 z
 * `initiativeStatusLabels.ts` (skrzynka H1b).
 *
 * TON PLAKIETKI (kanon triady — czerwień WYŁĄCZNIE semantyka krytyczna):
 *   PUBLISHED → success · APPROVED/FROZEN/DRAFT/VALIDATED/SUPERSEDED → neutral
 *   FAILED    → danger
 * Ton dla doręczenia adresata: DELIVERED → success, FAILED → danger,
 * PENDING/SENDING → neutral.
 *
 * Surowy kod NIE ZNIKA — wołający wkłada go w `title` (tooltip), żeby dało się
 * zweryfikować stan silnika bez otwierania bazy.
 */
import type { TFunction } from 'i18next';

export type WorkReportRunStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'FROZEN'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'FAILED'
  | 'SUPERSEDED';

export type WorkReportCadence = 'ON_DEMAND' | 'WEEKLY' | 'MONTHLY';

export type WorkReportRecipientStatus = 'PENDING' | 'SENDING' | 'DELIVERED' | 'FAILED';

/** Tony dopuszczone przez `MetaPill` (PreviewMetaCard) — bez `info`, bo stan przebiegu to nie podpowiedź. */
export type WorkReportTone = 'neutral' | 'success' | 'warning' | 'danger';

const RUN_STATUS_TONE: Record<string, WorkReportTone> = {
  PUBLISHED: 'success',
  APPROVED: 'neutral',
  FROZEN: 'neutral',
  VALIDATED: 'neutral',
  DRAFT: 'neutral',
  SUPERSEDED: 'neutral',
  FAILED: 'danger',
};

const RECIPIENT_STATUS_TONE: Record<string, WorkReportTone> = {
  DELIVERED: 'success',
  FAILED: 'danger',
  SENDING: 'neutral',
  PENDING: 'neutral',
};

/** Fallback dla kodu spoza słownika: `WEEKLY_TEAM_UPDATE` → `Weekly team update`. */
export const humanizeWorkReportCode = (raw: string): string => {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '—';
  const words = trimmed.replace(/[_-]+/g, ' ').toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const workReportRunStatusLabel = (t: TFunction, raw: string): string => {
  const key = String(raw ?? '').trim().toUpperCase();
  const map: Record<string, string> = {
    DRAFT: t('initiatives.workReport.runStatus.draft', 'Draft'),
    VALIDATED: t('initiatives.workReport.runStatus.validated', 'Validated'),
    FROZEN: t('initiatives.workReport.runStatus.frozen', 'Frozen — awaiting approval'),
    APPROVED: t('initiatives.workReport.runStatus.approved', 'Approved'),
    PUBLISHED: t('initiatives.workReport.runStatus.published', 'Published'),
    FAILED: t('initiatives.workReport.runStatus.failed', 'Failed'),
    SUPERSEDED: t('initiatives.workReport.runStatus.superseded', 'Superseded'),
  };
  return map[key] ?? humanizeWorkReportCode(raw);
};

export const workReportRunStatusTone = (raw: string): WorkReportTone =>
  RUN_STATUS_TONE[String(raw ?? '').trim().toUpperCase()] ?? 'neutral';

export const workReportCadenceLabel = (t: TFunction, raw: string): string => {
  const key = String(raw ?? '').trim().toUpperCase();
  const map: Record<string, string> = {
    ON_DEMAND: t('initiatives.workReport.cadence.onDemand', 'On demand'),
    WEEKLY: t('initiatives.workReport.cadence.weekly', 'Weekly'),
    MONTHLY: t('initiatives.workReport.cadence.monthly', 'Monthly'),
  };
  return map[key] ?? humanizeWorkReportCode(raw);
};

export const workReportRecipientStatusLabel = (t: TFunction, raw: string): string => {
  const key = String(raw ?? '').trim().toUpperCase();
  const map: Record<string, string> = {
    PENDING: t('initiatives.workReport.deliveryStatus.pending', 'Pending'),
    SENDING: t('initiatives.workReport.deliveryStatus.sending', 'Sending'),
    DELIVERED: t('initiatives.workReport.deliveryStatus.delivered', 'Delivered'),
    FAILED: t('initiatives.workReport.deliveryStatus.failed', 'Failed'),
  };
  return map[key] ?? humanizeWorkReportCode(raw);
};

export const workReportRecipientStatusTone = (raw: string): WorkReportTone =>
  RECIPIENT_STATUS_TONE[String(raw ?? '').trim().toUpperCase()] ?? 'neutral';

export const workReportTemplateLabel = (t: TFunction, raw: string): string => {
  const key = String(raw ?? '').trim().toUpperCase();
  const map: Record<string, string> = {
    EXECUTIVE_SUMMARY: t('initiatives.workReport.templates.executive', 'Executive summary'),
    PORTFOLIO_STATUS: t('initiatives.workReport.templates.portfolio', 'Portfolio status'),
    DECISION_BACKLOG: t('initiatives.workReport.templates.decisions', 'Decision backlog'),
    DELIVERY_RISKS: t('initiatives.workReport.templates.risks', 'Delivery risks'),
    WEEKLY_TEAM_UPDATE: t('initiatives.workReport.templates.weekly', 'Weekly team update'),
  };
  return map[key] ?? humanizeWorkReportCode(raw);
};

/**
 * Spłaszczenie `deliveryAttempts` przebiegu do JEDNEGO wiersza na adresata —
 * najnowsza próba wygrywa. Silnik trzyma listę prób (`receiptId` → adresaci),
 * a recenzent chce widzieć „kto dostał, kto nie i dlaczego", nie historię
 * kopert. Dane są już w odpowiedzi `GET /report-runs` (reader zwraca cały
 * `payload_json`), więc ta funkcja NIE potrzebuje zmian po stronie serwera.
 */
export interface WorkReportDelivery {
  address: string;
  status: WorkReportRecipientStatus | string;
  lastAttemptAt: string | null;
  lastError: string | null;
  attempts: number;
}

export const flattenWorkReportDeliveries = (run: any): WorkReportDelivery[] => {
  const attempts: any[] = Array.isArray(run?.deliveryAttempts) ? run.deliveryAttempts : [];
  const byAddress = new Map<string, WorkReportDelivery>();
  for (const attempt of attempts) {
    for (const recipient of Array.isArray(attempt?.recipients) ? attempt.recipients : []) {
      const address = String(recipient?.address ?? '').trim();
      if (!address) continue;
      const next: WorkReportDelivery = {
        address,
        status: String(recipient?.status ?? 'PENDING'),
        lastAttemptAt: recipient?.lastAttemptAt ? String(recipient.lastAttemptAt) : null,
        lastError: recipient?.lastError ? String(recipient.lastError) : null,
        attempts: Number(recipient?.attempts ?? 0),
      };
      const previous = byAddress.get(address);
      /* Najnowsza próba wygrywa; przy braku znacznika czasu wygrywa późniejszy
         wpis w tablicy (silnik dopisuje próby na koniec). */
      if (
        !previous ||
        !previous.lastAttemptAt ||
        (next.lastAttemptAt && next.lastAttemptAt >= previous.lastAttemptAt)
      ) {
        byAddress.set(address, next);
      }
    }
  }
  /* Adresaci z zamrożonej listy (`audience`), do których jeszcze nie poszła
     ŻADNA próba — inaczej „Wyślij" wyglądałoby jak akcja bez adresatów. */
  for (const raw of Array.isArray(run?.audience) ? run.audience : []) {
    const address = String(raw ?? '').trim();
    if (address && !byAddress.has(address)) {
      byAddress.set(address, {
        address,
        status: 'PENDING',
        lastAttemptAt: null,
        lastError: null,
        attempts: 0,
      });
    }
  }
  return [...byAddress.values()];
};

/** Ilu adresatów zakończyło się błędem — sterowanie akcją „Ponów wysyłkę". */
export const failedWorkReportDeliveryCount = (deliveries: WorkReportDelivery[]): number =>
  deliveries.filter((item) => String(item.status).toUpperCase() === 'FAILED').length;
