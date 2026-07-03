/**
 * Portfolio Matrix View
 *
 * Investment quadrant visualization (Value vs Risk).
 * Bubble size represents budget.
 */

import { AlertTriangle, Info, MinusCircle, ThumbsUp, TrendingUp, Zap } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import {
  getAxisColor,
  getPriorityColors,
  MATRIX_QUADRANT_COLORS,
} from '../../config/portfolioColors';
import { PortfolioInitiative } from '../../types';

interface PortfolioMatrixViewProps {
  initiatives: PortfolioInitiative[];
  onInitiativeClick: (initiative: PortfolioInitiative) => void;
}

// Quadrant definitions
const QUADRANTS = {
  quickWins: {
    label: 'Quick Wins',
    description: 'High value, low risk',
    icon: Zap,
    position: 'top-left',
  },
  majorInvest: {
    label: 'Major Investment',
    description: 'High value, high risk',
    icon: TrendingUp,
    position: 'top-right',
  },
  niceToHave: {
    label: 'Nice to Have',
    description: 'Low value, low risk',
    icon: ThumbsUp,
    position: 'bottom-left',
  },
  avoid: {
    label: 'Avoid/Reduce',
    description: 'Low value, high risk',
    icon: MinusCircle,
    position: 'bottom-right',
  },
};

// ============================================
// BUBBLE COMPONENT
// ============================================

interface BubbleProps {
  initiative: PortfolioInitiative;
  x: number; // 0-100
  y: number; // 0-100
  size: number; // radius in px
  onClick: () => void;
}

const Bubble: React.FC<BubbleProps> = ({ initiative, x, y, size, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const priorityColors = getPriorityColors(initiative.priority);
  const axisColor = getAxisColor(initiative.axis);

  // Clamp size between reasonable bounds
  const radius = Math.max(20, Math.min(60, size));

  return (
    <g
      transform={`translate(${x}, ${100 - y})`}
      className="cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Shadow */}
      <circle r={radius} fill="rgba(0,0,0,0.1)" transform="translate(2, 2)" />

      {/* Main bubble — neutral fill (priority encoded on ring; crimson never = data) */}
      <circle
        r={radius}
        className={`${isHovered ? 'fill-c-info' : 'fill-c-focus-solid'} stroke-white stroke-2 transition-all`}
        style={{ opacity: 0.8 }}
      />

      {/* Priority ring */}
      <circle
        r={radius - 4}
        fill="none"
        strokeWidth={3}
        className={priorityColors.bg.replace('bg-', 'stroke-')}
      />

      {/* Axis indicator */}
      <circle r={6} className={axisColor.bg} transform={`translate(0, ${-radius + 10})`} />

      {/* Initiative abbreviation */}
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-white text-xs font-medium pointer-events-none"
        style={{ fontSize: radius > 30 ? '12px' : '10px' }}
      >
        {initiative.name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 3)}
      </text>

      {/* Tooltip on hover */}
      {isHovered && (
        <g transform={`translate(${radius + 10}, 0)`}>
          <rect
            x={0}
            y={-30}
            width={180}
            height={60}
            rx={8}
            className="fill-c-surface stroke-c-border"
          />
          <text x={10} y={-10} className="fill-c-text text-xs font-medium">
            {initiative.name.length > 22 ? initiative.name.slice(0, 22) + '...' : initiative.name}
          </text>
          <text x={10} y={8} className="fill-c-text-secondary text-[10px]">
            Value: {initiative.valueScore} | Risk: {initiative.riskScore}
          </text>
          <text x={10} y={22} className="fill-c-text-muted text-[10px]">
            Budget: ${(initiative.budget / 1000).toFixed(0)}K
          </text>
        </g>
      )}
    </g>
  );
};

// ============================================
// MAIN MATRIX VIEW
// ============================================

export const PortfolioMatrixView: React.FC<PortfolioMatrixViewProps> = ({
  initiatives,
  onInitiativeClick,
}) => {
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null);

  // Calculate bubble positions and sizes
  const bubbleData = useMemo(() => {
    const maxBudget = Math.max(...initiatives.map((i) => i.budget || 1), 1);

    return initiatives.map((initiative) => {
      // Use riskScore and valueScore to position (0-100 scale)
      const x = initiative.riskScore || 50;
      const y = initiative.valueScore || 50;

      // Size based on budget (20-60px radius)
      const size = 20 + ((initiative.budget || 0) / maxBudget) * 40;

      // Determine quadrant
      let quadrant: string;
      if (y >= 50) {
        quadrant = x < 50 ? 'quickWins' : 'majorInvest';
      } else {
        quadrant = x < 50 ? 'niceToHave' : 'avoid';
      }

      return {
        initiative,
        x,
        y,
        size,
        quadrant,
      };
    });
  }, [initiatives]);

  // Filter by selected quadrant
  const filteredBubbles = useMemo(() => {
    if (!selectedQuadrant) return bubbleData;
    return bubbleData.filter((b) => b.quadrant === selectedQuadrant);
  }, [bubbleData, selectedQuadrant]);

  // Count per quadrant
  const quadrantCounts = useMemo(() => {
    const counts: Record<string, number> = {
      quickWins: 0,
      majorInvest: 0,
      niceToHave: 0,
      avoid: 0,
    };
    bubbleData.forEach((b) => {
      counts[b.quadrant]++;
    });
    return counts;
  }, [bubbleData]);

  return (
    <div className="h-full flex flex-col p-4">
      {/* Quadrant Filter Buttons */}
      <div className="shrink-0 flex items-center gap-3 mb-4">
        <button
          onClick={() => setSelectedQuadrant(null)}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            !selectedQuadrant
              ? 'bg-c-surface-raised text-c-text'
              : 'text-c-text-muted hover:bg-c-surface-raised'
          }`}
        >
          All ({initiatives.length})
        </button>

        {Object.entries(QUADRANTS).map(([key, q]) => (
          <button
            key={key}
            onClick={() => setSelectedQuadrant(selectedQuadrant === key ? null : key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              selectedQuadrant === key
                ? `${MATRIX_QUADRANT_COLORS[key as keyof typeof MATRIX_QUADRANT_COLORS].bg} ${MATRIX_QUADRANT_COLORS[key as keyof typeof MATRIX_QUADRANT_COLORS].label}`
                : 'text-c-text-muted hover:bg-c-surface-raised'
            }`}
          >
            <q.icon size={14} />
            {q.label} ({quadrantCounts[key]})
          </button>
        ))}
      </div>

      {/* Matrix Chart */}
      <div className="flex-1 relative bg-c-bg rounded-xl border border-c-border overflow-hidden">
        {/* Quadrant backgrounds */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
          {/* Top Left - Quick Wins */}
          <div
            className={`${MATRIX_QUADRANT_COLORS.quickWins.bg} ${MATRIX_QUADRANT_COLORS.quickWins.border} border-r border-b`}
          >
            <div className="p-3 flex items-center gap-2">
              <Zap size={16} className={MATRIX_QUADRANT_COLORS.quickWins.label} />
              <span className={`text-sm font-medium ${MATRIX_QUADRANT_COLORS.quickWins.label}`}>
                Quick Wins
              </span>
            </div>
          </div>

          {/* Top Right - Major Investment */}
          <div
            className={`${MATRIX_QUADRANT_COLORS.majorInvest.bg} ${MATRIX_QUADRANT_COLORS.majorInvest.border} border-b`}
          >
            <div className="p-3 flex items-center gap-2 justify-end">
              <span className={`text-sm font-medium ${MATRIX_QUADRANT_COLORS.majorInvest.label}`}>
                Major Investment
              </span>
              <TrendingUp size={16} className={MATRIX_QUADRANT_COLORS.majorInvest.label} />
            </div>
          </div>

          {/* Bottom Left - Nice to Have */}
          <div
            className={`${MATRIX_QUADRANT_COLORS.niceToHave.bg} ${MATRIX_QUADRANT_COLORS.niceToHave.border} border-r`}
          >
            <div className="h-full flex items-end p-3">
              <div className="flex items-center gap-2">
                <ThumbsUp size={16} className={MATRIX_QUADRANT_COLORS.niceToHave.label} />
                <span className={`text-sm font-medium ${MATRIX_QUADRANT_COLORS.niceToHave.label}`}>
                  Nice to Have
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Right - Avoid */}
          <div
            className={`${MATRIX_QUADRANT_COLORS.avoid.bg} ${MATRIX_QUADRANT_COLORS.avoid.border}`}
          >
            <div className="h-full flex items-end justify-end p-3">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${MATRIX_QUADRANT_COLORS.avoid.label}`}>
                  Avoid/Reduce
                </span>
                <MinusCircle size={16} className={MATRIX_QUADRANT_COLORS.avoid.label} />
              </div>
            </div>
          </div>
        </div>

        {/* Axis labels */}
        <div className="absolute left-1/2 bottom-2 -translate-x-1/2 flex items-center gap-1 text-xs text-c-text-muted">
          <span>Low Risk</span>
          <div className="w-20 h-px bg-c-border-strong" />
          <AlertTriangle size={12} />
          <div className="w-20 h-px bg-c-border-strong" />
          <span>High Risk</span>
        </div>

        <div className="absolute right-2 top-1/2 -translate-y-1/2 -rotate-90 flex items-center gap-1 text-xs text-c-text-muted origin-center">
          <span>Low Value</span>
          <div className="w-20 h-px bg-c-border-strong" />
          <TrendingUp size={12} />
          <div className="w-20 h-px bg-c-border-strong" />
          <span>High Value</span>
        </div>

        {/* SVG for bubbles */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
        >
          {filteredBubbles.map((bubble) => (
            <Bubble
              key={bubble.initiative.id}
              initiative={bubble.initiative}
              x={bubble.x}
              y={bubble.y}
              size={bubble.size / 3} // Scale down for viewBox
              onClick={() => onInitiativeClick(bubble.initiative)}
            />
          ))}
        </svg>

        {/* Empty state */}
        {filteredBubbles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-c-text-muted">
              <Info className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No initiatives in this quadrant</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="shrink-0 flex items-center justify-center gap-6 pt-4 text-xs text-c-text-muted">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-c-focus-solid" />
          <span>Initiative (size = budget)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-danger-500" />
          <span>Critical</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-c-warning" />
          <span>High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-c-info" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-c-success" />
          <span>Low</span>
        </div>
      </div>
    </div>
  );
};

export default PortfolioMatrixView;
