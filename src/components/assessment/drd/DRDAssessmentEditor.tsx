import { CheckCircle2, ChevronDown, Menu, Search, X } from 'lucide-react';
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
  onAxisChange?: (axisId: number) => void;
  currentAxisId?: number;
};

export const DRDAssessmentEditor: React.FC<Props> = ({
  assessmentId,
  readOnly = false,
  value,
  onChange,
  onAxisChange,
  currentAxisId,
}) => {
  const [axisId, setAxisId] = useState<number>(currentAxisId || 1);
  const [areaId, setAreaId] = useState<string>(DRD_STRUCTURE[0]?.areas?.[0]?.id || '1A');
  const [search, setSearch] = useState('');

  // Sync with external axis control
  React.useEffect(() => {
    if (currentAxisId !== undefined && currentAxisId !== axisId) {
      setAxisId(currentAxisId);
      // Reset to first area of new axis
      const newAxis = DRD_STRUCTURE.find((a) => a.id === currentAxisId);
      if (newAxis?.areas?.[0]) {
        setAreaId(newAxis.areas[0].id);
      }
      // Scroll to top when axis changes externally
      setTimeout(() => {
        levelsContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }, [currentAxisId, axisId]);

  const levelsContainerRef = React.useRef<HTMLDivElement>(null);

  const handleAxisChange = (newAxisId: number) => {
    setAxisId(newAxisId);
    const newAxis = DRD_STRUCTURE.find((a) => a.id === newAxisId);
    if (newAxis?.areas?.[0]) {
      setAreaId(newAxis.areas[0].id);
    }
    onAxisChange?.(newAxisId);
    // Scroll to top when axis changes
    setTimeout(() => {
      levelsContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

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
      return nameEN.includes(q) || a.id.toLowerCase().includes(q);
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

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="h-full flex bg-slate-50 dark:bg-navy-950">
      {/* Left: Axis + Area */}
      <div
        className={`${
          isSidebarOpen ? 'w-[320px]' : 'w-0'
        } shrink-0 border-r border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 transition-all duration-200 overflow-hidden`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-navy-800">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              DRD
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">Axis</label>
            <div className="relative">
              <select
                value={axisId}
                onChange={(e) => handleAxisChange(Number(e.target.value))}
                className="w-full h-10 px-3 pr-10 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              >
                {DRD_STRUCTURE.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id}. {a.name}
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
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="text-xs font-mono text-slate-400">{a.id}</div>
                      {(() => {
                        const areaState = getAreaState(value, a.id, axis?.levelCount || 5);
                        const isComplete = areaState.achievedLevel >= (axis?.levelCount || 5);
                        if (isComplete) {
                          return (
                            <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" title="All levels completed" />
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="text-sm font-medium truncate">{a.name}</div>
                    {/* Progress bar per area */}
                    {(() => {
                      const areaState = getAreaState(value, a.id, axis?.levelCount || 5);
                      const progress = (areaState.achievedLevel / (axis?.levelCount || 5)) * 100;
                      if (progress > 0) {
                        return (
                          <div className="mt-1.5 h-1 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="text-[10px] px-2 py-1 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 shrink-0">
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
      <div ref={levelsContainerRef} className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto">
          {/* Mobile: Toggle sidebar button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden mb-4 p-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 flex items-center gap-2"
          >
            {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            <span className="text-sm font-medium">Areas</span>
          </button>

          <div className="mb-6">
            <div className="text-xs font-mono text-slate-400">{areaId}</div>
            <div className="text-xl md:text-2xl font-semibold text-navy-900 dark:text-white">
              {selectedArea?.name || 'Area'}
            </div>
            <div className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Axis: {selectedAxis?.id}. {selectedAxis?.name} · Answers: Yes/No per level ·
              Attachments per level
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
                  className={`bg-white dark:bg-navy-900 border rounded-xl p-5 transition-colors ${
                    achieved
                      ? 'border-green-200 dark:border-green-900/40 bg-green-50/30 dark:bg-green-950/10'
                      : 'border-slate-200 dark:border-navy-700'
                  }`}
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
                        <span className="flex items-center gap-1.5">
                          {achieved && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                          Yes (in place)
                        </span>
                      </label>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {achieved
                          ? 'Level achieved. Unchecking lowers the maximum achieved level.'
                          : 'Unchecking lowers the maximum achieved level.'}
                      </div>
                    </div>
                  </div>

                  {/* Questions */}
                  <div className="mt-4 grid md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-navy-950/40 border border-slate-200 dark:border-navy-800 rounded-lg p-4">
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span>3 yes/no validation questions</span>
                        {achieved && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            Verified
                          </span>
                        )}
                      </div>
                      <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                        {knowledge.questions.map((q, idx) => (
                          <li key={idx} className="flex gap-2">
                            <span className="text-purple-500/70 mt-0.5 shrink-0">•</span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-slate-50 dark:bg-navy-950/40 border border-slate-200 dark:border-navy-800 rounded-lg p-4">
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        Example + suggested technologies
                      </div>
                      <div className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                        {knowledge.example}
                      </div>
                      <div className="flex flex-wrap gap-2">
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
