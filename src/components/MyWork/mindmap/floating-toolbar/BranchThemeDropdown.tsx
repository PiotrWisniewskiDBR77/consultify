import React from 'react';
import { useTranslation } from 'react-i18next';

interface BranchThemeDropdownProps {
  isPl: boolean;
  current?: string;
  onSelect: (theme: string) => void;
  onClose: () => void;
}

const LINE_STYLES = [
  {
    id: 'curved',
    labelPl: 'Łuk (domyślny)',
    labelEn: 'Curved (default)',
    preview: 'M 4 12 Q 16 4 28 12',
  },
  {
    id: 'orthogonal',
    labelPl: 'Kątowy',
    labelEn: 'Orthogonal',
    preview: 'M 4 12 L 16 12 L 16 6 L 28 6',
  },
  { id: 'straight', labelPl: 'Prosty', labelEn: 'Straight', preview: 'M 4 12 L 28 6' },
  {
    id: 'step',
    labelPl: 'Schodkowy',
    labelEn: 'Step',
    preview: 'M 4 12 L 12 12 L 12 6 L 20 6 L 20 12 L 28 12',
  },
];

export const BranchThemeDropdown: React.FC<BranchThemeDropdownProps> = ({
  isPl,
  current,
  onSelect,
  onClose,
}) => {
  const { t } = useTranslation();
  return (
    <div className="w-48 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl py-1">
      <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
        {t('ideas.mindmap.lineStyle', 'Line style')}
      </div>
      {LINE_STYLES.map((s) => {
        const isActive = current === s.id;
        return (
          <button
            key={s.id}
            onClick={() => {
              onSelect(s.id);
              onClose();
            }}
            className={`w-full flex items-center gap-3 px-2 py-2 text-[11px] transition-colors ${
              isActive
                ? 'bg-c-surface-raised dark:bg-c-surface text-c-text dark:text-c-text font-semibold'
                : 'text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
            }`}
          >
            <svg viewBox="0 0 32 16" className="w-8 h-4 shrink-0">
              <path
                d={s.preview}
                stroke={isActive ? 'currentColor' : 'var(--c-tag-8)'}
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
            {isPl ? s.labelPl : s.labelEn}
          </button>
        );
      })}
    </div>
  );
};
