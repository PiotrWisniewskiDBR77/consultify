import { CheckCircle2, Loader2, ShieldX, XCircle } from 'lucide-react';
import React from 'react';

export type ToolStep = {
  toolName: string;
  status: 'running' | 'completed' | 'failed' | 'blocked';
  costUsd?: number;
};

export function ToolStepList({ steps }: { steps: ToolStep[] }): React.ReactElement {
  return (
    <div className="not-prose mb-3 rounded-lg border border-c-border bg-c-surface p-3 text-c-text">
      <div className="mb-2 text-xs font-semibold">Kroki narzędzi</div>
      <ol className="space-y-2" aria-label="Kroki narzędzi Teresy">
        {steps.map((step, index) => {
          const Icon =
            step.status === 'running'
              ? Loader2
              : step.status === 'completed'
                ? CheckCircle2
                : step.status === 'blocked'
                  ? ShieldX
                  : XCircle;
          return (
            <li key={`${step.toolName}-${index}`} className="flex items-center gap-2 text-xs">
              <Icon
                className={
                  step.status === 'running'
                    ? 'h-4 w-4 animate-spin text-c-info'
                    : 'h-4 w-4 text-c-muted'
                }
              />
              <span className="font-medium">{step.toolName}</span>
              <span className="text-c-muted">{step.status}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
