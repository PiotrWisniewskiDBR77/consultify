import React from 'react';

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
  /**
   * If false, the right panel collapses to width 0.
   * Typically controlled for mobile UX.
   */
  isRightOpen?: boolean;
  /**
   * Tailwind width class for the right panel when open.
   *
   * ★ 2026-09-01 (dyżur 164): domyślna wartość była `w-[340px]` — SZÓSTA
   * szerokość prawego pasa w aplikacji, przy czym jedyny wołający
   * (`DRDAssessmentEditor`) i tak podawał `w-[320px]`. Domyślna klasa idzie
   * teraz z tokenu `--ntype-right-panel-width`, więc następna zmiana
   * szerokości prawego pasa jest zmianą w jednym pliku (`src/index.css`).
   */
  rightWidthClass?: string;
  /**
   * Which side the navigation/control panel should be on.
   */
  rightSide?: 'left' | 'right';
  className?: string;
};

export const AssessmentToolShell: React.FC<Props> = ({
  left,
  right,
  isRightOpen = true,
  rightWidthClass = 'w-[var(--ntype-right-panel-width)]',
  rightSide = 'right',
  className,
}) => {
  const isRight = rightSide === 'right';
  const borderClass = isRight
    ? 'border-l border-slate-200 dark:border-navy-800'
    : 'border-r border-slate-200 dark:border-navy-800';

  const rightPanel = (
    <div
      className={`${isRightOpen ? rightWidthClass : 'w-0'} shrink-0 ${borderClass} bg-white dark:bg-navy-900 transition-all duration-200 overflow-hidden`}
    >
      {right}
    </div>
  );

  return (
    <div className={`h-full flex bg-slate-50 dark:bg-navy-950 ${className || ''}`}>
      {rightSide === 'left' ? rightPanel : null}
      <div className="flex-1 min-w-0">{left}</div>
      {rightSide === 'right' ? rightPanel : null}
    </div>
  );
};
