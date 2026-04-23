import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ArtifactTemplateReuseResponse } from '@/services/api/v10/artifactRuntime';

interface ArtifactTemplateReuseSummaryProps {
  reuse: ArtifactTemplateReuseResponse | null | undefined;
  enabled?: boolean;
  isEvaluating?: boolean;
  onEvaluate?: () => void | Promise<unknown>;
}

export function ArtifactTemplateReuseSummary({
  reuse,
  enabled = true,
  isEvaluating = false,
  onEvaluate,
}: ArtifactTemplateReuseSummaryProps) {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Template Reuse</CardTitle>
            <CardDescription>
              Inspect template fingerprints and suggested library matches for the current artifact.
            </CardDescription>
          </div>
          {reuse ? <Badge variant="outline">{reuse.matches.length} matches</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {onEvaluate ? (
          <Button
            type="button"
            onClick={onEvaluate}
            loading={isEvaluating}
            disabled={!enabled}
            size="sm"
          >
            Evaluate reuse
          </Button>
        ) : null}

        {reuse ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge>{reuse.fingerprint}</Badge>
              <Badge variant="outline">
                {reuse.recommendedTemplateId
                  ? `Recommended: ${reuse.recommendedTemplateId}`
                  : 'No recommended template'}
              </Badge>
            </div>
            {reuse.matches.length > 0 ? (
              <ul className="space-y-2">
                {reuse.matches.map((match) => (
                  <li
                    key={match.templateId}
                    className="rounded-md border border-slate-200 px-3 py-2"
                  >
                    <div className="font-medium text-slate-900">{match.label}</div>
                    <div className="text-slate-600">
                      {match.templateId} · {match.artifactType}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-600">No library templates share this fingerprint yet.</p>
            )}
            {reuse.warnings.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-slate-600">
                {reuse.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-slate-600">No template reuse evaluation has been run yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
