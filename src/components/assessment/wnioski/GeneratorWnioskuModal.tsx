/**
 * Generator WNIOSKU z oceny (DEC-416) — anatomia 1:1 z jednym generatorem
 * inicjatyw (`src/components/Initiatives/Generator/GeneratorInicjatywModal.tsx`,
 * DEC-413): numerowane kroki na jednym ekranie, kafle „Źródło danych”, pola
 * wyboru, stopka Anuluj / akcja główna. Ten sam szkielet, inny produkt.
 *
 * Uczciwość powierzchni (ta sama zasada, co w generatorze inicjatyw: „rysowanie
 * pola, którego backend ignoruje, byłoby kłamstwem UI”): jest DOKŁADNIE jeden
 * kafel źródła, bo serwer ma dziś dokładnie jedną drogę do wniosku z oceny —
 * streszczenie wykonawcze raportu DRD przez most warstwy Wniosków. Nie ma tu
 * suwaka „liczba wniosków” ani wyboru metodologii, bo silnik ich nie przyjmuje.
 *
 * Zero `primary-*` (crimson), tokeny c-*, fokus `c-focus`.
 */
import { FileText, Loader2, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/utils/cn';

import {
  generujWniosekZRaportu,
  listaRaportowOceny,
  type RaportOceny,
  type WynikGeneracjiWniosku,
} from './wnioskiOcenyApi';

const POLE =
  'w-full h-11 px-4 rounded-xl border text-sm border-c-border bg-c-surface text-c-text ' +
  'focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid';

const PRZYCISK_WTORNY =
  'px-4 py-2 rounded-full border border-c-border text-c-text-secondary hover:bg-c-surface-hover ' +
  'text-sm font-medium transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

const PRZYCISK_GLOWNY =
  'px-4 py-2 rounded-full bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed text-white dark:text-navy-950 text-sm font-medium ' +
  'transition-colors inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

export interface GeneratorWnioskuModalProps {
  otwarty: boolean;
  onClose: () => void;
  /** Woływane po udanej generacji — lista Wniosków dociąga nowy wiersz. */
  onWygenerowano?: (wynik: WynikGeneracjiWniosku) => void;
  /** Otwarcie karty wniosku (`/conclusions?id=…`). */
  onOtworzWniosek?: (conclusionId: string) => void;
}

type Faza = 'config' | 'running' | 'done';

export const GeneratorWnioskuModal: React.FC<GeneratorWnioskuModalProps> = ({
  otwarty,
  onClose,
  onWygenerowano,
  onOtworzWniosek,
}) => {
  const { i18n } = useTranslation();
  const pl = !!i18n.language?.startsWith('pl');

  const [raporty, setRaporty] = useState<RaportOceny[]>([]);
  const [laduje, setLaduje] = useState(false);
  const [bladListy, setBladListy] = useState<string | null>(null);
  const [ocenaId, setOcenaId] = useState('');
  const [raportId, setRaportId] = useState('');
  const [faza, setFaza] = useState<Faza>('config');
  const [blad, setBlad] = useState<string | null>(null);
  const [wynik, setWynik] = useState<WynikGeneracjiWniosku | null>(null);

  useEffect(() => {
    if (!otwarty) return;
    setFaza('config');
    setBlad(null);
    setWynik(null);
    setLaduje(true);
    setBladListy(null);
    let anulowane = false;
    listaRaportowOceny()
      .then((items) => {
        if (anulowane) return;
        setRaporty(items);
      })
      .catch(() => {
        if (!anulowane) setBladListy(pl ? 'Nie udało się pobrać ocen.' : 'Failed to load assessments.');
      })
      .finally(() => {
        if (!anulowane) setLaduje(false);
      });
    return () => {
      anulowane = true;
    };
  }, [otwarty, pl]);

  /** Krok 2 — oceny, które MAJĄ raport (bez raportu silnik nie ma z czego zrobić wniosku). */
  const oceny = useMemo(() => {
    const mapa = new Map<string, { id: string; nazwa: string; typ: string | null }>();
    for (const r of raporty) {
      const id = r.assessmentId || '';
      if (!id || mapa.has(id)) continue;
      mapa.set(id, { id, nazwa: r.assessmentName || id, typ: r.assessmentType });
    }
    return Array.from(mapa.values());
  }, [raporty]);

  /** Krok 3 — raporty wybranej oceny. */
  const raportyOceny = useMemo(
    () => raporty.filter((r) => (r.assessmentId || '') === ocenaId),
    [raporty, ocenaId]
  );

  useEffect(() => {
    setRaportId(raportyOceny.length === 1 ? raportyOceny[0].id : '');
  }, [raportyOceny]);

  const mozeGenerowac = !!raportId && faza === 'config';

  const generuj = useCallback(async () => {
    if (!raportId) return;
    setFaza('running');
    setBlad(null);
    try {
      const res = await generujWniosekZRaportu(raportId);
      setWynik(res);
      setFaza('done');
      onWygenerowano?.(res);
    } catch (e: any) {
      setBlad(
        String(e?.message || '') ||
          (pl ? 'Nie udało się wygenerować wniosku.' : 'Failed to generate the conclusion.')
      );
      setFaza('config');
    }
  }, [raportId, onWygenerowano, pl]);

  if (!otwarty) return null;

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label={pl ? 'Zamknij' : 'Close'}
      />

      <div
        data-testid="generator-wniosku-modal"
        className={cn(
          'relative w-full max-w-2xl overflow-hidden rounded-2xl',
          'bg-c-surface border border-c-border-subtle shadow-2xl flex flex-col max-h-[80vh]'
        )}
      >
        <div className="px-5 py-4 border-b border-c-border-subtle flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-c-surface-subtle text-c-text-secondary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-c-text">
                {pl ? 'Nowy wniosek z oceny' : 'New conclusion from assessment'}
              </h2>
              <p className="text-sm text-c-text-muted">
                {faza === 'config'
                  ? pl
                    ? 'Wybierz źródło i uruchom generator'
                    : 'Pick a source and run the generator'
                  : faza === 'running'
                    ? pl
                      ? 'Trwa generowanie…'
                      : 'Generating…'
                    : pl
                      ? 'Gotowe'
                      : 'Done'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={pl ? 'Zamknij' : 'Close'}
            className="p-2 rounded-full hover:bg-c-surface-hover text-c-text-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-5">
          {faza === 'running' ? (
            <div className="py-10 flex flex-col items-center justify-center text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-c-border-subtle" />
                <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-navy-900 dark:border-slate-100 border-t-transparent animate-spin" />
                <Sparkles size={24} className="absolute inset-0 m-auto text-c-text-muted" />
              </div>
              <div className="mt-4 text-base font-semibold text-c-text">
                {pl ? 'Budowanie wniosku…' : 'Building the conclusion…'}
              </div>
              <div className="mt-1 text-sm text-c-text-muted">
                {pl
                  ? 'Silnik czyta ocenę i jej raport, potem zapisuje wniosek z dowodami.'
                  : 'The engine reads the assessment and its report, then stores the conclusion with evidence.'}
              </div>
            </div>
          ) : faza === 'done' && wynik ? (
            <div className="space-y-4" data-testid="generator-wniosku-wynik">
              <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-4">
                <div className="text-sm font-semibold text-c-text">
                  {pl ? 'Wniosek zapisany' : 'Conclusion saved'}
                </div>
                <div className="mt-1 text-sm text-c-text-secondary">{wynik.title}</div>
                <div className="mt-2 text-xs text-c-text-muted">
                  {pl ? 'Rodowód: ' : 'Lineage: '}
                  {wynik.sourceRefs.map((r) => `${r.type}:${r.id}`).join(' · ')}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 1. Źródło danych */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-c-text">
                  {pl ? '1. Źródło danych' : '1. Data source'}
                </label>
                <div className="grid grid-cols-1 gap-3">
                  <div
                    data-testid="generator-wniosku-zrodlo"
                    aria-pressed="true"
                    className="p-3 rounded-xl border text-left border-c-border-strong bg-c-surface-subtle ring-1 ring-c-border"
                  >
                    <div className="text-sm font-medium text-c-text flex items-center gap-2">
                      <FileText className="w-4 h-4 text-c-text-muted" />
                      {pl ? 'Ocena + raport oceny' : 'Assessment + assessment report'}
                    </div>
                    <div className="text-xs text-c-text-muted mt-0.5">
                      {pl
                        ? 'Jedyne źródło, które silnik dziś przyjmuje: streszczenie wykonawcze raportu wraz z dowodami i ograniczeniami.'
                        : 'The only source the engine accepts today: the report executive summary with its evidence and limits.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Wybierz ocenę */}
              <div className="space-y-2">
                <label
                  className="text-sm font-semibold text-c-text"
                  htmlFor="generator-wniosku-ocena"
                >
                  {pl ? '2. Wybierz ocenę' : '2. Pick an assessment'}
                </label>
                {laduje ? (
                  <div className="flex items-center gap-2 h-11 px-4 text-sm text-c-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {pl ? 'Ładowanie…' : 'Loading…'}
                  </div>
                ) : (
                  <select
                    id="generator-wniosku-ocena"
                    data-testid="generator-wniosku-ocena"
                    value={ocenaId}
                    onChange={(e) => setOcenaId(e.target.value)}
                    className={POLE}
                  >
                    <option value="">{pl ? '— wybierz ocenę —' : '— pick an assessment —'}</option>
                    {oceny.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nazwa}
                        {o.typ ? ` (${o.typ})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {!laduje && oceny.length === 0 ? (
                  <div className="text-xs text-c-text-muted">
                    {pl
                      ? 'Żadna ocena nie ma jeszcze raportu. Wniosek powstaje ze streszczenia raportu — najpierw utwórz raport na zakładce „Raporty”.'
                      : 'No assessment has a report yet. A conclusion is built from the report summary — create a report on the “Reports” tab first.'}
                  </div>
                ) : null}
                {bladListy ? (
                  <div className="text-xs text-danger-600 dark:text-danger-300">{bladListy}</div>
                ) : null}
              </div>

              {/* 3. Wybierz raport */}
              <div className="space-y-2">
                <label
                  className="text-sm font-semibold text-c-text"
                  htmlFor="generator-wniosku-raport"
                >
                  {pl ? '3. Wybierz raport oceny' : '3. Pick the assessment report'}
                </label>
                {!ocenaId ? (
                  <div className="h-11 px-4 flex items-center text-sm text-c-text-muted">
                    {pl ? 'Najpierw wybierz ocenę.' : 'Pick an assessment first.'}
                  </div>
                ) : (
                  <select
                    id="generator-wniosku-raport"
                    data-testid="generator-wniosku-raport"
                    value={raportId}
                    onChange={(e) => setRaportId(e.target.value)}
                    className={POLE}
                  >
                    <option value="">{pl ? '— wybierz raport —' : '— pick a report —'}</option>
                    {raportyOceny.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.status ? ` (${r.status})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {blad ? (
                <div
                  data-testid="generator-wniosku-blad"
                  className="text-sm text-danger-600 dark:text-danger-300"
                >
                  {blad}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-c-border-subtle flex items-center justify-end gap-2">
          {faza === 'done' && wynik ? (
            <>
              <button type="button" onClick={onClose} className={PRZYCISK_WTORNY}>
                {pl ? 'Zamknij' : 'Close'}
              </button>
              <button
                type="button"
                data-testid="generator-wniosku-otworz"
                onClick={() => onOtworzWniosek?.(wynik.conclusionId)}
                className={PRZYCISK_GLOWNY}
              >
                {pl ? 'Otwórz wniosek' : 'Open conclusion'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={faza === 'running'}
                className={PRZYCISK_WTORNY}
              >
                {pl ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                type="button"
                data-testid="generator-wniosku-generuj"
                disabled={!mozeGenerowac}
                onClick={generuj}
                className={PRZYCISK_GLOWNY}
              >
                {faza === 'running' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {pl ? 'Generuję…' : 'Generating…'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {pl ? 'Generuj wniosek' : 'Generate conclusion'}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeneratorWnioskuModal;
