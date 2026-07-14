/**
 * FAZA C modelu ról PM — deklaratywna bramka capability wokół przycisków akcji.
 *
 *   <CapabilityGate capability="initiative.start" projectId={projectId}>
 *     <button …>Start Execution</button>
 *   </CapabilityGate>
 *
 * Behavior by backend rollout mode (from useEffectiveAccess, fail-open):
 *   • mode='shadow' (today's default) → children render UNCHANGED (no wrapper
 *     element, zero DOM/layout difference). This is the hard contract until
 *     shadow telemetry proves nobody loses real access.
 *   • mode='enforce' + capability missing → `gateMode="hide"` removes the
 *     children, `gateMode="disable"` renders them inert (disabled + dimmed).
 *
 * Diagnostic mode: append `?debugCapabilities=1` to the URL (or pass
 * `debugOverride`) to draw a small outline + badge on every gated element
 * showing the capability name and the WOULD-ALLOW verdict — lets the owner
 * SEE future enforce behavior without flipping anything on the backend.
 */
import React, { isValidElement } from 'react';

import { useEffectiveAccess } from '@/hooks/useEffectiveAccess';

export interface CapabilityGateProps {
  /** Capability key (or any-of list), e.g. "initiative.start". */
  capability: string | string[];
  /** Project scope for role resolution; omit for org-level capabilities. */
  projectId?: string | null;
  /** What to do in enforce mode when capability is missing. Default: hide. */
  gateMode?: 'hide' | 'disable';
  /** Force the diagnostic overlay regardless of URL (dev-render/story only). */
  debugOverride?: boolean;
  children: React.ReactNode;
}

function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('debugCapabilities') === '1';
  } catch {
    return false;
  }
}

function renderDisabled(children: React.ReactNode): React.ReactNode {
  if (isValidElement(children)) {
    const props = children.props as { className?: string };
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      disabled: true,
      'aria-disabled': true,
      tabIndex: -1,
      onClick: undefined,
      className: `${props.className ?? ''} opacity-50 pointer-events-none`.trim(),
    });
  }
  return (
    <span aria-disabled className="opacity-50 pointer-events-none inline-flex">
      {children}
    </span>
  );
}

export function CapabilityGate({
  capability,
  projectId,
  gateMode = 'hide',
  debugOverride,
  children,
}: CapabilityGateProps): React.ReactElement | null {
  const { can, wouldAllow, mode } = useEffectiveAccess(projectId);
  const capabilities = Array.isArray(capability) ? capability : [capability];

  const allowed = capabilities.some((item) => can(item));
  const verdict = capabilities.some((item) => wouldAllow(item));
  const debug = debugOverride ?? isDebugEnabled();

  // Enforce mode with a real deny — the only case that alters today's UI.
  if (!allowed && !debug) {
    return gateMode === 'disable' ? <>{renderDisabled(children)}</> : null;
  }

  if (debug) {
    const label = capabilities.join(' | ');
    const body = allowed ? children : gateMode === 'disable' ? renderDisabled(children) : null;
    return (
      <span
        className={`relative inline-flex rounded-md outline-dashed outline-1 outline-offset-2 ${
          verdict ? 'outline-[color:var(--c-success)]' : 'outline-[color:var(--c-warning)]'
        }`}
        data-capability={label}
        data-would-allow={verdict}
      >
        {body ?? <span className="px-2 py-1 text-[10px] italic opacity-60">({label}: hidden)</span>}
        <span
          className={`absolute -top-2 -right-1 z-10 px-1 rounded text-[9px] font-mono leading-4 text-white ${
            verdict ? 'bg-[color:var(--c-success)]' : 'bg-[color:var(--c-warning)]'
          }`}
        >
          {label} · {verdict ? 'ALLOW' : `DENY(${mode})`}
        </span>
      </span>
    );
  }

  // Shadow / allowed → children untouched (no wrapper, zero DOM change).
  return <>{children}</>;
}

export default CapabilityGate;
