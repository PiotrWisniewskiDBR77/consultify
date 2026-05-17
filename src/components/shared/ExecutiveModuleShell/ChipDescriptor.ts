/**
 * ChipDescriptor — TopBar chip contract for `ExecutiveModuleShell`
 * (MELS § 2 Zone A · EPIC-T16 D1).
 *
 * Each module supplies an array of these descriptors; the shell renders
 * them in the documented MELS order (Internal → Theme → History → QA →
 * Governance → Analytics → Audit → Share → Agent → Run). Modules are
 * free to omit descriptors they don't surface.
 *
 * Constraints (MELS § 2 Zone A):
 *   * No per-module styling drift — variant + tone are centrally
 *     interpreted by `<TopBar>`.
 *   * `dotTone` lights up an accent dot (semantic only — DBR77
 *     monochrome on the rest of the chip).
 *   * `kind === 'primary'` is the run/prezentuj/export button; only one
 *     primary chip per module.
 */

import type { LucideIcon } from 'lucide-react';

export type TopBarChipKind = 'standard' | 'toggle' | 'primary';

export type TopBarChipDotTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | null;

export interface TopBarChipDescriptor {
  /** Stable id used for the keyboard-shortcut registry + analytics. */
  id: string;
  /** i18n-resolved display label. The shell does NOT translate chip labels. */
  label: string;
  /** Lucide icon component. Optional — text-only chips render fine. */
  icon?: LucideIcon;
  /** What kind of chip — drives default styling. */
  kind?: TopBarChipKind;
  /** True when the chip is currently active (toggle / Agent on, etc.). */
  active?: boolean;
  /** Disabled chips are still visible but non-interactive. */
  disabled?: boolean;
  /** Optional accent dot — semantic state. Use sparingly per MELS § 2.A. */
  dotTone?: TopBarChipDotTone;
  /** Optional callback. Disabled when `disabled === true`. */
  onClick?: () => void;
  /** Optional native `title` for hover tooltips. */
  tooltip?: string;
  /** Optional explicit `data-testid` override. */
  testId?: string;
}

/**
 * The canonical MELS chip order. Modules may use this constant when
 * stable-sorting their descriptor list, or pass `respectMelsOrder=true`
 * to `<TopBar>` to opt into shell-side sorting.
 */
export const MELS_CHIP_ORDER = [
  'internal',
  'theme',
  'history',
  'qa',
  'governance',
  'analytics',
  'audit',
  'share',
  'agent',
  'run',
] as const;

export type MelsChipId = (typeof MELS_CHIP_ORDER)[number];

export function sortChipsByMelsOrder(chips: TopBarChipDescriptor[]): TopBarChipDescriptor[] {
  const orderIndex = new Map<string, number>();
  MELS_CHIP_ORDER.forEach((id, idx) => orderIndex.set(id, idx));
  return [...chips].sort((a, b) => {
    const ai = orderIndex.has(a.id) ? (orderIndex.get(a.id) as number) : 999;
    const bi = orderIndex.has(b.id) ? (orderIndex.get(b.id) as number) : 999;
    return ai - bi;
  });
}
