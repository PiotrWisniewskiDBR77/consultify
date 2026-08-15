import { Api } from '../../services/api';
import {
  shouldFallbackToLegacyPartner,
  V8PartnerApi,
  type V8PartnerOnboardingStatus,
} from '../../services/api/v8';
import {
  PARTNER_TRUST_PHASES,
  type PartnerTrustPhase,
  type PartnerTrustProgression,
} from '../../views/partner/types';
import { loadPartnerRuntimeSummary } from './PartnerRuntimeSummaryStrip';

interface PartnerConnectionPayload {
  connected: boolean;
  organization?: {
    partnerSince?: string;
  };
}

export interface PartnerTrustSnapshot {
  trustProgression: PartnerTrustProgression[];
  currentTrustPhase: PartnerTrustPhase;
}

function normalizeConnection(payload: any): PartnerConnectionPayload {
  const data = payload?.data ?? payload;

  return {
    connected: Boolean(data?.connected),
    organization: data?.organization
      ? {
          partnerSince:
            typeof data.organization.partnerSince === 'string'
              ? data.organization.partnerSince
              : undefined,
        }
      : undefined,
  };
}

function normalizeOnboardingStatus(payload: any): V8PartnerOnboardingStatus {
  const data = payload?.status ?? payload?.data?.status ?? payload;

  return {
    termsAccepted: Boolean(data?.termsAccepted ?? data?.terms_accepted),
    privacyAccepted: Boolean(data?.privacyAccepted ?? data?.privacy_accepted),
    pricingTier:
      data?.pricingTier === undefined ? (data?.pricing_tier ?? null) : (data.pricingTier ?? null),
    paymentSetup: Boolean(data?.paymentSetup ?? data?.payment_setup),
    completed: Boolean(data?.completed),
  };
}

async function getPartnerConnection(): Promise<PartnerConnectionPayload> {
  const response = await V8PartnerApi.getConnection();
  return normalizeConnection(response);
}

async function getOnboardingStatus(): Promise<V8PartnerOnboardingStatus> {
  try {
    const response = await V8PartnerApi.getOnboardingStatus();
    return normalizeOnboardingStatus(response);
  } catch (error) {
    if (!shouldFallbackToLegacyPartner(error)) {
      throw error;
    }

    const response = await Api.get('/onboarding/status');
    return normalizeOnboardingStatus(response);
  }
}

async function getPartnerClientCount(): Promise<number> {
  try {
    const response = await V8PartnerApi.getClients();
    return Array.isArray(response?.clients) ? response.clients.length : 0;
  } catch (error) {
    if (!shouldFallbackToLegacyPartner(error)) {
      throw error;
    }

    const response = await Api.get('/api/partners/clients');
    return Array.isArray(response?.data) ? response.data.length : 0;
  }
}

function phaseRank(phase: PartnerTrustPhase): number {
  return PARTNER_TRUST_PHASES.findIndex((item) => item.phase === phase);
}

function buildProgression(
  currentTrustPhase: PartnerTrustPhase,
  completionMarker?: string
): PartnerTrustProgression[] {
  const currentRank = phaseRank(currentTrustPhase);

  return PARTNER_TRUST_PHASES.map((phase) => ({
    ...phase,
    completed: phaseRank(phase.phase) < currentRank,
    completedAt: phaseRank(phase.phase) < currentRank ? completionMarker : undefined,
  }));
}

export function derivePartnerTrustSnapshot(input: {
  connected: boolean;
  partnerSince?: string;
  onboardingStatus: V8PartnerOnboardingStatus;
  clientCount: number;
  totalClicks: number;
  signups: number;
  paidCustomers: number;
  totalEarned: number;
  readyForPayout: number;
}): PartnerTrustSnapshot {
  const {
    connected,
    partnerSince,
    onboardingStatus,
    clientCount,
    totalClicks,
    signups,
    paidCustomers,
    totalEarned,
    readyForPayout,
  } = input;

  let currentTrustPhase: PartnerTrustPhase = 'G1_DISCOVERY';

  if (connected) {
    currentTrustPhase = 'G2_QUALIFICATION';
  }

  const onboardingStarted =
    onboardingStatus.termsAccepted ||
    onboardingStatus.privacyAccepted ||
    Boolean(onboardingStatus.pricingTier) ||
    onboardingStatus.paymentSetup;

  if (onboardingStarted) {
    currentTrustPhase = 'G3_ONBOARDING';
  }

  const activationStarted =
    onboardingStatus.completed || clientCount > 0 || totalEarned > 0 || readyForPayout > 0;

  if (activationStarted) {
    currentTrustPhase = 'G4_ACTIVATION';
  }

  const ecosystemStarted = totalClicks > 0 || signups > 0 || paidCustomers > 0;

  if (ecosystemStarted) {
    currentTrustPhase = 'G5_ECOSYSTEM';
  }

  return {
    currentTrustPhase,
    trustProgression: buildProgression(currentTrustPhase, partnerSince),
  };
}

export async function loadPartnerTrustSnapshot(): Promise<PartnerTrustSnapshot> {
  const [connection, onboardingStatus, clientCount, runtimeSummary] = await Promise.all([
    getPartnerConnection(),
    getOnboardingStatus(),
    getPartnerClientCount(),
    loadPartnerRuntimeSummary(),
  ]);

  return derivePartnerTrustSnapshot({
    connected: connection.connected,
    partnerSince: connection.organization?.partnerSince,
    onboardingStatus,
    clientCount,
    totalClicks: Number(runtimeSummary.analytics.totalClicks ?? 0),
    signups: Number(runtimeSummary.analytics.signups ?? 0),
    paidCustomers: Number(runtimeSummary.analytics.paidCustomers ?? 0),
    totalEarned: Number(runtimeSummary.earnings.totalEarned ?? 0),
    readyForPayout: Number(runtimeSummary.earnings.readyForPayout ?? 0),
  });
}
