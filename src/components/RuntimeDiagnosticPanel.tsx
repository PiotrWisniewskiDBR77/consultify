type RuntimeDiagnosticPanelProps = {
  mode: string;
  title: string;
  description: string;
};

export function RuntimeDiagnosticPanel({ mode, title, description }: RuntimeDiagnosticPanelProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 font-sans text-slate-100">
      <main className="max-w-2xl rounded-3xl border border-slate-700/70 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/40">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-sky-400">
          Consultify Runtime Diagnostic
        </p>
        <h1 className="mb-3 text-2xl font-semibold leading-tight">{title}</h1>
        <p className="mb-4 leading-7 text-slate-600">{description}</p>
        <code className="block rounded-xl bg-slate-950 px-4 py-3 text-sm text-sky-200">
          ?diag={mode}
        </code>
      </main>
    </div>
  );
}
