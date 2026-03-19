import {
  AlertTriangle,
  Database,
  Globe,
  Link2,
  MessageSquareText,
  Plus,
  Trash2,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import {
  SWOTData,
  SWOTEvidenceType,
  SWOTSignal,
  SWOTSignalState,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';

type SignalType = SWOTSignal['type'];

const EVIDENCE_TYPE_OPTIONS: SWOTEvidenceType[] = ['fact', 'observation', 'hypothesis'];
const SIGNAL_STATE_OPTIONS: SWOTSignalState[] = ['accepted', 'proposed', 'needs-evidence'];

const SIGNAL_TYPE_META: Record<
  SignalType,
  { icon: React.ReactNode; label: { en: string; pl: string }; tone: string }
> = {
  interview: {
    icon: <MessageSquareText className="h-4 w-4" />,
    label: { en: 'Interview', pl: 'Interview' },
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  file: {
    icon: <Database className="h-4 w-4" />,
    label: { en: 'Material', pl: 'Materiał' },
    tone: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  link: {
    icon: <Link2 className="h-4 w-4" />,
    label: { en: 'Link', pl: 'Link' },
    tone: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  ai: {
    icon: <Globe className="h-4 w-4" />,
    label: { en: 'AI context', pl: 'Kontekst AI' },
    tone: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  benchmark: {
    icon: <Globe className="h-4 w-4" />,
    label: { en: 'Benchmark', pl: 'Benchmark' },
    tone: 'border-amber-200 bg-amber-50 text-amber-700',
  },
};

export function SWOTInputExplorationPhase({
  session,
  isPolish,
}: {
  session: ToolSession;
  isPolish: boolean;
}) {
  const { addSWOTSignal, removeSWOTSignal, updateSWOTSignal } = useToolStore();
  const swotData = session.inputData as SWOTData;
  const signals = useMemo(() => swotData.signals || [], [swotData.signals]);

  const [type, setType] = useState<SignalType>('interview');
  const [sourceLabel, setSourceLabel] = useState('');
  const [content, setContent] = useState('');
  const [evidenceType, setEvidenceType] = useState<SWOTEvidenceType>('observation');
  const [signalState, setSignalState] = useState<SWOTSignalState>('accepted');
  const [provenance, setProvenance] = useState('');

  const groupedSignals = useMemo(
    () =>
      signals.reduce<Record<SignalType, SWOTSignal[]>>(
        (acc, signal) => {
          acc[signal.type].push(signal);
          return acc;
        },
        { interview: [], file: [], link: [], ai: [], benchmark: [] }
      ),
    [signals]
  );

  const addSignal = () => {
    if (!content.trim()) return;

    addSWOTSignal({
      type,
      sourceLabel: sourceLabel.trim() || (isPolish ? 'Dodane w sesji' : 'Added in session'),
      content: content.trim(),
      confidence: type === 'ai' || type === 'benchmark' ? 3 : 4,
      tags: [],
      evidenceType,
      state: signalState,
      provenance:
        provenance.trim() || sourceLabel.trim() || (isPolish ? 'Sesja robocza' : 'Working session'),
    });

    setContent('');
    setSourceLabel('');
    setProvenance('');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
        <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {isPolish
            ? 'To jest evidence workbench. Tu łączymy wywiad, materiały, benchmarki i kontekst AI zanim zamienimy je w karty SWOT.'
            : 'This is the evidence workbench. It combines interviews, materials, benchmarks, and AI context before turning them into SWOT cards.'}
        </div>
        <InlineAssist
          hint={
            isPolish
              ? 'Jeden sygnał powinien oznaczać jeden fakt, obserwację albo hipotezę z jawnym źródłem i pewnością.'
              : 'Each signal should represent one fact, observation, or hypothesis with explicit source and confidence.'
          }
        />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            {isPolish ? 'Signals' : 'Signals'}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {signals.length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            {isPolish ? 'Accepted' : 'Accepted'}
          </div>
          <div className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-300">
            {
              signals.filter(
                (signal) => signal.state !== 'proposed' && signal.state !== 'needs-evidence'
              ).length
            }
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            {isPolish ? 'Proposed' : 'Proposed'}
          </div>
          <div className="mt-2 text-2xl font-semibold text-violet-600 dark:text-violet-300">
            {signals.filter((signal) => signal.state === 'proposed').length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            {isPolish ? 'Needs evidence' : 'Needs evidence'}
          </div>
          <div className="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-300">
            {signals.filter((signal) => signal.state === 'needs-evidence').length}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {isPolish ? 'Dodaj sygnał' : 'Add signal'}
            </h2>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {signals.length} {isPolish ? 'sygnałów' : 'signals'}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {isPolish ? 'Typ' : 'Type'}
              </span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as SignalType)}
                className="h-10 w-full rounded-lg border border-slate-300/70 bg-white px-3 text-sm dark:border-navy-600/50 dark:bg-navy-950"
              >
                {Object.entries(SIGNAL_TYPE_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {isPolish ? meta.label.pl : meta.label.en}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {isPolish ? 'Źródło' : 'Source'}
              </span>
              <input
                value={sourceLabel}
                onChange={(e) => setSourceLabel(e.target.value)}
                placeholder={
                  isPolish
                    ? 'np. CEO interview, raport branżowy'
                    : 'e.g. CEO interview, industry report'
                }
                className="h-10 w-full rounded-lg border border-slate-300/70 bg-white px-3 text-sm dark:border-navy-600/50 dark:bg-navy-950"
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {isPolish ? 'Typ dowodu' : 'Evidence type'}
              </span>
              <select
                value={evidenceType}
                onChange={(e) => setEvidenceType(e.target.value as SWOTEvidenceType)}
                className="h-10 w-full rounded-lg border border-slate-300/70 bg-white px-3 text-sm dark:border-navy-600/50 dark:bg-navy-950"
              >
                {EVIDENCE_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {isPolish ? 'Stan jakości' : 'Quality state'}
              </span>
              <select
                value={signalState}
                onChange={(e) => setSignalState(e.target.value as SWOTSignalState)}
                className="h-10 w-full rounded-lg border border-slate-300/70 bg-white px-3 text-sm dark:border-navy-600/50 dark:bg-navy-950"
              >
                {SIGNAL_STATE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-3 block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {isPolish ? 'Treść sygnału' : 'Signal content'}
            </span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder={
                isPolish
                  ? 'np. Segment premium B2B rośnie szybciej niż retail, ale firma nie ma jeszcze dedykowanego lejka sprzedaży.'
                  : 'e.g. Premium B2B is growing faster than retail, but the company still lacks a dedicated sales funnel.'
              }
              className="w-full rounded-xl border border-slate-300/70 bg-white px-3 py-2 text-sm dark:border-navy-600/50 dark:bg-navy-950"
            />
          </label>

          <label className="mt-3 block space-y-1">
            <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {isPolish ? 'Provenance / skąd to wiemy' : 'Provenance / why we know this'}
            </span>
            <input
              value={provenance}
              onChange={(e) => setProvenance(e.target.value)}
              placeholder={
                isPolish
                  ? 'np. wywiad z CEO 2026-03-18, raport branżowy, notatka z warsztatu'
                  : 'e.g. CEO interview 2026-03-18, industry report, workshop note'
              }
              className="h-10 w-full rounded-xl border border-slate-300/70 bg-white px-3 text-sm dark:border-navy-600/50 dark:bg-navy-950"
            />
          </label>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {isPolish
                ? 'W MVP sygnały są wspólną warstwą wejściową dla całej macierzy.'
                : 'In the MVP, signals are the shared input layer for the whole matrix.'}
            </div>
            <button
              type="button"
              onClick={addSignal}
              disabled={!content.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {isPolish ? 'Dodaj' : 'Add'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {(['interview', 'file', 'benchmark'] as SignalType[]).map((signalType) => {
            const meta = SIGNAL_TYPE_META[signalType];
            const items = groupedSignals[signalType];
            return (
              <div
                key={signalType}
                className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className={`rounded-lg border px-2 py-1 text-xs font-medium ${meta.tone}`}>
                    <span className="mr-1 inline-flex align-middle">{meta.icon}</span>
                    {isPolish ? meta.label.pl : meta.label.en}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Brak sygnałów w tej grupie.' : 'No signals in this group yet.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.slice(0, 4).map((signal) => (
                      <div
                        key={signal.id}
                        className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-navy-700/70 dark:bg-navy-950/40"
                      >
                        <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {signal.sourceLabel}
                        </div>
                        <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {signal.content}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                          <span>{signal.evidenceType || 'observation'}</span>
                          <span>{signal.state || 'accepted'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
        <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
          {isPolish ? 'Wszystkie sygnały' : 'All signals'}
        </div>
        {signals.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-navy-700 dark:text-slate-400">
            {isPolish
              ? 'Dodaj pierwszy sygnał lub poproś AI o pomoc w eksploracji.'
              : 'Add your first signal or ask AI to help with exploration.'}
          </div>
        ) : (
          <div className="space-y-3">
            {signals.map((signal) => {
              const meta = SIGNAL_TYPE_META[signal.type];
              return (
                <div
                  key={signal.id}
                  className="grid gap-3 rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-navy-700/70 dark:bg-navy-950/40 md:grid-cols-[140px_1fr_auto]"
                >
                  <div className="space-y-2">
                    <span
                      className={`inline-flex rounded-lg border px-2 py-1 text-xs font-medium ${meta.tone}`}
                    >
                      {isPolish ? meta.label.pl : meta.label.en}
                    </span>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {signal.sourceLabel}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <textarea
                      value={signal.content}
                      onChange={(e) => updateSWOTSignal(signal.id, { content: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg border border-slate-300/70 bg-white px-3 py-2 text-sm dark:border-navy-600/50 dark:bg-navy-900"
                    />
                    <div className="grid gap-2 md:grid-cols-2">
                      <input
                        value={signal.provenance || ''}
                        onChange={(e) =>
                          updateSWOTSignal(signal.id, { provenance: e.target.value })
                        }
                        placeholder={isPolish ? 'Provenance' : 'Provenance'}
                        className="h-8 rounded-md border border-slate-300/70 bg-white px-2 text-xs dark:border-navy-600/50 dark:bg-navy-900"
                      />
                      <select
                        value={signal.evidenceType || 'observation'}
                        onChange={(e) =>
                          updateSWOTSignal(signal.id, {
                            evidenceType: e.target.value as SWOTEvidenceType,
                          })
                        }
                        className="h-8 rounded-md border border-slate-300/70 bg-white px-2 text-xs dark:border-navy-600/50 dark:bg-navy-900"
                      >
                        {EVIDENCE_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Pewność' : 'Confidence'}
                      </span>
                      <select
                        value={signal.confidence ?? 3}
                        onChange={(e) =>
                          updateSWOTSignal(signal.id, { confidence: Number(e.target.value) || 3 })
                        }
                        className="h-8 rounded-md border border-slate-300/70 bg-white px-2 text-xs dark:border-navy-600/50 dark:bg-navy-900"
                      >
                        {[1, 2, 3, 4, 5].map((value) => (
                          <option key={value} value={value}>
                            {value}/5
                          </option>
                        ))}
                      </select>
                      <select
                        value={signal.state || 'accepted'}
                        onChange={(e) =>
                          updateSWOTSignal(signal.id, { state: e.target.value as SWOTSignalState })
                        }
                        className="h-8 rounded-md border border-slate-300/70 bg-white px-2 text-xs dark:border-navy-600/50 dark:bg-navy-900"
                      >
                        {SIGNAL_STATE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      {signal.state === 'needs-evidence' && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-300">
                          <AlertTriangle className="h-3 w-3" />
                          {isPolish ? 'wymaga potwierdzenia' : 'needs confirmation'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start justify-end">
                    <button
                      type="button"
                      onClick={() => removeSWOTSignal(signal.id)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SWOTInputExplorationPhase;
