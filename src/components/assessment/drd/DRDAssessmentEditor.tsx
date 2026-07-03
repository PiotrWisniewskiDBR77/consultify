import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Grid2X2,
  HelpCircle,
  Link2,
  List,
  Maximize2,
  Menu,
  MessageSquare,
  Paperclip,
  Sparkles,
  Target,
  User,
  X,
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AssessmentToolShell } from '@/components/assessment/AssessmentToolShell';
import { LevelAttachments } from '@/components/assessment/LevelAttachments';
import { GlossaryPanel } from '@/components/assessment/panels/GlossaryPanel';
import { Tooltip } from '@/components/ui/primitives';
import { getDRDKnowledge } from '@/services/assessmentKnowledge/drdKnowledge';
import { getAssessmentGuidanceLive } from '@/services/assessmentKnowledge/assessmentGuidanceRuntime';
import type { AssessmentGuidanceOutput } from '@/services/assessmentKnowledge/assessmentGuidanceService';
import { DRD_AXIS_KEY_MAP, DRD_STRUCTURE, DRDArea, DRDAxis, DRDLevel } from '@/services/drdStructure';
import { getDRDAxisWhyHint } from '@/services/assessmentKnowledge/whyThisMatters';

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
  const { t, i18n } = useTranslation();
  const isPl = (i18n.language || '').toLowerCase().startsWith('pl');
  const [axisId, setAxisId] = useState<number>(currentAxisId ?? 1);
  const [areaId, setAreaId] = useState<string>(
    currentAreaId ?? DRD_STRUCTURE[0]?.areas?.[0]?.id ?? '1A'
  );
  // Default to Matrix: new primary UX for assessment navigation.
  const [viewMode, setViewMode] = useState<'surveys' | 'matrix'>('matrix');
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [isMatrixFullscreen, setIsMatrixFullscreen] = useState(false);
  const [activeLevel, setActiveLevel] = useState<number>(currentLevel ?? 1);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isExplanationExpanded, setIsExplanationExpanded] = useState(false);
  const [matrixCompact, setMatrixCompact] = useState(true);
  const [activeCardPanel, setActiveCardPanel] = useState<
    'questions' | 'comment' | 'attachments' | 'links' | null
  >(null);
  const [linkDraft, setLinkDraft] = useState('');
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  // Per-question AI guidance (canon-grounded; keyed by "areaId#level").
  const [guidance, setGuidance] = useState<
    Record<string, { loading: boolean; data?: AssessmentGuidanceOutput }>
  >({});

  // Matrix cell popup state
  const [popupCell, setPopupCell] = useState<{ areaId: string; level: number } | null>(null);
  const [popupPosition, setPopupPosition] = useState<{
    top: number;
    left: number;
    arrowPosition: 'top' | 'bottom' | 'left' | 'right';
    arrowOffset: number;
  } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Hover tooltip state (lightweight)
  const [hoverCell, setHoverCell] = useState<{ areaId: string; level: number } | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ top: number; left: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    setIsExplanationExpanded(false);
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
  const whyThisMattersHint = useMemo(
    () => getDRDAxisWhyHint(selectedAxis?.id || 1),
    [selectedAxis?.id]
  );

  // Fetch canon-grounded AI guidance for one area×level (cached, non-blocking).
  const requestGuidance = React.useCallback(
    (area: DRDArea, level: DRDLevel) => {
      const key = `${area.id}#${level.level}`;
      setGuidance((prev) => {
        if (prev[key]?.loading || prev[key]?.data) return prev;
        return { ...prev, [key]: { loading: true } };
      });
      void getAssessmentGuidanceLive({
        framework: 'DRD',
        dimensionId: area.id,
        dimensionName: area.namePL || area.name,
        levelNumber: level.level,
        levelTitle: level.title,
        levelDescription: level.description,
        language: 'pl',
      })
        .then((data) => setGuidance((prev) => ({ ...prev, [key]: { loading: false, data } })))
        .catch(() => setGuidance((prev) => ({ ...prev, [key]: { loading: false } })));
    },
    []
  );

  // When area changes, default focus to "next likely" level (achieved+1), unless controlled externally.
  React.useEffect(() => {
    setActiveCardPanel(null);
    setLinkDraft('');
    setIsExplanationExpanded(false);
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
    // IMPORTANT:
    // When `currentLevel` prop is provided, the editor is controlled by the parent.
    // In that mode, calling `onLevelChange` here can create an update loop:
    // parent updates -> prop sync setsActiveLevel -> this effect fires -> parent updates -> ...
    if (currentLevel !== undefined) return;
    onLevelChange?.(activeLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLevel, currentLevel]);

  // Close fullscreen matrix on Escape
  React.useEffect(() => {
    if (!isMatrixFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMatrixFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMatrixFullscreen]);

  // Close popup on Escape or click outside
  React.useEffect(() => {
    if (!popupCell) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopupCell(null);
    };
    const onClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopupCell(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    // Delay click listener to avoid immediate close
    setTimeout(() => window.addEventListener('click', onClick), 10);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('click', onClick);
    };
  }, [popupCell]);

  // Cleanup timeouts on unmount to avoid stale callbacks during navigation
  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Helper to open popup at cell position with smart positioning
  const openCellPopup = (areaId: string, level: number, e: React.MouseEvent<HTMLButtonElement>) => {
    // Clear any hover tooltip
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoverCell(null);

    const rect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Popup dimensions (approximate)
    const popupWidth = 360;
    const popupHeight = 400;
    const gap = 12;

    let top = 0;
    let left = 0;
    let arrowPosition: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
    let arrowOffset = 0;

    // Calculate best position: prefer below, then above, then right, then left
    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = viewportWidth - rect.right;

    if (spaceBelow >= popupHeight + gap) {
      // Position below
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - popupWidth / 2;
      arrowPosition = 'top';
      arrowOffset = popupWidth / 2;
    } else if (spaceAbove >= popupHeight + gap) {
      // Position above
      top = rect.top - popupHeight - gap;
      left = rect.left + rect.width / 2 - popupWidth / 2;
      arrowPosition = 'bottom';
      arrowOffset = popupWidth / 2;
    } else if (spaceRight >= popupWidth + gap) {
      // Position to the right
      top = rect.top + rect.height / 2 - popupHeight / 2;
      left = rect.right + gap;
      arrowPosition = 'left';
      arrowOffset = popupHeight / 2;
    } else if (spaceLeft >= popupWidth + gap) {
      // Position to the left
      top = rect.top + rect.height / 2 - popupHeight / 2;
      left = rect.left - popupWidth - gap;
      arrowPosition = 'right';
      arrowOffset = popupHeight / 2;
    } else {
      // Fallback: center in viewport
      top = (viewportHeight - popupHeight) / 2;
      left = (viewportWidth - popupWidth) / 2;
      arrowPosition = 'top';
      arrowOffset = popupWidth / 2;
    }

    // Keep within viewport bounds
    if (left < 16) {
      arrowOffset = arrowOffset - (16 - left);
      left = 16;
    }
    if (left + popupWidth > viewportWidth - 16) {
      const overflow = left + popupWidth - (viewportWidth - 16);
      arrowOffset = arrowOffset + overflow;
      left = viewportWidth - popupWidth - 16;
    }
    if (top < 16) top = 16;
    if (top + popupHeight > viewportHeight - 16) top = viewportHeight - popupHeight - 16;

    // Clamp arrow offset
    arrowOffset = Math.max(
      20,
      Math.min(
        arrowOffset,
        arrowPosition === 'top' || arrowPosition === 'bottom' ? popupWidth - 20 : popupHeight - 20
      )
    );

    setPopupPosition({ top, left, arrowPosition, arrowOffset });
    setPopupCell({ areaId, level });
  };

  // Helper to show hover tooltip
  const showHoverTooltip = (
    areaId: string,
    level: number,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (popupCell) return; // Don't show tooltip if popup is open

    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

    // IMPORTANT:
    // - React synthetic events are invalid after the handler returns.
    // - We must not reference `e` inside setTimeout (it can become null).
    const target = e.currentTarget;

    hoverTimeoutRef.current = setTimeout(() => {
      if (!target || !target.isConnected) return;
      const rect = target.getBoundingClientRect();
      setHoverPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
      setHoverCell({ areaId, level });
    }, 400); // 400ms delay before showing tooltip
  };

  const hideHoverTooltip = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoverCell(null);
  };

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
      <div className="p-4 border-b border-c-border-subtle">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-c-text-muted uppercase tracking-wider">
            DRD
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1 text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text-muted"
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
          className="w-full h-10 px-4 rounded-lg border border-c-border-subtle bg-c-surface-raised dark:bg-c-bg text-c-text text-sm font-semibold flex items-center justify-center gap-2 hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
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
          <label className="text-xs text-c-text-muted">Axis</label>
          <div className="relative">
            <select
              value={axisId}
              onChange={(e) => handleAxisChange(Number(e.target.value))}
              className="w-full h-10 px-3 pr-10 rounded-lg border border-c-border-subtle bg-c-surface dark:bg-c-bg text-c-text text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)]"
            >
              {DRD_STRUCTURE.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id}. {a.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-c-text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                  ? 'border-c-accent bg-c-accent-soft text-c-accent'
                  : 'border-transparent hover:border-c-border dark:hover:border-c-border-subtle hover:bg-c-surface-raised dark:hover:bg-c-bg text-c-text-secondary'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="text-xs font-mono text-c-text-secondary">{a.id}</div>
                    {isMine && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--c-info)_12%,transparent)] text-c-info border border-c-info"
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
                        return <CheckCircle2 className="w-3 h-3 text-c-success shrink-0" />;
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
                        <div className="mt-1.5 h-1 bg-c-surface-raised rounded-full overflow-hidden">
                          <div
                            className="h-full bg-c-surface transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="text-[10px] px-2 py-1 rounded-full bg-c-surface-raised text-c-text-muted shrink-0">
                  {getAreaState(value, a.id, axis?.levelCount || 5).achievedLevel}/
                  {axis?.levelCount || 5}
                </div>
              </div>
            </button>
          );
        })}
        {filteredAreas.length === 0 && (
          <div className="p-6 text-center text-sm text-c-text-muted">
            No results.
          </div>
        )}
      </div>

      {/* Collapse button at bottom */}
      <div className="p-2 border-t border-c-border-subtle">
        <button
          onClick={() => setIsNavCollapsed(true)}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded transition-colors"
          title="Collapse panel"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  const contentPanel = (
    <div ref={levelsContainerRef} className="h-full overflow-auto p-4 md:p-6">
      <div className="w-full">
        {/* Mobile: Toggle sidebar button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden mb-4 p-2 bg-c-surface border border-c-border-subtle rounded-lg text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised flex items-center gap-2"
        >
          {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          <span className="text-sm font-medium">Navigation</span>
        </button>

        {/* ===================================================================== */}
        {/* MATRIX VIEW (enterprise / BCG-style)                                  */}
        {/* ===================================================================== */}
        {viewMode === 'matrix' && (
          <div className="relative overflow-hidden rounded-2xl border border-c-border dark:border-white/10 bg-c-surface dark:bg-c-bg shadow-lg dark:shadow-2xl">
            {/* Background glow */}
            <div className="pointer-events-none absolute -top-40 -right-40 h-[420px] w-[420px] rounded-full bg-[color-mix(in_srgb,var(--c-tag-5)_15%,transparent)] blur-3xl hidden dark:block" />
            <div className="pointer-events-none absolute -bottom-48 -left-40 h-[460px] w-[460px] rounded-full bg-[color-mix(in_srgb,var(--c-tag-1)_10%,transparent)] blur-3xl hidden dark:block" />

            <div className="relative p-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-xs font-semibold tracking-widest uppercase text-c-accent">
                    Digital Development Map
                  </div>
                  <div className="mt-1 text-2xl font-bold text-c-text">
                    {axis?.id}. {axis?.name}
                  </div>
                  <div className="mt-1 text-sm text-c-text-secondary">
                    Process Digitalization Assessment Matrix
                  </div>
                </div>

                {/* Right side: Legend + Fullscreen */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-2 text-xs text-c-text-secondary">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full bg-c-surface " />
                        <span>AS-IS</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full bg-c-tag-1 ring-1 ring-c-tag-1" />
                        <span>TO-BE</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-c-text-secondary">
                      <label className="inline-flex items-center gap-2 select-none">
                        <input
                          type="checkbox"
                          checked={!matrixCompact}
                          onChange={(e) => setMatrixCompact(!e.target.checked)}
                          className="h-4 w-4 rounded border-c-border dark:border-white/20 bg-c-surface-raised dark:bg-white/5 text-c-accent focus:ring-[color:var(--c-focus)]"
                        />
                        Spacious
                      </label>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsMatrixFullscreen(true)}
                    className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-c-border dark:border-white/10 bg-c-surface-raised dark:bg-white/5 text-c-text text-xs font-semibold hover:bg-c-surface-raised dark:hover:bg-white/10 transition-colors"
                    title="Open matrix in full screen"
                  >
                    <Maximize2 className="w-4 h-4" />
                    Full screen
                  </button>
                </div>
              </div>

              {/* Matrix */}
              <div className="dark mt-6 overflow-x-auto pb-2 rounded-xl bg-c-bg p-2">
                <div
                  className="grid gap-2 min-w-[1100px]"
                  style={{
                    gridTemplateColumns: `240px repeat(${axisAreas.length}, minmax(150px, 1fr))`,
                  }}
                >
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
                        <div className="sticky left-0 z-10 rounded-xl border border-white/10 bg-c-surface-raised backdrop-blur p-3 shadow-[10px_0_30px_rgba(0,0,0,0.18)]">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-white font-bold">
                              <span className="text-c-accent">{level}.</span> {label}
                            </div>
                          </div>
                          <div className="mt-1 text-[11px] text-c-text-secondary">
                            Hover for preview · Click for details
                          </div>
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

                          // Check if this cell is selected (popup open)
                          const isSelected =
                            popupCell?.areaId === area.id && popupCell?.level === level;
                          // Check if any popup is open (for dimming other cells)
                          const hasActivePopup = popupCell !== null;

                          return (
                            <button
                              key={`${area.id}-${level}`}
                              type="button"
                              className={`group relative rounded-lg border transition-all duration-200 text-left ${
                                matrixCompact ? 'p-2' : 'p-2.5'
                              } ${
                                isSelected
                                  ? 'border-white/60 bg-white/20 ring-2 ring-white/30 scale-[1.02] z-10'
                                  : hasActivePopup
                                    ? 'opacity-40'
                                    : ''
                              } ${
                                !isSelected && !hasActivePopup && isAchieved
                                  ? 'border-c-tag-5 bg-[color-mix(in_srgb,var(--c-tag-5)_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-tag-5)_35%,transparent)]'
                                  : !isSelected && !hasActivePopup && isTarget
                                    ? 'border-c-tag-1 bg-[color-mix(in_srgb,var(--c-tag-1)_15%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-tag-1)_25%,transparent)]'
                                    : !isSelected && !hasActivePopup
                                      ? 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'
                                      : ''
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
                                // Open popup overlay instead of navigating
                                openCellPopup(area.id, level, e);
                              }}
                              onMouseEnter={(e) => showHoverTooltip(area.id, level, e)}
                              onMouseLeave={hideHoverTooltip}
                              aria-label={`${area.name}, level ${level}`}
                            >
                              {/* Ultra-simple cell: just 2-3 keywords */}
                              {(() => {
                                // Prefer key technologies, fallback to short title
                                const keyTechs = [
                                  'AI',
                                  'ML',
                                  'RPA',
                                  'IoT',
                                  'AGV',
                                  'WMS',
                                  'MES',
                                  'ERP',
                                  'CRM',
                                  'BI',
                                  'API',
                                  'EDI',
                                  'PLM',
                                  'APS',
                                  'TMS',
                                  'YMS',
                                ];
                                const highlighted = techs
                                  .filter((t) => keyTechs.includes(t))
                                  .slice(0, 2);
                                const shortTitle = areaLevelInfo?.title
                                  ? areaLevelInfo.title.split(' ').slice(0, 3).join(' ')
                                  : null;
                                const displayContent =
                                  highlighted.length > 0
                                    ? highlighted.join(' · ')
                                    : shortTitle || '—';

                                return (
                                  <div className="h-full min-h-[40px] flex items-center justify-center text-center px-1">
                                    <span
                                      className={`text-[11px] font-medium leading-tight ${
                                        isAchieved
                                          ? 'text-white'
                                          : isTarget
                                            ? 'text-white'
                                            : 'text-c-text-secondary'
                                      }`}
                                    >
                                      {displayContent}
                                    </span>
                                  </div>
                                );
                              })()}
                            </button>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}

                  {/* Bottom X-axis strip (process areas) */}
                  <div className="sticky bottom-0 left-0 z-30 rounded-xl border border-white/10 bg-c-bg backdrop-blur p-2 shadow-[0_-10px_30px_rgba(0,0,0,0.35)]">
                    <div className="text-[10px] font-semibold text-c-text-secondary uppercase tracking-wider">
                      Area
                    </div>
                  </div>
                  {axisAreas.map((area) => {
                    const s = getAreaState(value, area.id, levelCount);
                    const achieved = s.achievedLevel || 0;
                    const target = s.targetLevel || 0;
                    return (
                      <button
                        key={`x-${area.id}`}
                        type="button"
                        onClick={() => {
                          setAreaId(area.id);
                          onAreaChange?.(area.id);
                          setViewMode('surveys');
                        }}
                        className="sticky bottom-0 z-20 rounded-xl border border-white/10 bg-gradient-to-b from-white/10 to-white/6 backdrop-blur p-2 text-left hover:from-white/14 hover:to-white/8 transition-colors shadow-[0_-10px_30px_rgba(0,0,0,0.22)]"
                      >
                        {/* Top line: ID + badges */}
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[11px] font-bold text-c-accent">{area.id}</span>
                          <div className="flex items-center gap-1">
                            {achieved > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--c-tag-5)_25%,transparent)] text-[9px] font-bold text-c-tag-5">
                                AS {achieved}
                              </span>
                            )}
                            {target > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--c-tag-1)_20%,transparent)] text-[9px] font-bold text-c-tag-1">
                                TO {target}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Area name - 2 lines max */}
                        <div className="text-[11px] font-medium text-white leading-tight line-clamp-2">
                          {area.name}
                        </div>
                      </button>
                    );
                  })}
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
                    <div className="rounded-xl border border-c-border dark:border-white/10 bg-c-surface-raised dark:bg-white/5 p-4">
                      <div className="text-3xl font-extrabold text-c-text tabular-nums">
                        {avgActual}
                      </div>
                      <div className="mt-1 text-xs text-c-text-secondary">
                        Avg. Current Level
                      </div>
                    </div>
                    <div className="rounded-xl border border-c-border dark:border-white/10 bg-c-surface-raised dark:bg-white/5 p-4">
                      <div className="text-3xl font-extrabold text-c-text tabular-nums">
                        {avgTarget}
                      </div>
                      <div className="mt-1 text-xs text-c-text-secondary">
                        Avg. Target Level
                      </div>
                    </div>
                    <div className="rounded-xl border border-c-border dark:border-white/10 bg-c-surface-raised dark:bg-white/5 p-4">
                      <div className="text-3xl font-extrabold text-c-text tabular-nums">
                        {avgGap}
                      </div>
                      <div className="mt-1 text-xs text-c-text-secondary">
                        Avg. Gap
                      </div>
                    </div>
                    <div className="rounded-xl border border-c-border dark:border-white/10 bg-c-surface-raised dark:bg-white/5 p-4">
                      <div className="text-3xl font-extrabold text-c-text tabular-nums">
                        {stats.assessed}/{axisAreas.length}
                      </div>
                      <div className="mt-1 text-xs text-c-text-secondary">
                        Areas Assessed
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Hover Tooltip (lightweight) */}
            {hoverCell &&
              hoverPosition &&
              !popupCell &&
              (() => {
                const tooltipArea = axisAreas.find((a) => a.id === hoverCell.areaId);
                const tooltipLevelInfo = tooltipArea?.levels?.find(
                  (l) => l.level === hoverCell.level
                );
                const tooltipKnowledge = getDRDKnowledge(hoverCell.areaId, hoverCell.level);
                const tooltipState = getAreaState(value, hoverCell.areaId, levelCount);
                const tooltipAchieved = tooltipState.achievedLevel || 0;
                const tooltipTarget = tooltipState.targetLevel || 0;
                const isTooltipAchieved = hoverCell.level <= tooltipAchieved;
                const isTooltipTarget =
                  tooltipTarget > 0 && hoverCell.level <= tooltipTarget && !isTooltipAchieved;
                const tooltipTechs = (tooltipKnowledge?.suggestedTechnologies || []).slice(0, 3);

                return (
                  <div
                    className="fixed z-[150] pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200"
                    style={{
                      top: hoverPosition.top,
                      left: hoverPosition.left,
                      transform: 'translate(-50%, -100%)',
                    }}
                  >
                    <div className="rounded-xl border border-c-border dark:border-white/20 bg-white/95 dark:bg-c-bg backdrop-blur-lg shadow-xl px-3 py-2 max-w-[240px]">
                      {/* Arrow */}
                      <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 rotate-45 bg-white/95 dark:bg-c-bg border-r border-b border-c-border dark:border-white/20" />

                      <div className="text-xs font-semibold text-c-text mb-1">
                        {tooltipLevelInfo?.title || `Level ${hoverCell.level}`}
                      </div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                            isTooltipAchieved
                              ? 'bg-[color-mix(in_srgb,var(--c-tag-5)_30%,transparent)] text-c-tag-5'
                              : isTooltipTarget
                                ? 'bg-[color-mix(in_srgb,var(--c-tag-1)_25%,transparent)] text-c-tag-1'
                                : 'bg-c-surface-raised dark:bg-white/10 text-c-text-muted'
                          }`}
                        >
                          {isTooltipAchieved ? 'AS-IS' : isTooltipTarget ? 'TO-BE' : 'Not assessed'}
                        </span>
                      </div>
                      {tooltipTechs.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tooltipTechs.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-c-surface-raised dark:bg-white/10 text-c-text-secondary"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-1.5 text-[9px] text-c-text-muted">Click for details</div>
                    </div>
                  </div>
                );
              })()}

            {/* Cell Detail Popup Overlay */}
            {popupCell && popupPosition && (
              <div
                ref={popupRef}
                className="fixed z-[200] w-[360px] rounded-2xl border border-c-border dark:border-white/20 bg-white/98 dark:bg-c-bg backdrop-blur-xl shadow-[0_25px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200"
                style={{ top: popupPosition.top, left: popupPosition.left }}
              >
                {/* Arrow indicator */}
                {popupPosition.arrowPosition === 'top' && (
                  <div
                    className="absolute -top-2 w-4 h-4 rotate-45 bg-white/98 dark:bg-c-bg border-l border-t border-c-border dark:border-white/20"
                    style={{ left: popupPosition.arrowOffset - 8 }}
                  />
                )}
                {popupPosition.arrowPosition === 'bottom' && (
                  <div
                    className="absolute -bottom-2 w-4 h-4 rotate-45 bg-white/98 dark:bg-c-bg border-r border-b border-c-border dark:border-white/20"
                    style={{ left: popupPosition.arrowOffset - 8 }}
                  />
                )}
                {popupPosition.arrowPosition === 'left' && (
                  <div
                    className="absolute -left-2 w-4 h-4 rotate-45 bg-white/98 dark:bg-c-bg border-l border-b border-c-border dark:border-white/20"
                    style={{ top: popupPosition.arrowOffset - 8 }}
                  />
                )}
                {popupPosition.arrowPosition === 'right' && (
                  <div
                    className="absolute -right-2 w-4 h-4 rotate-45 bg-white/98 dark:bg-c-bg border-r border-t border-c-border dark:border-white/20"
                    style={{ top: popupPosition.arrowOffset - 8 }}
                  />
                )}

                {(() => {
                  const popupArea = axisAreas.find((a) => a.id === popupCell.areaId);
                  const popupLevelInfo = popupArea?.levels?.find(
                    (l) => l.level === popupCell.level
                  );
                  const popupKnowledge = getDRDKnowledge(popupCell.areaId, popupCell.level);
                  const popupState = getAreaState(value, popupCell.areaId, levelCount);
                  const popupAchieved = popupState.achievedLevel || 0;
                  const popupTarget = popupState.targetLevel || 0;
                  const isPopupAchieved = popupCell.level <= popupAchieved;
                  const isPopupTarget =
                    popupTarget > 0 && popupCell.level <= popupTarget && !isPopupAchieved;
                  const popupTechs = popupKnowledge?.suggestedTechnologies || [];

                  return (
                    <>
                      {/* Header */}
                      <div className="p-4 border-b border-c-border dark:border-white/10">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                                isPopupAchieved
                                  ? 'bg-c-surface text-white'
                                  : isPopupTarget
                                    ? 'bg-[color-mix(in_srgb,var(--c-tag-1)_50%,transparent)] text-white'
                                    : 'bg-c-surface-raised dark:bg-white/10 text-c-text-secondary'
                              }`}
                            >
                              {popupCell.level}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-c-text">
                                {popupLevelInfo?.title || `Level ${popupCell.level}`}
                              </div>
                              <div className="text-xs text-c-text-muted">
                                {popupArea?.name} · {popupCell.areaId}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setAreaId(popupCell.areaId);
                                onAreaChange?.(popupCell.areaId);
                                setLevel(popupCell.level);
                                setViewMode('surveys');
                                setPopupCell(null);
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-c-text-secondary hover:text-c-text dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-white/10 transition-colors"
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => setPopupCell(null)}
                              className="p-1.5 rounded-lg hover:bg-c-surface-raised dark:hover:bg-white/10 text-c-text-muted hover:text-c-text dark:hover:text-c-text transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Status badges */}
                        <div className="mt-3 flex items-center gap-2">
                          <span
                            className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                              isPopupAchieved
                                ? 'bg-[color-mix(in_srgb,var(--c-tag-5)_30%,transparent)] text-c-tag-5 ring-1 ring-c-tag-5'
                                : 'bg-c-surface-raised dark:bg-white/5 text-c-text-muted ring-1 ring-slate-200 dark:ring-white/10'
                            }`}
                          >
                            {isPopupAchieved ? 'AS-IS (Achieved)' : 'Not achieved'}
                          </span>
                          {isPopupTarget && (
                            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[color-mix(in_srgb,var(--c-tag-1)_25%,transparent)] text-c-tag-1 ring-1 ring-c-tag-1">
                              TO-BE (Target)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-3 max-h-[280px] overflow-y-auto">
                        {/* Description */}
                        {popupLevelInfo?.description && (
                          <div>
                            <div className="text-[10px] font-semibold text-c-text-muted uppercase tracking-wider mb-1">
                              Description
                            </div>
                            <div className="text-xs text-c-text-secondary leading-relaxed">
                              {popupLevelInfo.description}
                            </div>
                          </div>
                        )}

                        {/* Example */}
                        {popupKnowledge?.example && (
                          <div>
                            <div className="text-[10px] font-semibold text-c-text-muted uppercase tracking-wider mb-1">
                              Example
                            </div>
                            <div className="text-xs text-c-text-secondary leading-relaxed">
                              {popupKnowledge.example}
                            </div>
                          </div>
                        )}

                        {/* Technologies */}
                        {popupTechs.length > 0 && (
                          <div>
                            <div className="text-[10px] font-semibold text-c-text-muted uppercase tracking-wider mb-2">
                              Technologies
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {popupTechs.map((t) => {
                                const isKey = [
                                  'AI',
                                  'ML',
                                  'RPA',
                                  'IoT',
                                  'AGV',
                                  'WMS',
                                  'MES',
                                  'ERP',
                                  'CRM',
                                  'BI',
                                  'API',
                                  'EDI',
                                ].includes(t);
                                return (
                                  <span
                                    key={t}
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      isKey
                                        ? 'bg-[color-mix(in_srgb,var(--c-warning)_20%,transparent)] text-c-warning border border-c-warning'
                                        : 'bg-c-surface-raised dark:bg-white/5 text-c-text-secondary border border-c-border dark:border-white/10'
                                    }`}
                                  >
                                    {t}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="p-4 border-t border-c-border dark:border-white/10">
                        {/* Quick actions row - toggleable buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => {
                              const cur = getAreaState(value, popupCell.areaId, levelCount);
                              const curAchieved = Number(cur.achievedLevel || 0);

                              if (isPopupAchieved) {
                                // Toggle off: clear achieved for this level
                                // Find the highest level below this one that should remain achieved
                                const newAchieved = popupCell.level > 1 ? popupCell.level - 1 : 0;
                                onChange(
                                  setAreaState(value, popupCell.areaId, {
                                    ...cur,
                                    achievedLevel:
                                      curAchieved === popupCell.level ? newAchieved : curAchieved,
                                  })
                                );
                              } else {
                                // Set as achieved - clear target if it was set to this level
                                onChange(
                                  setAreaState(value, popupCell.areaId, {
                                    ...cur,
                                    achievedLevel: popupCell.level,
                                    targetLevel:
                                      cur.targetLevel === popupCell.level
                                        ? undefined
                                        : cur.targetLevel,
                                  })
                                );
                              }
                            }}
                            className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                              isPopupAchieved
                                ? 'bg-c-tag-5 text-white hover:opacity-90'
                                : 'bg-[color-mix(in_srgb,var(--c-tag-5)_20%,transparent)] text-c-tag-5 hover:bg-[color-mix(in_srgb,var(--c-tag-5)_30%,transparent)]'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {isPopupAchieved ? 'Achieved' : 'Set AS-IS'}
                          </button>

                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => {
                              const cur = getAreaState(value, popupCell.areaId, levelCount);
                              const curTarget = Number(cur.targetLevel || 0);

                              if (curTarget === popupCell.level) {
                                // Toggle off: clear target
                                onChange(
                                  setAreaState(value, popupCell.areaId, {
                                    ...cur,
                                    targetLevel: undefined,
                                  })
                                );
                              } else {
                                // Set as target
                                onChange(
                                  setAreaState(value, popupCell.areaId, {
                                    ...cur,
                                    targetLevel: popupCell.level,
                                  })
                                );
                              }
                            }}
                            className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                              isPopupTarget
                                ? 'bg-c-tag-1 text-white hover:opacity-90'
                                : 'bg-[color-mix(in_srgb,var(--c-tag-1)_20%,transparent)] text-c-tag-1 hover:bg-[color-mix(in_srgb,var(--c-tag-1)_30%,transparent)]'
                            }`}
                          >
                            <Target className="w-3.5 h-3.5" />
                            {isPopupTarget ? 'Target' : 'Set TO-BE'}
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* SURVEYS VIEW (existing)                                               */}
        {/* ===================================================================== */}
        {viewMode === 'surveys' && (
          <>
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs font-mono text-c-text-secondary">{areaId}</div>
                <div className="flex items-center gap-2">
                  <div className="text-xl md:text-2xl font-semibold text-c-text">
                    {selectedArea?.name || 'Area'}
                  </div>
                  <Tooltip
                    content={
                      <div className="max-w-[280px]">
                        <div className="text-xs font-bold mb-1">
                          {t('assessment.drd.whyThisMatters.title', 'Why we ask this')}
                        </div>
                        <div className="text-xs leading-relaxed">
                          {isPl ? whyThisMattersHint.pl : whyThisMattersHint.en}
                        </div>
                      </div>
                    }
                    placement="bottom-start"
                    maxWidth={300}
                  >
                    <button
                      type="button"
                      aria-label={t('assessment.drd.whyThisMatters.ariaLabel', 'Why this question')}
                      className="shrink-0 p-1 rounded-full text-c-tag-5 hover:bg-[color-mix(in_srgb,var(--c-tag-5)_12%,transparent)] transition-colors"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
                <div className="text-xs md:text-sm text-c-text-muted mt-1">
                  Axis: {selectedAxis?.id}. {selectedAxis?.name} · Answers: Yes/No per level ·
                  Attachments per level
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGlossaryOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-c-border-subtle bg-c-surface text-xs font-semibold text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5" />
                {t('assessment.drd.glossary.button', isPl ? 'Słownik' : 'Glossary')}
              </button>
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
                    className={`bg-c-surface border rounded-xl transition-colors ${
                      isOpen ? 'ring-2 ring-c-focus p-5' : 'p-3'
                    } ${
                      achieved
                        ? 'border-c-success bg-[color-mix(in_srgb,var(--c-success)_8%,transparent)]'
                        : isTarget
                          ? 'border-c-accent dark:border-c-accent'
                          : 'border-c-border-subtle'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg bg-c-accent-soft text-c-accent flex items-center justify-center font-bold">
                            {lvl.level}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-c-text truncate">
                                {lvl.title}
                              </div>
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                  achieved
                                    ? 'bg-[color-mix(in_srgb,var(--c-success)_12%,transparent)] text-c-success border-c-success'
                                    : 'bg-c-surface-raised text-c-text-secondary border-c-border-subtle'
                                }`}
                              >
                                {achieved
                                  ? isImplicit
                                    ? 'Achieved (implicit)'
                                    : 'Achieved'
                                  : 'Not achieved'}
                              </span>
                              {isTarget && !achieved && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full border bg-c-accent-soft text-c-accent border-c-accent">
                                  Target
                                </span>
                              )}
                              {isSkipped && !achieved && !isTarget && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full border bg-transparent text-c-text-muted border-c-border-subtle">
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
                                className="p-1 rounded-md hover:bg-c-surface-raised dark:hover:bg-c-surface-raised"
                                aria-label={isOpen ? 'Collapse level' : 'Expand level'}
                                title={isOpen ? 'Collapse' : 'Expand'}
                              >
                                <ChevronDown
                                  className={`w-4 h-4 text-c-text-secondary transition-transform ${
                                    isOpen ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>
                            </div>
                            <div className="text-xs text-c-text-muted truncate">
                              {axisKey} · level {lvl.level}/{levelCount}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 text-sm text-c-text-secondary leading-relaxed line-clamp-3">
                          {lvl.description}
                        </div>
                      </div>
                    </div>

                    {/* Details: only for active level */}
                    {isOpen && (
                      <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                        {/* Example (full width, primary reading path) */}
                        <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised dark:bg-c-bg p-4">
                          <div className="text-xs font-bold text-c-text-muted uppercase tracking-wider mb-2">
                            Example + suggested technologies
                          </div>
                          <div className="text-sm text-c-text-secondary leading-relaxed">
                            {knowledge.example}
                          </div>
                          {Array.isArray(knowledge.suggestedTechnologies) &&
                            knowledge.suggestedTechnologies.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {knowledge.suggestedTechnologies.map((t) => (
                                  <span
                                    key={t}
                                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-c-accent-soft text-c-accent border border-c-accent"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>

                        {/* Explanation (collapsed by default; expandable) */}
                        <div className="mt-3 rounded-xl border border-c-border-subtle bg-c-surface dark:bg-c-bg p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-bold text-c-text-muted uppercase tracking-wider">
                              Explanation
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsExplanationExpanded((v) => !v)}
                              className="text-xs font-semibold text-c-accent dark:text-c-accent hover:underline"
                            >
                              {isExplanationExpanded ? 'Less' : 'More'}
                            </button>
                          </div>

                          <div className="mt-2 text-sm text-c-text-secondary leading-relaxed">
                            <div className={isExplanationExpanded ? '' : 'line-clamp-2'}>
                              {lvl.description}{' '}
                              <span className="text-c-text-muted">
                                Use evidence (screenshot, report, system log, procedure, KPI) to
                                justify your choice.
                              </span>
                            </div>

                            {isExplanationExpanded && (
                              <div className="mt-3 space-y-2">
                                <div className="text-xs font-semibold text-c-text-muted uppercase tracking-wider">
                                  How to decide
                                </div>
                                <ul className="space-y-1">
                                  <li>
                                    <span className="font-semibold">Achieved</span>: this is in
                                    place and used in practice (not only a pilot).
                                  </li>
                                  <li>
                                    <span className="font-semibold">Target</span>: desired “to‑be”
                                    level (planned / roadmap target).
                                  </li>
                                  <li>
                                    <span className="font-semibold">Skip</span>: explicitly mark
                                    “not planned” for this level.
                                  </li>
                                </ul>
                                <div className="text-xs font-semibold text-c-text-muted uppercase tracking-wider">
                                  Tip
                                </div>
                                <div>
                                  If you’re unsure, add a short comment + attach a quick artifact.
                                  You can always change your mind later.
                                </div>
                              </div>
                            )}
                          </div>
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
                                ? 'bg-c-surface border-c-border text-c-text shadow-sm'
                                : 'bg-white/70 dark:bg-white/5 border-c-border dark:border-white/15 text-c-text-secondary shadow-sm hover:bg-c-surface dark:hover:bg-white/8 hover:border-c-border-strong dark:hover:border-white/25'
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
                                ? 'bg-c-surface border-c-border text-c-text shadow-sm'
                                : 'bg-white/70 dark:bg-white/5 border-c-border dark:border-white/15 text-c-text-secondary shadow-sm hover:bg-c-surface dark:hover:bg-white/8 hover:border-c-border-strong dark:hover:border-white/25'
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
                                ? 'bg-c-surface border-c-border text-c-text shadow-sm'
                                : 'bg-white/70 dark:bg-white/5 border-c-border dark:border-white/15 text-c-text-secondary shadow-sm hover:bg-c-surface dark:hover:bg-white/8 hover:border-c-border-strong dark:hover:border-white/25'
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
                                ? 'bg-c-surface border-c-border text-c-text shadow-sm'
                                : 'bg-white/70 dark:bg-white/5 border-c-border dark:border-white/15 text-c-text-secondary shadow-sm hover:bg-c-surface dark:hover:bg-white/8 hover:border-c-border-strong dark:hover:border-white/25'
                            }`}
                          >
                            <Link2 className="w-4 h-4" />
                            Add link
                          </button>
                        </div>

                        {/* Panels */}
                        {activeCardPanel === 'questions' && (
                          <div className="mt-3 rounded-xl border border-c-border-subtle bg-c-surface dark:bg-c-bg p-4">
                            <div className="text-xs font-bold text-c-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                              <span>Validation questions</span>
                              {achieved && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] text-c-success">
                                  Verified
                                </span>
                              )}
                            </div>
                            <ul className="space-y-2 text-sm text-c-text-secondary">
                              {knowledge.questions.map((q, idx) => (
                                <li key={idx} className="flex gap-2">
                                  <span className="text-c-accent mt-0.5 shrink-0">•</span>
                                  <span>{q}</span>
                                </li>
                              ))}
                            </ul>

                            {/* Per-question AI guidance (canon-grounded, non-blocking) */}
                            {(() => {
                              const gKey = `${areaId}#${lvl.level}`;
                              const g = guidance[gKey];
                              if (!g) {
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (selectedArea) requestGuidance(selectedArea, lvl);
                                    }}
                                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-c-accent dark:text-c-accent hover:underline"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Podpowiedź AI (dlaczego to ważne + jak oceniać)
                                  </button>
                                );
                              }
                              if (g.loading) {
                                return (
                                  <div className="mt-3 text-xs text-c-text-muted">
                                    Generuję podpowiedź…
                                  </div>
                                );
                              }
                              if (!g.data) return null;
                              return (
                                <div className="mt-3 rounded-lg border border-c-accent bg-c-accent-soft p-3 space-y-2 text-sm">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-c-accent dark:text-c-accent">
                                    <Sparkles className="w-3 h-3" />
                                    Podpowiedź konsultanta
                                    <span className="ml-auto font-normal normal-case text-c-text-muted">
                                      {g.data.source === 'llm' ? 'AI' : 'kanon'}
                                    </span>
                                  </div>
                                  <p className="text-c-text-secondary">
                                    <span className="font-semibold">Dlaczego to ważne: </span>
                                    {g.data.whyItMatters}
                                  </p>
                                  <p className="text-c-text-secondary">
                                    <span className="font-semibold">Jak oceniać poziom: </span>
                                    {g.data.levelInterpretation}
                                  </p>
                                  <p className="text-c-text-secondary dark:text-c-text-muted text-xs">
                                    <span className="font-semibold">Kanon: </span>
                                    {g.data.canonContext}
                                  </p>
                                  {g.data.pitfalls.length > 0 && (
                                    <p className="text-c-text-secondary dark:text-c-text-muted text-xs">
                                      <span className="font-semibold">Uważaj na: </span>
                                      {g.data.pitfalls.join(' · ')}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {activeCardPanel === 'comment' && (
                          <div className="mt-3 rounded-xl border border-c-border-subtle bg-c-surface dark:bg-c-bg p-4">
                            <div className="text-xs font-bold text-c-text-muted uppercase tracking-wider mb-2">
                              Comment
                            </div>
                            <textarea
                              value={note}
                              onChange={(e) => setLevelNote(lvl.level, e.target.value)}
                              placeholder="Facts: what exists? Gaps: what's missing? Context: scope/owners/tools?"
                              disabled={readOnly}
                              rows={3}
                              className="w-full px-3 py-2 rounded-lg border border-c-border-subtle bg-c-surface dark:bg-c-bg text-c-text text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)]"
                            />
                          </div>
                        )}

                        {activeCardPanel === 'attachments' && (
                          <div className="mt-3 rounded-xl border border-c-border-subtle bg-c-surface dark:bg-c-bg p-4">
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
                          <div className="mt-3 rounded-xl border border-c-border-subtle bg-c-surface dark:bg-c-bg p-4">
                            <div className="text-xs font-bold text-c-text-muted uppercase tracking-wider mb-2">
                              Links
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                value={linkDraft}
                                onChange={(e) => setLinkDraft(e.target.value)}
                                placeholder="https://…"
                                className="flex-1 h-10 px-3 rounded-lg border border-c-border-subtle bg-c-surface dark:bg-c-bg text-c-text text-sm"
                              />
                              <button
                                type="button"
                                disabled={readOnly || !String(linkDraft || '').trim()}
                                onClick={() => {
                                  addLevelLink(lvl.level, linkDraft);
                                  setLinkDraft('');
                                }}
                                className="h-10 px-4 rounded-lg bg-c-tag-5 hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold"
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
                                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-c-border-subtle bg-c-surface-raised dark:bg-c-surface"
                                    >
                                      <a
                                        href={u}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm text-c-accent dark:text-c-accent hover:underline truncate"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {u}
                                      </a>
                                      <button
                                        type="button"
                                        disabled={readOnly}
                                        className="text-xs font-semibold text-c-text-muted hover:text-danger-500"
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
                            <div className="mt-4 pt-4 border-t border-c-border-subtle">
                              <div className="grid grid-cols-3 items-center gap-3">
                                <div />

                                <div className="flex items-center justify-center gap-2">
                                  {/* Single-choice radio-like buttons: only one can be active at a time */}
                                  <button
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => {
                                      const cur = getAreaState(value, areaId, levelCount);
                                      const curAchieved = Number(cur.achievedLevel || 0);
                                      const alreadyAchieved = curAchieved >= lvl.level;

                                      if (alreadyAchieved) {
                                        // Toggle off: clear achieved for this level
                                        setAchieved(lvl.level, false);
                                      } else {
                                        // Select Achieved: clear Target and Skip for this level first
                                        if (Number(cur.targetLevel || 0) === lvl.level) {
                                          setTargetLevel(undefined);
                                        }
                                        setLevelDecision(lvl.level, undefined);
                                        setAchieved(lvl.level, true);
                                      }
                                    }}
                                    className={`h-10 w-28 rounded-lg text-sm font-semibold border transition-colors ${
                                      achieved
                                        ? 'bg-c-success border-c-success text-white'
                                        : 'bg-[color-mix(in_srgb,var(--c-success)_10%,transparent)] border-c-success text-c-success hover:opacity-90'
                                    }`}
                                  >
                                    Achieved
                                  </button>

                                  <button
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => {
                                      const cur = getAreaState(value, areaId, levelCount);
                                      const alreadyTarget =
                                        Number(cur.targetLevel || 0) === lvl.level;

                                      if (alreadyTarget) {
                                        // Toggle off: clear target
                                        setTargetLevel(undefined);
                                      } else {
                                        // Select Target: clear Achieved (if at this level) and Skip first
                                        if (Number(cur.achievedLevel || 0) >= lvl.level) {
                                          setAchieved(lvl.level, false);
                                        }
                                        setLevelDecision(lvl.level, undefined);
                                        setTargetLevel(lvl.level);
                                      }
                                    }}
                                    className={`h-10 w-28 rounded-lg text-sm font-semibold border transition-colors ${
                                      isTarget
                                        ? 'bg-c-tag-5 border-c-tag-5 text-white'
                                        : 'bg-[color-mix(in_srgb,var(--c-tag-5)_10%,transparent)] border-c-tag-5 text-c-tag-5 hover:opacity-90'
                                    }`}
                                  >
                                    Target
                                  </button>

                                  <button
                                    type="button"
                                    disabled={readOnly}
                                    onClick={() => {
                                      const cur = getAreaState(value, areaId, levelCount);
                                      const alreadySkipped =
                                        (cur.levelDecisions || {})[String(lvl.level)] === 'skip';

                                      if (alreadySkipped) {
                                        // Toggle off: clear skip
                                        setLevelDecision(lvl.level, undefined);
                                      } else {
                                        // Select Skip: clear Achieved (if at this level) and Target first
                                        if (Number(cur.achievedLevel || 0) >= lvl.level) {
                                          setAchieved(lvl.level, false);
                                        }
                                        if (Number(cur.targetLevel || 0) === lvl.level) {
                                          setTargetLevel(undefined);
                                        }
                                        setLevelDecision(lvl.level, 'skip');
                                      }
                                    }}
                                    className={`h-10 w-28 rounded-lg text-sm font-semibold border transition-colors ${
                                      isSkipped
                                        ? 'bg-c-text text-c-surface border-c-text'
                                        : 'bg-transparent border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised'
                                    }`}
                                  >
                                    Skip
                                  </button>
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                  <div className="inline-flex overflow-hidden rounded-xl border border-c-border dark:border-white/15 bg-white/80 dark:bg-white/5 shadow-sm">
                                    <button
                                      type="button"
                                      disabled={!prev}
                                      onClick={() => prev && setLevel(prev.level)}
                                      className="h-10 px-4 inline-flex items-center gap-2 text-sm font-semibold text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-white/8 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                      title="Previous"
                                    >
                                      <ArrowLeft className="w-4 h-4" />
                                      Previous
                                    </button>
                                    <div className="w-px bg-c-surface-raised dark:bg-white/10" />
                                    <button
                                      type="button"
                                      disabled={!next}
                                      onClick={() => next && setLevel(next.level)}
                                      className="h-10 px-4 inline-flex items-center gap-2 text-sm font-semibold text-white bg-c-tag-1 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                      title="Next"
                                    >
                                      Next
                                      <ArrowRight className="w-4 h-4" />
                                    </button>
                                  </div>
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
        <div className="fixed inset-0 z-[100] bg-c-surface-raised dark:bg-c-bg backdrop-blur-sm">
          <div className="absolute inset-0 overflow-auto p-4 md:p-8">
            <div className="mx-auto max-w-[1600px]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsMatrixFullscreen(false)}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-c-border dark:border-white/10 bg-c-surface-raised dark:bg-white/5 text-c-text text-sm font-semibold hover:bg-c-surface-raised dark:hover:bg-white/10 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <div className="text-xs text-c-text-secondary">
                  Press <span className="font-semibold text-c-text">Esc</span> to
                  close
                </div>
              </div>

              {/* Re-render the same Matrix panel */}
              <div className="relative overflow-hidden rounded-2xl border border-c-border dark:border-white/10 bg-c-surface dark:bg-c-bg shadow-lg dark:shadow-2xl">
                <div className="pointer-events-none absolute -top-40 -right-40 h-[420px] w-[420px] rounded-full bg-[color-mix(in_srgb,var(--c-tag-5)_15%,transparent)] blur-3xl hidden dark:block" />
                <div className="pointer-events-none absolute -bottom-48 -left-40 h-[460px] w-[460px] rounded-full bg-[color-mix(in_srgb,var(--c-tag-1)_10%,transparent)] blur-3xl hidden dark:block" />

                <div className="relative p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="text-xs font-semibold tracking-widest uppercase text-c-accent">
                        Digital Development Map
                      </div>
                      <div className="mt-1 text-3xl font-bold text-c-text">
                        {axis?.id}. {axis?.name}
                      </div>
                      <div className="mt-1 text-sm text-c-text-secondary">
                        Process Digitalization Assessment Matrix
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-col gap-2 text-xs text-c-text-secondary">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="h-3.5 w-3.5 rounded-full bg-c-surface " />
                          <span>AS-IS</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-3.5 w-3.5 rounded-full bg-c-tag-1 ring-1 ring-c-tag-1" />
                          <span>TO-BE</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-c-text-secondary">
                        <label className="inline-flex items-center gap-2 select-none">
                          <input
                            type="checkbox"
                            checked={!matrixCompact}
                            onChange={(e) => setMatrixCompact(!e.target.checked)}
                            className="h-4 w-4 rounded border-c-border dark:border-white/20 bg-c-surface-raised dark:bg-white/5 text-c-accent focus:ring-[color:var(--c-focus)]"
                          />
                          Spacious
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Matrix */}
                  <div className="dark mt-6 overflow-x-auto pb-2 rounded-xl bg-c-bg p-2">
                    <div
                      className="grid gap-2 min-w-[1100px]"
                      style={{
                        gridTemplateColumns: `240px repeat(${axisAreas.length}, minmax(180px, 1fr))`,
                      }}
                    >
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
                            <div className="sticky left-0 z-10 rounded-xl border border-white/10 bg-c-surface-raised backdrop-blur p-3 shadow-[10px_0_30px_rgba(0,0,0,0.18)]">
                              <div className="text-white font-bold">
                                <span className="text-c-accent">{level}.</span> {label}
                              </div>
                              <div className="mt-1 text-[11px] text-c-text-secondary">
                                Click for details
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

                              return (
                                <button
                                  key={`cell-fs-${area.id}-${level}`}
                                  type="button"
                                  className={`group relative rounded-lg border transition-all duration-200 text-left ${
                                    matrixCompact ? 'p-2' : 'p-2.5'
                                  } ${
                                    isAchieved
                                      ? 'border-c-tag-5 bg-[color-mix(in_srgb,var(--c-tag-5)_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-tag-5)_35%,transparent)]'
                                      : isTarget
                                        ? 'border-c-tag-1 bg-[color-mix(in_srgb,var(--c-tag-1)_15%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-tag-1)_25%,transparent)]'
                                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'
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
                                  aria-label={`${area.name}, level ${level}`}
                                >
                                  {/* Ultra-simple cell: just 2-3 keywords */}
                                  {(() => {
                                    const keyTechs = [
                                      'AI',
                                      'ML',
                                      'RPA',
                                      'IoT',
                                      'AGV',
                                      'WMS',
                                      'MES',
                                      'ERP',
                                      'CRM',
                                      'BI',
                                      'API',
                                      'EDI',
                                      'PLM',
                                      'APS',
                                      'TMS',
                                      'YMS',
                                    ];
                                    const highlighted = techs
                                      .filter((t) => keyTechs.includes(t))
                                      .slice(0, 2);
                                    const shortTitle = areaLevelInfo?.title
                                      ? areaLevelInfo.title.split(' ').slice(0, 3).join(' ')
                                      : null;
                                    const displayContent =
                                      highlighted.length > 0
                                        ? highlighted.join(' \u00b7 ')
                                        : shortTitle || '\u2014';

                                    return (
                                      <div className="h-full min-h-[40px] flex items-center justify-center text-center px-1">
                                        <span
                                          className={`text-[11px] font-medium leading-tight ${
                                            isAchieved
                                              ? 'text-white'
                                              : isTarget
                                                ? 'text-white'
                                                : 'text-c-text-secondary'
                                          }`}
                                        >
                                          {displayContent}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </button>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}

                      {/* Bottom X-axis strip (process areas) */}
                      <div className="sticky bottom-0 left-0 z-30 rounded-xl border border-white/10 bg-c-bg backdrop-blur p-2 shadow-[0_-10px_30px_rgba(0,0,0,0.35)]">
                        <div className="text-[10px] font-semibold text-c-text-secondary uppercase tracking-wider">
                          Area
                        </div>
                      </div>
                      {axisAreas.map((area) => {
                        const s = getAreaState(value, area.id, levelCount);
                        const achieved = s.achievedLevel || 0;
                        const target = s.targetLevel || 0;
                        return (
                          <button
                            key={`x-fs-${area.id}`}
                            type="button"
                            onClick={() => {
                              setAreaId(area.id);
                              onAreaChange?.(area.id);
                              setViewMode('surveys');
                              setIsMatrixFullscreen(false);
                            }}
                            className="sticky bottom-0 z-20 rounded-xl border border-white/10 bg-gradient-to-b from-white/10 to-white/6 backdrop-blur p-2 text-left hover:from-white/14 hover:to-white/8 transition-colors shadow-[0_-10px_30px_rgba(0,0,0,0.22)]"
                          >
                            {/* Top line: ID + badges */}
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[11px] font-bold text-c-accent">
                                {area.id}
                              </span>
                              <div className="flex items-center gap-1">
                                {achieved > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--c-tag-5)_25%,transparent)] text-[9px] font-bold text-c-tag-5">
                                    AS {achieved}
                                  </span>
                                )}
                                {target > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--c-tag-1)_20%,transparent)] text-[9px] font-bold text-c-tag-1">
                                    TO {target}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Area name - 2 lines max */}
                            <div className="text-[11px] font-medium text-white leading-tight line-clamp-2">
                              {area.name}
                            </div>
                          </button>
                        );
                      })}
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
                        <div className="rounded-xl border border-c-border dark:border-white/10 bg-c-surface-raised dark:bg-white/5 p-4">
                          <div className="text-4xl font-extrabold text-c-text tabular-nums">
                            {avgActual}
                          </div>
                          <div className="mt-1 text-xs text-c-text-secondary">
                            Avg. Current Level
                          </div>
                        </div>
                        <div className="rounded-xl border border-c-border dark:border-white/10 bg-c-surface-raised dark:bg-white/5 p-4">
                          <div className="text-4xl font-extrabold text-c-text tabular-nums">
                            {avgTarget}
                          </div>
                          <div className="mt-1 text-xs text-c-text-secondary">
                            Avg. Target Level
                          </div>
                        </div>
                        <div className="rounded-xl border border-c-border dark:border-white/10 bg-c-surface-raised dark:bg-white/5 p-4">
                          <div className="text-4xl font-extrabold text-c-text tabular-nums">
                            {avgGap}
                          </div>
                          <div className="mt-1 text-xs text-c-text-secondary">
                            Avg. Gap
                          </div>
                        </div>
                        <div className="rounded-xl border border-c-border dark:border-white/10 bg-c-surface-raised dark:bg-white/5 p-4">
                          <div className="text-4xl font-extrabold text-c-text tabular-nums">
                            {stats.assessed}/{axisAreas.length}
                          </div>
                          <div className="mt-1 text-xs text-c-text-secondary">
                            Areas Assessed
                          </div>
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

  // Wrapper for content panel with expand button when nav is collapsed
  const contentWithExpandButton = (
    <div className="relative h-full">
      {leftOverride ?? contentPanel}
      {/* Expand button - visible only when nav is collapsed */}
      {isNavCollapsed && (
        <button
          onClick={() => setIsNavCollapsed(false)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-c-surface border border-c-border-subtle border-r-0 rounded-l-lg text-c-text-secondary hover:text-c-accent hover:bg-c-surface-raised shadow-sm transition-colors"
          title="Expand navigation"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  return (
    <>
      <AssessmentToolShell
        left={contentWithExpandButton}
        right={navPanel}
        isRightOpen={isSidebarOpen && !isNavCollapsed}
        rightWidthClass="w-[320px]"
        rightSide="right"
      />
      <GlossaryPanel isOpen={isGlossaryOpen} onClose={() => setIsGlossaryOpen(false)} />
    </>
  );
};

export default DRDAssessmentEditor;
