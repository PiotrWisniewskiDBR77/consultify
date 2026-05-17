import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ArtifactApprovalEvaluationResponse } from '@/services/api/v10/artifactRuntime';

import { approvalStatusBadgeVariant, formatReviewerRole } from './state';

interface ArtifactApprovalSummaryProps {
  evaluation: ArtifactApprovalEvaluationResponse | null | undefined;
  title?: string;
  emptyState?: string;
}

export function ArtifactApprovalSummary({
  evaluation,
  title = 'Approval Summary',
  emptyState = 'Run approval evaluation to inspect routing, reviewer, and readiness.',
}: ArtifactApprovalSummaryProps) {
  if (!evaluation) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{emptyState}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>
              Reviewer route and approval readiness for the current artifact runtime input.
            </CardDescription>
          </div>
          <Badge variant={approvalStatusBadgeVariant(evaluation.status)}>{evaluation.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-slate-200 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Required reviewer</div>
            <div className="mt-1 font-medium text-slate-900">
              {formatReviewerRole(evaluation.requiredReviewer)}
            </div>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Matched by</div>
            <div className="mt-1 font-medium text-slate-900">{evaluation.matchedBy}</div>
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Coverage</div>
            <div className="mt-1 font-medium text-slate-900">
              {evaluation.coverageSatisfied ? 'Complete' : 'Needs explicit rules'}
            </div>
          </div>
        </div>

        {evaluation.reasons.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-slate-600">
            {evaluation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-600">No additional approval warnings were returned.</p>
        )}
      </CardContent>
    </Card>
  );
}
