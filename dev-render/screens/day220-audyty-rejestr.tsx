import React from 'react';

type View = 'processes' | 'reports' | 'findings';

const rows = {
  processes: {
    title: 'Sesje',
    columns: ['Nazwa', 'Pakiet', 'Etap', 'Postęp', 'Audytor wiodący'],
    values: ['Audyt zarządzania transformacją — przegląd właścicielski', 'Pakiet audytu transformacji — operacje wewnętrzne', 'Przegląd ustaleń', '1/1', 'Alicja Audytorka'],
  },
  reports: {
    title: 'Raporty',
    columns: ['Tytuł', 'Status', 'Język', 'Odbiorca', 'Poufność'],
    values: ['Audyt zarządzania transformacją — szkic raportu właścicielskiego', 'Szkic', 'EN', 'wewnętrzny przegląd właścicielski i komitet sterujący transformacją', 'wewnętrzny — dostęp ograniczony do zespołu właścicielskiego'],
  },
  findings: {
    title: 'Ustalenia',
    columns: ['Numer', 'Treść', 'Klasyfikacja', 'Kryterium / proces', 'Właściciel'],
    values: ['AUD-001', 'W trzech z dwunastu decyzji brakowało datowanego zapisu niezależnego przeglądu oraz wskazania odpowiedzialnego właściciela.', 'Niezgodność', 'TA.1 — Decyzje transformacyjne: dowód, właściciel i niezależny przegląd', 'Alicja Audytorka'],
  },
} satisfies Record<View, { title: string; columns: string[]; values: string[] }>;

export default function Day220AudytyRejestrScreen(): React.ReactElement {
  const requested = new URLSearchParams(window.location.search).get('view') as View | null;
  const view: View = requested && requested in rows ? requested : 'processes';
  const data = rows[view];

  return (
    <main className="min-h-screen bg-c-bg px-8 py-10 text-c-text">
      <section className="mx-auto max-w-[1440px]">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-c-text-muted">Audyty · przegląd właścicielski</p>
          <h1 className="mt-2 text-2xl font-semibold">{data.title}</h1>
          <p className="mt-2 text-sm text-c-text-secondary">Długie polskie wartości pozostają dostępne w całości; identyfikatory osób są rozwiązane do nazw.</p>
        </header>
        <nav className="mb-4 flex gap-2" aria-label="Ekrany Audytów">
          {(['processes', 'reports', 'findings'] as const).map((item) => (
            <span key={item} className={`rounded-lg border px-4 py-2 text-sm ${item === view ? 'border-c-focus bg-c-surface font-semibold text-c-text' : 'border-c-border bg-c-bg text-c-text-secondary'}`}>
              {rows[item].title}
            </span>
          ))}
        </nav>
        <div className="overflow-x-auto rounded-xl border border-c-border bg-c-surface shadow-sm">
          <table className="w-full table-fixed" style={{ minWidth: 1120 }}>
            <thead className="bg-c-bg-subtle">
              <tr>{data.columns.map((column) => <th key={column} className="border-b border-c-border px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">{column}</th>)}</tr>
            </thead>
            <tbody>
              <tr>{data.values.map((value, index) => <td key={data.columns[index]} className="align-top border-b border-c-border-subtle px-4 py-5 text-sm text-c-text"><span title={value} className="block whitespace-normal break-words leading-6">{value}</span></td>)}</tr>
            </tbody>
          </table>
        </div>
        <aside className="mt-5 rounded-xl border border-c-border bg-c-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-c-text-muted">Pełna wartość wybranego rekordu</p>
          <p className="mt-2 text-sm leading-6 text-c-text-secondary">{data.values.join(' · ')}</p>
        </aside>
      </section>
    </main>
  );
}
