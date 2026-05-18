export type OnboardingResumeSnapshot = {
  persona: string | null;
  personaConfidence?: 'low' | 'medium' | 'high' | null;
  overrideHistory: Array<{
    fromPersona?: string | null;
    toPersona: string;
    at: string;
    reason?: string | null;
  }>;
  connectorTarget: string | null;
  connectorScopes: string[];
  uploadedFiles: Array<{
    id: string;
    name: string;
    hash: string;
    storedAt?: string | null;
  }>;
  currentDraft: string | null;
  approvalHistory: Array<{
    at: string;
    decision: string;
    actorId?: string | null;
    note?: string | null;
  }>;
  trustBanner: {
    viewedAt: string | null;
    acknowledged: boolean;
  };
  unresolvedValidationBlockers: string[];
  currentStep: string;
  deltaHint?: string | null;
};

export type OnboardingResumeOutcome = 'resumed' | 'expired' | 'not_found';

export function detectChangedSnapshotSources(
  snapshot: OnboardingResumeSnapshot | null | undefined,
  currentHashes: Record<string, string>
): string[] {
  if (!snapshot) return [];
  return (snapshot.uploadedFiles || [])
    .filter((file) => currentHashes[file.id] && currentHashes[file.id] !== file.hash)
    .map((file) => file.id);
}
