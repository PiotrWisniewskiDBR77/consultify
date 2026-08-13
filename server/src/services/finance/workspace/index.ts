/**
 * AP-09 / AP-10 / AP-11 — Finance shared workspace layer: barrel export.
 *
 * Report: `docs/validation/finance-v3/generated/gate-d/AP-09_10_11_workspace_contracts_report.md`.
 *
 * Everything in this directory is pure contract/data/logic — there is no
 * React, no .tsx and no DOM anywhere in it, deliberately. The visual shell
 * (Workspace Bar component, focus-mode layout, Related panel UI) is a separate
 * step that requires the owner's acceptance on screenshots first; see the
 * report's "React/UI poza zakresem" section.
 */

export * from './workspaceBarContract.js';
export * from './focusModeContract.js';
export * from './moduleAdapters.js';
export * from './lineageNavigatorContract.js';
