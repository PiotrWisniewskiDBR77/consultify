/**
 * StructurePickerPopover — Lets the user choose a map structure type:
 * Mind Map, Org Chart, Tree (Right), Fishbone, Timeline.
 */
import { Brain, GitBranch, type LucideIcon, Network, Rows3, Timer, Waypoints } from 'lucide-react';
import React from 'react';

import type { MapStructureType } from '../../ideaSelectionTypes';

interface StructureOption {
  type: MapStructureType;
  icon: LucideIcon;
  labelPl: string;
  labelEn: string;
  descPl: string;
  descEn: string;
}

const STRUCTURE_OPTIONS: StructureOption[] = [
  {
    type: 'mindmap',
    icon: Network,
    labelPl: 'Mapa myśli',
    labelEn: 'Mind Map',
    descPl: 'Radialna lub drzewo — klasyczny układ',
    descEn: 'Radial or tree — classic layout',
  },
  {
    type: 'org_chart',
    icon: Rows3,
    labelPl: 'Schemat organizacyjny',
    labelEn: 'Org Chart',
    descPl: 'Hierarchia z góry na dół',
    descEn: 'Top-down hierarchy',
  },
  {
    type: 'tree_right',
    icon: GitBranch,
    labelPl: 'Drzewo (w prawo)',
    labelEn: 'Tree (Right)',
    descPl: 'Korzeń po lewej, gałęzie w prawo',
    descEn: 'Root on left, branches to the right',
  },
  {
    type: 'fishbone',
    icon: Waypoints,
    labelPl: 'Ishikawa (rybka)',
    labelEn: 'Fishbone (Ishikawa)',
    descPl: 'Diagram przyczynowo-skutkowy',
    descEn: 'Cause-and-effect diagram',
  },
  {
    type: 'timeline',
    icon: Timer,
    labelPl: 'Oś czasu',
    labelEn: 'Timeline',
    descPl: 'Węzły wzdłuż osi poziomej',
    descEn: 'Nodes along a horizontal axis',
  },
  {
    type: 'semantic',
    icon: Brain,
    labelPl: 'Semantyczny',
    labelEn: 'Semantic',
    descPl: 'Grupuje węzły wg znaczenia i typu',
    descEn: 'Groups nodes by meaning and type',
  },
];

interface StructurePickerPopoverProps {
  isPl: boolean;
  current: MapStructureType;
  onSelect: (type: MapStructureType) => void;
  onClose: () => void;
}

export const StructurePickerPopover: React.FC<StructurePickerPopoverProps> = ({
  isPl,
  current,
  onSelect,
  onClose,
}) => {
  return (
    <div className="w-64 rounded-xl bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-white/[0.06] shadow-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-200/30 dark:border-white/[0.04]">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
          {isPl ? 'Typ struktury' : 'Structure Type'}
        </div>
      </div>
      <div className="px-1 py-1">
        {STRUCTURE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = current === opt.type;
          return (
            <button
              key={opt.type}
              onClick={() => {
                onSelect(opt.type);
                onClose();
              }}
              className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                isActive
                  ? 'bg-primary-500/10 dark:bg-primary-500/15'
                  : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
              }`}
            >
              <Icon
                size={14}
                className={`mt-0.5 shrink-0 ${
                  isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'
                }`}
              />
              <div className="min-w-0">
                <div
                  className={`text-[11px] font-semibold ${
                    isActive
                      ? 'text-primary-700 dark:text-primary-300'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {isPl ? opt.labelPl : opt.labelEn}
                </div>
                <div className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">
                  {isPl ? opt.descPl : opt.descEn}
                </div>
              </div>
              {isActive && (
                <div className="ml-auto mt-0.5 w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
