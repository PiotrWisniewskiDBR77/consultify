/**
 * Chat V9 / C-IN4-lite — compact keyboard-affordance strip under
 * `EnhancedChatInput`.
 *
 * What the user sees
 * ------------------
 * A single-line, low-contrast hint strip rendered below the
 * textarea action bar:
 *
 *     Enter ↲ send · Shift+Enter newline · Esc clear
 *
 * The strip is purely passive — it is not keyboard-focusable, not
 * announced to screen readers (it describes keys every screen
 * reader already surfaces), and fires no callbacks. It exists
 * because the default-chat contract changed over Chat V9 (Enter
 * sends by default, Shift+Enter is the newline, Escape clears the
 * draft) and new users kept asking "how do I add a paragraph
 * break?".
 *
 * Contract
 * --------
 * - `isEnabled` is a test seam; production always uses
 *   `isInputHintStripEnabled`.
 * - Returns `null` when the flag is OFF so the parent layout is
 *   pixel-for-pixel identical to pre-C-IN4-lite.
 * - Visually distinct from the input border (no bg, no box) so
 *   it never reads as "another control" — the whole strip is a
 *   single `<span>`-separated readout.
 * - No telemetry: the strip is a passive wayfinding affordance,
 *   identical contract to NAV-M2-lite.
 */

import React from 'react';

import { isInputHintStripEnabled } from '../../utils/inputHintStripFlag';

export interface InputHintStripProps {
  /**
   * Test seam so unit tests can force ON / OFF paths without
   * touching URL / localStorage / env. Production never sets it.
   */
  isEnabled?: () => boolean;
  /**
   * Optional extra class names. Parent components use this to
   * align the strip with the input padding in different layouts
   * (regular chat, voice transcript overlay, etc.). Intentionally
   * appended, not replacing — base typography / colour stays
   * deterministic.
   */
  className?: string;
}

interface HintItem {
  id: string;
  keys: string;
  action: string;
}

/**
 * Closed-list of hints. Order matters (maps to muscle memory):
 * Enter first (primary send key), then the modifier that breaks
 * the default, then the escape hatch. Adding a hint is a
 * deliberate act: every item compounds visual weight on a strip
 * that should stay scannable at a glance.
 */
const HINTS: readonly HintItem[] = [
  { id: 'send', keys: 'Enter', action: 'send' },
  { id: 'newline', keys: 'Shift+Enter', action: 'newline' },
  { id: 'clear', keys: 'Esc', action: 'clear' },
];

export const InputHintStrip: React.FC<InputHintStripProps> = ({
  isEnabled = isInputHintStripEnabled,
  className,
}) => {
  if (!isEnabled()) return null;

  const base =
    'px-2 pt-1.5 pb-0 text-[10px] leading-tight text-slate-400 dark:text-slate-500 select-none';

  return (
    <div
      data-testid="chat-v9-input-hint-strip"
      aria-hidden="true"
      className={className ? `${base} ${className}` : base}
    >
      {HINTS.map((hint, idx) => (
        <React.Fragment key={hint.id}>
          {idx > 0 && (
            <span
              aria-hidden
              className="mx-1.5 text-slate-300 dark:text-slate-600 select-none"
            >
              ·
            </span>
          )}
          <span
            data-testid={`chat-v9-input-hint-${hint.id}`}
            className="whitespace-nowrap"
          >
            <kbd className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
              {hint.keys}
            </kbd>
            <span className="ml-1">{hint.action}</span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

export default InputHintStrip;
