import { Plus, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { SWOTData, SWOTItem, ToolSession, useToolStore } from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';

type QuadrantId = SWOTItem['quadrant'];

const QUADRANT_META: Record<
  QuadrantId,
  {
    title: { en: string; pl: string };
    subtitle: { en: string; pl: string };
    accent: string;
    surface: string;
  }
> = {
  strengths: {
    title: { en: 'Strengths', pl: 'Mocne strony' },
    subtitle: { en: 'Internal advantages', pl: 'Wewnętrzne przewagi' },
    accent: 'text-emerald-700 dark:text-emerald-300',
    surface:
      'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-950/20',
  },
  weaknesses: {
    title: { en: 'Weaknesses', pl: 'Słabe strony' },
    subtitle: { en: 'Internal constraints', pl: 'Wewnętrzne ograniczenia' },
    accent: 'text-amber-700 dark:text-amber-300',
    surface: 'border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20',
  },
  opportunities: {
    title: { en: 'Opportunities', pl: 'Szanse' },
    subtitle: { en: 'External upside', pl: 'Zewnętrzny upside' },
    accent: 'text-sky-700 dark:text-sky-300',
    surface: 'border-sky-200 bg-sky-50/80 dark:border-sky-900/40 dark:bg-sky-950/20',
  },
  threats: {
    title: { en: 'Threats', pl: 'Zagrożenia' },
    subtitle: { en: 'External risk', pl: 'Zewnętrzne ryzyko' },
    accent: 'text-rose-700 dark:text-rose-300',
    surface: 'border-rose-200 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-950/20',
  },
};

function QuadrantCard({
  quadrant,
  items,
  isPolish,
  allQuadrants,
}: {
  quadrant: QuadrantId;
  items: SWOTItem[];
  isPolish: boolean;
  allQuadrants: QuadrantId[];
}) {
  const { addSWOTItem, removeSWOTItem, updateSWOTItem } = useToolStore();
  const [draft, setDraft] = useState('');
  const meta = QUADRANT_META[quadrant];

  const addItem = () => {
    if (!draft.trim()) return;
    addSWOTItem({
      text: draft.trim(),
      quadrant,
      impact: 'medium',
      source: 'user',
      confidence: 4,
      status: 'accepted',
    });
    setDraft('');
  };

  return (
    <div className={`rounded-2xl border p-4 ${meta.surface}`}>
      <div className="mb-3">
        <div className={`text-sm font-semibold ${meta.accent}`}>
          {isPolish ? meta.title.pl : meta.title.en}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {isPolish ? meta.subtitle.pl : meta.subtitle.en}
        </div>
      </div>

      <div className="mb-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder={isPolish ? 'Dodaj konkretny element...' : 'Add a concrete item...'}
          className="h-10 flex-1 rounded-lg border border-white/70 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900"
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!draft.trim()}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-3 text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-white/70 bg-white/40 p-6 text-center text-sm text-slate-500 dark:border-navy-700 dark:bg-navy-950/30 dark:text-slate-400">
          {isPolish ? 'Brak pozycji w tej ćwiartce.' : 'No items in this quadrant yet.'}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/70 bg-white/80 p-3 dark:border-navy-700 dark:bg-navy-950/40"
            >
              <textarea
                value={item.text}
                onChange={(e) => updateSWOTItem(item.id, { text: e.target.value })}
                rows={2}
                className="w-full resize-none bg-transparent text-sm text-slate-800 outline-none dark:text-slate-200"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={item.quadrant}
                  onChange={(e) =>
                    updateSWOTItem(item.id, {
                      quadrant: e.target.value as QuadrantId,
                    })
                  }
                  className="h-8 rounded-md border border-slate-300/70 bg-white px-2 text-xs dark:border-navy-600/50 dark:bg-navy-900"
                >
                  {allQuadrants.map((quadrantOption) => (
                    <option key={quadrantOption} value={quadrantOption}>
                      {isPolish
                        ? QUADRANT_META[quadrantOption].title.pl
                        : QUADRANT_META[quadrantOption].title.en}
                    </option>
                  ))}
                </select>
                <select
                  value={item.impact}
                  onChange={(e) =>
                    updateSWOTItem(item.id, {
                      impact: e.target.value as SWOTItem['impact'],
                    })
                  }
                  className="h-8 rounded-md border border-slate-300/70 bg-white px-2 text-xs dark:border-navy-600/50 dark:bg-navy-900"
                >
                  <option value="high">{isPolish ? 'Wysoki wpływ' : 'High impact'}</option>
                  <option value="medium">{isPolish ? 'Średni wpływ' : 'Medium impact'}</option>
                  <option value="low">{isPolish ? 'Niski wpływ' : 'Low impact'}</option>
                </select>
                <select
                  value={item.confidence ?? 3}
                  onChange={(e) =>
                    updateSWOTItem(item.id, {
                      confidence: Number(e.target.value) || 3,
                    })
                  }
                  className="h-8 rounded-md border border-slate-300/70 bg-white px-2 text-xs dark:border-navy-600/50 dark:bg-navy-900"
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {isPolish ? `Pewność ${value}/5` : `Confidence ${value}/5`}
                    </option>
                  ))}
                </select>
                <select
                  value={item.status || 'accepted'}
                  onChange={(e) =>
                    updateSWOTItem(item.id, {
                      status: e.target.value as SWOTItem['status'],
                    })
                  }
                  className="h-8 rounded-md border border-slate-300/70 bg-white px-2 text-xs dark:border-navy-600/50 dark:bg-navy-900"
                >
                  <option value="accepted">{isPolish ? 'Accepted' : 'Accepted'}</option>
                  <option value="proposed">{isPolish ? 'Proposed' : 'Proposed'}</option>
                </select>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500 dark:border-navy-700 dark:bg-navy-900/70 dark:text-slate-400">
                  {item.source === 'ai'
                    ? isPolish
                      ? 'AI'
                      : 'AI'
                    : isPolish
                      ? 'Użytkownik'
                      : 'User'}
                </span>
                {item.status === 'proposed' && (
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300">
                    {isPolish ? 'AI proposal' : 'AI proposal'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeSWOTItem(item.id)}
                  className="ml-auto rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SWOTBuildPhase({ session, isPolish }: { session: ToolSession; isPolish: boolean }) {
  const swotData = session.inputData as SWOTData;
  const signalsCount = swotData.signals?.length || 0;

  const groupedItems = useMemo(
    () => ({
      strengths: swotData.items.filter((item) => item.quadrant === 'strengths'),
      weaknesses: swotData.items.filter((item) => item.quadrant === 'weaknesses'),
      opportunities: swotData.items.filter((item) => item.quadrant === 'opportunities'),
      threats: swotData.items.filter((item) => item.quadrant === 'threats'),
    }),
    [swotData.items]
  );
  const allQuadrants: QuadrantId[] = ['strengths', 'weaknesses', 'opportunities', 'threats'];
  const storyLens = [
    {
      label: isPolish ? 'Strongest strengths' : 'Strongest strengths',
      item:
        groupedItems.strengths.find((item) => item.impact === 'high') || groupedItems.strengths[0],
    },
    {
      label: isPolish ? 'Critical weaknesses' : 'Critical weaknesses',
      item:
        groupedItems.weaknesses.find((item) => item.impact === 'high') ||
        groupedItems.weaknesses[0],
    },
    {
      label: isPolish ? 'Highest upside opportunities' : 'Highest upside opportunities',
      item:
        groupedItems.opportunities.find((item) => item.impact === 'high') ||
        groupedItems.opportunities[0],
    },
    {
      label: isPolish ? 'Most urgent threats' : 'Most urgent threats',
      item: groupedItems.threats.find((item) => item.impact === 'high') || groupedItems.threats[0],
    },
  ];
  const proposedCount = swotData.items.filter((item) => item.status === 'proposed').length;
  const acceptedCount = swotData.items.filter((item) => item.status !== 'proposed').length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
        <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {isPolish
            ? `Budujemy macierz SWOT na bazie ${signalsCount} sygnałów. Akceptowane karty są kanoniczną warstwą analizy, a propozycje AI pozostają jawnie oznaczone.`
            : `We are building the SWOT matrix from ${signalsCount} signals. Accepted cards are the canonical analysis layer, while AI proposals remain explicitly marked.`}
        </div>
        <InlineAssist
          hint={
            isPolish
              ? 'Każda karta powinna być konkretna, weryfikowalna i przypisana do właściwej logiki internal vs external.'
              : 'Each card should be concrete, verifiable, and clearly assigned to the right internal vs external logic.'
          }
        />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            {isPolish ? 'Signals used' : 'Signals used'}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {signalsCount}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            {isPolish ? 'Accepted cards' : 'Accepted cards'}
          </div>
          <div className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-300">
            {acceptedCount}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            {isPolish ? 'Proposals' : 'Proposals'}
          </div>
          <div className="mt-2 text-2xl font-semibold text-violet-600 dark:text-violet-300">
            {proposedCount}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            {isPolish ? 'Quadrants covered' : 'Quadrants covered'}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {Object.values(groupedItems).filter((items) => items.length > 0).length}/4
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {storyLens.map((lens) => (
          <div
            key={lens.label}
            className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40"
          >
            <div className="text-[11px] uppercase tracking-wide text-slate-400">{lens.label}</div>
            <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              {lens.item?.text || (isPolish ? 'Brak jeszcze karty' : 'No card yet')}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <QuadrantCard
          quadrant="strengths"
          items={groupedItems.strengths}
          isPolish={isPolish}
          allQuadrants={allQuadrants}
        />
        <QuadrantCard
          quadrant="weaknesses"
          items={groupedItems.weaknesses}
          isPolish={isPolish}
          allQuadrants={allQuadrants}
        />
        <QuadrantCard
          quadrant="opportunities"
          items={groupedItems.opportunities}
          isPolish={isPolish}
          allQuadrants={allQuadrants}
        />
        <QuadrantCard
          quadrant="threats"
          items={groupedItems.threats}
          isPolish={isPolish}
          allQuadrants={allQuadrants}
        />
      </div>
    </div>
  );
}

export default SWOTBuildPhase;
