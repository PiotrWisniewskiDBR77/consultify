import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Grid2X2,
  HelpCircle,
  Link2,
  List,
  Maximize2,
  Menu,
  MessageSquare,
  Paperclip,
  User,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { AssessmentToolShell } from '@/components/assessment/AssessmentToolShell';
import { LevelAttachments } from '@/components/assessment/LevelAttachments';
import { getDRDKnowledge } from '@/services/assessmentKnowledge/drdKnowledge';
import { DRD_AXIS_KEY_MAP, DRD_STRUCTURE, DRDArea, DRDAxis } from '@/services/drdStructure';

type AreaState = {
  achievedLevel: number; // 0..levelCount
  targetLevel?: number;
  levelNotes?: Record<string, string>; // levelNumber -> note
  levelLinks?: Record<string, string[]>; // levelNumber -> list of URLs
  // Enterprise-friendly: explicit decision when left "transparent" on purpose.
  // Missing key => not assessed yet (also transparent).
  levelDecisions?: Record<string, 'skip'>; // levelNumber -> 'skip'
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
    levelLinks: (s as any).levelLinks || {},
    levelDecisions: (s as any).levelDecisions || {},
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
  /**
   * Optional override for the LEFT workspace content.
   * When provided, the right navigation panel stays visible unchanged.
   */
  leftOverride?: React.ReactNode;
  /**
   * Called when user switches between Survey/Preview in the right panel.
   * Useful to exit Manage/Logs overlays in the parent.
   */
  onViewModeChange?: (mode: 'surveys' | 'matrix') => void;
  onAxisChange?: (axisId: number) => void;
  currentAxisId?: number;
  onAreaChange?: (areaId: string) => void;
  currentAreaId?: string;
  onLevelChange?: (levelNumber: number) => void;
  currentLevel?: number;
  // Enterprise collaboration helpers
  currentUserId?: string;
  assignmentByAreaId?: Record<
    string,
    { area_id?: string; assigned_user_id?: string; status?: string; due_at?: string | null }
  >;
  onAssignToMe?: (areaId: string) => void;
};

export const DRDAssessmentEditor: React.FC<Props> = ({
  assessmentId,
  readOnly = false,
  value,
  onChange,
  leftOverride,
  onViewModeChange,
  onAxisChange,
  currentAxisId,
  onAreaChange,
  currentAreaId,
  onLevelChange,
  currentLevel,
  currentUserId,
  assignmentByAreaId,
  onAssignToMe,
}) => {
  const [axisId, setAxisId] = useState<number>(currentAxisId ?? 1);
  const [areaId, setAreaId] = useState<string>(
    currentAreaId ?? DRD_STRUCTURE[0]?.areas?.[0]?.id ?? '1A'
  );
  // Default to Matrix: new primary UX for assessment navigation.
  const [viewMode, setViewMode] = useState<'surveys' | 'matrix'>('matrix');
  const [isMatrixFullscreen, setIsMatrixFullscreen] = useState(false);
  const [activeLevel, setActiveLevel] = useState<number>(currentLevel ?? 1);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  // In matrix, we want content visible by default (tech examples per cell)
  const [matrixShowText, setMatrixShowText] = useState(true);
  const [matrixCompact, setMatrixCompact] = useState(true);
  const [activeCardPanel, setActiveCardPanel] = useState<
    'questions' | 'comment' | 'attachments' | 'links' | null
  >(null);
  const [linkDraft, setLinkDraft] = useState('');

  // Sync with external axis control
  React.useEffect(() => {
    if (currentAxisId !== undefined && currentAxisId !== axisId) {
      setAxisId(currentAxisId);
      // Reset to first area of new axis
      const newAxis = DRD_STRUCTURE.find((a) => a.id === currentAxisId);
      if (newAxis?.areas?.[0]) {
        setAreaId(newAxis.areas[0].id);
        onAreaChange?.(newAxis.areas[0].id);
      }
      // Scroll to top when axis changes externally
      setTimeout(() => {
        levelsContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }, [currentAxisId, axisId]);

  // Sync with external area control
  React.useEffect(() => {
    if (currentAreaId !== undefined && currentAreaId !== areaId) {
      setAreaId(currentAreaId);
      // If external area points to another axis, align axis selection too.
      const ax = DRD_STRUCTURE.find((a) => a.areas.some((ar) => ar.id === currentAreaId));
      if (ax && ax.id !== axisId) {
        setAxisId(ax.id);
        onAxisChange?.(ax.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAreaId]);

  // Sync with external level control
  React.useEffect(() => {
    if (currentLevel !== undefined && currentLevel !== activeLevel) {
      setActiveLevel(currentLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevel]);

  const levelsContainerRef = React.useRef<HTMLDivElement>(null);

  const handleAxisChange = (newAxisId: number) => {
    setAxisId(newAxisId);
    const newAxis = DRD_STRUCTURE.find((a) => a.id === newAxisId);
    if (newAxis?.areas?.[0]) {
      setAreaId(newAxis.areas[0].id);
      onAreaChange?.(newAxis.areas[0].id);
    }
    onAxisChange?.(newAxisId);
    // Scroll to top when axis changes
    setTimeout(() => {
      levelsContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const setLevel = (lvl: number) => {
    setActiveLevel(lvl);
    onLevelChange?.(lvl);
    setIsDetailsOpen(true);
    setActiveCardPanel(null);
    setLinkDraft('');
    // Keep navigation snappy: bring the active card into view.
    setTimeout(() => {
      const el = document.getElementById(`drd-level-${lvl}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const axis: DRDAxis | undefined = useMemo(
    () => DRD_STRUCTURE.find((a) => a.id === axisId),
    [axisId]
  );
  const axisAreas = axis?.areas || [];

  const filteredAreas = useMemo(() => axisAreas, [axisAreas]);

  // Ensure currently selected area remains valid when axis changes/search filters out
  React.useEffect(() => {
    if (!axisAreas.some((a) => a.id === areaId)) {
      setAreaId(axisAreas[0]?.id || areaId);
      if (axisAreas[0]?.id) onAreaChange?.(axisAreas[0].id);
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

  // When area changes, default focus to "next likely" level (achieved+1), unless controlled externally.
  React.useEffect(() => {
    setActiveCardPanel(null);
    setLinkDraft('');
    if (currentLevel === undefined) {
      const s = getAreaState(value, areaId, levelCount);
      const next = clamp((s.achievedLevel || 0) + 1, 1, levelCount);
      setActiveLevel(next);
      onLevelChange?.(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId]);

  // Report internal level changes
  React.useEffect(() => {
    onLevelChange?.(activeLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLevel]);

  // Close fullscreen matrix on Escape
  React.useEffect(() => {
    if (!isMatrixFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMatrixFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMatrixFullscreen]);

  const setAchieved = (lvl: number, checked: boolean) => {
    if (readOnly) return;
    const current = state.achievedLevel;
    const nextAchieved = checked ? Math.max(current, lvl) : Math.min(current, lvl - 1);
    const next = { ...state, achievedLevel: clamp(nextAchieved, 0, levelCount) };
    // If a level is achieved, it cannot be "skipped" anymore. Clean up skip flags <= achievedLevel.
    if (next.levelDecisions && Object.keys(next.levelDecisions).length > 0) {
      const cleaned: Record<string, 'skip'> = { ...next.levelDecisions };
      for (const k of Object.keys(cleaned)) {
        const n = Number(k);
        if (Number.isFinite(n) && n <= (next.achievedLevel || 0)) delete cleaned[k];
      }
      next.levelDecisions = cleaned;
    }
    onChange(setAreaState(value, areaId, next));
  };

  const setLevelDecision = (lvl: number, decision: 'skip' | undefined) => {
    if (readOnly) return;
    const nextDecisions: Record<string, 'skip'> = { ...(state.levelDecisions || {}) };
    if (!decision) {
      delete nextDecisions[String(lvl)];
    } else {
      nextDecisions[String(lvl)] = decision;
    }
    onChange(setAreaState(value, areaId, { ...state, levelDecisions: nextDecisions }));
  };

  const setLevelNote = (lvl: number, note: string) => {
    if (readOnly) return;
    const nextNotes = { ...(state.levelNotes || {}), [String(lvl)]: note };
    onChange(setAreaState(value, areaId, { ...state, levelNotes: nextNotes }));
  };

  const addLevelLink = (lvl: number, url: string) => {
    if (readOnly) return;
    const cleaned = String(url || '').trim();
    if (!cleaned) return;
    const key = String(lvl);
    const current = Array.isArray(state.levelLinks?.[key]) ? state.levelLinks?.[key] : [];
    const nextForLvl = Array.from(new Set([...current, cleaned]));
    const nextLinks = { ...(state.levelLinks || {}), [key]: nextForLvl };
    onChange(setAreaState(value, areaId, { ...state, levelLinks: nextLinks }));
  };

  const removeLevelLink = (lvl: number, url: string) => {
    if (readOnly) return;
    const key = String(lvl);
    const current = Array.isArray(state.levelLinks?.[key]) ? state.levelLinks?.[key] : [];
    const nextForLvl = current.filter((x) => String(x) !== String(url));
    const nextLinks = { ...(state.levelLinks || {}) };
    if (nextForLvl.length > 0) nextLinks[key] = nextForLvl;
    else delete nextLinks[key];
    onChange(setAreaState(value, areaId, { ...state, levelLinks: nextLinks }));
  };

  const setTargetLevel = (lvl: number | undefined) => {
    if (readOnly) return;
    const nextTarget = lvl ? clamp(Number(lvl), 1, levelCount) : undefined;
    onChange(setAreaState(value, areaId, { ...state, targetLevel: nextTarget }));
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const navPanel = (
    <div className="h-full flex flex-col">
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

        <button
          type="button"
          onClick={() => {
            setViewMode((m) => {
              const next = m === 'surveys' ? 'matrix' : 'surveys';
              onViewModeChange?.(next);
              return next;
            });
          }}
          className="w-full h-10 px-4 rounded-lg border border-navy-700 bg-navy-950 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-navy-900 transition-colors"
        >
          {viewMode === 'surveys' ? (
            <>
              <Grid2X2 className="w-4 h-4" />
              Preview
            </>
          ) : (
            <>
              <List className="w-4 h-4" />
              Survey
            </>
          )}
        </button>

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
      </div>

      <div className="p-2 overflow-auto flex-1">
        {filteredAreas.map((a) => {
          const isActive = a.id === areaId;
          const assignedTo = assignmentByAreaId?.[a.id]?.assigned_user_id;
          const isMine = !!currentUserId && String(assignedTo || '') === String(currentUserId);
          return (
            <button
              key={a.id}
              onClick={() => {
                setAreaId(a.id);
                onAreaChange?.(a.id);
                setViewMode('surveys');
              }}
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
                    {isMine && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100/70 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/30"
                        title="Assigned to you"
                      >
                        <User className="w-3 h-3" />
                        me
                      </span>
                    )}
                    {(() => {
                      const areaState = getAreaState(value, a.id, axis?.levelCount || 5);
                      const isComplete = areaState.achievedLevel >= (axis?.levelCount || 5);
                      if (isComplete) {
                        return <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />;
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
  );

  const contentPanel = (
    <div ref={levelsContainerRef} className="h-full overflow-auto p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Mobile: Toggle sidebar button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden mb-4 p-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 flex items-center gap-2"
        >
          {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          <span className="text-sm font-medium">Navigation</span>
        </button>

        {/* ===================================================================== */}
        {/* MATRIX VIEW (enterprise / BCG-style)                                  */}
        {/* ===================================================================== */}
        {viewMode === 'matrix' && (
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-navy-950 shadow-2xl">
            {/* Background glow */}
            <div className="pointer-events-none absolute -top-40 -right-40 h-[420px] w-[420px] rounded-full bg-purple-600/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-48 -left-40 h-[460px] w-[460px] rounded-full bg-blue-500/10 blur-3xl" />

            <div className="relative p-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-xs font-semibold tracking-widest uppercase text-purple-300/90">
                    Digital Development Map
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {axis?.id}. {axis?.name}
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    Process Digitalization Assessment Matrix
                  </div>
                </div>

                {/* Right side: Legend + Fullscreen */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-2 text-xs text-slate-200">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full bg-purple-500 shadow-[0_0_18px_rgba(168,85,247,0.45)]" />
                        <span>AS-IS</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full bg-blue-500/70 ring-1 ring-blue-300/60" />
                        <span>TO-BE</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full bg-white/10 ring-1 ring-white/15" />
                        <span>Not assessed</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-300">
                      <label className="inline-flex items-center gap-2 select-none">
                        <input
                          type="checkbox"
                          checked={!matrixCompact}
                          onChange={(e) => setMatrixCompact(!e.target.checked)}
                          className="h-4 w-4 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/30"
                        />
                        Spacious
                      </label>
                      <label className="inline-flex items-center gap-2 select-none">
                        <input
                          type="checkbox"
                          checked={matrixShowText}
                          onChange={(e) => setMatrixShowText(e.target.checked)}
                          className="h-4 w-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/30"
                        />
                        Show technologies
                      </label>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsMatrixFullscreen(true)}
                    className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-white/10 bg-white/5 text-white text-xs font-semibold hover:bg-white/10 transition-colors"
                    title="Open matrix in full screen"
                  >
                    <Maximize2 className="w-4 h-4" />
                    Full screen
                  </button>
                </div>
              </div>

              {/* Matrix */}
              <div className="mt-6 overflow-x-auto pb-2">
                <div
                  className="grid gap-2 min-w-[1100px]"
                  style={{
                    gridTemplateColumns: `240px repeat(${axisAreas.length}, minmax(150px, 1fr))`,
                  }}
                >
                  {/* Top header row */}
                  <div className="sticky top-0 left-0 z-30 rounded-xl border border-white/10 bg-navy-950/95 backdrop-blur p-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                    <div className="text-sm font-semibold text-white">Maturity level</div>
                    <div className="text-[11px] text-slate-300">Rows (higher → lower)</div>
                    <div className="mt-2 text-[11px] text-slate-300 leading-snug">
                      Click: open details · Shift+Click: set TO-BE
                    </div>
                  </div>
                  {axisAreas.map((area) => (
                    <div
                      key={`h-${area.id}`}
                      className="sticky top-0 z-20 rounded-xl border border-white/10 bg-navy-950/95 backdrop-blur p-3 shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
                    >
                      {/* X-axis labels + AS/TO moved to bottom strip */}
                      <div className="min-h-[56px]" />
                    </div>
                  ))}

                  {/* Level rows (high -> low) */}
                  {Array.from({ length: levelCount }, (_, i) => levelCount - i).map((level) => {
                    const levelLabels: Record<number, string> = {
                      1: 'Basic / Manual',
                      2: 'Digitized',
                      3: 'Integrated',
                      4: 'Automated',
                      5: 'Optimized',
                      6: 'AI-Driven',
                      7: 'Autonomous',
                    };
                    const label = levelLabels[level] || `Level ${level}`;

                    return (
                      <React.Fragment key={`row-${level}`}>
                        {/* Row label */}
                        <div className="sticky left-0 z-10 rounded-xl border border-white/10 bg-gradient-to-r from-purple-700/30 to-navy-950/60 backdrop-blur p-3 shadow-[10px_0_30px_rgba(0,0,0,0.18)]">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-white font-bold">
                              <span className="text-purple-200">{level}.</span> {label}
                            </div>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-300">Hover: see details</div>
                        </div>

                        {/* Cells */}
                        {axisAreas.map((area) => {
                          const s = getAreaState(value, area.id, levelCount);
                          const achieved = s.achievedLevel || 0;
                          const target = s.targetLevel || 0;

                          const isAchieved = level <= achieved;
                          const isTarget = target > 0 && level <= target && !isAchieved;

                          const areaLevelInfo = area.levels?.find((l) => l.level === level);
                          const knowledge = getDRDKnowledge(area.id, level);
                          const techs = knowledge?.suggestedTechnologies || [];
                          const displayTechs = techs.slice(0, matrixCompact ? 2 : 3);

                          return (
                            <button
                              key={`${area.id}-${level}`}
                              type="button"
                              className={`group rounded-xl border border-white/10 bg-white/5 text-left hover:bg-white/7 transition-colors ${
                                matrixCompact ? 'p-2' : 'p-3'
                              }`}
                              onClick={(e) => {
                                if (e.shiftKey && !readOnly) {
                                  const cur = getAreaState(value, area.id, levelCount);
                                  onChange(
                                    setAreaState(value, area.id, {
                                      ...cur,
                                      targetLevel: clamp(level, 1, levelCount),
                                    })
                                  );
                                  return;
                                }
                                setAreaId(area.id);
                                onAreaChange?.(area.id);
                                setLevel(level);
                                setViewMode('surveys');
                              }}
                              title={`${area.name} · Level ${level}${areaLevelInfo?.title ? ` · ${areaLevelInfo.title}` : ''}${
                                isAchieved ? ' · AS-IS' : isTarget ? ' · TO-BE' : ''
                              }`}
                              aria-label={`${area.name}, level ${level}`}
                            >
                              {/* “Cloud” bubble */}
                              <div
                                className={`relative rounded-2xl ${
                                  matrixCompact
                                    ? 'px-3 py-2 min-h-[52px]'
                                    : 'px-3 py-2.5 min-h-[64px]'
                                } flex items-center ${
                                  isAchieved
                                    ? 'bg-purple-500/70 text-white shadow-[0_0_22px_rgba(168,85,247,0.30)] ring-1 ring-purple-300/60'
                                    : isTarget
                                      ? 'bg-blue-500/15 text-blue-100 ring-1 ring-blue-300/60'
                                      : 'bg-navy-900/40 text-slate-200/80 ring-1 ring-white/10'
                                } backdrop-blur-sm`}
                              >
                                {/* Scan-first marker */}
                                <div className="mr-3 shrink-0 flex flex-col items-center justify-center">
                                  <div
                                    className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-extrabold ${
                                      isAchieved
                                        ? 'bg-white/15 ring-1 ring-white/20 text-white'
                                        : isTarget
                                          ? 'bg-blue-500/20 ring-1 ring-blue-300/40 text-blue-100'
                                          : 'bg-white/5 ring-1 ring-white/10 text-slate-300'
                                    }`}
                                  >
                                    {level}
                                  </div>
                                  {!matrixCompact && (
                                    <div className="mt-1 text-[10px] text-slate-200/80">
                                      {isAchieved ? 'AS' : isTarget ? 'TO' : '—'}
                                    </div>
                                  )}
                                </div>

                                {/* Optional always-on content (technologies per cell) */}
                                <div className="min-w-0 flex-1">
                                  {matrixShowText ? (
                                    <div className="space-y-1">
                                      <div className="flex flex-wrap gap-1">
                                        {displayTechs.length > 0 ? (
                                          displayTechs.map((t) => (
                                            <span
                                              key={t}
                                              className={`max-w-full truncate px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                isAchieved
                                                  ? 'bg-white/15 text-white ring-1 ring-white/15'
                                                  : isTarget
                                                    ? 'bg-blue-500/20 text-blue-100 ring-1 ring-blue-300/30'
                                                    : 'bg-white/8 text-slate-200 ring-1 ring-white/10'
                                              }`}
                                              title={t}
                                            >
                                              {t}
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-[11px] text-slate-400">—</span>
                                        )}
                                        {techs.length > displayTechs.length && (
                                          <span className="text-[10px] text-slate-200/70">
                                            +{techs.length - displayTechs.length}
                                          </span>
                                        )}
                                      </div>
                                      {!matrixCompact && areaLevelInfo?.title && (
                                        <div className="text-[10px] text-slate-200/75 line-clamp-1">
                                          {areaLevelInfo.title}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-[11px] leading-snug text-slate-200/75">
                                      <span className="text-slate-300/70">Hover for details</span>
                                    </div>
                                  )}
                                </div>

                                {/* Hover tooltip (keeps grid clean) */}
                                {!matrixShowText && (
                                  <div className="pointer-events-none absolute left-2 right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="rounded-lg border border-white/10 bg-navy-950/95 backdrop-blur px-2 py-1 text-[11px] text-slate-100 shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
                                      <div className="font-semibold text-white">
                                        {area.id} · Level {level}
                                      </div>
                                      <div className="text-slate-200/90">
                                        {areaLevelInfo?.title || '—'}
                                      </div>
                                      {techs.length > 0 && (
                                        <div className="mt-1 text-slate-200/80">
                                          {techs.slice(0, 6).join(' · ')}
                                          {techs.length > 6 ? ` · +${techs.length - 6} more` : ''}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Corner markers */}
                                {isAchieved && (
                                  <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 ring-2 ring-navy-950">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                  </span>
                                )}
                                {isTarget && (
                                  <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 ring-2 ring-navy-950" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}

                  {/* Bottom X-axis strip (process areas) */}
                  <div className="sticky bottom-0 left-0 z-30 rounded-xl border border-white/10 bg-navy-950/95 backdrop-blur p-3 shadow-[0_-10px_30px_rgba(0,0,0,0.35)]">
                    <div className="text-sm font-semibold text-white">Process area</div>
                    <div className="text-[11px] text-slate-300">X-axis</div>
                  </div>
                  {axisAreas.map((area) => (
                    <button
                      key={`x-${area.id}`}
                      type="button"
                      onClick={() => {
                        setAreaId(area.id);
                        onAreaChange?.(area.id);
                        setViewMode('surveys');
                      }}
                      className="sticky bottom-0 z-20 rounded-xl border border-white/10 bg-gradient-to-b from-white/10 to-white/6 backdrop-blur p-3 text-left hover:from-white/14 hover:to-white/8 transition-colors shadow-[0_-10px_30px_rgba(0,0,0,0.22)] relative"
                    >
                      <div className="pr-24">
                        <div className="text-[11px] font-mono text-slate-300">{area.id}</div>
                        <div className="mt-0.5 text-sm font-semibold text-white leading-snug line-clamp-2">
                          {area.name}
                        </div>
                      </div>
                      {(() => {
                        const s = getAreaState(value, area.id, levelCount);
                        const achieved = s.achievedLevel || 0;
                        const target = s.targetLevel || 0;
                        if (achieved === 0 && target === 0) return null;
                        return (
                          <div className="absolute top-2 right-2 flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 ring-1 ring-purple-300/30 text-[10px] font-semibold text-purple-100">
                              AS {achieved || '—'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md bg-blue-500/15 ring-1 ring-blue-300/30 text-[10px] font-semibold text-blue-100">
                              TO {target || '—'}
                            </span>
                          </div>
                        );
                      })()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary strip */}
              {(() => {
                const stats = axisAreas.reduce(
                  (acc, area) => {
                    const s = getAreaState(value, area.id, levelCount);
                    const a = s.achievedLevel || 0;
                    const t = s.targetLevel || 0;
                    if (a > 0) {
                      acc.countActual++;
                      acc.sumActual += a;
                    }
                    if (t > 0) {
                      acc.countTarget++;
                      acc.sumTarget += t;
                    }
                    if (a > 0 || t > 0) acc.assessed++;
                    return acc;
                  },
                  { sumActual: 0, sumTarget: 0, countActual: 0, countTarget: 0, assessed: 0 }
                );

                const avgActual =
                  stats.countActual > 0 ? (stats.sumActual / stats.countActual).toFixed(1) : '—';
                const avgTarget =
                  stats.countTarget > 0 ? (stats.sumTarget / stats.countTarget).toFixed(1) : '—';
                const avgGap =
                  stats.countTarget > 0 && stats.countActual > 0
                    ? (Number(avgTarget) - Number(avgActual)).toFixed(1)
                    : '—';

                return (
                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="text-3xl font-extrabold text-white tabular-nums">
                        {avgActual}
                      </div>
                      <div className="mt-1 text-xs text-slate-300">Avg. Current Level</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="text-3xl font-extrabold text-white tabular-nums">
                        {avgTarget}
                      </div>
                      <div className="mt-1 text-xs text-slate-300">Avg. Target Level</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="text-3xl font-extrabold text-white tabular-nums">
                        {avgGap}
                      </div>
                      <div className="mt-1 text-xs text-slate-300">Avg. Gap</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="text-3xl font-extrabold text-white tabular-nums">
                        {stats.assessed}/{axisAreas.length}
                      </div>
                      <div className="mt-1 text-xs text-slate-300">Areas Assessed</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* SURVEYS VIEW (existing)                                               */}
        {/* ===================================================================== */}
        {viewMode === 'surveys' && (
          <>
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs font-mono text-slate-400">{areaId}</div>
                <div className="text-xl md:text-2xl font-semibold text-navy-900 dark:text-white">
                  {selectedArea?.name || 'Area'}
                </div>
                <div className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Axis: {selectedAxis?.id}. {selectedAxis?.name} · Answers: Yes/No per level ·
                  Attachments per level
                </div>
              </div>
            </div>

            {/* Make room for the pinned decision bar */}
            <div className="space-y-4 pb-28">
              {(selectedArea?.levels || []).map((lvl) => {
                const achieved = state.achievedLevel >= lvl.level;
                const isImplicit = achieved && (state.achievedLevel || 0) > lvl.level;
                const isTarget = (state.targetLevel || 0) === lvl.level;
                const isSkipped = (state.levelDecisions || {})[String(lvl.level)] === 'skip';
                const knowledge = getDRDKnowledge(areaId, lvl.level);
                const note = state.levelNotes?.[String(lvl.level)] || '';
                const isSelected = activeLevel === lvl.level;
                const isOpen = isSelected && isDetailsOpen;
                return (
                  <div
                    id={`drd-level-${lvl.level}`}
                    key={lvl.level}
                    onClick={() => {
                      if (!isSelected) setLevel(lvl.level);
                      else setIsDetailsOpen(true);
                    }}
                    className={`bg-white dark:bg-navy-900 border rounded-xl transition-colors ${
                      isOpen ? 'ring-2 ring-blue-500/30 p-5' : 'p-3'
                    } ${
                      achieved
                        ? 'border-green-200 dark:border-green-900/40 bg-green-50/30 dark:bg-green-950/10'
                        : isTarget
                          ? 'border-purple-300/50 dark:border-purple-800/50'
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
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-navy-900 dark:text-white truncate">
                                {lvl.title}
                              </div>
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                  achieved
                                    ? 'bg-green-100/60 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200/60 dark:border-green-900/30'
                                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-navy-700'
                                }`}
                              >
                                {achieved
                                  ? isImplicit
                                    ? 'Achieved (implicit)'
                                    : 'Achieved'
                                  : 'Not achieved'}
                              </span>
                              {isTarget && !achieved && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full border bg-purple-100/60 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200/60 dark:border-purple-900/30">
                                  Target
                                </span>
                              )}
                              {isSkipped && !achieved && !isTarget && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full border bg-transparent text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-navy-700">
                                  Skipped
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isSelected) {
                                    setLevel(lvl.level);
                                    return;
                                  }
                                  setIsDetailsOpen((v) => !v);
                                }}
                                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-navy-800"
                                aria-label={isOpen ? 'Collapse level' : 'Expand level'}
                                title={isOpen ? 'Collapse' : 'Expand'}
                              >
                                <ChevronDown
                                  className={`w-4 h-4 text-slate-400 transition-transform ${
                                    isOpen ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {axisKey} · level {lvl.level}/{levelCount}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                          {lvl.description}
                        </div>
                      </div>
                    </div>

                    {/* Details: only for active level */}
                    {isOpen && (
                      <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                        {/* Example (full width, primary reading path) */}
                        <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/40 p-4">
                          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Example + suggested technologies
                          </div>
                          <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                            {knowledge.example}
                          </div>
                          {Array.isArray(knowledge.suggestedTechnologies) &&
                            knowledge.suggestedTechnologies.length > 0 && (
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
                            )}
                        </div>

                        {/* Quick actions */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveCardPanel((p) => (p === 'questions' ? null : 'questions'))
                            }
                            className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                              activeCardPanel === 'questions'
                                ? 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-100'
                                : 'bg-transparent border-slate-200/70 dark:border-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-900/40'
                            }`}
                          >
                            <HelpCircle className="w-4 h-4" />
                            Questions
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setActiveCardPanel((p) => (p === 'comment' ? null : 'comment'))
                            }
                            className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                              activeCardPanel === 'comment'
                                ? 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-100'
                                : 'bg-transparent border-slate-200/70 dark:border-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-900/40'
                            }`}
                          >
                            <MessageSquare className="w-4 h-4" />
                            Comment
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setActiveCardPanel((p) =>
                                p === 'attachments' ? null : 'attachments'
                              )
                            }
                            className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                              activeCardPanel === 'attachments'
                                ? 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-100'
                                : 'bg-transparent border-slate-200/70 dark:border-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-900/40'
                            }`}
                          >
                            <Paperclip className="w-4 h-4" />
                            Add attachment
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setActiveCardPanel((p) => (p === 'links' ? null : 'links'))
                            }
                            className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                              activeCardPanel === 'links'
                                ? 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-800 dark:text-slate-100'
                                : 'bg-transparent border-slate-200/70 dark:border-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-900/40'
                            }`}
                          >
                            <Link2 className="w-4 h-4" />
                            Add link
                          </button>
                        </div>

                        {/* Panels */}
                        {activeCardPanel === 'questions' && (
                          <div className="mt-3 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-4">
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <span>Validation questions</span>
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
                        )}

                        {activeCardPanel === 'comment' && (
                          <div className="mt-3 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-4">
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                              Comment
                            </div>
                            <textarea
                              value={note}
                              onChange={(e) => setLevelNote(lvl.level, e.target.value)}
                              placeholder="Facts: what exists? Gaps: what's missing? Context: scope/owners/tools?"
                              disabled={readOnly}
                              rows={3}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                            />
                          </div>
                        )}

                        {activeCardPanel === 'attachments' && (
                          <div className="mt-3 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-4">
                            <LevelAttachments
                              assessmentId={assessmentId}
                              axisId={axisKey}
                              areaId={areaId}
                              levelNumber={lvl.level}
                              readOnly={readOnly}
                              compact={false}
                            />
                          </div>
                        )}

                        {activeCardPanel === 'links' && (
                          <div className="mt-3 rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 p-4">
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                              Links
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                value={linkDraft}
                                onChange={(e) => setLinkDraft(e.target.value)}
                                placeholder="https://…"
                                className="flex-1 h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white text-sm"
                              />
                              <button
                                type="button"
                                disabled={readOnly || !String(linkDraft || '').trim()}
                                onClick={() => {
                                  addLevelLink(lvl.level, linkDraft);
                                  setLinkDraft('');
                                }}
                                className="h-10 px-4 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white text-sm font-semibold"
                              >
                                Add
                              </button>
                            </div>
                            {(() => {
                              const links = (state.levelLinks || {})[String(lvl.level)] || [];
                              if (!Array.isArray(links) || links.length === 0) return null;
                              return (
                                <div className="mt-3 space-y-2">
                                  {links.map((u) => (
                                    <div
                                      key={u}
                                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/40"
                                    >
                                      <a
                                        href={u}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm text-purple-600 dark:text-purple-400 hover:underline truncate"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {u}
                                      </a>
                                      <button
                                        type="button"
                                        disabled={readOnly}
                                        className="text-xs font-semibold text-slate-500 hover:text-rose-500"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeLevelLink(lvl.level, u);
                                        }}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Card footer: pinned to this card (not the page) */}
                        {(() => {
                          const levels = selectedArea?.levels || [];
                          const idx = levels.findIndex((x) => x.level === lvl.level);
                          const prev = idx > 0 ? levels[idx - 1] : null;
                          const next = idx >= 0 && idx < levels.length - 1 ? levels[idx + 1] : null;
                          return (
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-800">
                              <div className="grid grid-cols-3 items-center gap-3">
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  Transparent = not achieved. Use{' '}
                                  <span className="font-semibold">Skip</span> to explicitly mark
                                  “not planned”.
                                </div>

                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => {
                                      setLevelDecision(lvl.level, undefined);
                                      setAchieved(lvl.level, true);
                                      if (next) setLevel(next.level);
                                    }}
                                    className={`h-10 w-28 rounded-lg text-sm font-semibold border transition-colors ${
                                      achieved
                                        ? 'bg-green-600 border-green-600 text-white'
                                        : 'bg-green-50 dark:bg-green-900/15 border-green-200 dark:border-green-900/30 text-green-700 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900/25'
                                    }`}
                                  >
                                    Achieved
                                  </button>

                                  <button
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => {
                                      setLevelDecision(lvl.level, undefined);
                                      setTargetLevel(lvl.level);
                                    }}
                                    className={`h-10 w-28 rounded-lg text-sm font-semibold border transition-colors ${
                                      isTarget
                                        ? 'bg-purple-600 border-purple-600 text-white'
                                        : 'bg-purple-50 dark:bg-purple-900/15 border-purple-200 dark:border-purple-900/30 text-purple-700 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900/25'
                                    }`}
                                  >
                                    Target
                                  </button>

                                  <button
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => {
                                      if (state.achievedLevel >= lvl.level) {
                                        const ok = window.confirm(
                                          `Skipping Level ${lvl.level} will lower the maximum achieved level to ${lvl.level - 1}. Continue?`
                                        );
                                        if (!ok) return;
                                      }
                                      if ((state.targetLevel || 0) === lvl.level) {
                                        setTargetLevel(undefined);
                                      }
                                      setAchieved(lvl.level, false);
                                      setLevelDecision(lvl.level, 'skip');
                                      if (next) setLevel(next.level);
                                    }}
                                    className={`h-10 w-28 rounded-lg text-sm font-semibold border transition-colors ${
                                      isSkipped
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-navy-950 border-slate-900 dark:border-white'
                                        : 'bg-transparent border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-900'
                                    }`}
                                  >
                                    Skip
                                  </button>
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    disabled={!prev}
                                    onClick={() => prev && setLevel(prev.level)}
                                    className="h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 disabled:opacity-50"
                                  >
                                    Previous
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!next}
                                    onClick={() => next && setLevel(next.level)}
                                    className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold"
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Fullscreen Matrix Overlay */}
      {viewMode === 'matrix' && isMatrixFullscreen && (
        <div className="fixed inset-0 z-[100] bg-navy-950/95 backdrop-blur-sm">
          <div className="absolute inset-0 overflow-auto p-4 md:p-8">
            <div className="mx-auto max-w-[1600px]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsMatrixFullscreen(false)}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-white/10 bg-white/5 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <div className="text-xs text-slate-300">
                  Press <span className="font-semibold text-white">Esc</span> to close
                </div>
              </div>

              {/* Re-render the same Matrix panel */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-navy-950 shadow-2xl">
                <div className="pointer-events-none absolute -top-40 -right-40 h-[420px] w-[420px] rounded-full bg-purple-600/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-48 -left-40 h-[460px] w-[460px] rounded-full bg-blue-500/10 blur-3xl" />

                <div className="relative p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-xs font-semibold tracking-widest uppercase text-purple-300/90">
                        Digital Development Map
                      </div>
                      <div className="mt-1 text-3xl font-bold text-white">
                        {axis?.id}. {axis?.name}
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        Process Digitalization Assessment Matrix
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-col gap-2 text-xs text-slate-200">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="h-3.5 w-3.5 rounded-full bg-purple-500 shadow-[0_0_18px_rgba(168,85,247,0.45)]" />
                          <span>AS-IS</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-3.5 w-3.5 rounded-full bg-blue-500/70 ring-1 ring-blue-300/60" />
                          <span>TO-BE</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-3.5 w-3.5 rounded-full bg-white/10 ring-1 ring-white/15" />
                          <span>Not assessed</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-slate-300">
                        <label className="inline-flex items-center gap-2 select-none">
                          <input
                            type="checkbox"
                            checked={!matrixCompact}
                            onChange={(e) => setMatrixCompact(!e.target.checked)}
                            className="h-4 w-4 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/30"
                          />
                          Spacious
                        </label>
                        <label className="inline-flex items-center gap-2 select-none">
                          <input
                            type="checkbox"
                            checked={matrixShowText}
                            onChange={(e) => setMatrixShowText(e.target.checked)}
                            className="h-4 w-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/30"
                          />
                          Show technologies
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Matrix */}
                  <div className="mt-6 overflow-x-auto pb-2">
                    <div
                      className="grid gap-2 min-w-[1100px]"
                      style={{
                        gridTemplateColumns: `240px repeat(${axisAreas.length}, minmax(180px, 1fr))`,
                      }}
                    >
                      {/* Top header row */}
                      <div className="sticky top-0 left-0 z-30 rounded-xl border border-white/10 bg-navy-950/95 backdrop-blur p-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                        <div className="text-sm font-semibold text-white">Maturity level</div>
                        <div className="text-[11px] text-slate-300">Rows (higher → lower)</div>
                        <div className="mt-2 text-[11px] text-slate-300 leading-snug">
                          Click: open details · Shift+Click: set TO-BE
                        </div>
                      </div>
                      {axisAreas.map((area) => (
                        <div
                          key={`h-fs-${area.id}`}
                          className="sticky top-0 z-20 rounded-xl border border-white/10 bg-navy-950/95 backdrop-blur p-3 shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
                        >
                          {/* X-axis labels + AS/TO moved to bottom strip */}
                          <div className="min-h-[56px]" />
                        </div>
                      ))}

                      {/* Level rows (high -> low) */}
                      {Array.from({ length: levelCount }, (_, i) => levelCount - i).map((level) => {
                        const levelLabels: Record<number, string> = {
                          1: 'Basic / Manual',
                          2: 'Digitized',
                          3: 'Integrated',
                          4: 'Automated',
                          5: 'Optimized',
                          6: 'AI-Driven',
                          7: 'Autonomous',
                        };
                        const label = levelLabels[level] || `Level ${level}`;

                        return (
                          <React.Fragment key={`row-fs-${level}`}>
                            {/* Row label */}
                            <div className="sticky left-0 z-10 rounded-xl border border-white/10 bg-gradient-to-r from-purple-700/30 to-navy-950/60 backdrop-blur p-3 shadow-[10px_0_30px_rgba(0,0,0,0.18)]">
                              <div className="text-white font-bold">
                                <span className="text-purple-200">{level}.</span> {label}
                              </div>
                              <div className="mt-1 text-[11px] text-slate-300">
                                Hover: see details
                              </div>
                            </div>

                            {axisAreas.map((area) => {
                              const s = getAreaState(value, area.id, levelCount);
                              const achieved = s.achievedLevel || 0;
                              const target = s.targetLevel || 0;

                              const isAchieved = level <= achieved;
                              const isTarget = target > 0 && level <= target && !isAchieved;

                              const areaLevelInfo = area.levels?.find((l) => l.level === level);
                              const knowledge = getDRDKnowledge(area.id, level);
                              const techs = knowledge?.suggestedTechnologies || [];
                              const displayTechs = techs.slice(0, 3);

                              return (
                                <button
                                  key={`cell-fs-${area.id}-${level}`}
                                  type="button"
                                  className={`group rounded-xl border border-white/10 bg-white/5 text-left hover:bg-white/7 transition-colors ${
                                    matrixCompact ? 'p-2' : 'p-3'
                                  }`}
                                  onClick={(e) => {
                                    if (e.shiftKey && !readOnly) {
                                      const cur = getAreaState(value, area.id, levelCount);
                                      onChange(
                                        setAreaState(value, area.id, {
                                          ...cur,
                                          targetLevel: clamp(level, 1, levelCount),
                                        })
                                      );
                                      return;
                                    }
                                    setAreaId(area.id);
                                    onAreaChange?.(area.id);
                                    setLevel(level);
                                    setViewMode('surveys');
                                    setIsMatrixFullscreen(false);
                                  }}
                                  title={`${area.name} · Level ${level}${areaLevelInfo?.title ? ` · ${areaLevelInfo.title}` : ''}${
                                    isAchieved ? ' · AS-IS' : isTarget ? ' · TO-BE' : ''
                                  }`}
                                  aria-label={`${area.name}, level ${level}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="text-[11px] font-semibold text-slate-100">
                                      {areaLevelInfo?.title
                                        ? areaLevelInfo.title
                                        : `Level ${level}`}
                                    </div>
                                    <div
                                      className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                        isAchieved
                                          ? 'bg-purple-500/30 text-purple-100 border-purple-300/30'
                                          : isTarget
                                            ? 'bg-blue-500/25 text-blue-100 border-blue-300/30'
                                            : 'bg-white/5 text-slate-200 border-white/10'
                                      }`}
                                    >
                                      {isAchieved ? 'AS-IS' : isTarget ? 'TO-BE' : '—'}
                                    </div>
                                  </div>

                                  {matrixShowText && (
                                    <div className="mt-1 text-[11px] text-slate-200/90 line-clamp-2">
                                      {knowledge?.example || ''}
                                    </div>
                                  )}

                                  {matrixShowText && displayTechs.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {displayTechs.map((t) => (
                                        <span
                                          key={t}
                                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-slate-100 border border-white/10"
                                        >
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <div
                                    className={`relative rounded-2xl ${
                                      matrixCompact
                                        ? 'px-3 py-2 min-h-[56px]'
                                        : 'px-3 py-2.5 min-h-[68px]'
                                    } flex items-center ${
                                      isAchieved
                                        ? 'bg-purple-500/70 text-white shadow-[0_0_22px_rgba(168,85,247,0.30)] ring-1 ring-purple-300/60'
                                        : isTarget
                                          ? 'bg-blue-500/15 text-blue-100 ring-1 ring-blue-300/60'
                                          : 'bg-navy-900/40 text-slate-200/80 ring-1 ring-white/10'
                                    } backdrop-blur-sm`}
                                  >
                                    <div className="mr-3 shrink-0 flex flex-col items-center justify-center">
                                      <div
                                        className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-extrabold ${
                                          isAchieved
                                            ? 'bg-white/15 ring-1 ring-white/20 text-white'
                                            : isTarget
                                              ? 'bg-blue-500/20 ring-1 ring-blue-300/40 text-blue-100'
                                              : 'bg-white/5 ring-1 ring-white/10 text-slate-300'
                                        }`}
                                      >
                                        {level}
                                      </div>
                                      {!matrixCompact && (
                                        <div className="mt-1 text-[10px] text-slate-200/80">
                                          {isAchieved ? 'AS' : isTarget ? 'TO' : '—'}
                                        </div>
                                      )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      {matrixShowText ? (
                                        <div className="space-y-1">
                                          <div className="flex flex-wrap gap-1">
                                            {displayTechs.length > 0 ? (
                                              displayTechs.map((t) => (
                                                <span
                                                  key={t}
                                                  className={`max-w-full truncate px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                    isAchieved
                                                      ? 'bg-white/15 text-white ring-1 ring-white/15'
                                                      : isTarget
                                                        ? 'bg-blue-500/20 text-blue-100 ring-1 ring-blue-300/30'
                                                        : 'bg-white/8 text-slate-200 ring-1 ring-white/10'
                                                  }`}
                                                  title={t}
                                                >
                                                  {t}
                                                </span>
                                              ))
                                            ) : (
                                              <span className="text-[11px] text-slate-400">—</span>
                                            )}
                                            {techs.length > displayTechs.length && (
                                              <span className="text-[10px] text-slate-200/70">
                                                +{techs.length - displayTechs.length}
                                              </span>
                                            )}
                                          </div>
                                          {!matrixCompact && areaLevelInfo?.title && (
                                            <div className="text-[10px] text-slate-200/75 line-clamp-1">
                                              {areaLevelInfo.title}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="text-[11px] leading-snug text-slate-200/75">
                                          <span className="text-slate-300/70">
                                            Hover for details
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {!matrixShowText && (
                                      <div className="pointer-events-none absolute left-2 right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="rounded-lg border border-white/10 bg-navy-950/95 backdrop-blur px-2 py-1 text-[11px] text-slate-100 shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
                                          <div className="font-semibold text-white">
                                            {area.id} · Level {level}
                                          </div>
                                          <div className="text-slate-200/90">
                                            {areaLevelInfo?.title || '—'}
                                          </div>
                                          {techs.length > 0 && (
                                            <div className="mt-1 text-slate-200/80">
                                              {techs.slice(0, 6).join(' · ')}
                                              {techs.length > 6
                                                ? ` · +${techs.length - 6} more`
                                                : ''}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {isAchieved && (
                                      <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 ring-2 ring-navy-950">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                      </span>
                                    )}
                                    {isTarget && (
                                      <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 ring-2 ring-navy-950" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}

                      {/* Bottom X-axis strip (process areas) */}
                      <div className="sticky bottom-0 left-0 z-30 rounded-xl border border-white/10 bg-navy-950/95 backdrop-blur p-3 shadow-[0_-10px_30px_rgba(0,0,0,0.35)]">
                        <div className="text-sm font-semibold text-white">Process area</div>
                        <div className="text-[11px] text-slate-300">X-axis</div>
                      </div>
                      {axisAreas.map((area) => (
                        <button
                          key={`x-fs-${area.id}`}
                          type="button"
                          onClick={() => {
                            setAreaId(area.id);
                            onAreaChange?.(area.id);
                            setViewMode('surveys');
                            setIsMatrixFullscreen(false);
                          }}
                          className="sticky bottom-0 z-20 rounded-xl border border-white/10 bg-gradient-to-b from-white/10 to-white/6 backdrop-blur p-3 text-left hover:from-white/14 hover:to-white/8 transition-colors shadow-[0_-10px_30px_rgba(0,0,0,0.22)] relative"
                        >
                          <div className="pr-24">
                            <div className="text-[11px] font-mono text-slate-300">{area.id}</div>
                            <div className="mt-0.5 text-sm font-semibold text-white leading-snug line-clamp-2">
                              {area.name}
                            </div>
                          </div>
                          {(() => {
                            const s = getAreaState(value, area.id, levelCount);
                            const achieved = s.achievedLevel || 0;
                            const target = s.targetLevel || 0;
                            if (achieved === 0 && target === 0) return null;
                            return (
                              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 ring-1 ring-purple-300/30 text-[10px] font-semibold text-purple-100">
                                  AS {achieved || '—'}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md bg-blue-500/15 ring-1 ring-blue-300/30 text-[10px] font-semibold text-blue-100">
                                  TO {target || '—'}
                                </span>
                              </div>
                            );
                          })()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary strip */}
                  {(() => {
                    const stats = axisAreas.reduce(
                      (acc, area) => {
                        const s = getAreaState(value, area.id, levelCount);
                        const a = s.achievedLevel || 0;
                        const t = s.targetLevel || 0;
                        if (a > 0) {
                          acc.countActual++;
                          acc.sumActual += a;
                        }
                        if (t > 0) {
                          acc.countTarget++;
                          acc.sumTarget += t;
                        }
                        if (a > 0 || t > 0) acc.assessed++;
                        return acc;
                      },
                      { sumActual: 0, sumTarget: 0, countActual: 0, countTarget: 0, assessed: 0 }
                    );

                    const avgActual =
                      stats.countActual > 0
                        ? (stats.sumActual / stats.countActual).toFixed(1)
                        : '—';
                    const avgTarget =
                      stats.countTarget > 0
                        ? (stats.sumTarget / stats.countTarget).toFixed(1)
                        : '—';
                    const avgGap =
                      stats.countTarget > 0 && stats.countActual > 0
                        ? (Number(avgTarget) - Number(avgActual)).toFixed(1)
                        : '—';

                    return (
                      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-4xl font-extrabold text-white tabular-nums">
                            {avgActual}
                          </div>
                          <div className="mt-1 text-xs text-slate-300">Avg. Current Level</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-4xl font-extrabold text-white tabular-nums">
                            {avgTarget}
                          </div>
                          <div className="mt-1 text-xs text-slate-300">Avg. Target Level</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-4xl font-extrabold text-white tabular-nums">
                            {avgGap}
                          </div>
                          <div className="mt-1 text-xs text-slate-300">Avg. Gap</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-4xl font-extrabold text-white tabular-nums">
                            {stats.assessed}/{axisAreas.length}
                          </div>
                          <div className="mt-1 text-xs text-slate-300">Areas Assessed</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <AssessmentToolShell
      left={leftOverride ?? contentPanel}
      right={navPanel}
      isRightOpen={isSidebarOpen}
      rightWidthClass="w-[320px]"
      rightSide="right"
    />
  );
};

export default DRDAssessmentEditor;
