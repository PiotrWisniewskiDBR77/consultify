import { describe, expect, it, vi } from 'vitest';

import {
  getRuntimeDiagnosticMode,
  logRuntimeDiagnosticMarker,
} from '@/utils/runtimeDiagnostics';

describe('runtime diagnostics', () => {
  it('accepts only supported diagnostic boot modes', () => {
    expect(getRuntimeDiagnosticMode('?diag=boot')).toBe('boot');
    expect(getRuntimeDiagnosticMode('?diag=min-react')).toBe('min-react');
    expect(getRuntimeDiagnosticMode('?diag=providers-only')).toBe('providers-only');
    expect(getRuntimeDiagnosticMode('?diag=no-auth')).toBe('no-auth');
    expect(getRuntimeDiagnosticMode('?diag=no-router-sync')).toBe('no-router-sync');
    expect(getRuntimeDiagnosticMode('?diag=unknown')).toBeNull();
    expect(getRuntimeDiagnosticMode('?foo=bar')).toBeNull();
  });

  it('emits structured stability markers', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    logRuntimeDiagnosticMarker('boot_screen_only', { path: '/chat' });

    expect(infoSpy).toHaveBeenCalledWith('[stability:diagnostic]', {
      marker: 'boot_screen_only',
      path: '/chat',
    });

    infoSpy.mockRestore();
  });
});

