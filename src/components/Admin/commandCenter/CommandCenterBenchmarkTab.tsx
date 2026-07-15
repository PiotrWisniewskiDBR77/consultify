/**
 * Command Center — "Consulting Bench" (HP-13, Harvey-Parity).
 *
 * Quality-benchmark surface for the Consultify Consulting Bench. The bench
 * (task bank + LLM judge + rubric) is BUILT — runner:
 * `server/scripts/run-consulting-benchmark.ts`, judge:
 * `consultingBenchmarkJudgeService.ts`. There is deliberately NO live API /
 * DB feed for graded scores yet: the bench is a build-time regression tool
 * whose output is a Markdown scorecard, and as of this delivery there are
 * NO graded runs (`benchmark/SCORECARD.md` → "No graded runs yet").
 *
 * ★ Zero fabrication: this card shows an honest "built, run pending" state
 * and the scorecard's own caveats. It does NOT invent a pass-rate or score.
 * When a graded-run endpoint is wired, replace the static state with a fetch.
 */
import { CheckCircle2, ClipboardCheck, Clock } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const CommandCenterBenchmarkTab: React.FC = () => {
  const { t } = useTranslation();

  const caveats = [
    t(
      'commandCenter.benchmark.caveats.noCompetitive',
      'No competitive comparison — this does not measure Consultify against other AI tools or consultants.'
    ),
    t(
      'commandCenter.benchmark.caveats.noHumanBaseline',
      'No human baseline — pass-rate refers only to this benchmark rubric, not to a real consultant.'
    ),
    t(
      'commandCenter.benchmark.caveats.regression',
      'Internal regression tool — it catches quality regressions between product versions, not a marketing claim.'
    ),
    t(
      'commandCenter.benchmark.caveats.llmJudge',
      'The judge is an LLM, not an auditor — verdicts carry the judge model’s own limits and variance.'
    ),
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-c-border bg-c-surface p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-c-surface-raised p-2 text-c-text-secondary">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-c-text">
              {t('commandCenter.benchmark.title', 'Consulting Bench')}
            </h3>
            <p className="mt-1 text-sm text-c-text-secondary">
              {t(
                'commandCenter.benchmark.description',
                'Regression benchmark for consulting-output quality — task bank, rubric, and LLM judge.'
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-c-border bg-c-surface p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-c-text-secondary">
            <CheckCircle2 className="h-3.5 w-3.5 text-c-success" />
            {t('commandCenter.benchmark.status.builtLabel', 'Harness status')}
          </div>
          <p className="mt-2 text-lg font-semibold text-c-text">
            {t('commandCenter.benchmark.status.built', 'Built')}
          </p>
          <p className="mt-1 text-xs text-c-text-secondary">
            {t(
              'commandCenter.benchmark.status.builtDetail',
              'Task bank, rubric, and judge service are in place.'
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-c-border bg-c-surface p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-c-text-secondary">
            <Clock className="h-3.5 w-3.5" />
            {t('commandCenter.benchmark.status.runLabel', 'Latest graded run')}
          </div>
          <p className="mt-2 text-lg font-semibold text-c-text">
            {t('commandCenter.benchmark.status.pending', 'Run pending')}
          </p>
          <p className="mt-1 text-xs text-c-text-secondary">
            {t(
              'commandCenter.benchmark.status.pendingDetail',
              'No graded run recorded yet — no score is shown until a run is produced.'
            )}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-c-border bg-c-surface p-5">
        <h4 className="text-sm font-semibold text-c-text">
          {t('commandCenter.benchmark.caveats.title', 'What this does not claim')}
        </h4>
        <ul className="mt-3 space-y-2">
          {caveats.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-c-text-secondary">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-c-text-muted" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CommandCenterBenchmarkTab;
