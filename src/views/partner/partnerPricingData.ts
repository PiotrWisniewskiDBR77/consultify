/**
 * Partner Pricing Data
 *
 * Defines partner tier configurations, features, requirements, and FAQ
 * Aligned with existing partner tier structure (BRONZE/SILVER/GOLD/PLATINUM)
 * and revenue share model from partnerService.ts
 */

import {
  Award,
  BookOpen,
  Building2,
  Crown,
  Headphones,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import React from 'react';

import { PMODomainId, PMOStandardsMapping } from './types';

// =============================================================================
// PARTNER TIER TYPES
// =============================================================================

export type PartnerTierId = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface PartnerTierFeature {
  name: string;
  included: boolean;
  highlight?: boolean;
}

export interface PartnerTierRequirement {
  label: string;
  value: string;
}

export interface PartnerTier {
  id: PartnerTierId;
  name: string;
  subtitle: string;
  description: string;
  commissionRate: number;
  highlight?: boolean;
  badge?: string;
  icon: React.ElementType;
  supportSLA: string;
  features: PartnerTierFeature[];
  requirements: PartnerTierRequirement[];
  cta: string;
  ctaVariant: 'primary' | 'secondary' | 'outline';
  pmoDomain: PMODomainId;
  pmoMapping: PMOStandardsMapping;
}

// =============================================================================
// PARTNER TIERS CONFIGURATION
// =============================================================================
//
// SSOT — confirm % with partner contract.
// This is the single canonical commission-tier schedule for the WHOLE app
// (public pricing page + in-product ProviderHomeView calculator + tier bar +
// the FAQ below). Customer-facing source of truth is the public pricing hero
// "up to 20%". Canonical schedule: Bronze 10% / Silver 12% / Gold 14% /
// Platinum 20%. Do NOT fork these numbers anywhere — import PARTNER_TIERS
// instead so the calculator and tier visuals can never drift again.

export const PARTNER_TIERS: PartnerTier[] = [
  {
    id: 'BRONZE',
    name: 'Bronze',
    subtitle: 'Entry Level',
    description: 'Rozpocznij współpracę i poznaj ekosystem Consultify',
    commissionRate: 10,
    icon: Shield,
    supportSLA: '48h',
    features: [
      { name: 'Partner Academy (moduły podstawowe)', included: true },
      { name: 'Wpis w Solutions Directory', included: true },
      { name: 'Email support (48h SLA)', included: true },
      { name: 'Monthly partner newsletter', included: true },
      { name: '10% commission na zamknięte deale', included: true, highlight: true },
      { name: 'Co-sell lead sharing', included: false },
      { name: 'Marketing kit access', included: false },
      { name: 'Deal desk support', included: false },
      { name: 'Joint marketing campaigns', included: false },
      { name: 'Dedicated PDM', included: false },
      { name: 'Custom agreement terms', included: false },
      { name: 'Strategic planning sessions', included: false },
    ],
    requirements: [
      { label: 'Onboarding', value: 'Zakończony' },
      { label: 'Certyfikacja', value: 'min. 1 moduł' },
      { label: 'Okres aktywności', value: 'Brak wymagań' },
    ],
    cta: 'Dołącz jako Partner',
    ctaVariant: 'outline',
    pmoDomain: 'SCOPE_CHANGE_CONTROL',
    pmoMapping: {
      domain: 'SCOPE_CHANGE_CONTROL',
      iso21500: 'Scope Subject Group (Clause 4.4)',
      pmbok: 'Development Approach & Life Cycle',
      prince2: 'Change Theme',
    },
  },
  {
    id: 'SILVER',
    name: 'Silver',
    subtitle: 'Growing Partners',
    description: 'Rozwijaj współpracę z dostępem do co-sell leads',
    commissionRate: 12,
    icon: Zap,
    supportSLA: '24h',
    features: [
      { name: 'Partner Academy (wszystkie moduły)', included: true },
      { name: 'Wpis w Solutions Directory (rozszerzony)', included: true },
      { name: 'Priority support (24h SLA)', included: true },
      { name: 'Quarterly business reviews', included: true },
      { name: '12% rabat na zamknięte deale', included: true, highlight: true },
      { name: 'Co-sell lead sharing', included: true },
      { name: 'Marketing kit access', included: true },
      { name: 'Deal desk support', included: false },
      { name: 'Joint marketing campaigns', included: false },
      { name: 'Dedicated PDM', included: false },
      { name: 'Custom agreement terms', included: false },
      { name: 'Strategic planning sessions', included: false },
    ],
    requirements: [
      { label: 'Zamknięte deale', value: 'min. 2' },
      { label: 'Academy completion', value: '50%' },
      { label: 'Okres aktywności', value: '6 miesięcy' },
    ],
    cta: 'Awansuj na Silver',
    ctaVariant: 'outline',
    pmoDomain: 'GOVERNANCE_DECISION_MAKING',
    pmoMapping: {
      domain: 'GOVERNANCE_DECISION_MAKING',
      iso21500: 'Governance Decision (Clause 4.3.4)',
      pmbok: 'Project Decision / Authorization',
      prince2: 'Project Board Decision',
    },
  },
  {
    id: 'GOLD',
    name: 'Gold',
    subtitle: 'Certified Partners',
    description: 'Pełny dostęp do deal desk i joint marketing',
    commissionRate: 14,
    highlight: true,
    badge: 'Najpopularniejszy',
    icon: Award,
    supportSLA: '4h',
    features: [
      { name: 'Partner Academy (wszystkie moduły + certyfikacja)', included: true },
      { name: 'Wpis w Solutions Directory (premium)', included: true },
      { name: 'Premium support (4h SLA)', included: true },
      { name: 'Monthly business reviews', included: true },
      { name: '14% rabat na zamknięte deale', included: true, highlight: true },
      { name: 'Co-sell lead sharing (priorytet)', included: true },
      { name: 'Marketing kit access', included: true },
      { name: 'Deal desk support', included: true },
      { name: 'Joint marketing campaigns', included: true },
      { name: 'Dedicated PDM (shared)', included: true },
      { name: 'Custom agreement terms', included: false },
      { name: 'Strategic planning sessions', included: false },
    ],
    requirements: [
      { label: 'Zamknięte deale', value: 'min. 5' },
      { label: 'Academy completion', value: '100%' },
      { label: 'Okres aktywności', value: '12 miesięcy' },
    ],
    cta: 'Awansuj na Gold',
    ctaVariant: 'primary',
    pmoDomain: 'PERFORMANCE_MONITORING',
    pmoMapping: {
      domain: 'PERFORMANCE_MONITORING',
      iso21500: 'Project Performance Measurement (Clause 4.4.22)',
      pmbok: 'Project Performance Information',
      prince2: 'Highlight Report',
    },
  },
  {
    id: 'PLATINUM',
    name: 'Platinum',
    subtitle: 'Elite Partners',
    description: 'Strategiczne partnerstwo z dedykowanym wsparciem',
    commissionRate: 20,
    icon: Crown,
    supportSLA: '1h',
    features: [
      { name: 'Partner Academy (pełny dostęp + advanced)', included: true },
      { name: 'Wpis w Solutions Directory (featured)', included: true },
      { name: 'Enterprise support (1h SLA)', included: true },
      { name: 'Weekly strategic reviews', included: true },
      { name: '20% commission na zamknięte deale', included: true, highlight: true },
      { name: 'Co-sell lead sharing (ekskluzywny)', included: true },
      { name: 'Marketing kit access (premium)', included: true },
      { name: 'Deal desk support (dedykowany)', included: true },
      { name: 'Joint marketing campaigns (co-branded)', included: true },
      { name: 'Dedicated PDM', included: true },
      { name: 'Custom agreement terms', included: true },
      { name: 'Strategic planning sessions', included: true },
    ],
    requirements: [
      { label: 'Zamknięte deale', value: 'min. 15' },
      { label: 'Roczny przychód', value: '$250k+' },
      { label: 'Executive sponsor', value: 'Wymagany' },
    ],
    cta: 'Skontaktuj się',
    ctaVariant: 'secondary',
    pmoDomain: 'BENEFITS_REALIZATION',
    pmoMapping: {
      domain: 'BENEFITS_REALIZATION',
      iso21500: 'Benefits Identification (Clause 4.4.1)',
      pmbok: 'Benefits Documentation',
      prince2: 'Expected Benefits (Business Case)',
    },
  },
];

// =============================================================================
// COMMISSION CALCULATOR TIER RESOLVER (SSOT-derived)
// =============================================================================
//
// SSOT — confirm % with partner contract.
// Maps an annual closed-deal volume onto the canonical PARTNER_TIERS schedule
// above. Rates are pulled FROM PARTNER_TIERS so the in-product calculator can
// never drift from the public pricing page. Thresholds are illustrative
// estimator inputs (not contract terms).

const tierRate = (id: PartnerTierId): number =>
  (PARTNER_TIERS.find((t) => t.id === id)?.commissionRate ?? 0) / 100;

export interface CalculatorTierResult {
  id: PartnerTierId;
  name: string;
  rate: number; // fraction, e.g. 0.14
}

export function resolveCalculatorTier(annualClients: number): CalculatorTierResult {
  let id: PartnerTierId = 'BRONZE';
  if (annualClients >= 50) id = 'PLATINUM';
  else if (annualClients >= 25) id = 'GOLD';
  else if (annualClients >= 10) id = 'SILVER';
  const tier = PARTNER_TIERS.find((t) => t.id === id)!;
  return { id, name: tier.name, rate: tierRate(id) };
}

// =============================================================================
// PARTNER BENEFITS
// =============================================================================

export interface PartnerBenefit {
  icon: React.ElementType;
  title: string;
  description: string;
}

export const PARTNER_BENEFITS: PartnerBenefit[] = [
  {
    icon: TrendingUp,
    title: 'Rabat do 14%',
    description:
      'Progresywny model prowizji rośnie wraz z Twoim zaangażowaniem i sukcesami w programie.',
  },
  {
    icon: Users,
    title: 'Co-selling z Consultify',
    description:
      'Wspólne generowanie leadów, pipeline review i deal desk support dla większych transakcji.',
  },
  {
    icon: BookOpen,
    title: 'Partner Academy',
    description:
      'Kompleksowe szkolenia z metodologii DRD, sprzedaży i wdrożeń dla Twojego zespołu.',
  },
  {
    icon: Target,
    title: 'Deal Registration',
    description: 'Ochrona Twoich dealów i transparentny proces rozliczeń zgodny z PMO standards.',
  },
  {
    icon: Building2,
    title: 'Solutions Directory',
    description:
      'Widoczność w katalogu partnerów dla klientów szukających ekspertów w Twojej dziedzinie.',
  },
  {
    icon: Sparkles,
    title: 'PMO Standards Compliance',
    description: 'Każda aktywność partnerska jest mapowana na ISO 21500 / PMBOK 7 / PRINCE2.',
  },
];

// =============================================================================
// PARTNER FAQ
// =============================================================================

export interface PartnerFAQ {
  question: string;
  answer: string;
}

export const PARTNER_FAQS: PartnerFAQ[] = [
  {
    question: 'Jak działa model prowizji?',
    answer:
      'Rabat jest naliczany od wartości zamkniętych dealów. Stawka zależy od Twojego poziomu partnerskiego: Bronze (10%), Silver (12%), Gold (14%), Platinum (20%). Prowizje są rozliczane kwartalnie w ramach Commission Statements.',
  },
  {
    question: 'Jak awansować na wyższy poziom?',
    answer:
      'Awans na wyższy poziom wymaga spełnienia określonych kryteriów: liczby zamkniętych dealów, ukończenia modułów Academy i minimalnego okresu aktywności. System automatycznie monitoruje Twój postęp i powiadomi Cię o możliwości awansu.',
  },
  {
    question: 'Co to jest Deal Registration?',
    answer:
      'Deal Registration to proces rejestracji potencjalnych transakcji w systemie. Chroni Twoje deale przed duplikacją i zapewnia transparentność w przypisywaniu prowizji. Każdy deal jest mapowany do PMO domain GOVERNANCE_DECISION_MAKING.',
  },
  {
    question: 'Jak działa Co-sell Lead Sharing?',
    answer:
      'Od poziomu Silver otrzymujesz dostęp do leadów generowanych przez Consultify. Leady są przydzielane na podstawie Twojej specjalizacji, regionu i historii współpracy. Na poziomie Gold i Platinum masz priorytetowy dostęp.',
  },
  {
    question: 'Jakie wsparcie marketingowe oferujecie?',
    answer:
      'Silver partners otrzymują dostęp do marketing kit (szablony, case studies, prezentacje). Gold partners mogą uczestniczyć w joint marketing campaigns. Platinum partners mają możliwość co-branded solutions i dedykowanych kampanii.',
  },
  {
    question: 'Co to jest Partner Academy?',
    answer:
      'Partner Academy to platforma szkoleniowa obejmująca metodologię DRD, techniki sprzedaży, best practices wdrożeniowe i certyfikacje. Ukończenie modułów jest wymagane do awansu na wyższe poziomy partnerskie.',
  },
  {
    question: 'Jak rozliczane są prowizje?',
    answer:
      'Commission Statements są generowane kwartalnie. Po zamknięciu kwartału Finance Team weryfikuje wszystkie deale i generuje statement zgodny z PMO domain BENEFITS_REALIZATION. Payout następuje w ciągu 30 dni od approval.',
  },
  {
    question: 'Czy mogę negocjować indywidualne warunki?',
    answer:
      'Partnerzy Platinum mogą negocjować custom agreement terms, w tym wyższe stawki prowizji dla określonych segmentów, dedykowane SLA i specjalne warunki współpracy strategicznej.',
  },
];

// =============================================================================
// TRUST INDICATORS
// =============================================================================

export interface TrustIndicator {
  icon: React.ElementType;
  label: string;
}

export const TRUST_INDICATORS: TrustIndicator[] = [
  { icon: Shield, label: 'PMO Standards Compliant' },
  { icon: Users, label: 'Program partnerski w fazie beta' },
  { icon: Headphones, label: 'Dedicated Support' },
  { icon: Award, label: 'ISO 21500 / PMBOK 7 / PRINCE2' },
];

// =============================================================================
// TIER COLORS
// =============================================================================

export const TIER_COLORS: Record<PartnerTierId, { bg: string; text: string; border: string }> = {
  BRONZE: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-700',
  },
  SILVER: {
    bg: 'bg-slate-100 dark:bg-slate-700/30',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-300 dark:border-slate-600',
  },
  GOLD: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-400 dark:border-yellow-600',
  },
  PLATINUM: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-400 dark:border-indigo-600',
  },
};
