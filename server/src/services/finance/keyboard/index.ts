/**
 * AP-03 — Keyboard command layer: barrel export.
 *
 * Report: `docs/validation/finance-v3/generated/gate-d/AP-03_keyboard_command_registry_report.md`.
 * This directory is pure in-memory logic (no DOM, no React) — see that
 * report for the UI/React key-listener integration contract a future
 * keyboard-shortcut hook is expected to implement against these exports.
 */

export * from './commandTypes.js';
export * from './FocusRestoreContract.js';
export * from './KeyboardCommandRegistry.js';
export * from './CommandPaletteIndex.js';
