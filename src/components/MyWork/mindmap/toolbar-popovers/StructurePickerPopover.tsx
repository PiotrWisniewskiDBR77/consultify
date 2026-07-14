/**
 * StructurePickerPopover — Lets the user choose a map structure type:
 * Mind Map, Org Chart, Tree (Right), Fishbone, Timeline.
 */
import { Brain, GitBranch, type LucideIcon, Network, Rows3, Timer, Waypoints } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  return (
    <div className="w-64 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-c-border-subtle dark:border-c-border-subtle">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
          {t('ideas.mindmap.structureType2', 'Structure Type')}
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
                  ? 'bg-c-surface-raised dark:bg-c-surface-raised'
                  : 'hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
              }`}
            >
              <Icon
                size={14}
                className={`mt-0.5 shrink-0 ${
                  isActive ? 'text-c-text-secondary dark:text-c-text' : 'text-c-text-secondary'
                }`}
              />
              <div className="min-w-0">
                <div
                  className={`text-[11px] font-semibold ${
                    isActive
                      ? 'text-c-text dark:text-c-text'
                      : 'text-c-text-secondary dark:text-c-text'
                  }`}
                >
                  {isPl ? opt.labelPl : opt.labelEn}
                </div>
                <div className="text-[9px] text-c-text-secondary dark:text-c-text-secondary leading-tight mt-0.5">
                  {isPl ? opt.descPl : opt.descEn}
                </div>
              </div>
              {isActive && (
                <div className="ml-auto mt-0.5 w-1.5 h-1.5 rounded-full bg-c-surface dark:bg-c-surface-raised shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
