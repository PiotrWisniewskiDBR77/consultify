import React from 'react';
import { CheckCircle2, CircleHelp, Clock3, ShieldAlert, TriangleAlert } from 'lucide-react';

type Level = 0 | 1 | 2 | 3 | 'UNKNOWN';

const tone: Record<Level, string> = {
  0: 'border-c-success/30 bg-c-success/10 text-c-success',
  1: 'border-c-warning/30 bg-c-warning/10 text-c-warning',
  2: 'border-c-warning/50 bg-c-warning/15 text-c-warning',
  3: 'border-c-danger/40 bg-c-danger/10 text-c-danger',
  UNKNOWN: 'border-c-border-subtle bg-c-surface-muted text-c-text-muted',
};

const Icon = ({ level }: { level: Level }) =>
  level === 0 ? (
    <CheckCircle2 size={16} />
  ) : level === 1 ? (
    <Clock3 size={16} />
  ) : level === 2 ? (
    <TriangleAlert size={16} />
  ) : level === 3 ? (
    <ShieldAlert size={16} />
  ) : (
    <CircleHelp size={16} />
  );

const axes = [
  {
    name: 'Poślizg wobec planu',
    level: 1 as Level,
    verdict: 'Obserwuj',
    value: '+3 dni robocze',
    detail: 'W granicy tolerancji projektu: 5 dni roboczych.',
  },
  {
    name: 'Zagrożenie terminu',
    level: 2 as Level,
    verdict: 'Działanie',
    value: '+11 dni prognozy',
    detail: 'Próg projektu: 7 dni, czyli większe z 5 dni i 5% czasu trwania.',
  },
  {
    name: 'Ekspozycja RAID',
    level: 'UNKNOWN' as Level,
    verdict: 'Brak danych',
    value: 'Nie zmierzono',
    detail: 'Brakuje prawdopodobieństwa dla ryzyka R-17.',
  },
];

const Aggregate = () => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone[2]}`}
  >
    <TriangleAlert size={14} /> Poziom 2 · 2/3 osie
  </span>
);

const AxisCard = ({ axis }: { axis: (typeof axes)[number] }) => (
  <article className={`min-w-0 rounded-xl border p-4 ${tone[axis.level]}`}>
    <div className="flex items-start justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
        <Icon level={axis.level} /> {axis.name}
      </span>
      <span className="whitespace-nowrap text-xs font-semibold">
        {axis.level === 'UNKNOWN' ? '—' : `Poziom ${axis.level}`}
      </span>
    </div>
    <p className="mt-4 text-lg font-semibold text-c-text-primary">{axis.value}</p>
    <p className="mt-1 text-xs font-medium">{axis.verdict}</p>
    <p className="mt-3 text-xs leading-5 text-c-text-secondary">{axis.detail}</p>
    <p className="mt-3 text-[11px] text-c-text-muted">Pomiar: 13.09.2026, 15:30</p>
  </article>
);

const VariantA = () => (
  <section className="rounded-2xl border border-c-border-subtle bg-c-surface shadow-sm">
    <header className="flex items-center justify-between border-b border-c-border-subtle px-5 py-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
          Wariant A · rekomendowany
        </p>
        <h2 className="mt-1 text-base font-semibold text-c-text-primary">
          Trzy osie w jednym wierszu
        </h2>
      </div>
      <Aggregate />
    </header>
    <div className="grid grid-cols-3 gap-3 p-5">
      {axes.map((axis) => (
        <AxisCard key={axis.name} axis={axis} />
      ))}
    </div>
  </section>
);

const VariantB = () => (
  <section className="rounded-2xl border border-c-border-subtle bg-c-surface p-5">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
          Wariant B · audyt
        </p>
        <h2 className="mt-1 text-base font-semibold text-c-text-primary">Pionowy ślad dowodowy</h2>
      </div>
      <Aggregate />
    </div>
    <div className="mt-4 space-y-2">
      {axes.map((axis) => (
        <div
          key={axis.name}
          className="grid grid-cols-[24px_1.2fr_.7fr_2fr] items-center gap-3 rounded-lg border border-c-border-subtle px-3 py-2.5 text-xs"
        >
          <span
            className={
              axis.level === 'UNKNOWN' ? 'text-c-text-muted' : tone[axis.level].split(' ').at(-1)
            }
          >
            <Icon level={axis.level} />
          </span>
          <strong className="text-c-text-primary">{axis.name}</strong>
          <span className="text-c-text-secondary">{axis.value}</span>
          <span className="text-c-text-muted">{axis.detail}</span>
        </div>
      ))}
    </div>
  </section>
);

const VariantC = () => (
  <section className="rounded-2xl border border-c-border-subtle bg-c-surface p-5">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
          Wariant C · legenda
        </p>
        <h2 className="mt-1 text-base font-semibold text-c-text-primary">Macierz 3 × 4</h2>
      </div>
      <span className="text-xs text-c-text-muted">
        Szary tylko, gdy wszystkie osie są bez danych
      </span>
    </div>
    <div className="mt-4 grid grid-cols-[1.5fr_repeat(4,1fr)_1.2fr] gap-2 text-center text-xs">
      <span />
      {['0 · W normie', '1 · Obserwuj', '2 · Działanie', '3 · Komitet'].map((label) => (
        <strong key={label} className="py-2 text-c-text-secondary">
          {label}
        </strong>
      ))}
      <strong className="py-2 text-c-text-secondary">Brak danych</strong>
      {axes.map((axis) => (
        <React.Fragment key={axis.name}>
          <strong className="flex items-center text-left text-c-text-primary">{axis.name}</strong>
          {[0, 1, 2, 3, 'UNKNOWN'].map((level) => (
            <span
              key={String(level)}
              className={`rounded-lg border py-2.5 ${axis.level === level ? tone[level as Level] + ' font-semibold ring-2 ring-c-focus/40' : 'border-c-border-subtle text-c-text-muted'}`}
            >
              {axis.level === level ? 'Wybrano' : '—'}
            </span>
          ))}
        </React.Fragment>
      ))}
    </div>
  </section>
);

const ExecutionRiskSignalE0Screen: React.FC = () => (
  <main className="min-h-screen bg-c-bg p-6 text-c-text-primary">
    <div className="mx-auto max-w-[1360px]">
      <header className="mb-5 flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-c-text-muted">
            Realizacja · E0 · prototyp do akceptu
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Sygnalizacja ryzyka realizacji</h1>
          <p className="mt-2 max-w-3xl text-sm text-c-text-secondary">
            Trzy niezależne osie, cztery poziomy i jawny brak danych. Zgodność z niedostępnym
            artefaktem CTO 8c073b0a pozostaje EVIDENCE_MISSING.
          </p>
        </div>
        <span className="rounded-full border border-c-border-subtle bg-c-surface-muted px-3 py-1.5 text-xs text-c-text-secondary">
          Kod produkcyjny: zablokowany do akceptu
        </span>
      </header>
      <div className="space-y-4">
        <VariantA />
        <div className="grid grid-cols-2 gap-4">
          <VariantB />
          <VariantC />
        </div>
      </div>
    </div>
  </main>
);

export default ExecutionRiskSignalE0Screen;
