import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ArtifactId, UserId } from '@/models/artifact/Artifact';
import {
  ANNOTATION_KINDS,
  type AnnotationKind,
  type CommentAnchor,
} from '@/models/artifact/CommentsAndAnnotations';
import type { SelectionScope } from '@/models/artifact/SelectionScope';
import type {
  ArtifactCommentPlanRequest,
  ArtifactCommentPlanResponse,
} from '@/services/api/v10/artifactRuntime';

import { ArtifactRuntimePanelShell } from './ArtifactRuntimePanelShell';
import { formatSelectionSummary } from './state';

interface ArtifactCommentPlannerPanelProps {
  artifactId: ArtifactId;
  author: UserId;
  anchor: CommentAnchor;
  selection?: SelectionScope | null;
  enabled?: boolean;
  isPlanning?: boolean;
  lastPlan?: ArtifactCommentPlanResponse | null;
  error?: string | null;
  defaultKind?: AnnotationKind;
  defaultBody?: string;
  defaultMentions?: readonly string[];
  onPlan: (request: ArtifactCommentPlanRequest) => void | Promise<unknown>;
}

export function ArtifactCommentPlannerPanel({
  artifactId,
  author,
  anchor,
  selection,
  enabled = true,
  isPlanning = false,
  lastPlan,
  error,
  defaultKind = 'suggestion',
  defaultBody = '',
  defaultMentions = [],
  onPlan,
}: ArtifactCommentPlannerPanelProps) {
  const [kind, setKind] = useState<AnnotationKind>(defaultKind);
  const [body, setBody] = useState(defaultBody);
  const [mentions, setMentions] = useState(defaultMentions.join(', '));

  const handlePlan = () =>
    onPlan({
      artifactId,
      anchor,
      author,
      body,
      mentions: mentions
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value as UserId),
      kind,
      selection,
    });

  return (
    <ArtifactRuntimePanelShell
      title="Artifact Comment Planner"
      description="Prepare typed comment and annotation plans with mention fan-out metadata."
      badge={enabled ? 'Enabled' : 'Flagged off'}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <Badge variant="outline">{formatSelectionSummary(selection)}</Badge>
        <Badge variant="outline">Anchor: {String(anchor.nodeId)}</Badge>
      </div>

      <div className="space-y-2">
        <Label htmlFor="artifact-comment-kind">Annotation kind</Label>
        <select
          id="artifact-comment-kind"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={kind}
          onChange={(event) => setKind(event.target.value as AnnotationKind)}
        >
          {ANNOTATION_KINDS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="artifact-comment-body">Comment body</Label>
        <Textarea
          id="artifact-comment-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Explain the issue, suggestion, or approval note."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="artifact-comment-mentions">Mentions</Label>
        <Input
          id="artifact-comment-mentions"
          value={mentions}
          onChange={(event) => setMentions(event.target.value)}
          placeholder="user_1, user_2"
        />
      </div>

      <Button
        type="button"
        onClick={handlePlan}
        loading={isPlanning}
        disabled={!enabled || body.trim().length === 0}
        size="sm"
      >
        Plan comment
      </Button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {lastPlan ? (
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <div className="flex flex-wrap gap-2">
            <Badge>{lastPlan.comment.kind}</Badge>
            <Badge variant="outline">{lastPlan.comment.state}</Badge>
            {lastPlan.anchorOutcome ? (
              <Badge variant="outline">{lastPlan.anchorOutcome}</Badge>
            ) : null}
          </div>
          <p>{lastPlan.mentionNotifications.length} mention notification intents created.</p>
          {lastPlan.warnings.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {lastPlan.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </ArtifactRuntimePanelShell>
  );
}
