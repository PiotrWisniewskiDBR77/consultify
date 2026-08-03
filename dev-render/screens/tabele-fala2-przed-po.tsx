/**
 * Render-verify fali „tabele 2026-07-28" — PRZED / PO, na REALNYCH komponentach.
 *
 * Reguła #7 z CLAUDE.md: Piotr nigdy nie jest pierwszym testerem wizualnym.
 * Ten ekran renderuje produkcyjne fasady (`StandardPreview`, `PriorityChip`,
 * `PriorityCell`) po naprawie i zestawia je z odtworzonym stanem SPRZED
 * naprawy, żeby akcept był porównaniem, a nie odkrywaniem.
 *
 * Kolumna PRZED jest odtworzeniem klas, które realnie stały w kodzie do
 * 2026-07-27 (skopiowane z historii plików) — nie stylizacją „na oko".
 */
import { Copy, Flag, Trash2, Zap } from 'lucide-react';
import React from 'react';

import { ArtifactPropertiesTable } from '../../src/components/standard/ArtifactPropertiesTable';
import { PriorityCell } from '../../src/components/standard/PriorityCell';
import { StandardPreview } from '../../src/components/standard/StandardPreview';
import { PriorityChip } from '../../src/components/ui/primitives/chips/PriorityChip';

const Sekcja: React.FC<{ tytul: string; opis: string; children: React.ReactNode }> = ({
  tytul,
  opis,
  children,
}) => (
  <section className="mb-10">
    <h2 className="mb-1 text-sm font-semibold text-c-text">{tytul}</h2>
    <p className="mb-4 max-w-3xl text-xs leading-relaxed text-c-text-muted">{opis}</p>
    {children}
  </section>
);

const Para: React.FC<{ przed: React.ReactNode; po: React.ReactNode }> = ({ przed, po }) => (
  <div className="grid grid-cols-2 gap-4">
    <div className="rounded-xl border border-c-border-subtle p-3">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
        Przed
      </div>
      {przed}
    </div>
    <div className="rounded-xl border border-c-border-subtle p-3">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
        Po
      </div>
      {po}
    </div>
  </div>
);

/* ── PRZED: pigułki priorytetu, dokładnie te klasy co w kodzie do 07-27 ── */

const StaraPigulkaDecisions: React.FC<{ poziom: 'CRITICAL' | 'MEDIUM' }> = ({ poziom }) => {
  const cfg =
    poziom === 'CRITICAL'
      ? { bg: 'bg-danger-500', text: 'text-white', icon: Zap, label: 'Critical', animate: true }
      : {
          bg: 'bg-amber-100 dark:bg-amber-900/30',
          text: 'text-amber-700 dark:text-amber-300',
          icon: Flag,
          label: 'Medium',
          animate: false,
        };
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.text} ${cfg.animate ? 'animate-pulse' : ''}`}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
};

const StaraPigulkaKanban: React.FC<{ etykieta: string; klasa: string; kropka: string }> = ({
  etykieta,
  klasa,
  kropka,
}) => (
  <span
    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${klasa}`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${kropka}`} />
    {etykieta}
  </span>
);

const StaraPigulkaChip: React.FC<{ etykieta: string }> = ({ etykieta }) => (
  <span className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200/60 bg-c-surface-raised px-2 py-0.5 text-[11px] font-medium leading-none text-c-text-secondary dark:border-white/[0.03]">
    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
    {etykieta}
  </span>
);

const Wiersz: React.FC<{ nazwa: string; children: React.ReactNode }> = ({ nazwa, children }) => (
  <div className="flex items-center gap-3 border-b border-c-border-subtle/60 py-2 last:border-b-0">
    <span className="w-40 shrink-0 truncate text-xs text-c-text-secondary">{nazwa}</span>
    {children}
  </div>
);

const noop = () => undefined;

export default function TabeleFala2PrzedPo() {
  return (
    <div className="min-h-screen bg-c-bg p-6 text-c-text">
      <header className="mb-8">
        <h1 className="text-base font-semibold">Fala tabel — 2026-07-28 · render-verify</h1>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-c-text-muted">
          Cztery naprawy z przeglądu 128 zrzutów. Prawa kolumna to realne komponenty produkcyjne po
          zmianie; lewa odtwarza stan sprzed naprawy.
        </p>
      </header>

      <Sekcja
        tytul="1 · Priorytet: kropka + tonowany tekst zamiast pigułki (N-24 / N-29)"
        opis="Kanon A4. Po lewej to, co stało w Decisions (biały tekst na pełnym czerwonym tle, z pulsowaniem) i na kartach kanbana (pigułka UPPERCASE z tłem i ramką). Po prawej wspólny PriorityCell — kolor niesie wyłącznie kropka."
      >
        <Para
          przed={
            <div>
              <Wiersz nazwa="Decisions — Critical">
                <StaraPigulkaDecisions poziom="CRITICAL" />
              </Wiersz>
              <Wiersz nazwa="Decisions — Medium">
                <StaraPigulkaDecisions poziom="MEDIUM" />
              </Wiersz>
              <Wiersz nazwa="Kanban Tasks — Critical">
                <StaraPigulkaKanban
                  etykieta="Critical"
                  klasa="bg-danger-500/15 text-danger-400 border border-danger-500/20"
                  kropka="bg-danger-500"
                />
              </Wiersz>
              <Wiersz nazwa="Kanban Tasks — High">
                <StaraPigulkaKanban
                  etykieta="High"
                  klasa="bg-amber-500/15 text-amber-400 border border-amber-500/20"
                  kropka="bg-amber-500"
                />
              </Wiersz>
              <Wiersz nazwa="Portfolio — MEDIUM">
                <StaraPigulkaChip etykieta="MEDIUM" />
              </Wiersz>
            </div>
          }
          po={
            <div>
              <Wiersz nazwa="Decisions — Critical">
                <PriorityCell value="CRITICAL" label="Critical" />
              </Wiersz>
              <Wiersz nazwa="Decisions — Medium">
                <PriorityCell value="MEDIUM" label="Medium" />
              </Wiersz>
              <Wiersz nazwa="Kanban Tasks — Critical">
                <PriorityCell value="critical" label="Critical" />
              </Wiersz>
              <Wiersz nazwa="Kanban Tasks — High">
                <PriorityCell value="high" label="High" />
              </Wiersz>
              <Wiersz nazwa="Portfolio — MEDIUM">
                <PriorityChip level="medium" label="MEDIUM" />
              </Wiersz>
            </div>
          }
        />
        <p className="mt-2 text-[11px] text-c-text-muted">
          Ostatni wiersz pokazuje przy okazji N-79: ekran podaje surowe „MEDIUM" z bazy, a chip
          normalizuje zapis do „Medium".
        </p>
      </Sekcja>

      <Sekcja
        tytul="2 · Delete zawsze na końcu stopki podglądu (PILNE-10 / N-83)"
        opis="Oba podglądy dostają akcje w TEJ SAMEJ, błędnej kolejności — Delete w rzędzie resolutions, Duplicate w rzędzie informational — czyli dokładnie tak, jak podaje je pięć ekranów Tools i Portfolio. Po lewej stara kolejność rzędów, po prawej realny StandardPreview po naprawie."
      >
        <Para
          przed={
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-danger-300/40 bg-danger-50 px-3 text-xs font-medium text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-slate-200/70 bg-white/70 px-3 text-xs font-medium text-slate-700 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-slate-200">
                  <Copy size={14} />
                  Duplicate
                </button>
              </div>
            </div>
          }
          po={
            <StandardPreview
              title="DRD Assessment — Jul 12, 2026"
              onClose={noop}
              details={{ content: 'Podgląd oceny gotowości cyfrowej.', wordCount: 7 }}
              actions={{
                resolutions: [
                  {
                    id: 'delete',
                    variant: 'destructive',
                    label: 'Delete',
                    icon: Trash2,
                    onClick: noop,
                  },
                ],
                informational: [
                  {
                    id: 'duplicate',
                    variant: 'neutral',
                    label: 'Duplicate',
                    icon: Copy,
                    onClick: noop,
                  },
                ],
              }}
            />
          }
        />
      </Sekcja>

      <Sekcja
        tytul="3 · Para Approve / Reject nie zmieniła się (kontrola regresji)"
        opis="Reject też jest destrukcyjny, więc reguła musiała go zostawić na miejscu — inaczej naprawa jednego ekranu zepsułaby Decisions, jedyny podgląd oceniony w przeglądzie jako wzorcowy."
      >
        <div className="max-w-md rounded-xl border border-c-border-subtle p-3">
          <StandardPreview
            title="Zatwierdzenie budżetu Q3"
            onClose={noop}
            details={{ content: 'Decyzja czeka na rozstrzygnięcie.', wordCount: 5 }}
            actions={{
              resolutions: [
                {
                  id: 'approve',
                  variant: 'positive',
                  label: 'Approve',
                  shortcut: 'A',
                  onClick: noop,
                },
                {
                  id: 'reject',
                  variant: 'destructive',
                  label: 'Reject',
                  shortcut: 'R',
                  onClick: noop,
                },
              ],
            }}
          />
        </div>
      </Sekcja>
      <Sekcja
        tytul="4 · Kebab wiersza bez atrap (P-17 / P-18)"
        opis={
          'Po lewej kebab Sejfu tak, jak wyglądał: trzy z czterech pozycji martwe, każda z bezużytecznym „Coming soon (backend)”. Po prawej ten sam kebab dziś — „jeszcze tego nie ma” znika, a blokada z POWODEM zostaje, bo uczy reguły produktu.'
        }
      >
        <Para
          przed={
            <div className="w-64 rounded-xl border border-c-border-subtle bg-c-surface-raised py-1 text-xs">
              <div className="px-3 py-1.5 text-c-text">Open preview</div>
              <div className="px-3 py-1.5 text-c-text-muted opacity-50">
                Edit <span className="text-[10px]">— Coming soon (backend)</span>
              </div>
              <div className="px-3 py-1.5 text-c-text-muted opacity-50">
                Archive <span className="text-[10px]">— Coming soon (backend)</span>
              </div>
              <div className="px-3 py-1.5 text-c-text-muted opacity-50">
                Delete <span className="text-[10px]">— Safes are automatic</span>
              </div>
            </div>
          }
          po={
            <div className="w-64 rounded-xl border border-c-border-subtle bg-c-surface-raised py-1 text-xs">
              <div className="px-3 py-1.5 text-c-text">Open preview</div>
              <div className="px-3 py-1.5 text-c-text-muted opacity-50">
                Delete{' '}
                <span className="text-[10px]">— Safes are automatic — cannot be deleted</span>
              </div>
            </div>
          }
        />
      </Sekcja>

      <Sekcja
        tytul="5 · Właściwości w tabeli klucz–wartość, nie w akapicie (N-52)"
        opis="Cztery podglądy wkładały właściwości encji w pole na prozę, sklejone przez join i z licznikiem słów nad nimi. Po prawej ten sam zestaw danych przez ArtifactPropertiesTable — komponent, który przegląd wskazał jako wzorzec w Tools → Reports."
      >
        <Para
          przed={
            <div className="rounded-xl border border-c-border-subtle p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                  Details
                </span>
                <span className="text-[10px] text-c-text-muted">~9 words</span>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-c-text">
                {'Answers: 0/6\n\nStarted: 30/04/2026\n\nLast activity: 30/04/2026'}
              </p>
            </div>
          }
          po={
            <div className="rounded-xl border border-c-border-subtle p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                Przebieg
              </div>
              <ArtifactPropertiesTable
                propertyLabel="Właściwość"
                valueLabel="Wartość"
                rows={[
                  { id: 'a', label: 'Odpowiedzi', value: '0/6', mono: true },
                  { id: 'b', label: 'Rozpoczęto', value: '30/04/2026', mono: true },
                  { id: 'c', label: 'Ostatnia aktywność', value: '30/04/2026', mono: true },
                ]}
              />
            </div>
          }
        />
      </Sekcja>

      <Sekcja
        tytul="6 · Stan końcowy mówi, że jest końcowy (Interview → Assigned)"
        opis="Podgląd zatwierdzonego przydziału był po prostu urwany — stopka znikała, bo przyciski renderowały się tylko dla trzech statusów roboczych. Pustka nie do odróżnienia od brakującej funkcji. Baner to wzorzec z Interview → Initiatives."
      >
        <Para
          przed={
            <div className="p-6 text-center text-xs text-c-text-muted">(nic — koniec panelu)</div>
          }
          po={
            <div className="rounded-token-md border-l-2 border-emerald-400/70 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-500/[0.08] dark:text-emerald-200">
              Zatwierdzone — przydział jest zamknięty i nie wymaga już działania.
            </div>
          }
        />
      </Sekcja>
    </div>
  );
}
