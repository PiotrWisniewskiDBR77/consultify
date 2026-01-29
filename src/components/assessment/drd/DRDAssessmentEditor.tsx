import { ChevronDown, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { LevelAttachments } from '@/components/assessment/LevelAttachments';
import { getDRDKnowledge } from '@/services/assessmentKnowledge/drdKnowledge';
import { DRD_AXIS_KEY_MAP, DRD_STRUCTURE, DRDArea, DRDAxis } from '@/services/drdStructure';

type AreaState = {
  achievedLevel: number; // 0..levelCount
  targetLevel?: number;
  levelNotes?: Record<string, string>; // levelNumber -> note
};

export type DRDEditorAnswers = {
  areas?: Record<string, AreaState>;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getAxisKey(axisId: number): string {
  return DRD_AXIS_KEY_MAP[axisId] || 'processes';
}

function getAreaState(
  answers: DRDEditorAnswers | undefined,
  areaId: string,
  levelCount: number
): AreaState {
  const s = answers?.areas?.[areaId];
  if (!s) return { achievedLevel: 0, levelNotes: {} };
  return {
    achievedLevel: clamp(Number(s.achievedLevel || 0), 0, levelCount),
    targetLevel: s.targetLevel ? clamp(Number(s.targetLevel), 1, levelCount) : undefined,
    levelNotes: s.levelNotes || {},
  };
}

function setAreaState(
  answers: DRDEditorAnswers | undefined,
  areaId: string,
  next: AreaState
): DRDEditorAnswers {
  return {
    ...(answers || {}),
    areas: {
      ...(answers?.areas || {}),
      [areaId]: next,
    },
  };
}

type Props = {
  assessmentId: string;
  readOnly?: boolean;
  value: DRDEditorAnswers | undefined;
  onChange: (next: DRDEditorAnswers) => void;
};

export const DRDAssessmentEditor: React.FC<Props> = ({
  assessmentId,
  readOnly = false,
  value,
  onChange,
}) => {
  const [axisId, setAxisId] = useState<number>(1);
  const [areaId, setAreaId] = useState<string>(DRD_STRUCTURE[0]?.areas?.[0]?.id || '1A');
  const [search, setSearch] = useState('');

  const axis: DRDAxis | undefined = useMemo(
    () => DRD_STRUCTURE.find((a) => a.id === axisId),
    [axisId]
  );
  const axisAreas = axis?.areas || [];

  const filteredAreas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return axisAreas;
    return axisAreas.filter((a) => {
      const nameEN = (a.name || '').toLowerCase();
      const namePL = (a.namePL || '').toLowerCase();
      return nameEN.includes(q) || namePL.includes(q) || a.id.toLowerCase().includes(q);
    });
  }, [axisAreas, search]);

  // Ensure currently selected area remains valid when axis changes/search filters out
  React.useEffect(() => {
    if (!axisAreas.some((a) => a.id === areaId)) {
      setAreaId(axisAreas[0]?.id || areaId);
    }
  }, [axisId]); // intentionally only axis change

  const selectedArea: DRDArea | undefined = useMemo(() => {
    for (const ax of DRD_STRUCTURE) {
      const found = ax.areas.find((a) => a.id === areaId);
      if (found) return found;
    }
    return undefined;
  }, [areaId]);

  const selectedAxis: DRDAxis | undefined = useMemo(() => {
    return DRD_STRUCTURE.find((a) => a.areas.some((ar) => ar.id === areaId));
  }, [areaId]);

  const levelCount = selectedAxis?.levelCount || 5;
  const state = getAreaState(value, areaId, levelCount);
  const axisKey = getAxisKey(selectedAxis?.id || 1);

  const setAchieved = (lvl: number, checked: boolean) => {
    if (readOnly) return;
    const current = state.achievedLevel;
    const nextAchieved = checked ? Math.max(current, lvl) : Math.min(current, lvl - 1);
    onChange(
      setAreaState(value, areaId, { ...state, achievedLevel: clamp(nextAchieved, 0, levelCount) })
    );
  };

  const setLevelNote = (lvl: number, note: string) => {
    if (readOnly) return;
    const nextNotes = { ...(state.levelNotes || {}), [String(lvl)]: note };
    onChange(setAreaState(value, areaId, { ...state, levelNotes: nextNotes }));
  };

  return (
    <div className="h-full flex bg-slate-50 dark:bg-navy-950">
      {/* Left: Axis + Area */}
      <div className="w-[320px] shrink-0 border-r border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900">
        <div className="p-4 border-b border-slate-200 dark:border-navy-800">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            DRD
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">Axis</label>
            <div className="relative">
              <select
                value={axisId}
                onChange={(e) => setAxisId(Number(e.target.value))}
                className="w-full h-10 px-3 pr-10 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              >
                {DRD_STRUCTURE.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id}. {a.name || a.namePL}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="mt-3 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search area…"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
          </div>
        </div>

        <div className="p-2 overflow-auto h-[calc(100%-140px)]">
          {filteredAreas.map((a) => {
            const isActive = a.id === areaId;
            return (
              <button
                key={a.id}
                onClick={() => setAreaId(a.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                  isActive
                    ? 'border-purple-500/40 bg-purple-50 dark:bg-purple-900/10 text-purple-800 dark:text-purple-200'
                    : 'border-transparent hover:border-slate-200 dark:hover:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-950/40 text-slate-700 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-slate-400">{a.id}</div>
                    <div className="text-sm font-medium truncate">{a.name || a.namePL}</div>
                  </div>
                  <div className="text-[10px] px-2 py-1 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400">
                    {getAreaState(value, a.id, axis?.levelCount || 5).achievedLevel}/
                    {axis?.levelCount || 5}
                  </div>
                </div>
              </button>
            );
          })}
          {filteredAreas.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No results.
            </div>
          )}
        </div>
      </div>

      {/* Right: Levels */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <div className="text-xs font-mono text-slate-400">{areaId}</div>
            <div className="text-2xl font-semibold text-navy-900 dark:text-white">
              {selectedArea?.name || selectedArea?.namePL || 'Area'}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Axis: {selectedAxis?.id}. {selectedAxis?.name || selectedAxis?.namePL} · Answers:
              Yes/No per level · Attachments per level
            </div>
          </div>

          <div className="space-y-4">
            {(selectedArea?.levels || []).map((lvl) => {
              const achieved = state.achievedLevel >= lvl.level;
              const knowledge = getDRDKnowledge(areaId, lvl.level);
              const note = state.levelNotes?.[String(lvl.level)] || '';
              return (
                <div
                  key={lvl.level}
                  className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
                          {lvl.level}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-navy-900 dark:text-white truncate">
                            {lvl.title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {axisKey} · level {lvl.level}/{levelCount}
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {lvl.description}
                      </p>
                    </div>

                    <div className="shrink-0">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={achieved}
                          onChange={(e) => setAchieved(lvl.level, e.target.checked)}
                          disabled={readOnly}
                          className="h-5 w-5 rounded border-slate-300 dark:border-navy-600 text-purple-600 focus:ring-purple-500/30"
                        />
                        Yes (in place)
                      </label>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Unchecking lowers the maximum achieved level.
                      </div>
                    </div>
                  </div>

                  {/* Questions */}
                  <div className="mt-4 grid md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-navy-950/40 border border-slate-200 dark:border-navy-800 rounded-lg p-4">
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        3 yes/no validation questions
                      </div>
                      <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                        {knowledge.questions.map((q, idx) => (
                          <li key={idx} className="flex gap-2">
                            <span className="text-purple-500/70 mt-0.5">•</span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-slate-50 dark:bg-navy-950/40 border border-slate-200 dark:border-navy-800 rounded-lg p-4">
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Example + suggested technologies
                      </div>
                      <div className="text-sm text-slate-700 dark:text-slate-300">
                        {knowledge.example}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {knowledge.suggestedTechnologies.map((t) => (
                          <span
                            key={t}
                            className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Comment */}
                  <div className="mt-4">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Comment (per level)
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setLevelNote(lvl.level, e.target.value)}
                      placeholder="Why Yes/No? What evidence / gaps / context?"
                      disabled={readOnly}
                      rows={3}
                      className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                  </div>

                  {/* Attachments */}
                  <LevelAttachments
                    assessmentId={assessmentId}
                    axisId={axisKey}
                    areaId={areaId}
                    levelNumber={lvl.level}
                    readOnly={readOnly}
                    compact={false}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DRDAssessmentEditor;
