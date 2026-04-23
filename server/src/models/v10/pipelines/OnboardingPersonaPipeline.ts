export type OnboardingPersonaPipelineRunId = string & { readonly __brand: 'OnboardingPersonaPipelineRunId' };

export function unsafeOnboardingPersonaPipelineRunId(value: string): OnboardingPersonaPipelineRunId {
  return String(value) as OnboardingPersonaPipelineRunId;
}

export type OnboardingPersonaPipelineOutput = {
  readonly onboardingId: OnboardingPersonaPipelineRunId;
  readonly now: string;
  readonly accepted: true;
};

export function runOnboardingPersonaPipeline(input: {
  readonly onboardingId: OnboardingPersonaPipelineRunId;
  readonly persona: unknown;
  readonly now: string;
}): OnboardingPersonaPipelineOutput {
  void input.persona;
  return { onboardingId: input.onboardingId, now: input.now, accepted: true };
}

