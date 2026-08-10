/**
 * AP-03 — Keyboard command layer: shared types for `KeyboardCommandRegistry`
 * / `CommandPaletteIndex`.
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 10 ("Keyboard: Pelny core workflow bez myszy, command palette,
 * standardowe skroty, focus restore i task benchmark <=90 s"). Task brief:
 * `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
 * section 3 point 3.
 *
 * SCOPE, stated up front because it drives every type below: this package is
 * a DECLARATIVE, testable-without-DOM contract — a map of key-combo -> action
 * -> engine call, plus a command-palette index over the same data, plus the
 * focus-restore contract (`FocusRestoreContract.ts`). It does NOT attach a
 * `keydown` listener, does NOT call `event.preventDefault()`, and does NOT
 * import React or any DOM lib type — that binding is explicitly a SEPARATE,
 * later step (a future `FinanceDataGrid`/keyboard-shortcut React hook), the
 * same split AP-01's ADR draws between its pure grid-coordinate logic and the
 * eventual `FinanceDataGrid` component. See the AP-03 report's "UI/React
 * binding contract" section for exactly what that future hook is expected to
 * call against these exports.
 */

// ---------------------------------------------------------------------------
// KeyCombo — a cross-platform (Mac/Windows/Linux) key-combo description.
// ---------------------------------------------------------------------------

/**
 * A minimal, DOM-shaped event the matcher needs — deliberately NOT
 * `KeyboardEvent` itself (importing the DOM lib type would pull a browser
 * global into a package that must stay usable from plain Node/vitest with no
 * `jsdom` environment). Any real `KeyboardEvent` structurally satisfies this
 * — a future React hook passes the real event straight through.
 */
export interface KeyboardEventLike {
  /** `KeyboardEvent.key` value: `'c'`, `'Enter'`, `'ArrowUp'`, `'Delete'`, `'Backspace'`, `'Escape'`, `'Tab'`, ... */
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export type Platform = 'mac' | 'windows';

/**
 * `key` uses `KeyboardEvent.key` values (case-sensitive: lowercase letters
 * for un-shifted alpha keys — `'c'`, not `'C'` — matching what a real
 * `keydown` event actually reports; named keys use their DOM name verbatim:
 * `'Enter'`, `'Escape'`, `'Tab'`, `'Delete'`, `'Backspace'`, `'ArrowUp'`, ...).
 *
 * `mod` is the ONE modifier this contract abstracts across platforms: `true`
 * means "the platform's primary modifier" — Ctrl on Windows/Linux, Cmd
 * (Meta) on macOS — which is what makes a single `KeyCombo` cross-platform
 * (one declarative combo, `matchesEvent`/`describeCombo` below resolve the
 * platform-specific key at match/render time; the registry never needs two
 * separate entries for the same action). `shift`/`alt` are literal on every
 * platform (no cross-platform ambiguity to abstract).
 *
 * Judgment call, documented per this package's own discipline of naming
 * contract gaps rather than silently resolving them: the task brief's own
 * wording for the finance-specific shortcuts ("Ctrl+Enter compute, Ctrl+D
 * compare, Ctrl+M comment") uses literal "Ctrl", but the SAME sentence that
 * introduces the whole command set requires "key combo (cross-platform
 * Mac/Windows)" for EVERY command, standard and finance-specific alike. This
 * registry resolves that in favor of the general cross-platform requirement
 * (`mod: true` for the finance-specific three as well) rather than the
 * literal "Ctrl" wording, because a hardcoded Ctrl-only combo would silently
 * fail on macOS (real analysts, real machines) for exactly the three
 * highest-value finance actions — the opposite of what "keyboard-first"
 * asks for. Flagged in the AP-03 report, not silently decided.
 */
export interface KeyCombo {
  key: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

function normalizeCombo(combo: KeyCombo): Required<KeyCombo> {
  return { key: combo.key, mod: combo.mod ?? false, shift: combo.shift ?? false, alt: combo.alt ?? false };
}

/** Stable string identity for a combo — used for collision detection and as a `Map` key. Case-folds `key` so `'c'`/`'C'` (a `keydown` for the same physical key with/without an unrelated caps-lock state) collide as intended. */
export function comboIdentity(combo: KeyCombo): string {
  const n = normalizeCombo(combo);
  return `${n.mod ? 'mod+' : ''}${n.shift ? 'shift+' : ''}${n.alt ? 'alt+' : ''}${n.key.toLowerCase()}`;
}

export function combosEqual(a: KeyCombo, b: KeyCombo): boolean {
  return comboIdentity(a) === comboIdentity(b);
}

/**
 * True iff the combo requires a deliberate modifier chord — i.e. it CANNOT be
 * fired by brushing one key.
 *
 * `shift` deliberately does NOT count. Shift is the selection modifier on this
 * very grid (`grid.extendUp/Down/Left/Right`), so a user extending a range
 * with shift+arrows is already holding it down; "Shift+Delete" would fire from
 * exactly the hand position the dangerous case starts from. Windows Explorer
 * makes the same key mean "delete permanently, skip the recycle bin", which is
 * the opposite of a safety guard. Only `mod` (Ctrl/Cmd) and `alt` count.
 */
export function comboHasGuardModifier(combo: KeyCombo): boolean {
  return (combo.mod ?? false) || (combo.alt ?? false);
}

/**
 * True iff `event` satisfies `combo` on `platform`. `mod` resolves to
 * `ctrlKey` on Windows and `metaKey` on macOS; a combo with `mod: true`
 * deliberately does NOT also require the other platform's modifier key to be
 * unset beyond the direct platform check — i.e. on macOS this checks
 * `event.metaKey` and ignores `event.ctrlKey` entirely (Excel/Sheets/every
 * native Mac app extends the same courtesy: Ctrl-anything is a different,
 * unrelated shortcut space on macOS, not a fallback for Cmd).
 */
export function comboMatchesEvent(combo: KeyCombo, event: KeyboardEventLike, platform: Platform): boolean {
  const n = normalizeCombo(combo);
  if (event.key.toLowerCase() !== n.key.toLowerCase()) return false;
  const modPressed = platform === 'mac' ? event.metaKey : event.ctrlKey;
  if (modPressed !== n.mod) return false;
  if (event.shiftKey !== n.shift) return false;
  if (event.altKey !== n.alt) return false;
  return true;
}

const NAMED_KEY_LABELS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Delete: 'Del',
  Backspace: '⌫',
  Enter: '↵',
  Escape: 'Esc',
  Tab: 'Tab',
};

/** Human-readable label for the command palette's shortcut hint column, e.g. `'⌘C'` (mac) / `'Ctrl+C'` (windows). Not localized — same discipline as the rest of this program's UI-adjacent contracts, which leave i18n to the eventual React layer. */
export function describeCombo(combo: KeyCombo, platform: Platform): string {
  const n = normalizeCombo(combo);
  const keyLabel = NAMED_KEY_LABELS[n.key] ?? n.key.toUpperCase();
  if (platform === 'mac') {
    const mod = n.mod ? '⌘' : '';
    const shift = n.shift ? '⇧' : '';
    const alt = n.alt ? '⌥' : '';
    return `${mod}${shift}${alt}${keyLabel}`;
  }
  const parts: string[] = [];
  if (n.mod) parts.push('Ctrl');
  if (n.shift) parts.push('Shift');
  if (n.alt) parts.push('Alt');
  parts.push(keyLabel);
  return parts.join('+');
}

// ---------------------------------------------------------------------------
// Command context — WHEN a command is active. Deliberately small and closed:
// the task brief's own phrasing ("context: grid-focused, cell-editing, itd.")
// anticipates more contexts arriving later (e.g. a future comment-composer
// context), so this stays a maintained union here rather than a free string,
// the same way `FocusRestoreReason` does in `FocusRestoreContract.ts`.
// ---------------------------------------------------------------------------

export const COMMAND_CONTEXTS = ['grid-focused', 'cell-editing', 'global'] as const;
/**
 * `'grid-focused'` — the grid has focus, no cell is in edit mode (the
 * default working state: navigating, selecting, invoking clipboard/history/
 * finance shortcuts).
 * `'cell-editing'` — a cell's inline editor is open and has focus (Enter/
 * Escape only make sense here; arrow-key navigation does NOT fire in this
 * context on a real grid — arrow keys move the text caret inside the editor
 * instead, which is exactly why `'grid.confirmEdit'`/`'grid.cancelEdit'` are
 * the ONLY two commands registered with this context).
 * `'global'` — active regardless of grid-focused/cell-editing (only `Save`
 * today — an explicit checkpoint is meaningful mid-edit too, unlike undo/
 * redo/clipboard which operate on grid selection state that does not exist
 * while a cell editor owns focus).
 */
export type CommandContext = (typeof COMMAND_CONTEXTS)[number];

export const COMMAND_CATEGORIES = ['clipboard', 'history', 'search', 'file', 'navigation', 'editing', 'finance'] as const;
export type CommandCategory = (typeof COMMAND_CATEGORIES)[number];

/** The AP work package that owns the function a command's handler resolves to. `'AP-03'` marks glue this package itself owns (no dedicated AP-01/AP-04/.. export exists for that exact operation — see individual `engineBinding.note`s in `KeyboardCommandRegistry.ts`). */
export const AP_OWNERS = ['AP-00', 'AP-01', 'AP-03', 'AP-04', 'AP-05', 'AP-06'] as const;
export type ApOwner = (typeof AP_OWNERS)[number];

// ---------------------------------------------------------------------------
// CommandEngineBinding — the RESOLVER CONTRACT (task scope item "b"): how a
// command's key combo turns into an actual call against one of the AP-01/
// AP-04/AP-05/AP-06 engines. Three shapes because the underlying engines are
// genuinely heterogeneous (see `KeyboardCommandRegistry.ts` for which
// commands use which):
//   'function'         — call a real exported function/method by name.
//   'inline-contract'   — no dedicated builder function exists; construct a
//                         literal against an AP-00 contract type directly
//                         (documented gap, not an invented convention — see
//                         `grid.confirmEdit`'s binding for the concrete case).
//   'keyboard-owned'    — no engine call at all; the action is local UI state
//                         this package's own resolver owns end to end (see
//                         `grid.cancelEdit`).
// ---------------------------------------------------------------------------

export interface FunctionEngineBinding {
  kind: 'function';
  engine: ApOwner;
  /** Path relative to `server/src/`, e.g. `'services/finance/grid/PasteEngine.ts'` — where the future resolver imports `functionName` from. */
  module: string;
  /** Exported function or (for a class-owned engine like `OperationStack`) instance method name the resolver must call. */
  functionName: string;
  note?: string;
}

export interface InlineContractEngineBinding {
  kind: 'inline-contract';
  engine: 'AP-00';
  module: string;
  /** The AP-00 type this binding constructs a literal of, e.g. `'OpSet'`. */
  contractType: string;
  note: string;
}

export interface KeyboardOwnedEngineBinding {
  kind: 'keyboard-owned';
  note: string;
}

export type CommandEngineBinding = FunctionEngineBinding | InlineContractEngineBinding | KeyboardOwnedEngineBinding;

// ---------------------------------------------------------------------------
// KeyboardCommand — one registry entry.
// ---------------------------------------------------------------------------

import type { FocusRestoreReason } from './FocusRestoreContract.js';

// ---------------------------------------------------------------------------
// Destructiveness — the SAME vocabulary AP-09's `workspaceBarContract.ts`
// already uses for the mouse-driven half of the same product
// (`WorkspaceBarMoreMenuItem.destructive` / `.requiresConfirmation`, and its
// validator's `DESTRUCTIVE_WITHOUT_CONFIRMATION` rule: OWN-FIN-012
// "wymagają potwierdzenia dla operacji destrukcyjnych"). Two models, one
// language — a reviewer reading either file sees the same two words mean the
// same thing.
//
// WHY the keyboard layer needs a THIRD field the bar does not: a bar menu
// item's blast radius is fixed by the item itself, while a keyboard command's
// blast radius is whatever the user happened to have selected. `Delete` on one
// cell and `Delete` on 400 cells extended with shift+arrows are the same
// keystroke; only the selection differs. `confirmAboveTargetCount` is the
// field that lets the contract say "immediate below this many targets, confirm
// above it" instead of forcing a single all-or-nothing answer to a question
// that genuinely depends on scale.
// ---------------------------------------------------------------------------

export interface CommandDestructivenessPolicy {
  /**
   * The command DESTROYS committed content — it removes value/provenance
   * rather than replacing it with something the user just supplied. Same
   * meaning as `WorkspaceBarMoreMenuItem.destructive`.
   *
   * Judgment call, stated so it can be argued with: `grid.paste` is NOT
   * destructive under this definition even though it overwrites cells. Paste
   * substitutes content the user explicitly provided, is a `paste` Operation
   * with a full inverse on the AP-04 stack, and is universally non-confirmed
   * in every spreadsheet this program is modeled on. CLEAR is different: it
   * forces `value_status = MISSING`, i.e. it manufactures absence of data in
   * an artifact whose whole purpose is auditable presence of data.
   */
  destructive: boolean;
  /** Confirm ALWAYS, at any target count. Same meaning as `WorkspaceBarMoreMenuItem.requiresConfirmation`. */
  requiresConfirmation: boolean;
  /**
   * Confirm when the command would touch MORE than this many cells. `null` =
   * no count-based guard. Ignored when `requiresConfirmation` is already
   * `true` (that is the stricter rule).
   */
  confirmAboveTargetCount: number | null;
}

export interface KeyboardCommand extends CommandDestructivenessPolicy {
  /** Stable, dotted id (`'grid.copy'`, `'finance.compute'`) — never reused across a rename; a future UI may persist this id (e.g. in a user's custom-binding override), so it is the identity, not `label`. */
  id: string;
  combo: KeyCombo;
  context: CommandContext;
  category: CommandCategory;
  /** Short, palette-row title. */
  label: string;
  /** Longer, palette-searchable description of what the command does. */
  description: string;
  engineBinding: CommandEngineBinding;
  /**
   * Which `FocusRestoreReason` (`FocusRestoreContract.ts`) this command's
   * outcome should be captured/resolved under, or `null` if the command
   * never needs a focus-restore step (e.g. `Save` does not move focus;
   * plain arrow-key navigation IS the focus move already, not a "restore"
   * after some other disruption).
   */
  focusRestoreReason: FocusRestoreReason | null;
}
