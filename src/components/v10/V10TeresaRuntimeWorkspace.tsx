import { RadioTower } from 'lucide-react';
import React from 'react';

import { useV10TeresaRuntime } from '../../hooks/v10/useV10TeresaRuntime';

export const V10TeresaRuntimeWorkspace: React.FC = () => {
  const runtime = useV10TeresaRuntime();

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-c-border-subtle dark:bg-navy-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
            <RadioTower size={14} />
            V10 Frontend Runtime
          </div>
          <h2 className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">
            Teresa voice workspace
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Frontend V10 surface backed by `/api/v10/teresa/voice-config`. It exposes the runtime
            state instead of leaving V10 as a server-only slice.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            runtime.status === 'ready'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
              : runtime.status === 'error'
                ? 'bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-200'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200'
          }`}
        >
          {runtime.loading ? 'loading' : runtime.status}
        </span>
      </div>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div className="rounded-xl border bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-950">
          <div className="text-xs text-slate-500">Voice enabled</div>
          <div className="mt-1 font-semibold">
            {runtime.loading ? '…' : runtime.voiceEnabled ? 'yes' : 'no'}
          </div>
          {runtime.voiceName && (
            <div className="mt-0.5 text-xs text-slate-500">voice: {runtime.voiceName}</div>
          )}
        </div>
        <div className="rounded-xl border bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-950">
          <div className="text-xs text-slate-500">Model</div>
          <div className="mt-1 font-semibold">
            {runtime.loading ? '…' : runtime.model || 'not configured'}
          </div>
        </div>
        <div className="rounded-xl border bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-950">
          <div className="text-xs text-slate-500">
            {runtime.status === 'error' ? 'Diagnostics error' : 'Unavailable reason'}
          </div>
          <div className="mt-1 font-semibold">
            {runtime.loading
              ? '…'
              : runtime.status === 'ready'
                ? 'none'
                : runtime.status === 'error'
                  ? `${runtime.reason || 'request failed'}${
                      runtime.httpStatus ? ` (HTTP ${runtime.httpStatus})` : ''
                    }`
                  : runtime.reason || 'none'}
          </div>
        </div>
      </div>
    </section>
  );
};

export default V10TeresaRuntimeWorkspace;
