export const ONBOARD_TELEMETRY_EVENT_NAMES = [
  'onboard.started',
  'onboard.persona_inferred',
  'onboard.persona_confirmed',
  'onboard.admin_console_seen',
  'onboard.trust_banner_viewed',
  'onboard.connector_offer_rendered',
  'onboard.connector_oauth_started',
  'onboard.connector_oauth_succeeded',
  'onboard.connector_oauth_failed',
  'onboard.fallback_upload_used',
  'onboard.artifact_seeded',
  'onboard.artifact_first_draft_rendered',
  'onboard.provenance_panel_opened',
  'onboard.approval_gate_opened',
  'onboard.artifact_approved',
  'onboard.artifact_saved',
  'onboard.activation_reached',
  'onboard.export_manifest_viewed',
  'onboard.export_completed',
  'onboard.memory_opt_in',
  'onboard.team_invite_sent',
  'onboard.resume_reentered',
  'onboard.abandoned',
  'onboard.artifact_blocked',
] as const;

export type OnboardTelemetryEventName = (typeof ONBOARD_TELEMETRY_EVENT_NAMES)[number];

export type OnboardTelemetryProps = {
  persona: string;
  sourceType: string;
  dataClassification: string;
  trustMode: string;
  residencyRegion: string;
  secondsSinceStart: number;
  artifactType: string;
  citationCount: number;
  validationStatus: string;
  approvalRequired: boolean;
  ahaReached: boolean;
};

export function buildDefaultOnboardTelemetryProps(
  overrides: Partial<OnboardTelemetryProps> & Pick<OnboardTelemetryProps, 'persona'>
): OnboardTelemetryProps {
  return {
    persona: overrides.persona,
    sourceType: overrides.sourceType || 'unknown',
    dataClassification: overrides.dataClassification || 'internal',
    trustMode: overrides.trustMode || 'guardrailed',
    residencyRegion: overrides.residencyRegion || 'unknown',
    secondsSinceStart: overrides.secondsSinceStart ?? 0,
    artifactType: overrides.artifactType || 'unknown',
    citationCount: overrides.citationCount ?? 0,
    validationStatus: overrides.validationStatus || 'pending',
    approvalRequired: overrides.approvalRequired ?? false,
    ahaReached: overrides.ahaReached ?? false,
  };
}
