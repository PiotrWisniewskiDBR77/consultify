export type ResearchMissionPipelineRunId = string & {
  readonly __brand: 'ResearchMissionPipelineRunId';
};

export function unsafeResearchMissionPipelineRunId(value: string): ResearchMissionPipelineRunId {
  return String(value) as ResearchMissionPipelineRunId;
}

export type ResearchMissionPipelineOutput = {
  readonly missionId: ResearchMissionPipelineRunId;
  readonly now: string;
  readonly summary: string;
};

export function runResearchMissionPipeline(input: {
  readonly missionId: ResearchMissionPipelineRunId;
  readonly query: string;
  readonly now: string;
}): ResearchMissionPipelineOutput {
  return {
    missionId: input.missionId,
    now: input.now,
    summary: `ResearchMissionPipeline(MVP): synthesized summary for "${input.query}"`,
  };
}
