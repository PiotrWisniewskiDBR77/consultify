import { ArrowDownUp, Palette, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { LANE_HEIGHT } from './FlowNodeComponent';
import type { Lane } from './useProcessFlowNodes';

export { LANE_HEIGHT };
export type { Lane };

// ── Lane palette & presets ───────────────────────────────────────────────────

export const LANE_COLORS = [
  '#e0e7ff',
  '#dbeafe',
  '#d1fae5',
  '#fef3c7',
  '#fce7f3',
  '#ede9fe',
  '#ccfbf1',
  '#fecaca',
  '#e2e8f0',
  '#c7d2fe',
];

export const FLOW_THEME_PRESETS: Record<string, string[]> = {
  ops: ['#dbeafe', '#e0e7ff', '#d1fae5', '#fef3c7', '#fee2e2'],
  workshop: ['#fce7f3', '#ede9fe', '#ccfbf1', '#dbeafe', '#fde68a'],
  strategy: ['#e2e8f0', '#c7d2fe', '#bfdbfe', '#ddd6fe', '#fecdd3'],
};

export const DEFAULT_LANES: Lane[] = [
  { id: 'lane-1', label: 'Main Process', color: LANE_COLORS[0] },
];

// ── Single lane background ───────────────────────────────────────────────────

interface LaneBackgroundProps {
  lane: Lane;
  idx: number;
  locked: boolean;
  onRename: (id: string, next: string) => void;
  onDelete?: (id: string) => void;
  onColorChange?: (id: string, color: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
  laneCount: number;
}

const LaneBackground: React.FC<LaneBackgroundProps> = ({
  lane,
  idx,
  locked,
  onRename,
  onDelete,
  onColorChange,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  laneCount,
}) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(lane.label);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (value.trim() && value !== lane.label) onRename(lane.id, value.trim());
  };

  return (
    <div
      className="absolute left-0 right-0 border-b border-slate-200/40 dark:border-navy-700/40"
      style={{ top: idx * LANE_HEIGHT, height: LANE_HEIGHT, background: `${lane.color}15` }}
    >
      <div className="absolute left-2 top-1 z-10 flex items-center gap-1">
        {editing ? (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-navy-800/80 rounded px-1 outline-none border border-primary-400"
          />
        ) : (
          <div
            className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 select-none cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
            onDoubleClick={() => {
              if (!locked) {
                setValue(lane.label);
                setEditing(true);
              }
            }}
          >
            {lane.label}
          </div>
        )}

        {!locked && (
          <div
            className="flex items-center gap-0.5 opacity-0 hover:opacity-100 transition-opacity"
            style={{ opacity: undefined }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '0';
            }}
          >
            {!isFirst && (
              <button
                onClick={() => onMoveUp?.(lane.id)}
                className="p-0.5 rounded hover:bg-white/60 dark:hover:bg-navy-700/60"
                title="Move up"
              >
                <ArrowDownUp size={9} className="text-slate-400 rotate-180" />
              </button>
            )}
            {!isLast && (
              <button
                onClick={() => onMoveDown?.(lane.id)}
                className="p-0.5 rounded hover:bg-white/60 dark:hover:bg-navy-700/60"
                title="Move down"
              >
                <ArrowDownUp size={9} className="text-slate-400" />
              </button>
            )}
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="p-0.5 rounded hover:bg-white/60 dark:hover:bg-navy-700/60"
              title="Change color"
            >
              <Palette size={9} className="text-slate-400" />
            </button>
            {laneCount > 1 && (
              <button
                onClick={() => onDelete?.(lane.id)}
                className="p-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20"
                title="Delete lane"
              >
                <X size={9} className="text-rose-400" />
              </button>
            )}
          </div>
        )}
      </div>

      {showColorPicker && !locked && (
        <div className="absolute left-2 top-5 z-20 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg p-1.5 shadow-lg flex flex-wrap gap-1 w-[120px]">
          {LANE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                onColorChange?.(lane.id, c);
                setShowColorPicker(false);
              }}
              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${c === lane.color ? 'border-primary-500 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── LaneSystem – renders all lane backgrounds ────────────────────────────────

export interface LaneSystemProps {
  lanes: Lane[];
  isPl: boolean;
  locked: boolean;
  onRename: (laneId: string, newLabel: string) => void;
  onDelete: (laneId: string) => void;
  onColorChange: (laneId: string, color: string) => void;
  onMoveUp: (laneId: string) => void;
  onMoveDown: (laneId: string) => void;
  dragOverLaneId: string | null;
}

export const LaneSystem: React.FC<LaneSystemProps> = ({
  lanes,
  locked,
  onRename,
  onDelete,
  onColorChange,
  onMoveUp,
  onMoveDown,
  dragOverLaneId,
}) => (
  <>
    {lanes.map((lane, idx) => (
      <LaneBackground
        key={lane.id}
        lane={lane}
        idx={idx}
        locked={locked}
        onRename={onRename}
        onDelete={onDelete}
        onColorChange={onColorChange}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        isFirst={idx === 0}
        isLast={idx === lanes.length - 1}
        laneCount={lanes.length}
      />
    ))}
    {dragOverLaneId &&
      (() => {
        const dragIdx = lanes.findIndex((l) => l.id === dragOverLaneId);
        if (dragIdx < 0) return null;
        return (
          <div
            className="absolute left-0 right-0 pointer-events-none border-2 border-primary-400/40 rounded-lg"
            style={{
              top: dragIdx * LANE_HEIGHT,
              height: LANE_HEIGHT,
            }}
          />
        );
      })()}
  </>
);

export default LaneSystem;
