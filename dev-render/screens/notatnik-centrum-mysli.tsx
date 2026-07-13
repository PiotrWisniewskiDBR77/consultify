/**
 * Dev-render host: NOTATNIK JAKO „CENTRUM MYŚLI" (#16 / #21 / #23).
 *
 * Story pokazuje WIZJĘ nadbudowaną na działającym rdzeniu notatnika, w układzie
 * D17 (Teresa zawsze po PRAWEJ, artefakt po LEWEJ):
 *
 *  #16  Teresa PROAKTYWNIE proponuje notatkę z rozmowy — karta propozycji
 *       („Zapisałam kluczowe ustalenia jako notatkę", approve/reject/execute).
 *       Nieautonomiczne (D4): Teresa PROPONUJE, człowiek zatwierdza.
 *  #21  Sekretarz „zapamiętaj / przypomnij mi …" → notatka z TERMINEM.
 *       Karta propozycji pokazuje linię „Przypomnienie: jutro · 14.07.2026",
 *       a gotowa notatka po lewej ma chip przypomnienia (dzwonek + termin).
 *  #23  Współobecność (presence P/T/O) — awatary osób oglądających notatkę
 *       (mock wzorowany na table CollaborationPresence, paleta c-tag-*).
 *
 * TREŚĆ mockowana (realne panele ciągną store/API/logowanie), ale POWŁOKA i
 * tokeny c-* (light+dark), focus=c-focus, ZERO crimson — 1:1 z kanonem.
 * Backend #21 (teresaReminderExtraction + handleNotebookHandoff→createNote) jest
 * realny; ta story odwzorowuje jego efekt wizualny do odbioru Piotra.
 */
import {
  Bell,
  Check,
  FileText,
  Link2,
  Play,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import React from 'react';

// ── presence: awatary współobecnych (mock #23) ─────────────────────────────
type Presence = { initials: string; name: string; tag: number };

function PresenceStack({ users, isPl }: { users: Presence[]; isPl: boolean }): React.ReactElement {
  return (
    <div
      className="flex items-center gap-2"
      aria-label={isPl ? 'Osoby oglądające notatkę' : 'People viewing the note'}
    >
      <div className="flex -space-x-2">
        {users.map((u) => (
          <span
            key={u.initials}
            title={u.name}
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-c-surface text-[10px] font-semibold text-white"
            style={{ background: `var(--c-tag-${u.tag})` }}
          >
            {u.initials}
          </span>
        ))}
      </div>
      <span className="text-[11px] text-c-text-muted">
        {isPl ? `${users.length} osoby tu teraz` : `${users.length} viewing now`}
      </span>
    </div>
  );
}

// ── reminder chip (#21) ────────────────────────────────────────────────────
function ReminderChip({ label }: { label: string }): React.ReactElement {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-c-warning px-2.5 py-1 text-[12px] font-medium text-c-warning"
      style={{ background: 'rgba(var(--c-warning-rgb), 0.10)' }}
    >
      <Bell size={13} strokeWidth={2} />
      {label}
    </span>
  );
}

// ── LEWA: Notatnik = artefakt „centrum myśli" ──────────────────────────────
function NotebookArtifactMock({ isPl }: { isPl: boolean }): React.ReactElement {
  const presence: Presence[] = [
    { initials: 'PW', name: 'Piotr W. (właściciel)', tag: 1 },
    { initials: 'T', name: 'Teresa (asystent)', tag: 4 },
    { initials: 'MK', name: 'Maria K.', tag: 6 },
  ];
  return (
    <div className="flex h-full flex-col bg-c-surface">
      {/* pasek artefaktu + presence */}
      <div className="flex h-[42px] items-center gap-2 border-b border-c-border-subtle bg-c-surface/50 px-4 backdrop-blur-sm">
        <FileText size={15} className="text-c-text-muted" />
        <span className="truncate text-sm font-semibold text-c-text">
          {isPl ? 'Ustalenia z rozmowy — wejście na rynek DE' : 'Chat findings — DE market entry'}
        </span>
        <div className="ml-auto">
          <PresenceStack users={presence} isPl={isPl} />
        </div>
      </div>

      {/* treść notatki */}
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-[560px]">
          {/* meta: proweniencja + reminder */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-c-border-subtle bg-c-surface-raised px-2.5 py-1 text-[12px] text-c-text-muted">
              <Sparkles size={13} className="text-c-info" />
              {isPl ? 'Utworzone przez Teresę z rozmowy' : 'Created by Teresa from chat'}
            </span>
            <ReminderChip label={isPl ? 'Przypomnienie: jutro · 14.07 · 09:00' : 'Reminder: tomorrow · Jul 14 · 09:00'} />
          </div>

          <h1 className="mb-3 text-xl font-bold text-c-text">
            {isPl ? 'Kluczowe ustalenia' : 'Key decisions'}
          </h1>
          <ul className="flex flex-col gap-2">
            {(isPl
              ? [
                  'Wariant B (partner dystrybucyjny) wybrany jako ścieżka wejścia.',
                  'TAM DE = 3,2× rynek krajowy — potwierdzone w 4 z 6 wywiadów.',
                  'Do zweryfikowania: bariery regulacyjne DE (termin: piątek).',
                ]
              : [
                  'Variant B (distribution partner) chosen as the entry path.',
                  'DE TAM = 3.2× home market — confirmed in 4 of 6 interviews.',
                  'To verify: DE regulatory barriers (due: Friday).',
                ]
            ).map((t, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-c-surface text-[10px] font-semibold text-c-text-muted">
                  {i + 1}
                </span>
                <p className="text-sm leading-snug text-c-text-secondary">{t}</p>
              </li>
            ))}
          </ul>

          {/* backlink — rdzeń notatnika działa */}
          <div className="mt-5 flex items-center gap-2 text-[12px] text-c-text-muted">
            <Link2 size={13} />
            {isPl ? 'Powiązane:' : 'Linked:'}
            <span className="rounded border border-c-border-subtle bg-c-surface-raised px-1.5 py-0.5 text-c-text-secondary">
              [[Strategia DE]]
            </span>
            <span className="rounded border border-c-border-subtle bg-c-surface-raised px-1.5 py-0.5 text-c-text-secondary">
              [[Wywiady Q3]]
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── karta propozycji Teresy (mock 1:1 z TeresaProposalCard) ────────────────
function ProposalCard({
  title,
  lines,
  isPl,
}: {
  title: string;
  lines: string[];
  isPl: boolean;
}): React.ReactElement {
  return (
    <div className="rounded-2xl border border-c-border bg-c-surface-raised p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
          style={{
            borderColor: 'rgba(var(--c-warning-rgb), 0.35)',
            background: 'rgba(var(--c-warning-rgb), 0.10)',
            color: 'var(--c-warning)',
          }}
        >
          <Sparkles size={11} />
          {isPl ? 'Propozycja Teresy' : 'Teresa proposal'}
        </span>
        <span className="ml-auto text-[11px] text-c-text-muted">
          {isPl ? 'Notatnik' : 'Notebook'}
        </span>
      </div>
      <p className="mb-1 text-sm font-semibold text-c-text">{title}</p>
      <ul className="mb-3 flex flex-col gap-1">
        {lines.map((l, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[12px] leading-snug text-c-text-secondary">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-c-text-muted" />
            {l}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          style={{ background: 'var(--c-success)' }}
        >
          <Check size={13} /> {isPl ? 'Zatwierdź' : 'Approve'}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-c-border px-3 py-1.5 text-[12px] font-medium text-c-text-secondary hover:bg-c-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <Play size={13} /> {isPl ? 'Wykonaj' : 'Execute'}
        </button>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-c-text-muted hover:bg-c-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <X size={13} /> {isPl ? 'Odrzuć' : 'Reject'}
        </button>
      </div>
    </div>
  );
}

// ── PRAWA: rozmowa z Teresą ────────────────────────────────────────────────
function TeresaChatMock({ isPl }: { isPl: boolean }): React.ReactElement {
  return (
    <div className="flex h-full flex-col border-l border-c-border-subtle bg-c-bg">
      <div className="flex h-[42px] items-center gap-2 border-b border-c-border-subtle px-4">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-c-info text-white">
          <Sparkles size={13} />
        </span>
        <span className="text-sm font-semibold text-c-text">Teresa</span>
        <span className="ml-auto text-[11px] text-c-text-muted">
          {isPl ? 'Asystent-sekretarz' : 'Assistant-secretary'}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {/* wiadomość użytkownika (#16 kontekst) */}
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-c-surface-raised px-3 py-2 text-sm text-c-text-secondary">
            {isPl
              ? 'Podsumujmy: wchodzimy w wariant B, TAM 3,2×, do sprawdzenia regulacje.'
              : "Let's summarize: we go with variant B, TAM 3.2×, regulations to check."}
          </div>
        </div>

        {/* #16: proaktywna propozycja notatki z rozmowy */}
        <div className="flex items-start gap-2">
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-c-info text-white">
            <Sparkles size={13} />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm leading-relaxed text-c-text-secondary">
              {isPl
                ? 'Zapisałam kluczowe ustalenia z tej rozmowy jako notatkę w Twoim Notatniku — sprawdź i zatwierdź:'
                : 'I saved the key decisions from this chat as a note in your Notebook — review and approve:'}
            </p>
            <ProposalCard
              isPl={isPl}
              title={isPl ? 'Notatka: Ustalenia z rozmowy — wejście na rynek DE' : 'Note: Chat findings — DE market entry'}
              lines={
                isPl
                  ? ['Wariant B wybrany jako ścieżka wejścia', 'TAM DE = 3,2× rynek krajowy (4/6 wywiadów)']
                  : ['Variant B chosen as entry path', 'DE TAM = 3.2× home market (4/6 interviews)']
              }
            />
          </div>
        </div>

        {/* #21: „przypomnij mi …" */}
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-c-surface-raised px-3 py-2 text-sm text-c-text-secondary">
            {isPl
              ? 'Przypomnij mi jutro o telefonie do klienta w sprawie regulacji.'
              : 'Remind me tomorrow to call the client about regulations.'}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-c-info text-white">
            <Sparkles size={13} />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm leading-relaxed text-c-text-secondary">
              {isPl
                ? 'Jasne — zapiszę to jako notatkę z przypomnieniem na jutro:'
                : "Sure — I'll save it as a note with a reminder for tomorrow:"}
            </p>
            <ProposalCard
              isPl={isPl}
              title={isPl ? 'Notatka: Telefon do klienta — regulacje DE' : 'Note: Call client — DE regulations'}
              lines={
                isPl
                  ? ['Zadzwonić do klienta w sprawie barier regulacyjnych', 'Przypomnienie: jutro · 14.07.2026 · 09:00']
                  : ['Call the client about regulatory barriers', 'Reminder: tomorrow · Jul 14, 2026 · 09:00']
              }
            />
          </div>
        </div>
      </div>

      {/* composer */}
      <div className="border-t border-c-border-subtle p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-c-border bg-c-surface px-3 py-2 focus-within:ring-2 focus-within:ring-c-focus">
          <textarea
            rows={1}
            placeholder={isPl ? 'Napisz do Teresy… („zapamiętaj że…", „przypomnij mi…")' : 'Message Teresa…'}
            className="min-h-[24px] flex-1 resize-none bg-transparent text-sm text-c-text placeholder:text-c-text-muted focus:outline-none"
          />
          <button
            type="button"
            aria-label={isPl ? 'Wyślij' : 'Send'}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-c-text text-c-bg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <UserRound size={15} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotatnikCentrumMysliScreen(): React.ReactElement {
  const isPl =
    (document.documentElement.lang || 'pl').startsWith('pl') ||
    new URLSearchParams(window.location.search).get('lang') !== 'en';

  const rootStyle = { ['--work-canvas-width' as string]: '52%' } as React.CSSProperties;

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-c-bg" style={rootStyle}>
      {/* PRAWA w DOM, lg:order-2 → wizualnie po PRAWEJ: Teresa (D17) */}
      <div className="flex h-full min-w-0 flex-col lg:order-2 lg:w-[calc(100%_-_var(--work-canvas-width))]">
        <TeresaChatMock isPl={isPl} />
      </div>
      {/* aside notatki: lg:order-1 → wizualnie po LEWEJ */}
      <aside className="flex h-full w-full flex-col bg-c-bg lg:order-1 lg:w-[var(--work-canvas-width)]">
        <div className="min-h-0 flex-1">
          <NotebookArtifactMock isPl={isPl} />
        </div>
      </aside>
    </div>
  );
}
