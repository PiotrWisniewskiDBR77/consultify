/**
 * Notifications Validators
 * Zod schemas for notifications-related endpoints
 *
 * ★ 2026-07-23 — karta POWIADOMIENIE. Dwie trasy zapisu (`/checklist`,
 * `/worksheet`) przyjmowały wcześniej DOWOLNY kształt danych:
 *   • `/checklist` sprawdzało tylko `Array.isArray` — element mógł być czymkolwiek
 *     (liczbą, obiektem 5 MB, zagnieżdżoną strukturą), a listy nie miała limitu.
 *   • `/worksheet` nie miało walidacji w ogóle (tylko `String(...)`), a autozapis
 *     w karcie leci co 1,2 s ⇒ nieograniczony wzrost kolumny `notifications.data`.
 * Poniższe schematy zamykają oba wektory: kształt + twarde limity długości/liczby.
 */

import { z } from 'zod';

// ==========================================
// LIMITY (świadome, nie magiczne liczby)
// ==========================================

/** Maks. pozycji checklisty. Front generuje 3–6, tnie do 12 — 200 to sufit z zapasem. */
export const CHECKLIST_MAX_ITEMS = 200;
/** Maks. długość tekstu pojedynczej pozycji checklisty. */
export const CHECKLIST_ITEM_TEXT_MAX = 2000;
/** Maks. długość pojedynczego pola arkusza (opis / dlaczego ważne / co blokuje / akcja). */
export const WORKSHEET_FIELD_MAX = 20000;

// ==========================================
// REQUEST SCHEMAS
// ==========================================

/**
 * Pozycja checklisty powiadomienia.
 * `urgency` jest opcjonalne (front wysyła 'critical' | 'normal' | 'optional'),
 * ale nie zawężamy go enumem — rule-engine bywa źródłem innych etykiet, a
 * odrzucenie zapisu z tego powodu kosztowałoby użytkownika treść.
 */
export const NotificationChecklistItemSchema = z
  .object({
    id: z.string().min(1).max(200),
    text: z.string().max(CHECKLIST_ITEM_TEXT_MAX),
    // `.default(false)` zamiast twardego `required` — starsze wiersze mogą nie
    // mieć tego pola, a odrzucenie całego zapisu kosztowałoby użytkownika treść.
    // Wartość INNEGO typu niż boolean nadal daje 400 (o to w walidacji chodzi).
    completed: z.boolean().default(false),
    urgency: z.string().max(50).optional(),
  })
  .strip();

export const UpdateNotificationChecklistSchema = z.object({
  checklist: z.array(NotificationChecklistItemSchema).max(CHECKLIST_MAX_ITEMS),
});

/**
 * Draft arkusza powiadomienia. Każde pole opcjonalne (PATCH — front wysyła
 * tylko to, co się zmieniło), ale gdy jest, musi być stringiem w limicie.
 * `.strict()` — nieznane pole = 400, żeby nie wsypać śmieci do JSON-a `data`.
 */
export const UpdateNotificationWorksheetSchema = z
  .object({
    description: z.string().max(WORKSHEET_FIELD_MAX).optional(),
    whyImportant: z.string().max(WORKSHEET_FIELD_MAX).optional(),
    blocked: z.string().max(WORKSHEET_FIELD_MAX).optional(),
    expectedAction: z.string().max(WORKSHEET_FIELD_MAX).optional(),
  })
  .strict();

export type NotificationChecklistItem = z.infer<typeof NotificationChecklistItemSchema>;
export type UpdateNotificationWorksheetInput = z.infer<typeof UpdateNotificationWorksheetSchema>;
