/**
 * PublicBookingView (#24c)
 * Publiczny, NIEZALOGOWANY widget rezerwacji (Calendly-like). Osadzony pod
 * `/book/:consultantSlug`, poza layoutem apki. Pokazuje wolne sloty konsultanta
 * (z jego zsynchronizowanego kalendarza) i pozwala umówić spotkanie.
 *
 * Branding: reużywa tokeny c-* (spójne z Landing), light+dark. CTA „Zarezerwuj"
 * jest NEUTRALNE (bg-c-text / text-c-bg) — ZERO crimson na realnym przycisku
 * akcji (crimson = tylko semantyka krytyczna).
 */

import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE = '/api/public/booking';

interface Slot {
  startAt: string;
  endAt: string;
}
interface AvailabilityDay {
  date: string;
  slots: Slot[];
}
interface AvailabilityResponse {
  success: boolean;
  consultant: { slug: string; displayName: string };
  timezone: string;
  slotMinutes: number;
  days: AvailabilityDay[];
}

type ViewState = 'loading' | 'pick' | 'form' | 'submitting' | 'done' | 'error' | 'not_found';

interface PublicBookingViewProps {
  /** Wstrzykiwany slug (dev-render / test). W runtime brany z URL. */
  slugOverride?: string;
  /** Wstrzykiwane dane (dev-render). Pomija fetch. */
  mockData?: AvailabilityResponse;
}

function getSlugFromPath(): string {
  const m = window.location.pathname.match(/\/book\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

function fmtDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export function PublicBookingView({ slugOverride, mockData }: PublicBookingViewProps = {}): React.ReactElement {
  const slug = useMemo(() => slugOverride || getSlugFromPath(), [slugOverride]);

  const [state, setState] = useState<ViewState>(mockData ? 'pick' : 'loading');
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(mockData ?? null);
  const [activeDate, setActiveDate] = useState<string | null>(mockData?.days[0]?.date ?? null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ startAt: string; endAt: string; consultantName: string } | null>(null);

  const loadAvailability = useCallback(async () => {
    if (mockData) return;
    setState('loading');
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}/availability`);
      if (res.status === 404) {
        setState('not_found');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AvailabilityResponse = await res.json();
      setAvailability(data);
      setActiveDate(data.days[0]?.date ?? null);
      setState('pick');
    } catch {
      setState('error');
    }
  }, [slug, mockData]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  const activeDay = availability?.days.find((d) => d.date === activeDate) ?? null;

  const handlePickSlot = (slot: Slot) => {
    setSelectedSlot(slot);
    setState('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) return setFormError('Podaj imię i nazwisko.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setFormError('Podaj poprawny e-mail.');
    if (!selectedSlot) return setFormError('Wybierz termin.');

    if (mockData) {
      setConfirmed({ ...selectedSlot, consultantName: availability?.consultant.displayName ?? '' });
      setState('done');
      return;
    }

    setState('submitting');
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(slug)}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), topic: topic.trim(), startAt: selectedSlot.startAt }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setState('form');
        setFormError(data.error || 'Nie udało się zarezerwować. Spróbuj innego terminu.');
        return;
      }
      setConfirmed({ startAt: data.startAt, endAt: data.endAt, consultantName: data.consultantName });
      setState('done');
    } catch {
      setState('form');
      setFormError('Błąd sieci. Spróbuj ponownie.');
    }
  };

  const consultantName = availability?.consultant.displayName ?? slug;

  return (
    <div className="min-h-screen w-full bg-c-bg text-c-text">
      {/* Nagłówek brandingowy (spójny z Landing) */}
      <header className="border-b border-c-border bg-c-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-c-accent text-c-tag-foreground">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Consultify</div>
            <div className="text-xs text-c-text-muted">Umów spotkanie</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {state === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-24 text-c-text-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Ładowanie dostępnych terminów…</p>
          </div>
        )}

        {state === 'not_found' && (
          <div className="rounded-xl border border-c-border bg-c-surface p-8 text-center">
            <h1 className="text-lg font-semibold">Nie znaleziono konsultanta</h1>
            <p className="mt-2 text-sm text-c-text-muted">
              Link rezerwacji jest nieprawidłowy lub wygasł.
            </p>
          </div>
        )}

        {state === 'error' && (
          <div className="rounded-xl border border-c-border bg-c-surface p-8 text-center">
            <h1 className="text-lg font-semibold">Nie udało się wczytać terminów</h1>
            <button
              type="button"
              onClick={() => void loadAvailability()}
              className="mt-4 rounded-lg bg-c-text px-4 py-2 text-sm font-medium text-c-bg transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-c-focus"
            >
              Spróbuj ponownie
            </button>
          </div>
        )}

        {(state === 'pick' || state === 'form' || state === 'submitting') && availability && (
          <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
            {/* Lewa kolumna: kontekst + dni */}
            <section>
              <h1 className="text-xl font-semibold">Spotkanie z {consultantName}</h1>
              <p className="mt-1 text-sm text-c-text-muted">
                {availability.slotMinutes} min · strefa {availability.timezone}
              </p>

              <div className="mt-5">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-c-text-muted">
                  Wybierz dzień
                </div>
                {availability.days.length === 0 ? (
                  <p className="rounded-lg border border-c-border bg-c-surface p-4 text-sm text-c-text-muted">
                    Brak wolnych terminów w najbliższych 14 dniach.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {availability.days.map((d) => {
                      const isActive = d.date === activeDate;
                      return (
                        <button
                          key={d.date}
                          type="button"
                          onClick={() => {
                            setActiveDate(d.date);
                            setSelectedSlot(null);
                            setState('pick');
                          }}
                          className={[
                            'flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-c-focus',
                            isActive
                              ? 'border-c-focus bg-c-surface-raised font-medium'
                              : 'border-c-border bg-c-surface hover:border-c-border-strong',
                          ].join(' ')}
                        >
                          <span className="capitalize">{fmtDayLabel(d.date)}</span>
                          <span className="text-xs text-c-text-muted">{d.slots.length} wol.</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Prawa kolumna: sloty lub formularz */}
            <section className="rounded-xl border border-c-border bg-c-surface p-5">
              {state === 'pick' && (
                <>
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4 text-c-text-muted" />
                    {activeDay ? <span className="capitalize">{fmtDayLabel(activeDay.date)}</span> : 'Wybierz dzień'}
                  </div>
                  {activeDay ? (
                    <div className="grid grid-cols-3 gap-2">
                      {activeDay.slots.map((s) => (
                        <button
                          key={s.startAt}
                          type="button"
                          onClick={() => handlePickSlot(s)}
                          className="rounded-lg border border-c-border bg-c-bg px-2 py-2 text-sm font-medium transition hover:border-c-focus hover:bg-c-surface-raised focus:outline-none focus:ring-2 focus:ring-c-focus"
                        >
                          {fmtTime(s.startAt)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-c-text-muted">Wybierz dzień z listy po lewej.</p>
                  )}
                </>
              )}

              {(state === 'form' || state === 'submitting') && selectedSlot && (
                <form onSubmit={handleSubmit}>
                  <button
                    type="button"
                    onClick={() => setState('pick')}
                    className="mb-3 inline-flex items-center gap-1 text-xs text-c-text-muted hover:text-c-text focus:outline-none"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> zmień termin
                  </button>

                  <div className="mb-4 rounded-lg border border-c-border bg-c-surface-raised px-3 py-2 text-sm">
                    <span className="capitalize">{fmtDayLabel(activeDate!)}</span>, {fmtTime(selectedSlot.startAt)}–{fmtTime(selectedSlot.endAt)}
                  </div>

                  <label className="mb-3 block">
                    <span className="mb-1 block text-xs font-medium text-c-text-muted">Imię i nazwisko</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-c-border bg-c-bg px-3 py-2 text-sm outline-none focus:border-c-focus focus:ring-2 focus:ring-c-focus"
                      placeholder="Jan Kowalski"
                    />
                  </label>
                  <label className="mb-3 block">
                    <span className="mb-1 block text-xs font-medium text-c-text-muted">E-mail</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-c-border bg-c-bg px-3 py-2 text-sm outline-none focus:border-c-focus focus:ring-2 focus:ring-c-focus"
                      placeholder="jan@firma.pl"
                    />
                  </label>
                  <label className="mb-4 block">
                    <span className="mb-1 block text-xs font-medium text-c-text-muted">Temat (opcjonalnie)</span>
                    <textarea
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-c-border bg-c-bg px-3 py-2 text-sm outline-none focus:border-c-focus focus:ring-2 focus:ring-c-focus"
                      placeholder="Czego dotyczy spotkanie?"
                    />
                  </label>

                  {formError && (
                    <p className="mb-3 text-sm text-c-danger">{formError}</p>
                  )}

                  {/* CTA NEUTRALNY — zero crimson (bg-c-text/text-c-bg). */}
                  <button
                    type="submit"
                    disabled={state === 'submitting'}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-c-text px-4 py-2.5 text-sm font-semibold text-c-bg transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-c-focus disabled:opacity-60"
                  >
                    {state === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" />}
                    Zarezerwuj termin
                  </button>
                </form>
              )}
            </section>
          </div>
        )}

        {state === 'done' && confirmed && (
          <div className="mx-auto max-w-md rounded-xl border border-c-border bg-c-surface p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-c-success/15 text-c-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-lg font-semibold">Rezerwacja przyjęta</h1>
            <p className="mt-2 text-sm text-c-text-muted">
              Spotkanie z {confirmed.consultantName}:
            </p>
            <p className="mt-1 text-sm font-medium">
              <span className="capitalize">{fmtDayLabel(confirmed.startAt.slice(0, 10))}</span>, {fmtTime(confirmed.startAt)}–{fmtTime(confirmed.endAt)}
            </p>
            <p className="mt-4 text-xs text-c-text-muted">
              Wyślemy potwierdzenie na podany adres e-mail po akceptacji terminu.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default PublicBookingView;
