/**
 * #24c — Public Booking Service (Calendly-like lead-gen).
 *
 * Publiczna, NIEZALOGOWANA rezerwacja spotkania z konsultantem. Liczy wolne
 * sloty na podstawie zsynchronizowanych wydarzeń w `v8_calendar_items`
 * (silnik sync P02, #24b) i zapisuje zgłoszenie do `public_booking_requests`
 * (migracja 930, NIE-AUTO-APPLY).
 *
 * Model dostępności (MVP, świadomie prosty):
 *   • godziny pracy 09:00–17:00 (UTC), sloty 60 min,
 *   • tylko dni robocze (pon–pt),
 *   • okno = najbliższe 14 dni,
 *   • slot ZAJĘTY, jeśli nachodzi na jakikolwiek `v8_calendar_item` konsultanta
 *     lub na istniejącą rezerwację (pending/confirmed),
 *   • przeszłe sloty odfiltrowane.
 *
 * Konsultant identyfikowany przez `organizations.slug` (fallback: id org).
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { getCalendarItems } from './calendarInteropService.js';

const LOG_PREFIX = '[#24c-PublicBooking]';

const WORK_START_HOUR = 9; // 09:00 UTC
const WORK_END_HOUR = 17; // 17:00 UTC (ostatni slot 16:00–17:00)
const SLOT_MINUTES = 60;
const WINDOW_DAYS = 14;
const DEFAULT_TZ = 'Europe/Warsaw';

export interface ConsultantRef {
  organizationId: string;
  displayName: string;
  slug: string;
}

export interface BookingSlot {
  startAt: string; // ISO
  endAt: string; // ISO
}

export interface AvailabilityDay {
  date: string; // YYYY-MM-DD
  slots: BookingSlot[];
}

export interface AvailabilityResult {
  consultant: { slug: string; displayName: string };
  timezone: string;
  slotMinutes: number;
  days: AvailabilityDay[];
}

interface BusyInterval {
  start: number; // epoch ms
  end: number; // epoch ms
}

/**
 * Rozwiązuje slug konsultanta → organizacja. Defensywnie: najpierw po
 * `organizations.slug`, a gdy kolumny brak/pusto — po `id`. Każde zapytanie
 * osobno, żeby błąd braku kolumny nie zabił fallbacku.
 */
export async function resolveConsultant(slug: string): Promise<ConsultantRef | null> {
  const clean = (slug || '').trim();
  if (!clean) return null;

  // 1. Po slug (kolumna może nie istnieć na niektórych bazach → fallback:true).
  try {
    const bySlug = await dbGet<Record<string, unknown>>(
      `SELECT id, name FROM organizations WHERE slug = ? AND COALESCE(is_active, 1) = 1 LIMIT 1`,
      [clean],
      { fallback: true }
    );
    if (bySlug?.id) {
      return {
        organizationId: String(bySlug.id),
        displayName: (bySlug.name as string) || clean,
        slug: clean,
      };
    }
  } catch {
    /* kolumna slug może nie istnieć — przechodzimy do fallbacku po id */
  }

  // 2. Fallback: slug == id organizacji.
  const byId = await dbGet<Record<string, unknown>>(
    `SELECT id, name FROM organizations WHERE id = ? AND COALESCE(is_active, 1) = 1 LIMIT 1`,
    [clean],
    { fallback: true }
  );
  if (byId?.id) {
    return {
      organizationId: String(byId.id),
      displayName: (byId.name as string) || clean,
      slug: clean,
    };
  }

  return null;
}

/** Zajęte przedziały z kalendarza konsultanta (nachodzące na okno). */
async function loadCalendarBusy(
  organizationId: string,
  windowStart: Date,
  windowEnd: Date
): Promise<BusyInterval[]> {
  // Fetch od (windowStart - 1 dzień) bez filtra endAt, żeby złapać też trwające
  // i null-end eventy; overlap liczymy w JS.
  const fetchFrom = new Date(windowStart.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const items = await getCalendarItems(organizationId, { startAt: fetchFrom });
  const busy: BusyInterval[] = [];
  for (const item of items) {
    if (item.syncState === 'stale') continue; // odwołane/nieaktualne
    const start = Date.parse(item.startAt);
    if (Number.isNaN(start)) continue;
    // Brak end → traktuj jako 60-min blok (typowe dla all-day/nieznanego).
    const end = item.endAt ? Date.parse(item.endAt) : start + SLOT_MINUTES * 60 * 1000;
    if (end <= windowStart.getTime() || start >= windowEnd.getTime()) continue;
    busy.push({ start, end: Number.isNaN(end) ? start + SLOT_MINUTES * 60 * 1000 : end });
  }
  return busy;
}

/** Zajęte przedziały z istniejących rezerwacji (tabela może nie istnieć). */
async function loadBookingBusy(
  slug: string,
  windowStart: Date,
  windowEnd: Date
): Promise<BusyInterval[]> {
  try {
    const rows = await dbAll<Record<string, unknown>>(
      `SELECT start_at, end_at FROM public_booking_requests
        WHERE consultant_slug = ?
          AND status IN ('pending', 'confirmed')
          AND start_at >= ? AND start_at < ?`,
      [slug, windowStart.toISOString(), windowEnd.toISOString()],
      { fallback: true }
    );
    const busy: BusyInterval[] = [];
    for (const r of rows || []) {
      const start = Date.parse(String(r.start_at));
      const end = Date.parse(String(r.end_at));
      if (Number.isNaN(start)) continue;
      busy.push({ start, end: Number.isNaN(end) ? start + SLOT_MINUTES * 60 * 1000 : end });
    }
    return busy;
  } catch {
    return [];
  }
}

function overlaps(slotStart: number, slotEnd: number, busy: BusyInterval[]): boolean {
  return busy.some((b) => slotStart < b.end && slotEnd > b.start);
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Liczy wolne sloty konsultanta w najbliższych 14 dniach.
 */
export async function getAvailability(slug: string): Promise<AvailabilityResult> {
  const consultant = await resolveConsultant(slug);
  if (!consultant) {
    const err = new Error('Consultant not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  const now = new Date();
  const windowStart = now;
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [calBusy, bookingBusy] = await Promise.all([
    loadCalendarBusy(consultant.organizationId, windowStart, windowEnd),
    loadBookingBusy(consultant.slug, windowStart, windowEnd),
  ]);
  const busy = [...calBusy, ...bookingBusy];

  const days: AvailabilityDay[] = [];
  for (let dayOffset = 0; dayOffset < WINDOW_DAYS; dayOffset++) {
    const base = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset)
    );
    const dow = base.getUTCDay();
    if (dow === 0 || dow === 6) continue; // weekend

    const slots: BookingSlot[] = [];
    for (let hour = WORK_START_HOUR; hour < WORK_END_HOUR; hour++) {
      const slotStart = new Date(base);
      slotStart.setUTCHours(hour, 0, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60 * 1000);
      if (slotStart.getTime() <= now.getTime()) continue; // przeszłość
      if (overlaps(slotStart.getTime(), slotEnd.getTime(), busy)) continue; // zajęte
      slots.push({ startAt: slotStart.toISOString(), endAt: slotEnd.toISOString() });
    }
    if (slots.length > 0) {
      days.push({ date: ymd(base), slots });
    }
  }

  return {
    consultant: { slug: consultant.slug, displayName: consultant.displayName },
    timezone: DEFAULT_TZ,
    slotMinutes: SLOT_MINUTES,
    days,
  };
}

export interface CreateBookingInput {
  slug: string;
  name: string;
  email: string;
  topic?: string;
  startAt: string; // ISO
  utm?: Record<string, unknown> | null;
}

export interface CreateBookingResult {
  bookingId: string;
  status: string;
  startAt: string;
  endAt: string;
  notifiedChannel: 'email' | 'stored';
  consultantName: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Tworzy rezerwację: waliduje slot względem żywej dostępności, zapisuje do
 * `public_booking_requests`, próbuje wysłać info mailem (jeśli silnik działa),
 * inaczej pozostawia zapis w tabeli.
 */
export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const name = (input.name || '').trim();
  const email = (input.email || '').trim().toLowerCase();
  const topic = (input.topic || '').trim() || null;

  if (!name) throw badRequest('Name is required');
  if (!EMAIL_RE.test(email)) throw badRequest('Valid email is required');
  const startMs = Date.parse(input.startAt);
  if (Number.isNaN(startMs)) throw badRequest('Invalid startAt');

  const consultant = await resolveConsultant(input.slug);
  if (!consultant) throw notFound('Consultant not found');

  // Waliduj slot względem aktualnej dostępności (anty-double-book / anty-fabrykacja).
  const availability = await getAvailability(input.slug);
  const match = availability.days
    .flatMap((d) => d.slots)
    .find((s) => Date.parse(s.startAt) === startMs);
  if (!match) throw conflict('Selected slot is no longer available');

  const bookingId = uuidv4();
  const nowIso = new Date().toISOString();
  const utmStr = input.utm ? JSON.stringify(input.utm) : null;

  // Najpierw próba wysyłki maila; kanał zapisujemy razem z rekordem.
  const notifiedChannel = await notifyConsultant(consultant, {
    name,
    email,
    topic,
    startAt: match.startAt,
    endAt: match.endAt,
  });

  await dbRun(
    `INSERT INTO public_booking_requests (
       id, organization_id, consultant_slug, requester_name, requester_email,
       topic, start_at, end_at, timezone, status, notified_channel, source_utm,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      bookingId,
      consultant.organizationId,
      consultant.slug,
      name,
      email,
      topic,
      match.startAt,
      match.endAt,
      DEFAULT_TZ,
      'pending',
      notifiedChannel,
      utmStr,
      nowIso,
      nowIso,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Booking ${bookingId} created for org ${consultant.organizationId} (${match.startAt}), channel=${notifiedChannel}`
  );

  return {
    bookingId,
    status: 'pending',
    startAt: match.startAt,
    endAt: match.endAt,
    notifiedChannel,
    consultantName: consultant.displayName,
  };
}

/**
 * Próbuje powiadomić konsultanta mailem. Zwraca kanał ('email' | 'stored').
 * Import silnika mailowego jest miękki — brak/wyłączony silnik → 'stored'.
 */
async function notifyConsultant(
  consultant: ConsultantRef,
  details: { name: string; email: string; topic: string | null; startAt: string; endAt: string }
): Promise<'email' | 'stored'> {
  try {
    const emailService = await import('../emailService.js');
    const subject = `Nowa rezerwacja spotkania — ${details.name}`;
    const html = `
      <p>Nowe zgłoszenie rezerwacji przez publiczny widget booking.</p>
      <ul>
        <li><strong>Konsultant/organizacja:</strong> ${escapeHtml(consultant.displayName)}</li>
        <li><strong>Osoba:</strong> ${escapeHtml(details.name)} (${escapeHtml(details.email)})</li>
        <li><strong>Temat:</strong> ${escapeHtml(details.topic || '—')}</li>
        <li><strong>Termin:</strong> ${escapeHtml(details.startAt)} → ${escapeHtml(details.endAt)} (${DEFAULT_TZ})</li>
      </ul>`;
    // Adres docelowy: fallback na env, bo publiczny konsultant nie ma tu maila.
    const to = process.env.PUBLIC_BOOKING_NOTIFY_EMAIL || '';
    if (!to) return 'stored';
    const ok = await emailService.send({ to, subject, html });
    return ok ? 'email' : 'stored';
  } catch (err) {
    logger.warn(`${LOG_PREFIX} Email notify skipped: ${(err as Error).message}`);
    return 'stored';
  }
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c
  );
}

function badRequest(msg: string): Error & { statusCode: number } {
  const e = new Error(msg) as Error & { statusCode: number };
  e.statusCode = 400;
  return e;
}
function notFound(msg: string): Error & { statusCode: number } {
  const e = new Error(msg) as Error & { statusCode: number };
  e.statusCode = 404;
  return e;
}
function conflict(msg: string): Error & { statusCode: number } {
  const e = new Error(msg) as Error & { statusCode: number };
  e.statusCode = 409;
  return e;
}
