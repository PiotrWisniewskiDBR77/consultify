export type RuntimeDiagnosticMode =
  | 'boot'
  | 'min-react'
  | 'providers-only'
  | 'no-auth'
  | 'no-router-sync';

const RUNTIME_DIAGNOSTIC_MODES = new Set<RuntimeDiagnosticMode>([
  'boot',
  'min-react',
  'providers-only',
  'no-auth',
  'no-router-sync',
]);

export function getRuntimeDiagnosticMode(search?: string): RuntimeDiagnosticMode | null {
  if (typeof window === 'undefined' && typeof search !== 'string') return null;
  const source = typeof search === 'string' ? search : window.location.search;

  try {
    const params = new URLSearchParams(source);
    const requested = params.get('diag');
    return RUNTIME_DIAGNOSTIC_MODES.has(requested as RuntimeDiagnosticMode)
      ? (requested as RuntimeDiagnosticMode)
      : null;
  } catch {
    return null;
  }
}

export function isRuntimeDiagnosticMode(mode: RuntimeDiagnosticMode): boolean {
  return getRuntimeDiagnosticMode() === mode;
}

export function logRuntimeDiagnosticMarker(
  marker: string,
  details: Record<string, unknown> = {}
): void {
  if (typeof console === 'undefined') return;
  console.info('[stability:diagnostic]', { marker, ...details });
}
