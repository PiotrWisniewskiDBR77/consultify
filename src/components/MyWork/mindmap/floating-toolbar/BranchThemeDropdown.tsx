import { ArrowLeft, ArrowLeftRight, ArrowRight, Ban } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { EdgeArrowDirection } from '../../canvas/edgeArrowMarkers';

interface BranchThemeDropdownProps {
  isPl?: boolean;
  current?: string;
  onSelect: (theme: string) => void;
  /**
   * Strzałka kierunku dla WSZYSTKICH połączeń gałęzi (2026-07-28). Opcjonalne:
   * pasek węzła podaje ten handler tylko gdy węzeł ma co ustawiać. Sekcja
   * dokłada się do menu „Styl linii" — nie zmienia jego układu ani języka
   * wizualnego (te same nagłówki caps/tracking, te same ikony co popover
   * krawędzi w Przepływie procesu).
   */
  onArrowSelect?: (direction: EdgeArrowDirection) => void;
  onClose: () => void;
}

// Ikony 1:1 z `processflow/EdgeStylePopover.tsx` — ta sama czwórka opcji,
// żeby „strzałka" znaczyła to samo we wszystkich narzędziach.
const ARROW_OPTIONS: Array<{
  id: EdgeArrowDirection;
  icon: React.ComponentType<{ size?: number }>;
  labelEn: string;
}> = [
  { id: 'none', icon: Ban, labelEn: 'None' },
  { id: 'end', icon: ArrowRight, labelEn: 'End' },
  { id: 'start', icon: ArrowLeft, labelEn: 'Start' },
  { id: 'both', icon: ArrowLeftRight, labelEn: 'Both' },
];

const LINE_STYLES = [
  {
    id: 'curved',
    labelEn: 'Curved (default)',
    preview: 'M 4 12 Q 16 4 28 12',
  },
  {
    id: 'orthogonal',
    labelEn: 'Orthogonal',
    preview: 'M 4 12 L 16 12 L 16 6 L 28 6',
  },
  { id: 'straight', labelEn: 'Straight', preview: 'M 4 12 L 28 6' },
  {
    id: 'step',
    labelEn: 'Step',
    preview: 'M 4 12 L 12 12 L 12 6 L 20 6 L 20 12 L 28 12',
  },
];

export const BranchThemeDropdown: React.FC<BranchThemeDropdownProps> = ({
  isPl: _isPl,
  current,
  onSelect,
  onArrowSelect,
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
            {t(`myWorkMindmap.lineStyle.${s.id}`, s.labelEn)}
          </button>
        );
      })}

      {/* Strzałka kierunku przepływu — hurtowo dla całej gałęzi. Pojedynczą
          linię ustawia się prawym klikiem na niej („Kierunek strzałki").
          Świadomie bez podświetlenia „bieżącej" wartości: gałąź może mieć
          linie w różnych stanach, więc to jest przycisk ZASTOSUJ, nie
          przełącznik stanu — udawany stan byłby kłamstwem. */}
      {onArrowSelect && (
        <>
          <div className="my-1 mx-2 h-px bg-c-border-subtle dark:bg-c-border-subtle" />
          <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
            {t('ideas.mindmap.arrowDirectionBranch', 'Arrows in branch')}
          </div>
          <div className="flex gap-1 px-2 pb-1.5">
            {ARROW_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const label = t(`myWorkMindmap.arrowDirection.${opt.id}`, opt.labelEn);
              return (
                <button
                  key={opt.id}
                  type="button"
                  title={label}
                  aria-label={label}
                  onClick={() => {
                    onArrowSelect(opt.id);
                    onClose();
                  }}
                  className="flex-1 h-7 flex items-center justify-center rounded-lg text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus transition-colors"
                >
                  <Icon size={13} />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
