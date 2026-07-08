/**
 * Data Inventory — worked-example fixture.
 *
 * Grounds the deterministic engine (dataInventoryEngine.ts) and the conclusion
 * prompt builder (conclusionPrompts.ts) in a runnable example so the tool can
 * be self-tested and previewed without a live session. Lifted from the
 * doctrine's own worked example (§7, Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/
 * data-inventory.md): a mid-size B2B distributor considering an AI agent for
 * demand forecasting + order-automation, whose board asks "is our data ready?".
 *
 *   - Customer data lives split across a CRM ("owned by sales" in general, no
 *     named owner) and a hand-maintained "VIP clients" Excel sheet with no
 *     shared identifier — the doctrine's core orphan + consistency-gap case.
 *   - Customer-service logs sit in a shared mailbox, collected, never analyzed
 *     — the doctrine's dark-data case, doubling as unassessed GDPR exposure.
 *   - Product data (ERP, named owner) and warehouse data (WMS, audit-forced
 *     discipline, governance level 4) are the doctrine's "mature domain to
 *     replicate" contrast against customer data (governance level 2).
 *   - A supplier domain with high quality but low governance (level 2) is
 *     added to exercise the "high quality without governance = transitional
 *     risk" branch of the engine, distinct from the AI-readiness blocker.
 *   - The AI use-case (demand forecasting + order automation) requires
 *     customer + operations + product data at once; customer data is the sole
 *     domain below the elevated AI quality bar — the doctrine's single hard
 *     blocker, which the warehouse's higher quality cannot rescue.
 *
 * Field convention (see dataInventoryEngine.ts `toDataInventorySession` adapter
 * doc-comment):
 *   - `assets` section:  OperationalItem + domain/owner/steward/sensitive/darkData/consumers
 *   - `domains` section: OperationalItem + domain/quality/governanceLevel/criticalForAi/aiReadiness
 *   - `useCase` section: OperationalItem (title = use-case title) + requiresDomains
 * These are additive fields the strict `OperationalItem` interface does not
 * declare (it is intentionally generic across all 22 operational tools), so
 * each section below is typed as `OperationalItem & {...extras}` locally and
 * assigned by reference into `sections` — this satisfies structural typing
 * without widening or touching the shared store types.
 */

import type { OperationalItem, OperationalToolData } from '@/store/useToolStore';
import { createConsultingMissionContext } from '@/config/consultingToolsStandard';
import type {
  AiReadinessDimensionId,
  DataDomainId,
  GovernanceMaturityLevel,
  QualityDimensionId,
} from './deepeningLadder';

type AssetItem = OperationalItem & {
  domain?: DataDomainId;
  owner?: string;
  steward?: string;
  sensitive?: boolean;
  darkData?: boolean;
  consumers?: number;
};

type DomainItem = OperationalItem & {
  domain: DataDomainId;
  quality?: Partial<Record<QualityDimensionId, number>>;
  governanceLevel?: GovernanceMaturityLevel;
  criticalForAi?: boolean;
  aiReadiness?: Partial<Record<AiReadinessDimensionId, number>>;
};

type UseCaseItem = OperationalItem & {
  requiresDomains?: DataDomainId[];
};

// ---------------------------------------------------------------------------
// Assets — the asset register. Orphan = no named business owner (owner
// missing/placeholder); dark data = collected but never analyzed (consumers=0
// or darkData=true). Doctrine table §7, plus SaaS-sprawl siblings.
// ---------------------------------------------------------------------------

const assetItems: AssetItem[] = [
  {
    id: 'asset-crm-customer',
    title: 'CRM — dane klienta (kontakt, historia zamówień)',
    description:
      'Główny system CRM handlowy; pole „właściciel" ustawione ogólnie na dział sprzedaży, bez osoby imiennej.',
    impact: 'high',
    effort: 'medium',
    domain: 'customer',
    owner: 'Brak',
    steward: 'Zespół sprzedaży (nieformalnie, rotacyjnie)',
    sensitive: true,
    darkData: false,
    consumers: 12,
  },
  {
    id: 'asset-vip-sheet',
    title: 'Arkusz „VIP klienci" (Excel, prowadzony ręcznie)',
    description:
      'Równoległy arkusz utrzymywany przez pojedynczego handlowca; brak wspólnego identyfikatora z CRM, aktualizowany nieregularnie.',
    impact: 'medium',
    effort: 'low',
    domain: 'customer',
    owner: 'Brak',
    sensitive: true,
    darkData: false,
    consumers: 1,
  },
  {
    id: 'asset-service-logs',
    title: 'Logi obsługi klienta (skrzynka pocztowa współdzielona)',
    description: 'E-maile i zgłoszenia klientów; nigdy nieanalizowane — potencjalne źródło sygnału o churn.',
    impact: 'medium',
    effort: 'low',
    domain: 'customer',
    owner: 'Brak',
    sensitive: true,
    darkData: true,
    consumers: 0,
  },
  {
    id: 'asset-saas-marketing',
    title: 'Narzędzie marketing automation (SaaS)',
    description: 'Subskrypcja SaaS z listami mailingowymi klientów; nikt formalnie nie odpowiada za konto.',
    impact: 'low',
    effort: 'low',
    domain: 'customer',
    owner: 'Brak',
    sensitive: true,
    darkData: true,
    consumers: 0,
  },
  {
    id: 'asset-erp-product',
    title: 'ERP — dane produktowe (SKU, kategorie, ceny)',
    description: 'Aktualizowane przy wprowadzeniu nowego produktu; imiennie przypisany właściciel biznesowy.',
    impact: 'high',
    effort: 'low',
    domain: 'product',
    owner: 'Kierownik ds. Produktu — Marek Nowicki',
    steward: 'Zespół produktowy',
    sensitive: false,
    darkData: false,
    consumers: 25,
  },
  {
    id: 'asset-order-history',
    title: 'Historia zamówień/transakcji (ERP + hurtownia danych)',
    description:
      'Zasilanie automatyczne, ale bez walidacji jakości; właściciel formalny to dział IT — techniczny, nie biznesowy.',
    impact: 'high',
    effort: 'medium',
    domain: 'operations',
    owner: 'Dział IT (techniczny, nie biznesowy)',
    sensitive: false,
    darkData: false,
    consumers: 40,
  },
  {
    id: 'asset-wms-warehouse',
    title: 'WMS — stany magazynowe i lokalizacje',
    description: 'Aktualizowane na bieżąco, wysoka dyscyplina wymuszona regularnym audytem logistycznym.',
    impact: 'medium',
    effort: 'low',
    domain: 'operations',
    owner: 'Kierownik Magazynu — Ewa Kowalska',
    steward: 'Zespół magazynowy',
    sensitive: false,
    darkData: false,
    consumers: 15,
  },
  {
    id: 'asset-invoicing',
    title: 'Fakturowanie i płatności (moduł finansowy ERP)',
    description: 'Dane płatnicze i faktury; imiennie przypisany właściciel, regularny audyt księgowy.',
    impact: 'medium',
    effort: 'low',
    domain: 'finance',
    owner: 'Dyrektor Finansowy — Anna Wiśniewska',
    sensitive: true,
    darkData: false,
    consumers: 20,
  },
  {
    id: 'asset-supplier-portal',
    title: 'Portal dostawców (zamówienia do dostawców)',
    description:
      'Dane utrzymywane w dobrej jakości ręcznie przez kilku doświadczonych kupców — bez formalnej polityki ani stewarda.',
    impact: 'low',
    effort: 'low',
    domain: 'supplier',
    owner: 'Dyrektor Zakupów — Piotr Zych',
    sensitive: false,
    darkData: false,
    consumers: 8,
  },
];

// ---------------------------------------------------------------------------
// Domains — DAMA quality profile (0..1 per dimension) + Gartner governance
// maturity (1..5) + AI-readiness dimensions (0..1) for the domains critical to
// the planned use-case. Customer = doctrine's hard blocker (quality ~55-60%,
// governance level 2/Reactive); operations = mature contrast (level 4/Managed,
// warehouse-driven); product = comfortably above the AI bar; supplier = high
// quality but low governance -> transitional-risk warning, not an AI blocker
// (not required by the use-case); finance = present for domain coverage only.
// ---------------------------------------------------------------------------

const domainItems: DomainItem[] = [
  {
    id: 'domain-customer',
    title: 'Dane klienta',
    description:
      'CRM + arkusz VIP + logi obsługi — rozjazd tożsamości klienta między systemami, brak wspólnego identyfikatora.',
    impact: 'high',
    effort: 'high',
    domain: 'customer',
    quality: {
      completeness: 0.6,
      accuracy: 0.55,
      consistency: 0.35,
      timeliness: 0.5,
      uniqueness: 0.7,
      integrity: 0.55,
      validity: 0.65,
      reasonableness: 0.6,
    },
    governanceLevel: 2,
    criticalForAi: true,
    aiReadiness: {
      availability: 0.65,
      quality: 0.55,
      structure: 0.45,
      governance: 0.4,
      useCaseAlignment: 0.75,
    },
  },
  {
    id: 'domain-product',
    title: 'Dane produktowe',
    description: 'ERP z imiennym właścicielem; aktualizowane przy wprowadzeniu nowego produktu.',
    impact: 'medium',
    effort: 'medium',
    domain: 'product',
    quality: {
      completeness: 0.85,
      accuracy: 0.82,
      consistency: 0.8,
      timeliness: 0.78,
      uniqueness: 0.9,
      integrity: 0.85,
      validity: 0.88,
      reasonableness: 0.8,
    },
    governanceLevel: 3,
    criticalForAi: true,
    aiReadiness: {
      availability: 0.85,
      quality: 0.82,
      structure: 0.82,
      governance: 0.78,
      useCaseAlignment: 0.78,
    },
  },
  {
    id: 'domain-operations',
    title: 'Dane operacyjne (zamówienia + magazyn)',
    description:
      'Historia transakcji (bez walidacji jakości) + dane magazynowe (audytowane, poziom 4) — wzorzec dyscypliny do replikacji na klienta.',
    impact: 'high',
    effort: 'medium',
    domain: 'operations',
    quality: {
      completeness: 0.75,
      accuracy: 0.7,
      consistency: 0.68,
      timeliness: 0.85,
      uniqueness: 0.8,
      integrity: 0.72,
      validity: 0.75,
      reasonableness: 0.78,
    },
    governanceLevel: 4,
    criticalForAi: true,
    aiReadiness: {
      availability: 0.9,
      quality: 0.8,
      structure: 0.82,
      governance: 0.8,
      useCaseAlignment: 0.85,
    },
  },
  {
    id: 'domain-finance',
    title: 'Dane finansowe',
    description: 'Fakturowanie i płatności; regularny audyt księgowy. Poza zakresem planowanego use-case AI.',
    impact: 'low',
    effort: 'low',
    domain: 'finance',
    quality: {
      completeness: 0.88,
      accuracy: 0.85,
      consistency: 0.84,
      timeliness: 0.8,
      uniqueness: 0.92,
      integrity: 0.88,
      validity: 0.9,
      reasonableness: 0.82,
    },
    governanceLevel: 4,
    criticalForAi: false,
  },
  {
    id: 'domain-supplier',
    title: 'Dane dostawców',
    description:
      'Wysoka jakość utrzymywana ręcznie przez doświadczonych kupców, ale bez formalnej polityki ani stewarda — stan tymczasowy.',
    impact: 'medium',
    effort: 'low',
    domain: 'supplier',
    quality: {
      completeness: 0.9,
      accuracy: 0.88,
      consistency: 0.85,
      timeliness: 0.82,
      uniqueness: 0.92,
      integrity: 0.87,
      validity: 0.9,
      reasonableness: 0.84,
    },
    governanceLevel: 2,
    criticalForAi: false,
  },
];

// ---------------------------------------------------------------------------
// Use case — the planned AI agent the readiness diagnosis is judged against.
// ---------------------------------------------------------------------------

const useCaseItems: UseCaseItem[] = [
  {
    id: 'usecase-demand-forecast',
    title: 'Agent AI: prognozowanie popytu i automatyzacja obsługi zamówień',
    description:
      'Zarząd pyta „czy nasze dane są gotowe?" przed decyzją o pilocie prognozy popytu (SKU) i automatyzacji przetwarzania zamówień.',
    impact: 'high',
    effort: 'high',
    requiresDomains: ['customer', 'operations', 'product'],
  },
];

// ---------------------------------------------------------------------------
// Fixture — assembled OperationalToolData
// ---------------------------------------------------------------------------

export const DATA_INVENTORY_FIXTURE: OperationalToolData = {
  context: createConsultingMissionContext({
    goal:
      'Ocenić, czy dane organizacji są gotowe pod pilota AI (prognoza popytu + automatyzacja obsługi zamówień) — i jeśli nie, zsekwencjonować naprawę przed startem pilota.',
    scope:
      'Firma dystrybucyjna B2B średniej wielkości; dane klienta (CRM + arkusz VIP + logi obsługi), dane produktowe (ERP), dane operacyjne (zamówienia + magazyn), dane finansowe i dostawców.',
    timeframe: 'medium',
    successSignal:
      'Domena klienta osiąga próg jakości AI (≥80%) i governance poziom 3+, rejestr aktywów domknięty (0 sierocych zbiorów wrażliwych), pilot rusza dopiero po Fazie 0.',
    assumptions:
      'Zarząd chce pilota AI „w tym kwartale"; handlowcy raportują, że CRM „w zasadzie działa"; nikt nie policzył jeszcze % sierocych zbiorów ani dark data.',
    constraints:
      'Zero dodatkowego budżetu na nowy system CRM w tym roku — naprawa musi odbyć się na istniejących systemach (konsolidacja + właściciele + walidacja), nie wymianą platformy.',
    kpiTarget: 'Gotowość AI domeny klienta ≥80% i governance ≥3/5 przed startem pilota prognozy popytu.',
  }),
  sections: {
    assets: assetItems,
    domains: domainItems,
    useCase: useCaseItems,
  },
};
