/**
 * PMO-1 (U-35) — MAKIETA (b): karta inicjatywy · panel „Stage transition".
 *
 * PO CO: właściciel (U-35) pyta o warstwę, której nie ma — „kto, jak, kiedy,
 * za co odpowiada". Dziś podgląd inicjatywy pokazuje wygaszone „Submit for
 * approval" bez powodu: nie widać ani warunków wejścia na kolejny etap, ani
 * osoby, która może przesunąć, ani terminu.
 *
 * CO TO JEST: makieta DESIGNU na REALNEJ powłoce Initiatives — ten sam
 * `StandardModuleBar` (Menu 1 breadcrumbs karty + Menu 2 sekcje + Menu 3
 * chipy), tokeny `c-*`, fokus `c-focus`, ZERO crimson. Nowy jest wyłącznie
 * panel „Stage transition": warunki ✓/✗ z dowodem, kto zatwierdza, termin
 * i JEDEN przycisk, który jest aktywny dopiero gdy wszystkie warunki są
 * spełnione, a gdy nie są — mówi CZEGO brakuje.
 *
 * CZEGO TU NIE MA: zero kodu produkcyjnego, zero backendu.
 *
 * URL: ?screen=pmo1-przejscie-etapu&lang=en&theme=light
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { StandardModuleBar } from '../../src/components/standard/StandardModuleBar';

type Warunek = {
  label: string;
  met: boolean;
  evidence: string;
};

const WARUNKI: Warunek[] = [
  { label: 'Problem and outcome stated', met: true, evidence: 'Definition · updated 14 Sep by E. Stone' },
  { label: 'Scope and options agreed', met: true, evidence: 'Definition · 3 options recorded' },
  { label: 'Success criteria with a measurable KPI', met: true, evidence: 'KPI: Warehouse cutover slippage (days)' },
  { label: 'Initiative owner named', met: false, evidence: 'No owner assigned — required to leave Defined' },
  { label: 'Value case attached (benefit and cost)', met: false, evidence: 'Not started' },
];

const Wiersz: React.FC<{ etykieta: string; wartosc: React.ReactNode }> = ({ etykieta, wartosc }) => (
  <div className="flex items-baseline gap-3 py-1.5">
    <span className="w-40 shrink-0 text-xs uppercase tracking-wide text-c-text-muted">{etykieta}</span>
    <span className="text-sm text-c-text">{wartosc}</span>
  </div>
);

export default function Pmo1PrzejscieEtapuScreen(): React.ReactElement {
  const spelnione = WARUNKI.filter((w) => w.met).length;
  const gotowe = spelnione === WARUNKI.length;

  return (
    <MemoryRouter>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }} className="bg-c-bg">
        <StandardModuleBar
          breadcrumbs={[
            { label: 'Initiatives', onClick: () => {} },
            { label: 'Resolve Warehouse Cutover Date Discrepancy' },
          ]}
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'analysis', label: 'Analysis' },
            { id: 'plan', label: 'Plan' },
            { id: 'decisions', label: 'Decisions' },
          ]}
          activeTab="overview"
          onTabChange={() => {}}
          chips={[
            { id: 'stage', label: 'Stage 2 of 12 · Defined' },
            { id: 'due', label: 'Gate due 18 Sep' },
            { id: 'owner', label: 'Owner not set' },
          ]}
          activeChip="stage"
          onChipChange={() => {}}
        />

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }} className="px-6 py-5">
          <div className="mx-auto flex w-full max-w-[1100px] gap-6">
            {/* Centrum karty — skrót rekordu, żeby panel nie wisiał w próżni. */}
            <section className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-c-text">
                Resolve Warehouse Cutover Date Discrepancy
              </h1>
              <p className="mt-2 max-w-[640px] text-sm leading-relaxed text-c-text-secondary">
                Two source systems hold different cutover dates for the Wakefield warehouse. The
                initiative aligns them before the Line 3 MES rollout depends on the earlier date.
              </p>
              <div className="mt-5 rounded-lg border border-c-border-subtle bg-c-surface p-4">
                <Wiersz etykieta="Source" wartosc="Idea workspace · session 12 Sep 2026" />
                <Wiersz etykieta="Project" wartosc="Northwind 2027 — Wave 1" />
                <Wiersz etykieta="Sponsor" wartosc="James Whitfield · Operations Director" />
                <Wiersz etykieta="PMO" wartosc="Irina Dubois" />
                <Wiersz
                  etykieta="Owner"
                  wartosc={
                    <span className="border-l-2 border-c-warning pl-2 text-c-text">
                      Not assigned
                    </span>
                  }
                />
                <Wiersz etykieta="Registered" wartosc="12 Sep 2026 · 3 days in this stage" />
              </div>
              {/* Log decyzji — ten sam panel, pod spodem. */}
              <div className="mt-4 rounded-lg border border-c-border-subtle bg-c-surface">
                <header className="border-b border-c-border-subtle px-4 py-3">
                  <h2 className="text-sm font-semibold text-c-text">Decision log</h2>
                </header>
                <ul className="divide-y divide-c-border-subtle">
                  {[
                    ['14 Sep · 11:20', 'E. Stone', 'Definition completed', '—'],
                    ['13 Sep · 09:05', 'I. Dubois', 'Sent back to Defined', 'Success criteria not measurable'],
                    ['12 Sep · 16:40', 'System', 'Registered from idea workspace', 'Candidate accepted'],
                  ].map(([kiedy, kto, co, komentarz]) => (
                    <li key={kiedy} className="px-4 py-2.5">
                      <p className="text-sm text-c-text">{co}</p>
                      <p className="text-xs text-c-text-muted">
                        {kto} · {kiedy}
                      </p>
                      {komentarz !== '—' ? (
                        <p className="mt-1 text-xs italic text-c-text-secondary">„{komentarz}"</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* ── NOWY PANEL: Stage transition ──────────────────────────── */}
            <aside className="w-[360px] shrink-0">
              <div className="rounded-lg border border-c-border bg-c-surface">
                <header className="border-b border-c-border-subtle px-4 py-3">
                  <h2 className="text-sm font-semibold text-c-text">Stage transition</h2>
                  <p className="mt-1 text-xs text-c-text-secondary">
                    2 · Defined → 3 · Analyzing
                  </p>
                </header>

                <div className="px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-c-text-muted">
                    Entry conditions · {spelnione} of {WARUNKI.length}
                  </p>
                  <ul className="mt-2 space-y-2.5">
                    {WARUNKI.map((w) => (
                      <li key={w.label} className="flex gap-2.5">
                        <span
                          aria-hidden
                          className={
                            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ' +
                            (w.met
                              ? 'border-l-2 border-c-success pl-1 text-c-text'
                              : 'bg-c-surface-subtle text-c-text-secondary')
                          }
                        >
                          {w.met ? '✓' : '✗'}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm leading-snug text-c-text">{w.label}</span>
                          <span className="block text-xs leading-snug text-c-text-muted">
                            {w.evidence}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-c-border-subtle px-4 py-3">
                  <Wiersz etykieta="Who moves it" wartosc="Initiative owner" />
                  <Wiersz etykieta="Who approves" wartosc="Irina Dubois · PMO" />
                  <Wiersz etykieta="Due" wartosc="18 Sep 2026 · in 3 days" />
                  <Wiersz etykieta="If overdue" wartosc="Escalates to sponsor after 5 days" />
                </div>

                <footer className="border-t border-c-border-subtle px-4 py-3">
                  <button
                    type="button"
                    disabled={!gotowe}
                    title={
                      gotowe
                        ? undefined
                        : 'Assign an owner and attach the value case to request analysis'
                    }
                    className={
                      'w-full rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ' +
                      (gotowe
                        ? 'bg-c-text text-c-surface hover:bg-c-text/90'
                        : 'cursor-not-allowed bg-c-surface-subtle text-c-text-secondary')
                    }
                  >
                    Request analysis
                  </button>
                  <p className="mt-2 text-xs leading-snug text-c-text-muted">
                    Blocked by 2 conditions: owner not assigned, value case missing.
                  </p>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-md border border-c-border px-3 py-2 text-sm text-c-text hover:bg-c-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    Send back with a comment
                  </button>
                </footer>
              </div>

            </aside>
          </div>
        </div>
      </div>
    </MemoryRouter>
  );
}
