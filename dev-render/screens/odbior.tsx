/**
 * PANEL ODBIORU — jedna paczka dla WSZYSTKICH obszarów (2026-07-23).
 *
 * Spinacz: pozycje czytane wprost z `rejestr/3-DO-ODBIORU/*.md` (SSOT, do
 * którego pisze każdy z agentów) przez `/__odbior/pozycje`. Nowa pozycja w
 * rejestrze = nowa karta tutaj, bez dotykania tego pliku.
 *
 * Piotr KLIKA żywe ekrany, nie ogląda fotek: pozycja z polem `ekran:` we
 * frontmatterze osadza REALNY ekran harnessu w iframe (same-origin, więc
 * można w nim klikać i pisać). Pozycje bez `ekran:` (analizy, koncepty,
 * backend) dostają samą kartę z opisem — też do werdyktu.
 *
 * Werdykty lecą POST-em do `/__odbior/zapisz` → `rejestr/_odbior/…json`
 * (prosto do repo, bez pobierania plików). Kopia w localStorage, żeby
 * odświeżenie nic nie gubiło.
 *
 * URL: ?screen=odbior
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

const PARTIA = '2026-07-23';
const LS = `odbior:${PARTIA}`;

type Werdykt = 'akceptuje' | 'poprawka' | 'odrzucam' | null;

interface Pozycja {
  id: string;
  tytul: string;
  obszar: string;
  narzedzie?: string;
  flaga?: string;
  ekran?: string;
  query?: string;
  klik?: string;
  wysokosc?: number;
  zmiana?: string;
  patrz?: string;
  ryzyko?: string;
  plik?: string;
}

interface Stan {
  [id: string]: { werdykt: Werdykt; komentarz: string };
}

const ETYKIETY: [Werdykt, string][] = [
  ['akceptuje', 'Akceptuję'],
  ['poprawka', 'Poprawka'],
  ['odrzucam', 'Odrzucam'],
];

export default function OdbiorScreen(): React.ReactElement {
  const [pozycje, setPozycje] = useState<Pozycja[]>([]);
  const [stan, setStan] = useState<Stan>({});
  const [otwarte, setOtwarte] = useState<Record<string, boolean>>({});
  const [motyw, setMotyw] = useState<'light' | 'dark'>('light');
  const [filtr, setFiltr] = useState<string>('wszystkie');
  const [tylkoKlikalne, setTylkoKlikalne] = useState(false);
  const [status, setStatus] = useState('');
  const [zapisywanie, setZapisywanie] = useState(false);
  const [ladowanie, setLadowanie] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/__odbior/pozycje');
        const j = await r.json();
        setPozycje(j.pozycje || []);
      } catch {
        setStatus('Nie udało się wczytać pozycji z rejestru — czy harness działa z tego repo?');
      }
      let bazowy: Stan = {};
      try {
        const r2 = await fetch(`/__odbior/wczytaj?partia=${PARTIA}`);
        const j2 = await r2.json();
        (j2.pozycje || []).forEach((p: any) => {
          bazowy[p.id] = { werdykt: p.werdykt ?? null, komentarz: p.komentarz ?? '' };
        });
      } catch {
        /* brak zapisu = pusty stan */
      }
      try {
        const l = localStorage.getItem(LS);
        if (l) bazowy = { ...bazowy, ...JSON.parse(l) };
      } catch {
        /* ignore */
      }
      setStan(bazowy);
      setLadowanie(false);
    })();
  }, []);

  const ustaw = useCallback(
    (id: string, patch: Partial<{ werdykt: Werdykt; komentarz: string }>) => {
      setStan((prev) => {
        const next = { ...prev, [id]: { werdykt: null, komentarz: '', ...prev[id], ...patch } };
        try {
          localStorage.setItem(LS, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    []
  );

  const obszary = useMemo(() => {
    const m = new Map<string, number>();
    pozycje.forEach((p) => m.set(p.obszar, (m.get(p.obszar) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [pozycje]);

  const widoczne = useMemo(
    () =>
      pozycje.filter(
        (p) => (filtr === 'wszystkie' || p.obszar === filtr) && (!tylkoKlikalne || !!p.ekran)
      ),
    [pozycje, filtr, tylkoKlikalne]
  );

  const wypelnione = pozycje.filter((p) => stan[p.id]?.werdykt).length;

  const zapisz = async () => {
    setZapisywanie(true);
    setStatus('');
    const payload = {
      partia: PARTIA,
      pozycje: pozycje.map((p) => ({
        id: p.id,
        tytul: p.tytul,
        obszar: p.obszar,
        werdykt: stan[p.id]?.werdykt ?? null,
        komentarz: (stan[p.id]?.komentarz || '').trim() || null,
      })),
    };
    try {
      const r = await fetch('/__odbior/zapisz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      setStatus(
        j.ok
          ? `Zapisane do repo (${wypelnione}/${pozycje.length}). Powiedz „werdykty gotowe" — odczytam i wykonam.`
          : `Błąd zapisu: ${j.blad || 'nieznany'}.`
      );
    } catch {
      try {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        setStatus('Serwer nie odpowiedział — werdykty w schowku, wklej mi je w czacie.');
      } catch {
        setStatus('Nie udało się zapisać ani skopiować.');
      }
    } finally {
      setZapisywanie(false);
    }
  };

  const stylWerdykt = (w: Werdykt, wybrany: boolean) => {
    if (!wybrany) return 'border-c-border-subtle text-c-text-secondary hover:bg-state-hover';
    if (w === 'akceptuje') return 'border-c-success text-c-success bg-c-success/10';
    if (w === 'poprawka') return 'border-c-warning text-c-warning bg-c-warning/10';
    return 'border-c-danger text-c-danger bg-c-danger/10';
  };

  return (
    <div className="min-h-screen w-full bg-c-bg">
      <div className="mx-auto max-w-[1200px] px-6 py-8">
        <header className="mb-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-c-text-muted">
            Consultify · Paczka odbiorowa {PARTIA}
          </div>
          <h1 className="mt-2 text-2xl font-extrabold text-c-text">
            Odbiór — {pozycje.length} pozycji z {obszary.length} obszarów
          </h1>
          <p className="mt-2 max-w-4xl text-sm text-c-text-secondary">
            Pozycje czytane wprost z <code className="text-c-text">rejestr/3-DO-ODBIORU/</code> —
            każdy agent dopisuje swoje i pojawiają się tutaj. Gdzie da się kliknąć,{' '}
            <strong className="text-c-text">osadzam żywy ekran</strong> (nie zrzut) — możesz w nim
            pisać i klikać. Werdykty zapisują się prosto do repo.
          </p>
        </header>

        <div className="sticky top-0 z-20 mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-c-border-subtle bg-c-surface-raised px-4 py-3">
          <button
            type="button"
            onClick={zapisz}
            disabled={zapisywanie || ladowanie}
            className="rounded-lg border border-c-focus-solid bg-c-surface px-4 py-2 text-sm font-bold text-c-text hover:bg-state-hover disabled:opacity-50"
          >
            {zapisywanie ? 'Zapisuję…' : 'Zapisz werdykty'}
          </button>
          <span className="text-sm text-c-text-secondary">
            Wypełnione: <strong className="text-c-text">{wypelnione}</strong> z {pozycje.length}
          </span>
          <select
            value={filtr}
            onChange={(e) => setFiltr(e.target.value)}
            className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs text-c-text"
          >
            <option value="wszystkie">wszystkie obszary ({pozycje.length})</option>
            {obszary.map(([o, n]) => (
              <option key={o} value={o}>
                {o} ({n})
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 text-xs text-c-text-secondary">
            <input
              type="checkbox"
              checked={tylkoKlikalne}
              onChange={(e) => setTylkoKlikalne(e.target.checked)}
            />
            tylko klikalne
          </label>
          <label className="ml-auto inline-flex items-center gap-2 text-xs text-c-text-secondary">
            motyw ekranów:
            <select
              value={motyw}
              onChange={(e) => setMotyw(e.target.value as 'light' | 'dark')}
              className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs text-c-text"
            >
              <option value="light">jasny</option>
              <option value="dark">ciemny</option>
            </select>
          </label>
          {status && <span className="w-full text-xs text-c-text-secondary">{status}</span>}
        </div>

        {ladowanie && <div className="text-sm text-c-text-muted">Wczytuję pozycje z rejestru…</div>}

        {widoczne.map((p) => {
          const s = stan[p.id] || { werdykt: null, komentarz: '' };
          const url = p.ekran ? `/?screen=${p.ekran}&lang=pl&theme=${motyw}${p.query || ''}` : '';
          return (
            <section
              key={p.id}
              className="mb-5 overflow-hidden rounded-xl border border-c-border-subtle bg-c-surface"
            >
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-c-border-subtle bg-c-surface-raised px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-extrabold tracking-[0.1em] text-c-focus-solid">
                    {p.id} · {p.obszar}
                    {s.werdykt && (
                      <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] text-c-text-secondary">
                        {ETYKIETY.find(([w]) => w === s.werdykt)?.[1]}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 text-base font-bold text-c-text">{p.tytul}</h2>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {p.flaga && (
                    <span className="rounded-md border border-c-border-subtle px-2 py-1 text-[10px] text-c-text-muted">
                      {p.flaga}
                    </span>
                  )}
                  {!p.ekran && (
                    <span className="text-[10px] text-c-text-muted">
                      bez ekranu — ocena z opisu
                    </span>
                  )}
                </div>
              </header>

              <div
                className={`grid grid-cols-1 gap-4 p-4 ${p.ekran ? 'lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]' : ''}`}
              >
                {p.ekran && (
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOtwarte((o) => ({ ...o, [p.id]: !o[p.id] }))}
                        className="rounded-md border border-c-border-subtle bg-c-surface-raised px-3 py-1.5 text-xs font-semibold text-c-text hover:bg-state-hover"
                      >
                        {otwarte[p.id] ? 'Zwiń ekran' : '▶ Pokaż żywy ekran'}
                      </button>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-c-border-subtle px-3 py-1.5 text-xs text-c-text-secondary hover:bg-state-hover"
                      >
                        Otwórz osobno ↗
                      </a>
                      {p.klik && <span className="text-xs text-c-text-muted">{p.klik}</span>}
                    </div>
                    {otwarte[p.id] ? (
                      <iframe
                        title={p.id}
                        src={url}
                        className="w-full rounded-lg border border-c-border-subtle bg-c-surface"
                        style={{ height: p.wysokosc || 600 }}
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center rounded-lg border border-dashed border-c-border-subtle px-4 text-center text-xs text-c-text-muted"
                        style={{ height: 110 }}
                      >
                        Ekran ładuje się po kliknięciu — żeby panel nie mielił wszystkich naraz.
                      </div>
                    )}
                  </div>
                )}

                <div className="min-w-0">
                  {p.zmiana && (
                    <div className="mb-3">
                      <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-c-text-muted">
                        Co się zmieniło
                      </span>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-c-text-secondary">
                        {p.zmiana}
                      </p>
                    </div>
                  )}
                  {p.patrz && (
                    <div className="mb-3">
                      <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-c-text-muted">
                        Na co patrzeć
                      </span>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-c-text-secondary">
                        {p.patrz}
                      </p>
                    </div>
                  )}
                  {p.ryzyko && (
                    <div className="mb-3">
                      <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-c-text-muted">
                        Ryzyko / ograniczenia
                      </span>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-c-warning">
                        {p.ryzyko}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {ETYKIETY.map(([w, label]) => (
                      <button
                        key={String(w)}
                        type="button"
                        onClick={() => ustaw(p.id, { werdykt: s.werdykt === w ? null : w })}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${stylWerdykt(w, s.werdykt === w)}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={s.komentarz}
                    onChange={(e) => ustaw(p.id, { komentarz: e.target.value })}
                    rows={3}
                    placeholder={`Komentarz do ${p.id} — co poprawić, co przeszkadza…`}
                    className="mt-3 w-full rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs text-c-text focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
                  />
                  {p.plik && <div className="mt-1.5 text-[10px] text-c-text-muted">{p.plik}</div>}
                </div>
              </div>
            </section>
          );
        })}

        {!ladowanie && widoczne.length === 0 && (
          <div className="rounded-xl border border-dashed border-c-border-subtle p-8 text-center text-sm text-c-text-muted">
            Brak pozycji dla wybranego filtra.
          </div>
        )}

        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-xl border border-c-border-subtle bg-c-surface-raised px-4 py-3">
          <button
            type="button"
            onClick={zapisz}
            disabled={zapisywanie || ladowanie}
            className="rounded-lg border border-c-focus-solid bg-c-surface px-4 py-2 text-sm font-bold text-c-text hover:bg-state-hover disabled:opacity-50"
          >
            {zapisywanie ? 'Zapisuję…' : 'Zapisz werdykty'}
          </button>
          <span className="text-sm text-c-text-secondary">
            Wypełnione: <strong className="text-c-text">{wypelnione}</strong> z {pozycje.length}
          </span>
          {status && <span className="text-xs text-c-text-secondary">{status}</span>}
        </div>
      </div>
    </div>
  );
}
