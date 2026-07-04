import { LucideIcon } from 'lucide-react';
import React from 'react';

interface SignalNodeProps {
  type: 'system' | 'client' | 'feedback';
  icon: LucideIcon;
  label: string;
  count: number;
  colorClass: string; // e.g., 'bg-danger-500' or 'text-danger-500'
  active: boolean;
  onClick: () => void;
}

export const SignalNode: React.FC<SignalNodeProps> = ({
  type,
  icon: Icon,
  label,
  count,
  colorClass,
  active,
  onClick,
}) => {
  // Determine blinking effect for Critical/Warning states
  const isCritical = colorClass.includes('red');
  const isWarning = colorClass.includes('amber');

  // Aggressive blink for Critical (Red Light)
  const getBlinkClass = () => {
    if (count > 0 && isCritical) return 'animate-ping opacity-100 duration-700';
    if (count > 0 && isWarning) return 'animate-pulse';
    return '';
  };

  return (
    <button
      onClick={onClick}
      className={`
                relative flex items-center justify-center p-2 rounded-xl transition-all duration-300
                group border bg-white dark:bg-navy-950/50
                ${
                  active
                    ? `border-${colorClass.split('-')[1]}-500/30 bg-slate-50 dark:bg-white/5`
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5 hover:border-slate-100 dark:hover:border-c-border-subtle'
                }
            `}
      title={`${count} ${label}`}
    >
      {/* Critical Blinking Ring (Red Light only) */}
      {count > 0 && isCritical && (
        <div className="absolute inset-0 rounded-xl bg-danger-500/20 animate-pulse pointer-events-none" />
      )}

      {/* Active Status Dot (Top-Right) with Ping */}
      {count > 0 && (
        <span
          className={`absolute top-2 right-2 w-2 h-2 rounded-full ${colorClass} ${getBlinkClass()}`}
        />
      )}

      {/* Main Icon */}
      <Icon
        size={22}
        className={`transition-colors duration-300 ${count > 0 ? colorClass : 'text-slate-600 group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-200'}`}
        strokeWidth={isCritical && count > 0 ? 2.5 : 2}
      />

      {/* Numeric Badge (If Count > 0) */}
      {count > 0 && (
        <span
          className={`
                    absolute -top-2 -right-2
                    min-w-[20px] h-5
                    flex items-center justify-center
                    text-[10px] font-bold
                    rounded-full
                    bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700
                    text-slate-900 dark:text-white
                    shadow-sm dark:shadow-lg dark:shadow-black/50
                    z-10
                `}
        >
          <span className={colorClass}>{count > 99 ? '99+' : count}</span>
        </span>
      )}

      {/* Hover Tooltip */}
      <div className="absolute top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 px-3 py-1.5 rounded-lg text-xs text-slate-700 dark:text-slate-200 whitespace-nowrap z-50 shadow-xl">
        <span className="font-semibold mr-1">{count}</span> {label}
      </div>
    </button>
  );
};
