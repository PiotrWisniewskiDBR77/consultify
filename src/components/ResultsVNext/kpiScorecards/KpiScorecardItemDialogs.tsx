/**
 * KpiScorecardItemDialogs — okna zapisu pozycji karty wyników:
 * `AddKpiScorecardItemModal` (`POST .../items`) i
 * `RemoveKpiScorecardItemDialog` (`DELETE .../items/:itemId`).
 *
 * DEC-422c (2026-09-06, zadanie 1.1-R3) — DLACZEGO TEN PLIK SIĘ ZMIENIŁ.
 * Do 2026-09-06 okno „Dodaj KPI do karty wyników" miało JEDNO pole tekstowe
 * „KPI ID" i kazało człowiekowi WKLEIĆ UUID; serwer
 * (`AddScorecardItemSchema`: `kpiId: z.string().uuid()`) odrzucał wszystko inne
 * komunikatem „Invalid UUID". Poprzedni nagłówek tego pliku tłumaczył to
 * brakiem listy KPI — to była nieprawda mierzalna dwoma greppami: endpoint
 * `GET /api/vnext/results/kpi` istnieje od RN-G5
 * (`server/src/routes/resultsVnext/kpi.routes.ts`, wyszukiwanie po nazwie
 * `q` robi SQL w `kpiRepository.listKpis`), a `POST /api/vnext/results/kpi`
 * tworzy KPI wraz z wersją 1. Oba miały już gotowych wołaczy w `../kpiApi`
 * (`listKpis`, `createKpiDraft`) — brakowało wyłącznie ostatniego przewodu.
 *
 * Okno ma teraz DWIE DROGI i ZERO UUID w interfejsie:
 *  (A) „Wybierz istniejący" — szukanie po NAZWIE (`listKpis({ q })`,
 *      serwer wymaga min. 2 znaków), wybór wiersza zapamiętuje `kpiId`
 *      W TLE; użytkownik widzi nazwę i kod, nigdy identyfikatora.
 *  (B) „Nowy miernik" — Nazwa (wymagana) + OPIS (WYMAGANY, świadomie
 *      zastąpił dawną „Notatkę (opcjonalnie)" — właściciel 2026-09-06:
 *      „trzeba wymusić nie notatkę, a opis KPI"), Jednostka, Kierunek
 *      (wyżej/niżej lepiej ⇒ `threshold_min`/`threshold_max`, dokładnie tak
 *      jak nazywa je `targetGeometryEvaluator.ts`) i opcjonalny Cel.
 *      „Dodaj" robi `createKpiDraft` → `onSubmit({ kpiId })` → wołający
 *      dokłada pozycję do karty.
 *
 * KOD KPI (`kpiCode`) nie jest pytany od użytkownika, bo nie jest niczym,
 * co człowiek dodający miernik do karty ma wymyślać — jest wyprowadzany z
 * nazwy plus losowy sufiks (kolumna ma `UNIQUE (organization_id, kpi_code)`,
 * `server/migrations/20260810_rvn_kpi_core.sql`). Kolizja wraca jako uczciwy
 * błąd serwera, nie jako cichy sukces.
 *
 * AI — ŻADNEGO NOWEGO SILNIKA (DEC-407). „Zaproponuj z AI" woła istniejący
 * `generujTrescPola` (`POST /ai/refine-text`, język z UI) po cztery
 * osobne pola i tylko WYPEŁNIA formularz. Nie zapisuje niczego: ani KPI,
 * ani pozycji karty — zapis może zrobić wyłącznie człowiek klikając „Dodaj"
 * (`ZASADY_AI_TERESA_SSOT` §3: „AI proposes. User reviews."). Pola, których
 * model nie zwrócił albo których odpowiedzi nie dało się uczciwie
 * zinterpretować (np. kierunek inny niż wyżej/niżej), zostają NIETKNIĘTE —
 * nigdy nie podstawiamy wartości wymyślonej lokalnie.
 */
import { AlertTriangle, Check, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';
import { Modal } from '@/components/ui/primitives';
import { generujTrescPola } from '@/services/ai/generujTrescPola';

import {
  createKpiDraft,
  listKpis,
  newKpiIdempotencyKey,
  type KpiDefinitionDto,
} from '../kpiApi';
import { KPI_SCORECARD_ITEM_ROLES, type KpiScorecardItemRole } from './kpiScorecardApi';
import { kpiScorecardItemRoleLabel } from './kpiScorecardMappers';

const FIELD_CLASS =
  'w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';
const TEXTAREA_CLASS =
  'w-full min-h-[64px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors resize-y ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';
const LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';
const GHOST_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 ' +
  'text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';
const DANGER_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg bg-c-danger px-4 text-sm font-medium text-white ' +
  'transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-50';
const TAB_BASE_CLASS =
  'flex-1 h-8 rounded-md text-sm font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';
const TAB_ACTIVE_CLASS = 'bg-c-surface text-c-text shadow-sm';
const TAB_IDLE_CLASS = 'text-c-text-muted hover:text-c-text';

// ==========================================
// AddKpiScorecardItemModal
// ==========================================

/** Dwie wartości `KpiTargetGeometry`, które da się uczciwie nazwać po ludzku
 * w oknie „dodaj miernik". Pozostałe cztery (`range`/`exact`/`binary`/
 * `custom`) wymagają par progów, których to okno nie zbiera — ustawia się je
 * w rejestrze KPI. */
export type KierunekMiernika = 'threshold_min' | 'threshold_max';

export interface AddKpiScorecardItemFormValues {
  /** ZAWSZE prawdziwy `kpiId` istniejącego rekordu — w drodze (B) rekord
   * powstał chwilę wcześniej przez `createKpiDraft`. Nigdy tekst wpisany
   * ręcznie przez człowieka. */
  kpiId: string;
  role: KpiScorecardItemRole;
}

export interface AddKpiScorecardItemModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: AddKpiScorecardItemFormValues) => void;
  isPolish: boolean;
  /** Nazwa karty wyników — jedyny kontekst, jaki to okno ma o miejscu
   * docelowym; idzie do promptu AI (i tylko tam). */
  scorecardName?: string | null;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}

/** Etykieta wiersza listy: nazwa z aktualnej wersji definicji, a gdy KPI jej
 * nie ma (brak zatwierdzonej wersji) — kod. Nigdy `kpiId`. */
export function etykietaKpi(kpi: KpiDefinitionDto): string {
  const nazwa = kpi.name?.trim();
  return nazwa && nazwa.length > 0 ? nazwa : kpi.kpiCode;
}

/** `kpiCode` z nazwy + losowy sufiks — patrz nagłówek pliku. */
export function kodZNazwy(nazwa: string): string {
  const rdzen = nazwa
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  const sufiks = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${rdzen || 'KPI'}_${sufiks}`;
}

/** Liczba z pola „Cel" albo `null`. Przecinek dziesiętny jest dopuszczony
 * (klawiatura numeryczna PL), pusty ciąg to brak celu — NIE zero. */
export function parsujCel(tekst: string): number | null {
  const oczyszczony = tekst.trim().replace(',', '.');
  if (!oczyszczony) return null;
  const liczba = Number(oczyszczony);
  return Number.isFinite(liczba) ? liczba : null;
}

/** Odpowiedź modelu na pytanie o kierunek → enum albo `null`, gdy model
 * odpowiedział czymkolwiek innym (wtedy pole zostaje nietknięte). */
export function kierunekZOdpowiedziAI(tekst: string): KierunekMiernika | null {
  const t = tekst.toLowerCase();
  if (/niż|niz|lower|mniej|spad|decreas|minimal/.test(t)) return 'threshold_max';
  if (/wyż|wyz|higher|więcej/.test(t) || /\bwiecej\b/.test(t) || /increas|maximal|growth/.test(t))
    return 'threshold_min';
  return null;
}

/** Jednostka z odpowiedzi modelu: pierwsza linia, bez cudzysłowów i kropki
 * końcowej, maks. 16 znaków — dłuższa odpowiedź to zdanie, nie jednostka. */
export function jednostkaZOdpowiedziAI(tekst: string): string | null {
  const pierwsza = tekst.split('\n')[0]?.trim() ?? '';
  const oczyszczona = pierwsza.replace(/^["'`]+|["'`.]+$/g, '').trim();
  if (!oczyszczona || oczyszczona.length > 16) return null;
  return oczyszczona;
}

/** Liczba z odpowiedzi modelu na pytanie o cel. */
export function celZOdpowiedziAI(tekst: string): string | null {
  const trafienie = tekst.match(/-?\d+(?:[.,]\d+)?/);
  return trafienie ? trafienie[0].replace(',', '.') : null;
}

export const AddKpiScorecardItemModal: React.FC<AddKpiScorecardItemModalProps> = ({
  open,
  onClose,
  onSubmit,
  isPolish,
  scorecardName = null,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [droga, setDroga] = useState<'istniejacy' | 'nowy'>('istniejacy');
  const [role, setRole] = useState<KpiScorecardItemRole>('primary');
  const [dotknieto, setDotknieto] = useState(false);

  // Droga A
  const [szukaj, setSzukaj] = useState('');
  const [wyniki, setWyniki] = useState<KpiDefinitionDto[]>([]);
  const [stanListy, setStanListy] = useState<'idle' | 'ladowanie' | 'blad'>('idle');
  const [wybrany, setWybrany] = useState<KpiDefinitionDto | null>(null);

  // Droga B
  const [nazwa, setNazwa] = useState('');
  const [opis, setOpis] = useState('');
  const [jednostka, setJednostka] = useState('');
  const [kierunek, setKierunek] = useState<KierunekMiernika>('threshold_min');
  const [cel, setCel] = useState('');
  const [tworzenieBusy, setTworzenieBusy] = useState(false);
  const [tworzenieBlad, setTworzenieBlad] = useState<string | null>(null);

  // AI
  const [aiStan, setAiStan] = useState<'idle' | 'ladowanie'>('idle');
  const [aiBlad, setAiBlad] = useState<string | null>(null);
  const [aiWypelnil, setAiWypelnil] = useState<string[]>([]);

  // Klucz idempotencji na OTWARCIE okna (nie na klik) — powtórka po błędzie
  // sieci w tym samym otwarciu nie stworzy drugiego KPI.
  const kluczIdempotencji = useRef<string>('');

  useEffect(() => {
    if (!open) return;
    setDroga('istniejacy');
    setRole('primary');
    setDotknieto(false);
    setSzukaj('');
    setWyniki([]);
    setStanListy('idle');
    setWybrany(null);
    setNazwa('');
    setOpis('');
    setJednostka('');
    setKierunek('threshold_min');
    setCel('');
    setTworzenieBusy(false);
    setTworzenieBlad(null);
    setAiStan('idle');
    setAiBlad(null);
    setAiWypelnil([]);
    kluczIdempotencji.current = newKpiIdempotencyKey();
  }, [open]);

  // Lista KPI: pierwsze wejście = najświeższe rekordy organizacji, potem
  // filtrowanie po nazwie po stronie serwera (debounce 300 ms).
  useEffect(() => {
    if (!open || droga !== 'istniejacy') return;
    let anulowane = false;
    setStanListy('ladowanie');
    const timer = setTimeout(() => {
      listKpis({ q: szukaj.trim(), limit: 25 })
        .then((kpis) => {
          if (anulowane) return;
          setWyniki(kpis);
          setStanListy('idle');
        })
        .catch(() => {
          if (anulowane) return;
          setWyniki([]);
          setStanListy('blad');
        });
    }, 300);
    return () => {
      anulowane = true;
      clearTimeout(timer);
    };
  }, [open, droga, szukaj]);

  const brakWyboru = droga === 'istniejacy' && dotknieto && !wybrany;
  const brakNazwy = droga === 'nowy' && dotknieto && !nazwa.trim();
  const brakOpisu = droga === 'nowy' && dotknieto && !opis.trim();

  const zajete = busy || tworzenieBusy;

  const zaproponujZAI = useCallback(async () => {
    if (!nazwa.trim()) {
      setDotknieto(true);
      return;
    }
    setAiStan('ladowanie');
    setAiBlad(null);
    setAiWypelnil([]);
    const kontekstArtefaktu = {
      type: 'kpi',
      title: scorecardName
        ? `${nazwa.trim()} — ${isPolish ? 'karta wyników' : 'scorecard'}: ${scorecardName}`
        : nazwa.trim(),
    };
    const [odpOpis, odpJednostka, odpKierunek, odpCel] = await Promise.allSettled([
      generujTrescPola({
        etykietaPola: isPolish
          ? 'Opis miernika: co dokładnie mierzy i po co'
          : 'KPI description: what exactly it measures and why',
        kontekstArtefaktu,
        format: 'paragraph',
      }),
      generujTrescPola({
        etykietaPola: isPolish
          ? 'Jednostka miary — samo oznaczenie, np. %, dni, szt., PLN'
          : 'Unit of measure — the symbol only, e.g. %, days, pcs, PLN',
        kontekstArtefaktu,
        format: 'short',
      }),
      generujTrescPola({
        etykietaPola: isPolish
          ? 'Kierunek poprawy — odpowiedz jednym słowem: WYŻEJ albo NIŻEJ'
          : 'Direction of improvement — answer one word: HIGHER or LOWER',
        kontekstArtefaktu,
        format: 'short',
      }),
      generujTrescPola({
        etykietaPola: isPolish
          ? 'Wartość docelowa — sama liczba, bez jednostki'
          : 'Target value — a bare number, no unit',
        kontekstArtefaktu,
        format: 'short',
      }),
    ]);

    const wypelnione: string[] = [];
    if (odpOpis.status === 'fulfilled' && odpOpis.value.trim()) {
      setOpis(odpOpis.value.trim());
      wypelnione.push(isPolish ? 'opis' : 'description');
    }
    if (odpJednostka.status === 'fulfilled') {
      const j = jednostkaZOdpowiedziAI(odpJednostka.value);
      if (j) {
        setJednostka(j);
        wypelnione.push(isPolish ? 'jednostka' : 'unit');
      }
    }
    if (odpKierunek.status === 'fulfilled') {
      const k = kierunekZOdpowiedziAI(odpKierunek.value);
      if (k) {
        setKierunek(k);
        wypelnione.push(isPolish ? 'kierunek' : 'direction');
      }
    }
    if (odpCel.status === 'fulfilled') {
      const c = celZOdpowiedziAI(odpCel.value);
      if (c) {
        setCel(c);
        wypelnione.push(isPolish ? 'cel' : 'target');
      }
    }

    setAiWypelnil(wypelnione);
    if (wypelnione.length === 0) {
      setAiBlad(
        isPolish
          ? 'AI nie zwróciło propozycji, których dałoby się użyć. Wypełnij pola ręcznie.'
          : 'AI returned nothing usable. Fill the fields in by hand.'
      );
    }
    setAiStan('idle');
  }, [nazwa, scorecardName, isPolish]);

  const handleSubmit = useCallback(async () => {
    setDotknieto(true);
    if (droga === 'istniejacy') {
      if (!wybrany) return;
      onSubmit({ kpiId: wybrany.kpiId, role });
      return;
    }
    if (!nazwa.trim() || !opis.trim()) return;
    setTworzenieBusy(true);
    setTworzenieBlad(null);
    try {
      const { kpi } = await createKpiDraft({
        kpiCode: kodZNazwy(nazwa),
        name: nazwa.trim(),
        description: opis.trim(),
        unit: jednostka.trim() || null,
        targetGeometry: kierunek,
        targetValue: parsujCel(cel),
        idempotencyKey: kluczIdempotencji.current,
      });
      onSubmit({ kpiId: kpi.kpiId, role });
    } catch (err) {
      setTworzenieBlad(err instanceof Error ? err.message : String(err));
    } finally {
      setTworzenieBusy(false);
    }
  }, [droga, wybrany, role, onSubmit, nazwa, opis, jednostka, kierunek, cel]);

  return (
    <Modal
      open={open}
      onClose={zajete ? () => {} : onClose}
      title={isPolish ? 'Dodaj miernik do karty wyników' : 'Add a measure to the scorecard'}
      size="md"
      preventOverlayClose={zajete}
      preventEscapeClose={zajete}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={zajete} className={GHOST_BUTTON_CLASS}>
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={zajete}
            data-testid="kpi-scorecard-add-item-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Plus size={16} />
            <span>{zajete ? (isPolish ? 'Dodawanie…' : 'Adding…') : isPolish ? 'Dodaj' : 'Add'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-1 rounded-lg bg-c-surface-raised p-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={droga === 'istniejacy'}
            onClick={() => setDroga('istniejacy')}
            data-testid="kpi-scorecard-add-item-tab-existing"
            className={`${TAB_BASE_CLASS} ${droga === 'istniejacy' ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS}`}
          >
            {isPolish ? 'Wybierz istniejący' : 'Pick an existing one'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={droga === 'nowy'}
            onClick={() => setDroga('nowy')}
            data-testid="kpi-scorecard-add-item-tab-new"
            className={`${TAB_BASE_CLASS} ${droga === 'nowy' ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS}`}
          >
            {isPolish ? 'Nowy miernik' : 'New measure'}
          </button>
        </div>

        {droga === 'istniejacy' ? (
          <div className="space-y-2">
            <label className={LABEL_CLASS} htmlFor="kpi-scorecard-add-item-search">
              {isPolish ? 'Znajdź miernik po nazwie' : 'Find a measure by name'}
            </label>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-c-text-muted"
              />
              <input
                id="kpi-scorecard-add-item-search"
                type="text"
                value={szukaj}
                onChange={(e) => setSzukaj(e.target.value)}
                className={`${FIELD_CLASS} pl-8`}
                data-testid="kpi-scorecard-add-item-search"
                autoComplete="off"
                placeholder={isPolish ? 'np. terminowość dostaw' : 'e.g. on-time delivery'}
              />
            </div>
            {wybrany ? (
              <div
                className="flex items-center justify-between gap-2 rounded-lg border border-c-border bg-c-surface-raised px-3 py-2"
                data-testid="kpi-scorecard-add-item-selected"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm text-c-text">
                  <Check size={14} className="shrink-0 text-c-success" />
                  <span className="truncate">{etykietaKpi(wybrany)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setWybrany(null)}
                  className="shrink-0 text-[12px] font-medium text-c-text-muted hover:text-c-text"
                  data-testid="kpi-scorecard-add-item-clear"
                >
                  {isPolish ? 'Zmień' : 'Change'}
                </button>
              </div>
            ) : (
              <div
                className="max-h-52 overflow-y-auto rounded-lg border border-c-border"
                data-testid="kpi-scorecard-add-item-results"
                role="listbox"
              >
                {stanListy === 'ladowanie' ? (
                  <p className="px-3 py-2 text-[12px] text-c-text-muted">
                    {isPolish ? 'Szukanie…' : 'Searching…'}
                  </p>
                ) : stanListy === 'blad' ? (
                  <p className="px-3 py-2 text-[12px] text-c-danger">
                    {isPolish
                      ? 'Nie udało się pobrać listy mierników.'
                      : 'Could not load the list of measures.'}
                  </p>
                ) : wyniki.length === 0 ? (
                  <p className="px-3 py-2 text-[12px] text-c-text-muted">
                    {isPolish
                      ? 'Brak mierników pasujących do tej nazwy. Załóż nowy w zakładce obok.'
                      : 'No measure matches that name. Create one in the other tab.'}
                  </p>
                ) : (
                  wyniki.map((kpi) => (
                    <button
                      key={kpi.kpiId}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => setWybrany(kpi)}
                      data-testid={`kpi-scorecard-add-item-option-${kpi.kpiId}`}
                      className="flex w-full items-center justify-between gap-2 border-b border-c-border px-3 py-2 text-left last:border-b-0 hover:bg-c-surface-raised focus-visible:outline-none focus-visible:bg-c-surface-raised"
                    >
                      <span className="truncate text-sm text-c-text">{etykietaKpi(kpi)}</span>
                      <span className="shrink-0 text-[11px] uppercase tracking-wide text-c-text-muted">
                        {kpi.kpiCode}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
            {brakWyboru ? (
              <p className="text-[11px] text-c-danger" data-testid="kpi-scorecard-add-item-pick-error">
                {isPolish ? 'Wybierz miernik z listy.' : 'Pick a measure from the list.'}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className={LABEL_CLASS} htmlFor="kpi-scorecard-add-item-name">
                {isPolish ? 'Nazwa miernika' : 'Measure name'}
              </label>
              <input
                id="kpi-scorecard-add-item-name"
                type="text"
                value={nazwa}
                onChange={(e) => setNazwa(e.target.value)}
                className={FIELD_CLASS}
                data-testid="kpi-scorecard-add-item-name"
                aria-invalid={brakNazwy || undefined}
                placeholder={isPolish ? 'np. Terminowość dostaw' : 'e.g. On-time delivery'}
              />
              {brakNazwy ? (
                <p className="mt-1 text-[11px] text-c-danger" data-testid="kpi-scorecard-add-item-name-error">
                  {isPolish ? 'Nazwa miernika jest wymagana.' : 'The measure name is required.'}
                </p>
              ) : null}
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label className={LABEL_CLASS} htmlFor="kpi-scorecard-add-item-description">
                  {isPolish ? 'Opis miernika' : 'Measure description'}
                </label>
                <button
                  type="button"
                  onClick={() => void zaproponujZAI()}
                  disabled={aiStan === 'ladowanie' || zajete}
                  data-testid="kpi-scorecard-add-item-ai"
                  className="mb-1.5 inline-flex h-7 items-center gap-1.5 rounded-lg border border-c-border bg-transparent px-2.5 text-[12px] font-medium text-c-text transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles size={13} />
                  <span>
                    {aiStan === 'ladowanie'
                      ? isPolish
                        ? 'Proponuję…'
                        : 'Proposing…'
                      : isPolish
                        ? 'Zaproponuj z AI'
                        : 'Propose with AI'}
                  </span>
                </button>
              </div>
              <textarea
                id="kpi-scorecard-add-item-description"
                value={opis}
                onChange={(e) => setOpis(e.target.value)}
                className={TEXTAREA_CLASS}
                data-testid="kpi-scorecard-add-item-description"
                aria-invalid={brakOpisu || undefined}
                placeholder={
                  isPolish
                    ? 'Co ten miernik mierzy i po co go pilnujemy?'
                    : 'What does this measure track, and why?'
                }
              />
              {brakOpisu ? (
                <p
                  className="mt-1 text-[11px] text-c-danger"
                  data-testid="kpi-scorecard-add-item-description-error"
                >
                  {isPolish ? 'Opis miernika jest wymagany.' : 'The measure description is required.'}
                </p>
              ) : null}
              {aiWypelnil.length > 0 ? (
                <p className="mt-1 text-[11px] text-c-text-muted" data-testid="kpi-scorecard-add-item-ai-filled">
                  {isPolish
                    ? `Propozycja AI wypełniła: ${aiWypelnil.join(', ')}. Sprawdź i popraw — zapisuje dopiero „Dodaj".`
                    : `AI filled in: ${aiWypelnil.join(', ')}. Review and edit — nothing is saved until you click Add.`}
                </p>
              ) : null}
              {aiBlad ? (
                <p className="mt-1 text-[11px] text-c-danger" data-testid="kpi-scorecard-add-item-ai-error">
                  {aiBlad}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS} htmlFor="kpi-scorecard-add-item-unit">
                  {isPolish ? 'Jednostka' : 'Unit'}
                </label>
                <input
                  id="kpi-scorecard-add-item-unit"
                  type="text"
                  value={jednostka}
                  onChange={(e) => setJednostka(e.target.value)}
                  className={FIELD_CLASS}
                  data-testid="kpi-scorecard-add-item-unit"
                  placeholder={isPolish ? 'np. %' : 'e.g. %'}
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="kpi-scorecard-add-item-target">
                  {isPolish ? 'Cel (opcjonalnie)' : 'Target (optional)'}
                </label>
                <input
                  id="kpi-scorecard-add-item-target"
                  type="text"
                  inputMode="decimal"
                  value={cel}
                  onChange={(e) => setCel(e.target.value)}
                  className={FIELD_CLASS}
                  data-testid="kpi-scorecard-add-item-target"
                  placeholder={isPolish ? 'np. 95' : 'e.g. 95'}
                />
              </div>
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="kpi-scorecard-add-item-direction">
                {isPolish ? 'Kierunek' : 'Direction'}
              </label>
              <select
                id="kpi-scorecard-add-item-direction"
                value={kierunek}
                onChange={(e) => setKierunek(e.target.value as KierunekMiernika)}
                className={FIELD_CLASS}
                data-testid="kpi-scorecard-add-item-direction"
              >
                <option value="threshold_min">
                  {isPolish ? 'Wyżej = lepiej' : 'Higher is better'}
                </option>
                <option value="threshold_max">
                  {isPolish ? 'Niżej = lepiej' : 'Lower is better'}
                </option>
              </select>
            </div>

            {tworzenieBlad ? (
              <p
                className="text-[12px] text-c-danger"
                role="alert"
                data-testid="kpi-scorecard-add-item-create-error"
              >
                {isPolish
                  ? `Nie udało się utworzyć miernika: ${tworzenieBlad}`
                  : `Could not create the measure: ${tworzenieBlad}`}
              </p>
            ) : null}
          </div>
        )}

        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-scorecard-add-item-role">
            {isPolish ? 'Rola' : 'Role'}
          </label>
          <select
            id="kpi-scorecard-add-item-role"
            value={role}
            onChange={(e) => setRole(e.target.value as KpiScorecardItemRole)}
            className={FIELD_CLASS}
            data-testid="kpi-scorecard-add-item-role"
          >
            {KPI_SCORECARD_ITEM_ROLES.map((r) => (
              <option key={r} value={r}>
                {kpiScorecardItemRoleLabel(r, isPolish)}
              </option>
            ))}
          </select>
        </div>

        {errorMessage ? (
          <p className="text-[12px] text-c-danger" role="alert" data-testid="kpi-scorecard-add-item-error">
            {isConflict
              ? isPolish
                ? `Konflikt zapisu: ${errorMessage}`
                : `Write conflict: ${errorMessage}`
              : errorMessage}
          </p>
        ) : null}
      </div>
    </Modal>
  );
};

// ==========================================
// RemoveKpiScorecardItemDialog
// ==========================================

export interface RemoveKpiScorecardItemDialogProps {
  open: boolean;
  itemLabel: string;
  isPolish: boolean;
  onClose: () => void;
  onSubmit: (reason: string | null) => void;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}

export const RemoveKpiScorecardItemDialog: React.FC<RemoveKpiScorecardItemDialogProps> = ({
  open,
  itemLabel,
  isPolish,
  onClose,
  onSubmit,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setReason('');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Usuń pozycję z karty wyników' : 'Remove item from scorecard'}
      description={isPolish ? `Pozycja: ${itemLabel}` : `Item: ${itemLabel}`}
      size="sm"
      preventOverlayClose={busy}
      preventEscapeClose={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => onSubmit(reason.trim() || null)}
            disabled={busy}
            data-testid="kpi-scorecard-remove-item-submit"
            className={DANGER_BUTTON_CLASS}
          >
            <Trash2 size={16} />
            <span>{busy ? (isPolish ? 'Usuwanie…' : 'Removing…') : isPolish ? 'Usuń' : 'Remove'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-scorecard-remove-item-reason">
            {isPolish ? 'Powód (opcjonalnie)' : 'Reason (optional)'}
          </label>
          <textarea
            id="kpi-scorecard-remove-item-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="kpi-scorecard-remove-item-reason"
          />
        </div>
        {errorMessage ? (
          <p className="flex items-start gap-1.5 text-[12px] text-c-danger" role="alert" data-testid="kpi-scorecard-remove-item-error">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              {isConflict
                ? isPolish
                  ? `Konflikt zapisu: ${errorMessage}`
                  : `Write conflict: ${errorMessage}`
                : errorMessage}
            </span>
          </p>
        ) : null}
      </div>
    </Modal>
  );
};

export default AddKpiScorecardItemModal;
