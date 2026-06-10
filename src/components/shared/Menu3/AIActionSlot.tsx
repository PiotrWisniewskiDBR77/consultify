/**
 * AIActionSlot — canonical Menu-3 right-side AI / action trigger (standard §3.4)
 *
 * Enforces the Menu-3 AI button canon so modules stop hand-rolling AI buttons:
 *   • h-8 rounded-full pill, 11px semibold
 *   • base (neutral) vs cyan/blue-active state for toggles
 *   • optional leading icon (defaults to Sparkles; pass <TeresaMark /> for Teresa)
 *   • disabled + loading support
 *
 * Styling is delegated to the single source of truth
 * `getMenu3AiButtonClass` — this wrapper only standardizes the markup.
 *
 * @example
 * <AIActionSlot label="Ask Teresa" icon={<TeresaMark size={14} />} onClick={open} />
 *
 * @example  // toggle
 * <AIActionSlot label="AI insights" active={showInsights} onClick={toggle} />
 */

import { Loader2, Sparkles } from 'lucide-react';
import React from 'react';

import { getMenu3AiButtonClass } from '../ModuleHub/menu3ActionButtonStyles';

export interface AIActionSlotProps {
  /** Button label */
  label: string;
  /** Click handler */
  onClick?: () => void;
  /** Active/toggled state — switches to the cyan-active styling */
  active?: boolean;
  /** Disable the control */
  disabled?: boolean;
  /** Loading state — shows a spinner and disables interaction */
  loading?: boolean;
  /**
   * Leading icon. Defaults to <Sparkles>. Pass a <TeresaMark> for Teresa
   * surfaces, or `null` to render no icon.
   */
  icon?: React.ReactNode | null;
  /** Accessible label override (defaults to `label`) */
  ariaLabel?: string;
  /** Reflects toggle state to assistive tech when `active` is meaningful */
  ariaPressed?: boolean;
  /** Additional class names */
  className?: string;
  /** Native button type */
  type?: 'button' | 'submit';
  /** Optional test id */
  'data-testid'?: string;
}

const DEFAULT_ICON = <Sparkles size={14} aria-hidden="true" />;

export const AIActionSlot: React.FC<AIActionSlotProps> = ({
  label,
  onClick,
  active = false,
  disabled = false,
  loading = false,
  icon,
  ariaLabel,
  ariaPressed,
  className = '',
  type = 'button',
  'data-testid': dataTestId,
}) => {
  const isDisabled = disabled || loading;
  const resolvedIcon = icon === undefined ? DEFAULT_ICON : icon;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel ?? label}
      aria-pressed={ariaPressed}
      aria-busy={loading || undefined}
      data-testid={dataTestId}
      className={`${getMenu3AiButtonClass(active)} ${className}`.trim()}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
      ) : (
        resolvedIcon !== null && <span className="flex-shrink-0">{resolvedIcon}</span>
      )}
      <span className="truncate">{label}</span>
    </button>
  );
};

AIActionSlot.displayName = 'AIActionSlot';

export default AIActionSlot;
