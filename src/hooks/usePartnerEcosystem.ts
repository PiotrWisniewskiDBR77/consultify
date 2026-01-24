import { useCallback, useMemo, useState } from 'react';

import {
  CommissionStatement,
  PARTNER_TRUST_PHASES,
  PartnerDeal,
  PartnerEcosystemMetrics,
  PartnerTrustPhase,
  PartnerTrustProgression,
  PARTNER_PMO_MAPPING,
} from '../views/partner/types';

export const usePartnerEcosystem = () => {
  const [loading] = useState(false);

  const trustProgression: PartnerTrustProgression[] = PARTNER_TRUST_PHASES;
  const currentTrustPhase: PartnerTrustPhase = 'G4_ACTIVATION';

  const metrics: PartnerEcosystemMetrics = {
    referralConversions: 12,
    benchmarkContributions: 4,
    networkEffectMultiplier: 1.6,
    ecosystemHealthScore: 78,
    totalDealsCreated: 24,
    totalDealsWon: 9,
    totalCommissionEarned: 18500,
    activeClients: 7,
    partnerTier: 'SILVER',
  };

  const deals: PartnerDeal[] = [
    {
      id: 'deal-001',
      partnerId: 'partner-01',
      clientName: 'Northwind Manufacturing',
      dealValue: 120000,
      status: 'NEGOTIATION',
      commissionRate: 0.12,
      commissionAmount: 14400,
      registeredAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
      pmoMapping: PARTNER_PMO_MAPPING.DEAL_REGISTRATION,
    },
    {
      id: 'deal-002',
      partnerId: 'partner-01',
      clientName: 'Blue Peak Logistics',
      dealValue: 78000,
      status: 'WON',
      commissionRate: 0.1,
      commissionAmount: 7800,
      registeredAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 80).toISOString(),
      closedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
      pmoMapping: PARTNER_PMO_MAPPING.DEAL_REGISTRATION,
    },
  ];

  const statements: CommissionStatement[] = [
    {
      id: 'stmt-2025-12',
      partnerId: 'partner-01',
      period: 'Dec 2025',
      totalAmount: 7800,
      status: 'PAID',
      paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      deals: deals.filter((deal) => deal.status === 'WON'),
    },
  ];

  const getComplianceScore = useCallback(() => {
    const score = metrics.ecosystemHealthScore;
    return Math.max(0, Math.min(100, score));
  }, [metrics.ecosystemHealthScore]);

  const submitCommissionInquiry = useCallback(async (_type: string, _message: string) => {
    // Placeholder for API integration
  }, []);

  return {
    metrics: useMemo(() => metrics, [metrics]),
    trustProgression,
    currentTrustPhase,
    deals: useMemo(() => deals, [deals]),
    statements: useMemo(() => statements, [statements]),
    loading,
    getComplianceScore,
    submitCommissionInquiry,
  };
};

export default usePartnerEcosystem;
