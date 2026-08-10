/**
 * useFinancialCase — driver/case state + the stale/recompute state machine
 * required by doc 09 §7.3 ("changes to drivers IMMEDIATELY mark calculations
 * stale until recomputed") and doc 11 E09 DoD ("invalid/stale state blocks
 * misleading approval").
 *
 * State machine (FinancialCaseStatus):
 *   empty ──(add 1st driver)──▶ stale
 *   stale ──(recompute, computeFn present)──▶ computing ──▶ fresh | error
 *   stale ──(recompute, no computeFn)──▶ blocked
 *   fresh ──(any driver/case-meta edit)──▶ stale   (immediate, synchronous)
 *   error/blocked ──(any edit)──▶ stale
 *
 * `isStaleOrWorse` is the single boolean the UI/DoD cares about for "does this
 * case's numbers currently mean what they say" — every non-`fresh` status is
 * true, deliberately erring toward "don't trust this number" rather than the
 * reverse.
 */
import { useCallback, useMemo, useRef, useState } from 'react';

import { useUndoRedo } from '../useUndoRedo';
import { createEmptyCase } from './financialDefaults';
import type {
  FinancialCaseInput,
  FinancialCaseResult,
  FinancialCaseStatus,
  FinancialComputeFn,
  FinancialDriver,
} from './financialTypes';

export interface UseFinancialCaseOptions {
  initialCase?: FinancialCaseInput;
  /** Injected by the caller — see FinancialComputeFn doc comment for the
   * seam contract with the sibling calculation-engine workstream. Absent
   * means "not wired yet"; recompute() then honestly reports `blocked`. */
  computeFn?: FinancialComputeFn;
  onCaseChange?: (next: FinancialCaseInput) => void;
}

export function useFinancialCase(options: UseFinancialCaseOptions = {}) {
  const { computeFn, onCaseChange } = options;

  const [caseMeta, setCaseMetaState] = useState<Omit<FinancialCaseInput, 'drivers'>>(() => {
    const base = options.initialCase ?? createEmptyCase();
    const { drivers: _drivers, ...rest } = base;
    return rest;
  });

  const driversUndo = useUndoRedo<FinancialDriver[]>(options.initialCase?.drivers ?? []);
  const drivers = driversUndo.state;

  const [status, setStatus] = useState<FinancialCaseStatus>(drivers.length > 0 ? 'stale' : 'empty');
  const [result, setResult] = useState<FinancialCaseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastComputedAt, setLastComputedAt] = useState<string | null>(null);
  const computeSeq = useRef(0);

  const buildInput = useCallback(
    (nextDrivers: FinancialDriver[]): FinancialCaseInput => ({
      ...caseMeta,
      drivers: nextDrivers,
    }),
    [caseMeta]
  );

  const markDirty = useCallback(
    (nextDrivers: FinancialDriver[]) => {
      setStatus(nextDrivers.length > 0 ? 'stale' : 'empty');
      setErrorMessage(null);
      onCaseChange?.(buildInput(nextDrivers));
    },
    [buildInput, onCaseChange]
  );

  const setDrivers = useCallback(
    (next: FinancialDriver[]) => {
      driversUndo.push(next);
      markDirty(next);
    },
    [driversUndo, markDirty]
  );

  const addDriver = useCallback(
    (driver: FinancialDriver) => {
      setDrivers([...drivers, driver]);
    },
    [drivers, setDrivers]
  );

  const updateDriver = useCallback(
    (id: string, patch: Partial<FinancialDriver>) => {
      const next = drivers.map((d) =>
        d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d
      );
      setDrivers(next);
    },
    [drivers, setDrivers]
  );

  const removeDriver = useCallback(
    (id: string) => {
      setDrivers(drivers.filter((d) => d.id !== id));
    },
    [drivers, setDrivers]
  );

  const setCaseMeta = useCallback((patch: Partial<Omit<FinancialCaseInput, 'drivers'>>) => {
    setCaseMetaState((prev) => {
      const next = { ...prev, ...patch };
      return next;
    });
    setStatus((s) => (s === 'fresh' || s === 'error' || s === 'blocked' ? 'stale' : s));
    setErrorMessage(null);
  }, []);

  const recompute = useCallback(async () => {
    if (drivers.length === 0) {
      setStatus('empty');
      return;
    }
    if (!computeFn) {
      setStatus('blocked');
      setErrorMessage(null);
      return;
    }
    const mySeq = ++computeSeq.current;
    setStatus('computing');
    setErrorMessage(null);
    try {
      const input = buildInput(drivers);
      const out = await Promise.resolve(computeFn(input));
      // A stale click during computation must not clobber a fresher one.
      if (mySeq !== computeSeq.current) return;
      setResult(out);
      setStatus('fresh');
      setLastComputedAt(out.computedAt ?? new Date().toISOString());
    } catch (err) {
      if (mySeq !== computeSeq.current) return;
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, [computeFn, drivers, buildInput]);

  const isStaleOrWorse = status !== 'fresh';

  const driverCounts = useMemo(() => {
    let cost = 0;
    let benefit = 0;
    for (const d of drivers) {
      if (d.kind === 'cost') cost += 1;
      else benefit += 1;
    }
    return { cost, benefit };
  }, [drivers]);

  return {
    caseMeta,
    setCaseMeta,
    drivers,
    addDriver,
    updateDriver,
    removeDriver,
    canUndo: driversUndo.canUndo,
    canRedo: driversUndo.canRedo,
    undo: () => {
      driversUndo.undo();
      markDirty(driversUndo.state);
    },
    redo: () => {
      driversUndo.redo();
      markDirty(driversUndo.state);
    },
    status,
    isStaleOrWorse,
    result,
    errorMessage,
    lastComputedAt,
    recompute,
    driverCounts,
    input: buildInput(drivers),
    engineWired: Boolean(computeFn),
  };
}

export type UseFinancialCaseReturn = ReturnType<typeof useFinancialCase>;
