/**
 * PKG_C (Finance v3 UI Platform) — dev-render host for the REAL
 * `<FinanceWorkspaceBar>` (src/components/Finance/shared/FinanceWorkspaceBar.tsx)
 * + a compact mock workspace body demonstrating value semantics.
 *
 * CLAUDE.md rule #7 — Piotr nigdy nie jest pierwszym testerem wizualnym: ten
 * ekran renderuje REALNY komponent (nie reimplementację) za pomocą realnego
 * `WorkspaceBarConfig` z `financeWorkspaceBar.contract.ts`, sam robię zrzut,
 * DOPIERO wtedy Piotr patrzy do akceptu.
 *
 * Nie ma żadnej z pięciu istniejących workspace'ów Finance w tym ekranie —
 * `FinanceWorkspaceBar` jest nowym, jeszcze nie podłączonym komponentem
 * (Pakiet C dostarcza klocki, D–H je wpina). Ten harness jest dowodem, że
 * komponent DZIAŁA i spełnia twarde kryteria, nie dowodem integracji.
 *
 * URL: ?screen=finance-workspace-bar[&lang=pl|en][&theme=light|dark]
 *   &scene=draft|stale|approved|failed|computing|needs-changes|longname|values|empty|error
 *     (default: draft)
 *   &name=<string>   nadpisuje nazwę artefaktu (negatywna kontrola nazwy)
 *   &role=preparer|viewer   nadpisuje rolę oceny uprawnień
 */
import React, { useState } from 'react';

import { FinanceErrorBoundary } from '../../src/components/Finance/shared/FinanceErrorBoundary';
import { FinanceWorkspaceBar } from '../../src/components/Finance/shared/FinanceWorkspaceBar';
import {
  ENABLEMENT_ALWAYS,
  type WorkspaceBarConfig,
  type WorkspaceBarEvaluationContext,
} from '../../src/components/Finance/shared/financeWorkspaceBar.contract';
import {
  financeValueDisplayReasonLabel,
  formatFinanceValueForDisplay,
  type FinanceRole,
  type FinanceValue,
} from '../../src/services/api/financeV2.types';

const params = new URLSearchParams(window.location.search);
const scene = params.get('scene') || 'draft';
const nameOverride = params.get('name');
const roleOverride = (params.get('role') as FinanceRole | null) || undefined;

// ── Konfiguracja bazowa (Models — 4 widoki → separate-row) ─────────────────

type SceneKey =
  | 'draft'
  | 'stale'
  | 'approved'
  | 'failed'
  | 'computing'
  | 'needs-changes'
  | 'longname'
  | 'values'
  | 'empty'
  | 'error';

const SCENE_META: Record<SceneKey, { status: WorkspaceBarConfig['identity']['status']; freshness: WorkspaceBarConfig['identity']['freshness']; name: string }> = {
  draft: { status: 'DRAFT', freshness: 'CURRENT', name: 'DBR77 — Model bazowy FY2026' },
  stale: { status: 'DRAFT', freshness: 'STALE_SOURCE', name: 'DBR77 — Model bazowy FY2026' },
  approved: { status: 'APPROVED', freshness: 'CURRENT', name: 'DBR77 — Model bazowy FY2026 (zatwierdzony)' },
  failed: { status: 'DRAFT', freshness: 'COMPUTE_FAILED', name: 'DBR77 — Model bazowy FY2026' },
  computing: { status: 'IN_REVIEW', freshness: 'NEVER_COMPUTED', name: 'DBR77 — Model bazowy FY2026' },
  'needs-changes': { status: 'NEEDS_CHANGES', freshness: 'STALE_ASSUMPTIONS', name: 'DBR77 — Model bazowy FY2026' },
  longname: {
    status: 'DRAFT',
    freshness: 'CURRENT',
    name: 'Model bazowy prognozy przychodów i kosztów dla segmentu B2B FY2026Q',
  },
  values: { status: 'DRAFT', freshness: 'CURRENT', name: 'DBR77 — Model bazowy FY2026' },
  empty: { status: 'DRAFT', freshness: 'NEVER_COMPUTED', name: 'Nowy model (bez danych)' },
  error: { status: 'DRAFT', freshness: 'CURRENT', name: 'DBR77 — Wycena z błędem renderu' },
};

const meta = SCENE_META[(scene as SceneKey) in SCENE_META ? (scene as SceneKey) : 'draft'];
// Nazwa 60-znakowa do dowodu kryterium 1280px — dokładnie 60 znaków licząc spacje.
const LONGNAME_60 = 'Model bazowy prognozy przychodow i kosztow segmentu B2B FY26';

function buildConfig(): WorkspaceBarConfig {
  const name = nameOverride ?? (scene === 'longname' ? LONGNAME_60 : meta.name);
  return {
    moduleId: 'baselineModel',
    artifactType: 'BASELINE_MODEL',
    identity: {
      artifactRef: { artifactType: 'BASELINE_MODEL', businessVersionId: 'bv-dbr77-1', artifactId: 'art-dbr77-model' },
      back: { targetListRoute: '/finance', label: { key: 'back', pl: 'Wróć do listy' } },
      name: {
        value: name,
        editable: meta.status !== 'APPROVED',
        editableBlockedReason: meta.status === 'APPROVED' ? 'STATUS_IMMUTABLE' : null,
        maxChars: 120,
        layoutBudgetChars: 60,
      },
      version: {
        label: meta.status === 'APPROVED' ? 'v2' : 'v3',
        businessVersionId: 'bv-dbr77-1',
        hasUncommittedWorkingRevision: scene === 'draft' || scene === 'longname',
      },
      status: meta.status,
      freshness: meta.freshness,
      contextFields: ['type', 'period', 'entity', 'currencyScale', 'source', 'lastCompute'],
    },
    viewNavigation: {
      kind: 'tabs',
      views: [
        { id: 'assumptions', label: { key: 'assumptions', pl: 'Założenia' }, state: { kind: 'ready', label: { key: 'ready', pl: 'Gotowe' } } },
        { id: 'events', label: { key: 'events', pl: 'Zdarzenia' }, state: null },
        {
          id: 'outputs',
          label: { key: 'outputs', pl: 'Wyliczenia' },
          state:
            scene === 'failed'
              ? { kind: 'blocked', label: { key: 'blocked', pl: 'Błąd' } }
              : scene === 'stale' || scene === 'needs-changes'
                ? { kind: 'stale', label: { key: 'stale', pl: 'Nieaktualne' } }
                : { kind: 'ready', label: { key: 'ready', pl: 'Gotowe' } },
        },
        { id: 'validation', label: { key: 'validation', pl: 'Walidacja' }, state: null },
      ],
      activeViewId: 'assumptions',
      placement: 'separate-row',
    },
    actions: {
      primary: {
        kind: 'primary',
        id: 'primary.recalculate',
        label: { key: 'recalc', pl: 'Przelicz' },
        enablement: ENABLEMENT_ALWAYS,
        mergesFreshness: true,
        keyboardCommandId: null,
      },
      secondary: {
        kind: 'secondary',
        id: 'secondary.export',
        label: { key: 'export', pl: 'Eksportuj' },
        enablement: ENABLEMENT_ALWAYS,
        keyboardCommandId: null,
      },
      lifecycle: {
        kind: 'lifecycle',
        id: 'lifecycle.status',
        label: {
          key: 'status',
          pl:
            meta.status === 'DRAFT'
              ? 'Wersja robocza'
              : meta.status === 'IN_REVIEW'
                ? 'W przeglądzie'
                : meta.status === 'APPROVED'
                  ? 'Zatwierdzone'
                  : 'Wymaga zmian',
        },
        enablement: ENABLEMENT_ALWAYS,
        transitions:
          meta.status === 'APPROVED'
            ? [
                {
                  action: 'new_version',
                  label: { key: 'new-version', pl: 'Utwórz nową wersję' },
                  enablement: ENABLEMENT_ALWAYS,
                  destructive: false,
                  requiresConfirmation: false,
                  requiresReason: false,
                },
                {
                  action: 'reopen',
                  label: { key: 'reopen', pl: 'Otwórz ponownie' },
                  enablement: ENABLEMENT_ALWAYS,
                  destructive: true,
                  requiresConfirmation: true,
                  requiresReason: true,
                },
              ]
            : [
                {
                  action: 'save_draft',
                  label: { key: 'save', pl: 'Zapisz wersję roboczą' },
                  enablement: ENABLEMENT_ALWAYS,
                  destructive: false,
                  requiresConfirmation: false,
                  requiresReason: false,
                },
                {
                  action: 'submit_for_review',
                  label: { key: 'submit', pl: 'Przekaż do przeglądu' },
                  enablement: ENABLEMENT_ALWAYS,
                  destructive: false,
                  requiresConfirmation: false,
                  requiresReason: false,
                },
                {
                  action: 'invalidate',
                  label: { key: 'invalidate', pl: 'Unieważnij' },
                  enablement: ENABLEMENT_ALWAYS,
                  destructive: true,
                  requiresConfirmation: true,
                  requiresReason: true,
                },
              ],
      },
      more: {
        kind: 'more',
        id: 'more.menu',
        label: { key: 'more', pl: 'Więcej' },
        enablement: ENABLEMENT_ALWAYS,
        items: [
          { id: 'more.duplicate', label: { key: 'duplicate', pl: 'Duplikuj' }, group: 'document', enablement: ENABLEMENT_ALWAYS, destructive: false, requiresConfirmation: false },
          { id: 'more.history', label: { key: 'history', pl: 'Historia wersji' }, group: 'navigation', enablement: ENABLEMENT_ALWAYS, destructive: false, requiresConfirmation: false },
          { id: 'more.archive', label: { key: 'archive', pl: 'Archiwizuj' }, group: 'danger', enablement: ENABLEMENT_ALWAYS, destructive: true, requiresConfirmation: true },
        ],
      },
      fullscreen: {
        kind: 'fullscreen',
        id: 'fullscreen.toggle',
        label: { key: 'fullscreen', pl: 'Pełny ekran' },
        enablement: ENABLEMENT_ALWAYS,
        iconOnly: true,
        ariaLabel: { key: 'fullscreen.aria', pl: 'Tryb pełnego obszaru roboczego' },
      },
      extraDirectControls: [],
    },
  };
}

const evaluationContext: WorkspaceBarEvaluationContext = {
  status: meta.status,
  role: roleOverride ?? 'preparer',
  freshness: meta.freshness,
  gates: {},
};

const contextValues = {
  type: 'Model bazowy (Baseline)',
  period: 'FY2026, kwartalnie',
  entity: 'DBR77 sp. z o.o.',
  currencyScale: 'PLN, tysiące',
  source: 'Pakiet sprawozdań FY2025 (zatwierdzony)',
  lastCompute: scene === 'empty' ? undefined : '2026-08-10 14:32',
};

// ── Panel wartości: dowód "brak danych != 0" + wartości ujemne ─────────────

function valueOf(status: FinanceValue['status'], valueDecimal: string | null): FinanceValue {
  return {
    status,
    valueDecimal,
    nativeCurrency: 'PLN',
    presentationCurrency: 'PLN',
    unit: 'THOUSANDS',
    multiplier: '1',
    sourceRef: null,
    isAdjustment: false,
    adjustmentReason: null,
  };
}

const VALUE_ROWS: Array<{ label: string; value: FinanceValue }> = [
  { label: 'Przychody Q1', value: valueOf('PRESENT_NONZERO', '12450.75') },
  { label: 'Wynik operacyjny Q2 (strata)', value: valueOf('PRESENT_NONZERO', '-3820.10') },
  { label: 'Amortyzacja Q1 (realne zero)', value: valueOf('PRESENT_ZERO', '0') },
  { label: 'Przychody Q3 (brak danych źródłowych)', value: valueOf('MISSING', null) },
  { label: 'Dni zapasów — spółka usługowa', value: valueOf('NOT_APPLICABLE', null) },
  { label: 'Korekta jednorazowa Q4 (NA — analityk potwierdził)', value: valueOf('NA', null) },
];

function ValuesDemoPanel(): React.ReactElement {
  return (
    <div className="p-6">
      <h2 className="text-sm font-semibold text-c-text mb-1">
        Dowód: brak danych nigdy nie renderuje się jako 0
      </h2>
      <p className="text-xs text-c-text-muted mb-4">
        `formatFinanceValueForDisplay` — PRESENT_ZERO renderuje „0”; MISSING/NA/NOT_APPLICABLE renderują „—”
        (wizualnie odróżnialne), z powodem w etykiecie obok.
      </p>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs text-c-text-muted border-b border-c-border-subtle">
            <th className="py-2 pr-4">Linia</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4 text-right">Wartość</th>
            <th className="py-2">Powód (jeśli brak)</th>
          </tr>
        </thead>
        <tbody>
          {VALUE_ROWS.map((row) => {
            const display = formatFinanceValueForDisplay(row.value);
            const reason = financeValueDisplayReasonLabel(row.value.status);
            return (
              <tr key={row.label} className="border-b border-c-border-subtle/50">
                <td className="py-2 pr-4 text-c-text">{row.label}</td>
                <td className="py-2 pr-4 text-c-text-muted font-mono text-xs">{row.value.status}</td>
                <td
                  className={`py-2 pr-4 text-right tabular-nums font-medium ${
                    display.isMissingLikeGlyph ? 'text-c-text-muted' : 'text-c-text'
                  }`}
                  data-testid={`value-${row.value.status}`}
                >
                  {display.text}
                </td>
                <td className="py-2 text-xs text-c-text-muted">{reason ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyStatePanel(): React.ReactElement {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-sm font-semibold text-c-text">Ten model nie ma jeszcze żadnych założeń</p>
      <p className="text-xs text-c-text-muted max-w-sm">
        Dodaj pierwsze założenie, aby rozpocząć budowę modelu bazowego. Pusty stan — uczciwy, bez zmyślonych liczb.
      </p>
    </div>
  );
}

function BoomPanel(): React.ReactElement {
  throw new Error('Symulowany błąd renderu — zakładka Wyliczenia (dev-render)');
}

function ErrorBoundaryScene(): React.ReactElement {
  const [attempt, setAttempt] = useState(0);
  return (
    <div className="p-6">
      <div className="mb-4 rounded-lg border border-c-border-subtle bg-c-surface-raised p-3 text-xs text-c-text-muted">
        Reszta powłoki (Menu 1 — symulowane niżej, FinanceWorkspaceBar powyżej) żyje mimo błędu w jednym dokumencie.
      </div>
      <FinanceErrorBoundary
        key={attempt}
        documentLabel="Wyliczenia — DBR77 Model bazowy FY2026"
        onRetry={() => setAttempt((n) => n + 1)}
        onBackToList={() => {
          /* dev-render: brak realnej listy do powrotu */
        }}
      >
        <BoomPanel />
      </FinanceErrorBoundary>
    </div>
  );
}

function SimulatedMenu1(): React.ReactElement {
  return (
    <div className="flex h-10 items-center gap-4 border-b border-c-border-subtle bg-c-surface px-4 text-xs text-c-text-secondary">
      <span className="font-semibold text-c-text">Consultify</span>
      <span>Finance</span>
      <span className="text-c-text-muted">(symulowane Menu 1 — nie część tego pakietu)</span>
    </div>
  );
}

export default function FinanceWorkspaceBarScreen(): React.ReactElement {
  const config = buildConfig();
  return (
    <div className="min-h-screen bg-c-bg" data-testid="finance-workspace-bar-screen" data-scene={scene}>
      <SimulatedMenu1 />
      <FinanceWorkspaceBar
        config={config}
        evaluationContext={evaluationContext}
        contextValues={contextValues}
        onNavigateBack={() => {}}
        onSelectView={() => {}}
        onPrimaryAction={() => {}}
        onSecondaryAction={() => {}}
        onLifecycleTransition={() => {}}
        onMoreItem={() => {}}
        onEnterFocusMode={() => {}}
        onCommitRename={async () => ({ ok: true })}
      />
      {scene === 'values' && <ValuesDemoPanel />}
      {scene === 'empty' && <EmptyStatePanel />}
      {scene === 'error' && <ErrorBoundaryScene />}
      {!['values', 'empty', 'error'].includes(scene) && (
        <div className="p-6 text-sm text-c-text-muted">
          Treść workspace'u (poza zakresem tego pakietu — placeholder). Scena: <span className="font-mono">{scene}</span>
        </div>
      )}
    </div>
  );
}
