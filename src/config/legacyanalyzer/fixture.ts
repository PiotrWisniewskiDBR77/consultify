/**
 * Legacy Analyzer — worked-example fixture.
 *
 * Sourced from the doctrine's §7 worked example
 * (Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/legacy-analyzer.md): a medium-size
 * manufacturing company, ~4M PLN/year IT run budget, 5 systems from the
 * doctrine's Krok 1 inventory table —
 *   - ERP (SAP, 2012): high value / low health, mainstream support ends in
 *     14 months, 2 people know the customizations → raw MIGRATE (Replatform).
 *   - CRM własny (2016, PHP): low incremental value after the 70% functional
 *     overlap with the service desk is netted out, low health (no docs,
 *     author left, 1 incident/month) → raw ELIMINATE (consolidate into the
 *     service desk).
 *   - System zgłoszeń serwisowych (SaaS, 2022): high value, high health →
 *     raw INVEST (the portfolio's healthy base).
 *   - Portal dostawców (2010, .NET Framework 3.5): low value (12 active
 *     users), very low health (EOL framework, no vendor support) → raw
 *     ELIMINATE, the doctrine's dependency-free "quick win" retirement.
 *   - Middleware integracyjny (2008): scored low on both axes standalone
 *     (undocumented, bus factor 1, no vendor support) → raw ELIMINATE, but
 *     it is a critical integration node with in-degree 3 (ERP, service desk
 *     and the supplier portal all depend on it) — the dependency-graph
 *     override lifts it to MIGRATE/Refactor: build the new integration
 *     layer first, retire the old node second.
 *
 * Used as: (a) the `toLegacySession` self-test fixture, (b) a seed/demo
 * session for the tool, (c) a reference for QA/DoD screenshots.
 */

import type { OperationalToolData } from '@/store/useToolStore';

export const LEGACY_FIXTURE: OperationalToolData = {
  context: {
    goal:
      'Ustalić kolejność modernizacji portfela IT na najbliższy rok — co utrzymać, w co inwestować, co migrować, co wygasić — i policzyć ile dług technologiczny faktycznie kosztuje firmę',
    scope:
      'Firma produkcyjna średniej wielkości, wycinek portfela: 5 kluczowych systemów (ERP, CRM własny, system zgłoszeń serwisowych, portal dostawców, middleware integracyjny), roczny budżet IT utrzymania ~4 mln PLN',
    timeframe: 'medium',
    successSignal:
      'Roadmapa modernizacji sekwencjonowana grafem zależności (nie tylko rankingiem wartości) z budżetem i twardymi deadline\'ami, gotowa do obrony przed zarządem',
    assumptions:
      'Oceny wartości biznesowej i kondycji technicznej ustalone wspólnie z właścicielami biznesowymi (nie wyłącznie przez IT); wagi osi standardowe dla firmy nieregulowanej',
    constraints:
      'Middleware jest węzłem integracyjnym dla 3 innych systemów — nie da się go wygasić bez wcześniejszego zbudowania zastępczej integracji',
  },
  sections: {
    apps: [
      {
        id: 'app-erp',
        title: 'ERP (SAP, wdrożony 2012)',
        description:
          'Rdzeń operacji firmy. On-prem, koniec mainstream support za 14 miesięcy, tylko 2 osoby znają customizacje. Wysoka wartość biznesowa, pogarszająca się kondycja techniczna — twardy deadline.',
        impact: 'high',
        effort: 'high',
        category: 'core-operations',
        businessValue: 5,
        technicalHealth: 2,
        tcoPerYear: 900_000,
        replacementValue: 3_000_000,
        remediationCost: 1_200_000,
        activeUsers: 450,
        hasBusinessOwner: true,
        busFactor: 2,
        busFactorPrev: 3,
        supportStatus: 'expiring',
        supportEndsInMonths: 14,
        knownCves: 1,
        complianceGap: false,
        commoditized: false,
        duplicatedElsewhere: false,
      },
      {
        id: 'app-crm',
        title: 'CRM własny (2016, PHP)',
        description:
          'Brak dokumentacji, autor odszedł, 1 incydent/miesiąc. Po analizie nakładania funkcji z systemem zgłoszeń serwisowych (70% pokrycia) wartość samodzielna jest niska — kandydat do konsolidacji, nie migracji.',
        impact: 'medium',
        effort: 'low',
        category: 'crm',
        businessValue: 2,
        technicalHealth: 2,
        tcoPerYear: 250_000,
        replacementValue: 600_000,
        remediationCost: 300_000,
        activeUsers: 80,
        hasBusinessOwner: false,
        busFactor: 1,
        busFactorPrev: 2,
        supportStatus: 'none',
        knownCves: 2,
        complianceGap: false,
        commoditized: true,
        duplicatedElsewhere: true,
      },
      {
        id: 'app-servicedesk',
        title: 'System zgłoszeń serwisowych (SaaS, 2022)',
        description:
          'Wysoka wartość i wysoka kondycja — koń pociągowy portfela, dobra baza do dalszego rozwoju (w tym przejęcia funkcji CRM).',
        impact: 'high',
        effort: 'low',
        category: 'service-desk',
        businessValue: 5,
        technicalHealth: 5,
        tcoPerYear: 120_000,
        replacementValue: 400_000,
        remediationCost: 0,
        activeUsers: 200,
        hasBusinessOwner: true,
        busFactor: 4,
        busFactorPrev: 4,
        supportStatus: 'active',
        knownCves: 0,
        complianceGap: false,
        commoditized: true,
        duplicatedElsewhere: false,
      },
      {
        id: 'app-supplier-portal',
        title: 'Portal dostawców (2010, .NET Framework 3.5)',
        description:
          'Framework EOL, brak wsparcia dostawcy, tylko 12 aktywnych użytkowników. Niska wartość, bardzo niska kondycja — kandydat do wygaszenia, najniższe ryzyko, najszybszy zwrot (quick win finansujący część migracji ERP).',
        impact: 'low',
        effort: 'low',
        category: 'supplier-portal',
        businessValue: 2,
        technicalHealth: 1,
        tcoPerYear: 80_000,
        replacementValue: 200_000,
        remediationCost: 150_000,
        activeUsers: 12,
        hasBusinessOwner: false,
        busFactor: 1,
        busFactorPrev: 1,
        supportStatus: 'none',
        knownCves: 5,
        complianceGap: false,
        commoditized: false,
        duplicatedElsewhere: false,
      },
      {
        id: 'app-middleware',
        title: 'Middleware integracyjny (2008)',
        description:
          'Brak dokumentacji, bus factor 1, brak wsparcia dostawcy — oceniony samodzielnie (bez uwzględnienia roli integracyjnej) trafiłby do ELIMINATE. Ale jest węzłem, przez który przechodzą zamówienia z ERP, system zgłoszeń i portal dostawców — wygaszenie bez zastępstwa zablokowałoby te trzy systemy.',
        impact: 'high',
        effort: 'high',
        category: 'integration',
        businessValue: 2,
        technicalHealth: 1,
        tcoPerYear: 150_000,
        replacementValue: 500_000,
        remediationCost: 400_000,
        activeUsers: 0,
        hasBusinessOwner: false,
        busFactor: 1,
        busFactorPrev: 2,
        supportStatus: 'none',
        knownCves: 2,
        complianceGap: false,
        commoditized: false,
        duplicatedElsewhere: false,
      },
    ] as unknown as OperationalToolData['sections']['apps'],
    dependencies: [
      {
        id: 'dep-erp-middleware',
        title: 'ERP → Middleware integracyjny',
        description: 'ERP konsumuje warstwę integracyjną middleware do wymiany zamówień/danych z innymi systemami.',
        impact: 'high',
        effort: 'low',
        from: 'app-erp',
        to: 'app-middleware',
        documented: true,
      },
      {
        id: 'dep-servicedesk-middleware',
        title: 'System zgłoszeń serwisowych → Middleware integracyjny',
        description: 'System zgłoszeń konsumuje middleware do synchronizacji zgłoszeń z ERP i portalem dostawców.',
        impact: 'high',
        effort: 'low',
        from: 'app-servicedesk',
        to: 'app-middleware',
        documented: true,
      },
      {
        id: 'dep-supplierportal-middleware',
        title: 'Portal dostawców → Middleware integracyjny',
        description: 'Portal dostawców przekazuje zamówienia przez middleware do ERP — integracja udokumentowana częściowo.',
        impact: 'medium',
        effort: 'low',
        from: 'app-supplier-portal',
        to: 'app-middleware',
        documented: false,
      },
      {
        id: 'dep-crm-servicedesk',
        title: 'CRM własny → System zgłoszeń serwisowych',
        description: 'CRM odczytuje status zgłoszeń z systemu serwisowego (integracja punkt-punkt, kandydat do likwidacji razem z CRM).',
        impact: 'low',
        effort: 'low',
        from: 'app-crm',
        to: 'app-servicedesk',
        documented: true,
      },
    ] as unknown as OperationalToolData['sections']['dependencies'],
  },
};
