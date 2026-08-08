export interface ValuationMonetaryUnit {
  sourceScaling?: string;
  multiplier?: number;
  storageUnit?: string;
  displayUnit?: string;
}

export function valuationDisplayMultiplier(results: unknown): number {
  const raw = Number((results as any)?.monetaryUnit?.multiplier ?? 1);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

export function valuationDisplayValue(value: unknown, multiplier: number): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric * multiplier : null;
}
