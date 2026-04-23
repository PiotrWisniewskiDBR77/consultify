import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type { Artifact } from '@/models/artifact/Artifact';
import type { MutationProposal } from '@/models/artifact/MutationProposal';
import type { SelectionScope } from '@/models/artifact/SelectionScope';
import type {
  ArtifactMutationApplyRequest,
  ArtifactMutationApplyResponse,
  ArtifactMutationPlanRequest,
  ArtifactMutationPlanResponse,
} from '@/services/api/v10/artifactRuntime';

import { ArtifactRuntimePanelShell } from './ArtifactRuntimePanelShell';
import { buildDefaultSelectedOpIndices, formatSelectionSummary } from './state';

interface ArtifactMutationPlannerPanelProps {
  artifact: Artifact;
  proposal: MutationProposal;
  actorId: string;
  selection?: SelectionScope | null;
  defaultSelectedOpIndices?: readonly number[];
  enabled?: boolean;
  isPlanning?: boolean;
  isApplying?: boolean;
  lastPlan?: ArtifactMutationPlanResponse | null;
  lastApply?: ArtifactMutationApplyResponse | null;
  planError?: string | null;
  applyError?: string | null;
  onPlan: (request: ArtifactMutationPlanRequest) => void | Promise<unknown>;
  onApply?: (request: ArtifactMutationApplyRequest) => void | Promise<unknown>;
}

export function ArtifactMutationPlannerPanel({
  artifact,
  proposal,
  actorId,
  selection,
  defaultSelectedOpIndices,
  enabled = true,
  isPlanning = false,
  isApplying = false,
  lastPlan,
  lastApply,
  planError,
  applyError,
  onPlan,
  onApply,
}: ArtifactMutationPlannerPanelProps) {
  const initialSelection = useMemo(
    () =>
      defaultSelectedOpIndices
        ? [...defaultSelectedOpIndices]
        : buildDefaultSelectedOpIndices(proposal),
    [defaultSelectedOpIndices, proposal]
  );

  const [selectedOpIndices, setSelectedOpIndices] = useState<number[]>(initialSelection);
  const [reviewerNote, setReviewerNote] = useState('');

  useEffect(() => {
    setSelectedOpIndices(initialSelection);
  }, [initialSelection]);

  const allSelected = proposal.ops.length > 0 && selectedOpIndices.length === proposal.ops.length;

  const selectionSummary = formatSelectionSummary(selection);

  const toggleIndex = (index: number) => {
    setSelectedOpIndices((current) =>
      current.includes(index)
        ? current.filter((value) => value !== index)
        : [...current, index].sort((a, b) => a - b)
    );
  };

  const handlePlan = () =>
    onPlan({
      artifact,
      proposal,
      actorId,
      selectedOpIndices,
      reviewEvent: 'submit_for_review',
      selectionContext: selection ? { artifactId: artifact.id, selection } : undefined,
    });

  const handleApprove = () =>
    onApply?.({
      artifactId: artifact.id,
      proposalId: String(proposal.id),
      intent: 'approve',
      note: reviewerNote || undefined,
      selectedOpIndices,
      actorId,
    });

  const handleReject = () =>
    onApply?.({
      artifactId: artifact.id,
      proposalId: String(proposal.id),
      intent: 'reject',
      rejectionReason: 'wrong_scope',
      note: reviewerNote || undefined,
      selectedOpIndices,
      actorId,
    });

  return (
    <ArtifactRuntimePanelShell
      title="Artifact Mutation Planner"
      description="Selection-aware mutation planning with partial acceptance and apply handoff."
      badge={enabled ? 'Enabled' : 'Flagged off'}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <Badge variant="outline">{selectionSummary}</Badge>
        <Badge variant="outline">{proposal.ops.length} proposed ops</Badge>
        <Badge variant="outline">{selectedOpIndices.length} selected</Badge>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Accepted operations</Label>
          <button
            type="button"
            className="text-xs text-slate-500 underline-offset-2 hover:underline"
            onClick={() =>
              setSelectedOpIndices(allSelected ? [] : buildDefaultSelectedOpIndices(proposal))
            }
          >
            {allSelected ? 'Clear selection' : 'Select all'}
          </button>
        </div>

        <div className="space-y-2 rounded-md border border-slate-200 p-3">
          {proposal.ops.map((op, index) => (
            <label
              key={`${proposal.id}-${index}`}
              className="flex items-start gap-3 rounded-md border border-transparent p-2 hover:border-slate-200 hover:bg-slate-50"
            >
              <Checkbox
                checked={selectedOpIndices.includes(index)}
                onCheckedChange={() => toggleIndex(index)}
              />
              <div className="space-y-1 text-sm">
                <div className="font-medium text-slate-900">
                  #{index + 1} {op.kind}
                </div>
                <div className="text-xs text-slate-500">
                  {'targetNodeId' in op && op.targetNodeId
                    ? `Target: ${op.targetNodeId}`
                    : 'Target resolved by runtime'}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="artifact-mutation-reviewer-note">Reviewer note</Label>
        <Textarea
          id="artifact-mutation-reviewer-note"
          value={reviewerNote}
          onChange={(event) => setReviewerNote(event.target.value)}
          placeholder="Optional note for apply/reject flows."
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={handlePlan}
          loading={isPlanning}
          disabled={!enabled || selectedOpIndices.length === 0}
          size="sm"
        >
          Plan mutation
        </Button>
        {onApply ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleApprove}
              loading={isApplying}
              disabled={!enabled || !lastPlan}
              size="sm"
            >
              Apply approved selection
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReject}
              disabled={!enabled || isApplying}
              size="sm"
            >
              Reject selection
            </Button>
          </>
        ) : null}
      </div>

      {planError ? <p className="text-sm text-red-600">{planError}</p> : null}
      {applyError ? <p className="text-sm text-red-600">{applyError}</p> : null}

      {lastPlan ? (
        <>
          <Separator />
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge>{lastPlan.pipeline.nextReviewState}</Badge>
              <Badge variant="outline">{lastPlan.selectedOps.length} ops in plan</Badge>
              <Badge variant="outline">
                {lastPlan.capabilities.supportsSelectionScope
                  ? 'Selection-aware'
                  : 'Whole artifact'}
              </Badge>
            </div>
            {lastPlan.warnings.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-slate-600">
                {lastPlan.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      ) : null}

      {lastApply ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {lastApply.applied
            ? `Mutation applied${lastApply.appliedVersionId ? ` as version ${String(lastApply.appliedVersionId)}` : ''}.`
            : 'Mutation apply returned without committing changes.'}
        </div>
      ) : null}
    </ArtifactRuntimePanelShell>
  );
}
