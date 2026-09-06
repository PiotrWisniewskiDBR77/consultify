/**
 * GeneratorInicjatywModal — JEDEN generator inicjatyw w całej aplikacji
 * (DEC-413).
 *
 * Anatomia przeniesiona 1:1 z modalu Oceny, który właściciel przyjął 06.09
 * („metodologicznie fantastyczny"): numerowane kroki na JEDNYM ekranie, faza
 * biegu z postępem, faza wyniku z podglądem i przesłaniem do przeglądu.
 * Korekta graficzna wg kanonu: powłoka `rounded-2xl`, kafle/pola
 * `rounded-xl`, przyciski akcji półokrągłe (`rounded-full`, D21), kolory z
 * tokenów `c-*`, fokus `c-focus`, zero `primary-*` (crimson).
 *
 * Modal nie wie nic o module — wszystko, co modułowe, niesie adapter
 * (`./types.ts`).
 */

import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Loader2, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';
import { cn } from '@/utils/cn';

import type {
  AdapterGeneratora,
  OpcjaZrodla,
  PodgladInicjatywy,
  PostepBiegu,
  UchwytBiegu,
} from './types';

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

interface TemplateOption {
  id: string;
  name: string;
  category?: string;
  level?: string;
  description?: string | null;
}

export interface GeneratorInicjatywModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Adaptery dostępne w tym miejscu aplikacji. Zwykle jeden — moduł wołający. */
  adaptery: AdapterGeneratora[];
  /** Wstępnie zaznaczony wybór kroku 2 (np. sesja, z której wołano modal). */
  wstepnyWybor?: string[];
  onCompleted?: () => void;
}

export function GeneratorInicjatywModal({
  isOpen,
  onClose,
  adaptery,
  wstepnyWybor,
  onCompleted,
}: GeneratorInicjatywModalProps) {
  const [phase, setPhase] = useState<'config' | 'running' | 'done'>('config');
  const [tryb, setTryb] = useState<string>('');
  const [glowny, setGlowny] = useState<string[]>([]);
  const [wtorny, setWtorny] = useState<string[]>([]);
  const [opcjeGlowne, setOpcjeGlowne] = useState<OpcjaZrodla[]>([]);
  const [opcjeWtorne, setOpcjeWtorne] = useState<OpcjaZrodla[]>([]);
  const [ladujeGlowne, setLadujeGlowne] = useState(false);
  const [ladujeWtorne, setLadujeWtorne] = useState(false);

  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [ladujeTemplates, setLadujeTemplates] = useState(false);

  const [methodologyId, setMethodologyId] = useState('impact-feasibility');
  const [liczba, setLiczba] = useState(20);
  const [includeChatContext, setIncludeChatContext] = useState(true);
  const [consultantBrief, setConsultantBrief] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [starting, setStarting] = useState(false);
  const [uchwyt, setUchwyt] = useState<UchwytBiegu | null>(null);
  const [postep, setPostep] = useState<PostepBiegu | null>(null);
  const [wynik, setWynik] = useState<PodgladInicjatywy[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const pollTimer = useRef<number | null>(null);
  const zakonczone = useRef<Set<string>>(new Set());

  /** Adapter wybrany krokiem 1 — kafel niesie `adapterId:tryb`. */
  const adapter = useMemo<AdapterGeneratora | null>(() => {
    if (!adaptery.length) return null;
    const [adapterId] = tryb.split('::');
    return adaptery.find((a) => a.id === adapterId) || adaptery[0];
  }, [adaptery, tryb]);

  const trybAdaptera = useMemo(() => tryb.split('::')[1] || '', [tryb]);

  const kafle = useMemo(
    () =>
      adaptery.flatMap((a) =>
        a.tryby.map((t) => ({
          klucz: `${a.id}::${t.wartosc}`,
          etykieta: t.etykieta,
          opis: t.opis,
        }))
      ),
    [adaptery]
  );

  // Reset po otwarciu — pierwszy kafel jest domyślny, dokładnie jak we wzorcu.
  useEffect(() => {
    if (!isOpen) return;
    setPhase('config');
    setTryb(kafle[0]?.klucz || '');
    setGlowny(wstepnyWybor && wstepnyWybor.length ? wstepnyWybor : []);
    setWtorny([]);
    setUchwyt(null);
    setPostep(null);
    setWynik([]);
    setStarting(false);
    setShowAdvanced(false);
    setTemplateId('');
  }, [isOpen, kafle, wstepnyWybor]);

  useEffect(() => {
    if (!adapter) return;
    setLiczba(adapter.domyslnaLiczba);
  }, [adapter]);

  // Krok 2 — lista główna.
  useEffect(() => {
    if (!isOpen || !adapter) return;
    let cancelled = false;
    setLadujeGlowne(true);
    adapter.krokGlowny
      .lista({ tryb: trybAdaptera, glowny: [] })
      .then((list) => {
        if (!cancelled) setOpcjeGlowne(list);
      })
      .catch(() => {
        if (!cancelled) setOpcjeGlowne([]);
      })
      .finally(() => {
        if (!cancelled) setLadujeGlowne(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, adapter, trybAdaptera]);

  // Krok 3 — lista wtórna (zależna od kroku 2).
  const krokWtornyWidoczny = Boolean(
    adapter?.krokWtorny && (adapter.krokWtorny.widoczny?.(trybAdaptera) ?? true)
  );

  useEffect(() => {
    if (!isOpen || !adapter?.krokWtorny || !krokWtornyWidoczny) {
      setOpcjeWtorne([]);
      return;
    }
    if (!glowny[0]) {
      setOpcjeWtorne([]);
      setWtorny([]);
      return;
    }
    let cancelled = false;
    setLadujeWtorne(true);
    adapter.krokWtorny
      .lista({ tryb: trybAdaptera, glowny })
      .then((list) => {
        if (cancelled) return;
        setOpcjeWtorne(list);
        setWtorny((prev) => prev.filter((id) => list.some((o) => o.id === id)));
      })
      .catch(() => {
        if (!cancelled) {
          setOpcjeWtorne([]);
          setWtorny([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLadujeWtorne(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, adapter, krokWtornyWidoczny, trybAdaptera, glowny]);

  // Krok 4 — template'y (tylko gdy adapter je naprawdę obsługuje).
  useEffect(() => {
    if (!isOpen || !adapter?.wymagaTemplate) return;
    let cancelled = false;
    setLadujeTemplates(true);
    Api.get('/initiatives/templates')
      .then((resp: any) => {
        if (cancelled) return;
        const list: any[] = Array.isArray(resp?.templates) ? resp.templates : [];
        setTemplates(
          list.map((t: any) => ({
            id: String(t.id),
            name: String(t.name || 'Template'),
            category: t.category ? String(t.category) : undefined,
            level: t.level ? String(t.level) : undefined,
            description: t.description ? String(t.description) : null,
          }))
        );
      })
      .catch(() => setTemplates([]))
      .finally(() => {
        if (!cancelled) setLadujeTemplates(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, adapter]);

  // Odpytywanie postępu — tylko dla adapterów z biegiem w tle.
  useEffect(() => {
    if (!isOpen || !uchwyt || !adapter?.postep) return;
    const stop = () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
    const tick = async () => {
      try {
        const run = await adapter.postep!(uchwyt);
        if (!run) return;
        setPostep(run);
        if (run.status !== 'RUNNING') {
          stop();
          setPhase('done');
          if (!zakonczone.current.has(uchwyt.runId)) {
            zakonczone.current.add(uchwyt.runId);
            if (run.status === 'SUCCEEDED')
              toast.success('Wygenerowano inicjatywy', { id: `gen-${uchwyt.runId}-ok` });
            if (run.status === 'PARTIAL')
              toast.success('Wygenerowano inicjatywy (częściowo)', {
                id: `gen-${uchwyt.runId}-partial`,
              });
            if (run.status === 'FAILED')
              toast.error(run.error || 'Generowanie nie powiodło się', {
                id: `gen-${uchwyt.runId}-fail`,
              });
            onCompleted?.();
          }
        }
      } catch {
        // przejściowy błąd odpytywania nie kończy biegu
      }
    };
    void tick();
    pollTimer.current = window.setInterval(tick, 1500);
    return () => stop();
  }, [isOpen, uchwyt, adapter, onCompleted]);

  // Wynik biegu.
  useEffect(() => {
    if (!isOpen || phase !== 'done' || !uchwyt || !adapter?.wynikBiegu) return;
    let cancelled = false;
    adapter
      .wynikBiegu(uchwyt)
      .then((list) => {
        if (!cancelled) setWynik(list);
      })
      .catch(() => {
        if (!cancelled) setWynik([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, phase, uchwyt, adapter]);

  const przelaczWybor = useCallback(
    (ustaw: React.Dispatch<React.SetStateAction<string[]>>, id: string, wielokrotny: boolean) => {
      ustaw((prev) => {
        if (!wielokrotny) return id ? [id] : [];
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      });
    },
    []
  );

  const canStart = useMemo(() => {
    if (!adapter) return false;
    if (glowny.length === 0) return false;
    if (krokWtornyWidoczny && adapter.krokWtorny && wtorny.length === 0) return false;
    if (adapter.wymagaTemplate && !templateId) return false;
    if (!Number.isFinite(liczba) || liczba < 1) return false;
    return true;
  }, [adapter, glowny, krokWtornyWidoczny, wtorny, templateId, liczba]);

  const startuj = async () => {
    if (!adapter || !canStart) return;
    setStarting(true);
    try {
      const res = await adapter.generuj({
        tryb: trybAdaptera,
        glowny,
        wtorny,
        templateId,
        methodologyId,
        liczba,
        includeChatContext,
        consultantBrief,
      });
      if (res.rodzaj === 'bieg') {
        setUchwyt(res.uchwyt);
        setPhase('running');
      } else {
        setWynik(res.inicjatywy);
        setPhase('done');
        toast.success(`Wygenerowano ${res.inicjatywy.length} inicjatyw`);
        onCompleted?.();
      }
    } catch (e: any) {
      toast.error(e?.message || 'Nie udało się uruchomić generowania');
    } finally {
      setStarting(false);
    }
  };

  if (!isOpen || !adapter) return null;

  const disableClose = starting || phase === 'running' || submitting;
  const numerTemplate = krokWtornyWidoczny ? '4.' : '3.';
  const numerKonfig = krokWtornyWidoczny ? (adapter.wymagaTemplate ? '5.' : '4.') : adapter.wymagaTemplate ? '4.' : '3.';

  const listaWyboru = (
    opcje: OpcjaZrodla[],
    wybrane: string[],
    ustaw: React.Dispatch<React.SetStateAction<string[]>>,
    krok: NonNullable<AdapterGeneratora['krokWtorny']>,
    testId: string
  ) =>
    krok.wielokrotny ? (
      <div
        data-testid={testId}
        className="max-h-44 overflow-auto rounded-xl border border-c-border bg-c-surface divide-y divide-c-border-subtle"
      >
        {opcje.length === 0 ? (
          <div className="px-4 py-3 text-sm text-c-text-muted">Brak pozycji do wyboru.</div>
        ) : (
          opcje.map((o) => (
            <label
              key={o.id}
              className="flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-c-surface-hover"
            >
              <input
                type="checkbox"
                checked={wybrane.includes(o.id)}
                onChange={() => przelaczWybor(ustaw, o.id, true)}
                className="mt-0.5 w-4 h-4 rounded border-c-border focus:ring-c-focus"
              />
              <span className="min-w-0">
                <span className="block text-sm text-c-text truncate">{o.nazwa}</span>
                {o.opis ? (
                  <span className="block text-xs text-c-text-muted">{o.opis}</span>
                ) : null}
              </span>
            </label>
          ))
        )}
      </div>
    ) : (
      <select
        data-testid={testId}
        value={wybrane[0] || ''}
        onChange={(e) => przelaczWybor(ustaw, e.target.value, false)}
        className={POLE}
      >
        <option value="">{krok.placeholder}</option>
        {opcje.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nazwa}
            {o.opis ? ` (${o.opis})` : ''}
          </option>
        ))}
      </select>
    );

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !disableClose && onClose()}
        aria-label="Zamknij"
      />

      <div
        data-testid="generator-inicjatyw-modal"
        className={cn(
          'relative w-full max-w-3xl h-[600px] overflow-hidden rounded-2xl',
          'bg-c-surface border border-c-border-subtle shadow-2xl flex flex-col'
        )}
      >
        {/* Nagłówek */}
        <div className="px-5 py-4 border-b border-c-border-subtle flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-c-surface-subtle text-c-text-secondary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-c-text">Generuj inicjatywy</h2>
              <p className="text-sm text-c-text-muted">
                {phase === 'config'
                  ? 'Wybierz źródło i uruchom generator'
                  : phase === 'running'
                    ? 'Trwa generowanie…'
                    : 'Gotowe'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={disableClose}
            aria-label="Zamknij"
            className="p-2 rounded-full hover:bg-c-surface-hover text-c-text-muted transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Treść */}
        <div className="flex-1 min-h-0 overflow-auto p-5">
          {phase === 'config' ? (
            <div className="space-y-5">
              {/* 1. Źródło danych */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-c-text">1. Źródło danych</label>
                <div
                  className={cn(
                    'grid gap-3',
                    kafle.length >= 3 ? 'grid-cols-3' : kafle.length === 2 ? 'grid-cols-2' : 'grid-cols-1'
                  )}
                >
                  {kafle.map((k) => (
                    <button
                      key={k.klucz}
                      type="button"
                      data-testid={`generator-zrodlo-${k.klucz}`}
                      onClick={() => {
                        setTryb(k.klucz);
                        setWtorny([]);
                      }}
                      aria-pressed={tryb === k.klucz}
                      className={cn(
                        'p-3 rounded-xl border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus',
                        tryb === k.klucz
                          ? 'border-c-border-strong bg-c-surface-subtle ring-1 ring-c-border'
                          : 'border-c-border-subtle bg-c-surface hover:border-c-border'
                      )}
                    >
                      <div className="text-sm font-medium text-c-text">{k.etykieta}</div>
                      <div className="text-xs text-c-text-muted mt-0.5">{k.opis}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Krok główny */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-c-text">
                  2. {adapter.krokGlowny.etykieta}
                </label>
                {ladujeGlowne ? (
                  <div className="flex items-center gap-2 h-11 px-4 text-sm text-c-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Ładowanie…
                  </div>
                ) : (
                  listaWyboru(
                    opcjeGlowne,
                    glowny,
                    setGlowny,
                    adapter.krokGlowny,
                    'generator-krok-glowny'
                  )
                )}
              </div>

              {/* 3. Krok wtórny */}
              {krokWtornyWidoczny && adapter.krokWtorny ? (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-c-text">
                    3. {adapter.krokWtorny.etykieta}
                  </label>
                  {!glowny[0] ? (
                    <div className="h-11 px-4 flex items-center text-sm text-c-text-muted">
                      {adapter.krokWtorny.tekstBezPoprzednika || 'Najpierw wybierz źródło.'}
                    </div>
                  ) : ladujeWtorne ? (
                    <div className="flex items-center gap-2 h-11 px-4 text-sm text-c-text-muted">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Ładowanie…
                    </div>
                  ) : (
                    listaWyboru(
                      opcjeWtorne,
                      wtorny,
                      setWtorny,
                      adapter.krokWtorny,
                      'generator-krok-wtorny'
                    )
                  )}
                </div>
              ) : null}

              {/* 4. Template inicjatywy */}
              {adapter.wymagaTemplate ? (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-c-text">
                    {numerTemplate} Wybierz template inicjatywy
                  </label>
                  {ladujeTemplates ? (
                    <div className="flex items-center gap-2 h-11 px-4 text-sm text-c-text-muted">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Ładowanie template’ów…
                    </div>
                  ) : (
                    <select
                      data-testid="generator-template"
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                      className={POLE}
                    >
                      <option value="">— wybierz template —</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.category ? ` • ${t.category}` : ''}
                          {t.level ? ` • ${t.level}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {templateId ? (
                    <div className="text-xs text-c-text-muted">
                      {templates.find((t) => t.id === templateId)?.description || ''}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* 5. Metodologia + liczba */}
              <div className="grid grid-cols-2 gap-4">
                {adapter.wymagaMetodologii ? (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-c-text">
                      {numerKonfig} Metodologia
                    </label>
                    <select
                      data-testid="generator-metodologia"
                      value={methodologyId}
                      onChange={(e) => setMethodologyId(e.target.value)}
                      className={POLE}
                    >
                      <option value="impact-feasibility">Impact × Feasibility</option>
                      <option value="moscow">MoSCoW</option>
                      <option value="rice">RICE</option>
                      <option value="value-effort">Value × Effort</option>
                      <option value="strategic-fit">Strategic Fit</option>
                    </select>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-c-text">Liczba inicjatyw</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Zmniejsz"
                      onClick={() => setLiczba((p) => Math.max(1, p - 5))}
                      className="h-11 w-11 rounded-xl border border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={adapter.maxLiczba}
                      value={liczba}
                      onChange={(e) => setLiczba(Number(e.target.value))}
                      className="flex-1 h-11 px-3 text-center rounded-xl border text-sm border-c-border bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
                    />
                    <button
                      type="button"
                      aria-label="Zwiększ"
                      onClick={() => setLiczba((p) => Math.min(adapter.maxLiczba, p + 5))}
                      className="h-11 w-11 rounded-xl border border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Opcje zaawansowane */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-c-text-secondary hover:text-c-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus rounded-full px-1"
              >
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                Opcje zaawansowane
              </button>

              {showAdvanced && (
                <div className="space-y-4 p-4 rounded-xl border border-c-border-subtle bg-c-surface-raised">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeChatContext}
                      onChange={(e) => setIncludeChatContext(e.target.checked)}
                      className="w-4 h-4 rounded border-c-border focus:ring-c-focus"
                    />
                    <span className="text-sm text-c-text-secondary">Uwzględnij kontekst czatu</span>
                  </label>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-c-text">
                      Notatka konsultanta (opcjonalnie)
                    </label>
                    <textarea
                      value={consultantBrief}
                      onChange={(e) => setConsultantBrief(e.target.value)}
                      rows={3}
                      placeholder="Ograniczenia, priorytety klienta, oczekiwane rezultaty…"
                      className="w-full px-3 py-2 rounded-xl border text-sm border-c-border bg-c-surface text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : phase === 'running' ? (
            <div className="py-10 flex flex-col items-center justify-center text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-c-border-subtle" />
                <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-navy-900 dark:border-slate-100 border-t-transparent animate-spin" />
                <Sparkles size={24} className="absolute inset-0 m-auto text-c-text-muted" />
              </div>
              <div className="mt-4 text-base font-semibold text-c-text">Generowanie inicjatyw…</div>
              <div className="mt-1 text-sm text-c-text-muted">
                Możesz zamknąć okno — proces kontynuuje w tle.
              </div>

              {postep && (
                <div className="mt-6 w-full max-w-xs text-left space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-c-text-secondary">Wygenerowano</span>
                    <span className="font-medium text-c-text">
                      {postep.generatedCount}/{postep.requestedCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-c-text-secondary">Partie</span>
                    <span className="font-medium text-c-text">
                      {postep.batchesSucceeded + postep.batchesFailed}/{postep.batchesPlanned}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-c-text">Generowanie zakończone</div>
                  <div className="text-sm text-c-text-secondary">
                    Drafty inicjatyw są zapisane i powiązane ze źródłem.
                  </div>
                </div>
              </div>

              {postep?.error && (
                <div className="text-sm text-danger-600 dark:text-danger-300">{postep.error}</div>
              )}

              {wynik.length > 0 && (
                <div className="rounded-xl border border-c-border-subtle overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-c-border-subtle bg-c-surface-raised text-sm font-medium text-c-text">
                    Podgląd ({wynik.length})
                  </div>
                  <div className="max-h-48 overflow-auto divide-y divide-c-border-subtle">
                    {wynik.slice(0, 10).map((it) => (
                      <div key={it.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <span className="text-sm text-c-text-secondary truncate">{it.title}</span>
                        <span className="text-xs text-c-text-muted shrink-0">{it.status}</span>
                      </div>
                    ))}
                    {wynik.length > 10 && (
                      <div className="px-4 py-2.5 text-xs text-c-text-muted">
                        …i {wynik.length - 10} więcej
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stopka */}
        <div className="px-5 py-3 border-t border-c-border-subtle flex items-center justify-end gap-2">
          {phase === 'config' ? (
            <>
              <button type="button" onClick={onClose} disabled={disableClose} className={PRZYCISK_WTORNY}>
                Anuluj
              </button>
              <button
                type="button"
                data-testid="generator-generuj"
                disabled={!canStart || starting}
                onClick={startuj}
                className={PRZYCISK_GLOWNY}
              >
                {starting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uruchamiam…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generuj inicjatywy
                  </>
                )}
              </button>
            </>
          ) : phase === 'running' ? (
            <button type="button" onClick={onClose} className={PRZYCISK_WTORNY}>
              Zamknij
            </button>
          ) : (
            <>
              {adapter.przeslijDoPrzegladu && uchwyt ? (
                <button
                  type="button"
                  onClick={async () => {
                    setSubmitting(true);
                    try {
                      const updated = await adapter.przeslijDoPrzegladu!(uchwyt);
                      toast.success(`Przesłano ${updated} inicjatyw do przeglądu`);
                      onCompleted?.();
                    } catch (e: any) {
                      toast.error(e?.message || 'Nie udało się przesłać');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  disabled={submitting}
                  className={cn(PRZYCISK_WTORNY, 'inline-flex items-center gap-2')}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  Prześlij do przeglądu
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  onCompleted?.();
                  onClose();
                }}
                className={PRZYCISK_GLOWNY}
              >
                Zamknij
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default GeneratorInicjatywModal;
