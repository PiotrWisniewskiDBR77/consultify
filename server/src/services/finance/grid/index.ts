/**
 * AP-01 — Finance Data Grid core logic: barrel export.
 *
 * ADR: `docs/validation/finance-v3/generated/gate-d/AP-01_finance_data_grid_ADR.md`.
 * This directory is pure in-memory logic (no DOM, no React, no DB
 * connection) — see the ADR for the UI integration contract a future
 * `FinanceDataGrid` React component is expected to implement against these
 * exports.
 */

export * from './gridCoordinates.js';
export * from './engineContext.js';
export * from './GridSelectionModel.js';
export * from './PasteEngine.js';
export * from './FillEngine.js';
export * from './BulkOpsEngine.js';
export * from './FindReplaceEngine.js';
export * from './GridViewState.js';
