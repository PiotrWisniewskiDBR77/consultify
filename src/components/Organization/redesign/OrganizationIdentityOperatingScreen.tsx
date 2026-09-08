/**
 * „Tożsamość i model działania" — PIERWSZY realny ekran redesignu v1 (etap A).
 *
 * Powstaje z połączenia dwóch dzisiejszych ekranów Profilu (mapa konsolidacji
 * §2, pozycje #1 „Tożsamość i skala" + #2 „Model działania"). Cztery sekcje
 * ekranu = cztery pigułki Menu 2 z prototypu: Tożsamość · Skala · Model dostawy
 * · Rynki i systemy.
 *
 * DANE SĄ REALNE — te same wywołania co dotychczasowy `OrganizationProfileModule`:
 *   GET/PUT `/organization-profiles/:orgId` (+ readback po zapisie, 1:1 z legacy)
 *   GET `/organization-context` → liczba twierdzeń, konflikty per `claimPath`,
 *   znacznik ostatniej przebudowy snapshotu.
 * Taksonomia (typy organizacji, branże, modele) pochodzi z JEDNEGO źródła —
 * `organizationProfileTaxonomy.tsx` — wspólnego ze starym ekranem.
 *
 * Zapis: JEDEN przycisk „Zapisz zmiany" w prawym panelu stanu zapisuje KOMPLET
 * pól ekranu (a nie sekcja po sekcji) — §5.3 dokumentu konsolidacji.
 *
 * ZAKRES ETAPU A — świadomie NIE ma tu:
 *   - chipa „Zmienione dziś" (wymaga historii zmian per pole),
 *   - publikacji wersji kontekstu wykonywanej NA MIEJSCU (publikacja ma własne
 *     bramki uprawnień i preconditiony w „Źródła i twierdzenia" — przycisk
 *     prowadzi tam, zamiast dublować ścieżkę governance).
 */

import { BarChart3, Briefcase, Building2, Globe, Plus } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../../routes/routeConfig';
import { formatListDate } from '../../../utils/listDateFormat';
import { Api } from '../../../services/api';
import {
  type GovernedClaim,
  organizationGovernedContextApi,
} from '../../../services/organizationGovernedContextApi';
import { useAppStore } from '../../../store/useAppStore';
import {
  COMPANY_SIZES,
  computeCompleteness,
  CORE_SYSTEMS_OPTIONS,
  DELIVERY_MODELS,
  EMPTY_PROFILE,
  INDUSTRIES,
  optionKey,
  ORG_TYPES,
  type OrganizationType,
  type OrgProfile,
  REVENUE_MODELS,
  showCoreSystems,
  showDeliveryModel,
  showRevenueModel,
} from '../../../views/ContextBuilder/modules/organizationProfileTaxonomy';
import type { StandardCounterChip, StandardModuleTab } from '../../standard/StandardModuleBar';
import {
  OrgChoiceSegment,
  OrgFieldColumn,
  OrgFieldGrid,
  OrgListField,
  OrgSectionCard,
  OrgSelectField,
  OrgTagToggleGroup,
  OrgTextField,
} from './OrganizationCardPrimitives';
import type { OrganizationStatePanelProps } from './OrganizationStatePanel';

export type IdentityOperatingSection = 'identity' | 'scale' | 'delivery' | 'markets';

export const IDENTITY_OPERATING_SECTIONS: Array<{
  id: IdentityOperatingSection;
  /** Klucz i18n etykiety — literał nigdy nie trafia do JSX (PLAN §2 pkt 4). */
  labelKey: string;
  en: string;
}> = [
  { id: 'identity', labelKey: 'organization.redesign.sections.identity', en: 'Identity' },
  { id: 'scale', labelKey: 'organization.redesign.sections.scale', en: 'Scale' },
  { id: 'delivery', labelKey: 'organization.redesign.sections.delivery', en: 'Delivery model' },
  { id: 'markets', labelKey: 'organization.redesign.sections.markets', en: 'Markets & systems' },
];

interface OrgContextConflict {
  claimPath: string;
  values?: unknown[];
  sourceTypes?: string[];
}

interface OrgContextResponse {
  snapshotUpdatedAt?: string | null;
  schemaVersion?: number;
  counts?: { items?: number; claims?: number; conflicts?: number };
  conflicts?: OrgContextConflict[];
}

/** Pola ekranu — deklaratywnie, bo liczniki Menu 3 i filtr muszą je znać. */
interface ScreenField {
  id: keyof OrgProfile;
  section: IdentityOperatingSection;
  /** Klucz i18n etykiety pola — używany też przez wyszukiwarkę Menu 3. */
  labelKey: string;
  en: string;
  /** Ścieżka twierdzenia w kontekście organizacji — wiąże pole z konfliktem. */
  claimPath?: string;
}

const SCREEN_FIELDS: ScreenField[] = [
  {
    id: 'organization_type',
    section: 'identity',
    labelKey: 'organization.redesign.fields.organizationType', en: 'Organization type',
    claimPath: 'profile.organizationType',
  },
  { id: 'industry', section: 'identity', labelKey: 'organization.profile.fields.industry', en: 'Industry', claimPath: 'profile.industry' },
  {
    id: 'industry_subsector',
    section: 'identity',
    labelKey: 'organization.profile.fields.subIndustry', en: 'Sub-Industry',
    claimPath: 'profile.industrySubsector',
  },
  {
    id: 'industry_code',
    section: 'identity',
    labelKey: 'organization.profile.fields.industryCode', en: 'Industry Code',
    claimPath: 'profile.industryCode',
  },
  {
    id: 'description',
    section: 'identity',
    labelKey: 'organization.redesign.fields.organizationDescription', en: 'Organization description',
    claimPath: 'profile.description',
  },
  {
    id: 'companySize',
    section: 'scale',
    labelKey: 'organization.profile.fields.companySize', en: 'Company Size',
    claimPath: 'profile.companySize',
  },
  {
    id: 'employee_count',
    section: 'scale',
    labelKey: 'organization.profile.fields.employeeCount', en: 'Employee Count',
    claimPath: 'profile.employeeCount',
  },
  {
    id: 'annual_revenue',
    section: 'scale',
    labelKey: 'organization.profile.fields.annualRevenue', en: 'Annual Revenue',
    claimPath: 'profile.annualRevenue',
  },
  {
    id: 'founding_year',
    section: 'scale',
    labelKey: 'organization.profile.fields.foundingYear', en: 'Founding Year',
    claimPath: 'profile.foundingYear',
  },
  {
    id: 'headquarters_country',
    section: 'scale',
    labelKey: 'organization.profile.fields.headquartersCountry', en: 'Headquarters Country',
    claimPath: 'profile.location',
  },
  {
    id: 'delivery_model',
    section: 'delivery',
    labelKey: 'organization.profile.fields.deliveryModel', en: 'Delivery Model',
    claimPath: 'operations.deliveryModel',
  },
  {
    id: 'revenue_model',
    section: 'delivery',
    labelKey: 'organization.profile.fields.revenueFundingModel', en: 'Revenue / Funding Model',
    claimPath: 'profile.revenueModel',
  },
  { id: 'primary_markets', section: 'markets', labelKey: 'organization.profile.fields.primaryMarkets', en: 'Primary Markets' },
  { id: 'customer_segments', section: 'markets', labelKey: 'organization.profile.fields.customerSegments', en: 'Customer Segments' },
  { id: 'key_competitors', section: 'markets', labelKey: 'organization.profile.fields.keyCompetitors', en: 'Key Competitors' },
  {
    id: 'core_systems',
    section: 'markets',
    labelKey: 'organization.profile.fields.coreSystems', en: 'Core Systems',
    claimPath: 'systems.coreSystems',
  },
];

function fieldById(id: keyof OrgProfile): ScreenField {
  const found = SCREEN_FIELDS.find((field) => field.id === id);
  if (!found) throw new Error(`Unknown screen field: ${String(id)}`);
  return found;
}

function isFilled(profile: OrgProfile, field: keyof OrgProfile): boolean {
  const value = profile[field];
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return String(value ?? '').trim().length > 0;
}

/**
 * Data pochodzenia faktu — locale z KONTA (SSOT `listDateFormat`), nigdy
 * `pl-PL` na sztywno: użytkownik EN dostawał polski zapis daty (K7).
 */
function formatClaimDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const sformatowana = formatListDate(iso, '');
  return sformatowana || null;
}

/**
 * Typ źródła twierdzenia = ENUM z serwera → SŁOWNIK kluczy i18n (PLAN §2 pkt 6).
 * Zakaz renderowania surowej wartości i zakaz polskiej etykiety w kodzie.
 */
const SOURCE_TYPE_KEYS: Record<string, string> = {
  document: 'organization.redesign.sourceType.document',
  interview_answer: 'organization.redesign.sourceType.interview_answer',
  interview_context: 'organization.redesign.sourceType.interview_context',
  manual_entry: 'organization.redesign.sourceType.manual_entry',
  organization_profile: 'organization.redesign.sourceType.organization_profile',
};

/** Pochodzenie faktu (prototyp `.prov`): „Źródło · zatwierdzone/data". */
function formatProvenance(
  claim: GovernedClaim | undefined,
  t: TFunction
): string | undefined {
  if (!claim) return undefined;
  const sourceKey = SOURCE_TYPE_KEYS[claim.sourceType];
  const sourceLabel = sourceKey ? t(sourceKey) : claim.sourceType;
  const date = formatClaimDate(claim.decidedAt ?? claim.createdAt);
  const approval = claim.approved
    ? t('organization.redesign.provenance.approved', 'approved')
    : t('organization.redesign.provenance.notApproved', 'not approved');
  return date ? `${sourceLabel} · ${approval} ${date}` : `${sourceLabel} · ${approval}`;
}

/** Dla każdej ścieżki twierdzenia — najlepsze twierdzenie do pokazania jako pochodzenie: zatwierdzone przed niezatwierdzonym, potem najnowsze. */
function bestClaimByPath(claims: GovernedClaim[]): Map<string, GovernedClaim> {
  const map = new Map<string, GovernedClaim>();
  for (const claim of claims) {
    const current = map.get(claim.claimPath);
    if (!current) {
      map.set(claim.claimPath, claim);
      continue;
    }
    const currentRank = current.approved ? 1 : 0;
    const claimRank = claim.approved ? 1 : 0;
    if (
      claimRank > currentRank ||
      (claimRank === currentRank &&
        new Date(claim.createdAt).getTime() > new Date(current.createdAt).getTime())
    ) {
      map.set(claim.claimPath, claim);
    }
  }
  return map;
}

function formatRelative(iso: string | null | undefined, t: TFunction): string {
  if (!iso) return t('organization.redesign.relative.never', 'never');
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return t('organization.redesign.relative.never', 'never');
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return t('organization.redesign.relative.justNow', 'just now');
  if (minutes < 60) return t('organization.redesign.relative.minutesAgo', '{{count}} min ago', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('organization.redesign.relative.hoursAgo', '{{count}} h ago', { count: hours });
  return t('organization.redesign.relative.daysAgo', '{{count}} days ago', { count: Math.floor(hours / 24) });
}

export interface IdentityOperatingScreenRenderArgs {
  sections: StandardModuleTab[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  chips: StandardCounterChip[];
  activeChip: string;
  onChipChange: (id: string) => void;
  searchValue: string;
  onSearch: (query: string) => void;
  primaryCta: { label: string; icon: typeof Plus; onClick: () => void };
  statePanel: OrganizationStatePanelProps;
  content: React.ReactNode;
}

/**
 * Ekran oddaje sterowanie paskiem i panelem na zewnątrz (render-prop), bo to
 * `OrganizationScreenShell` jest właścicielem Menu 2/Menu 3 i prawej kolumny —
 * ekran wyłącznie DEKLARUJE, czym je wypełnić.
 */
export const OrganizationIdentityOperatingScreen: React.FC<{
  children: (args: IdentityOperatingScreenRenderArgs) => React.ReactNode;
}> = ({ children }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, currentOrganization } = useAppStore();
  const orgId = currentOrganization?.id || currentUser?.organizationId;

  const [profile, setProfile] = useState<OrgProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [context, setContext] = useState<OrgContextResponse | null>(null);
  const [claims, setClaims] = useState<GovernedClaim[]>([]);
  const [activeSection, setActiveSection] = useState<IdentityOperatingSection>('identity');
  const [activeChip, setActiveChip] = useState<string>('all');
  const [searchValue, setSearchValue] = useState('');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await Api.get(`/organization-profiles/${orgId}`);
        if (cancelled) return;
        if (res?.exists && res.profile) {
          const arrayFields = [
            'strategic_priorities',
            'technology_stack',
            'core_systems',
            'primary_markets',
            'customer_segments',
            'key_competitors',
            'regulatory_environment',
          ] as const;
          const parsed: Partial<OrgProfile> = { ...res.profile };
          for (const field of arrayFields) {
            (parsed as Record<string, unknown>)[field] = Array.isArray(res.profile[field])
              ? res.profile[field]
              : [];
          }
          setProfile((previous) => ({ ...previous, ...parsed }));
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = (await Api.organizationContextGet()) as OrgContextResponse;
        if (!cancelled) setContext(data || null);
      } catch {
        // Kontekst jest dodatkiem do ekranu — brak snapshotu nie może go zablokować.
        if (!cancelled) setContext(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await organizationGovernedContextApi.listClaims();
        if (!cancelled) setClaims(Array.isArray(rows) ? rows : []);
      } catch {
        // Pochodzenie faktu jest dodatkiem do pola — brak twierdzeń nie może zablokować ekranu.
        if (!cancelled) setClaims([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const bestClaimByClaimPath = useMemo(() => bestClaimByPath(claims), [claims]);

  const provenanceFor = useCallback(
    (id: keyof OrgProfile) => {
      const field = fieldById(id);
      if (!field.claimPath) return undefined;
      return formatProvenance(bestClaimByClaimPath.get(field.claimPath), t);
    },
    [bestClaimByClaimPath, t]
  );

  const update = useCallback(<K extends keyof OrgProfile>(field: K, value: OrgProfile[K]) => {
    setProfile((previous) => ({ ...previous, [field]: value }));
  }, []);

  const orgType = profile.organization_type as OrganizationType;

  const visibleFields = useMemo(
    () =>
      SCREEN_FIELDS.filter((field) => {
        if (field.id === 'delivery_model') return showDeliveryModel(orgType);
        if (field.id === 'revenue_model') return showRevenueModel(orgType);
        if (field.id === 'core_systems') return showCoreSystems(orgType);
        return true;
      }),
    [orgType]
  );

  const conflictByClaimPath = useMemo(() => {
    const map = new Map<string, OrgContextConflict>();
    for (const conflict of context?.conflicts ?? []) {
      if (conflict?.claimPath) map.set(conflict.claimPath, conflict);
    }
    return map;
  }, [context]);

  const fieldConflict = useCallback(
    (field: ScreenField) =>
      field.claimPath ? conflictByClaimPath.get(field.claimPath) : undefined,
    [conflictByClaimPath]
  );

  const counts = useMemo(() => {
    const filled = visibleFields.filter((field) => isFilled(profile, field.id));
    const conflicts = visibleFields.filter((field) => !!fieldConflict(field));
    return {
      all: visibleFields.length,
      filled: filled.length,
      missing: visibleFields.length - filled.length,
      conflicts: conflicts.length,
    };
  }, [fieldConflict, profile, visibleFields]);

  const matchesChip = useCallback(
    (field: ScreenField) => {
      if (activeChip === 'filled') return isFilled(profile, field.id);
      if (activeChip === 'missing') return !isFilled(profile, field.id);
      if (activeChip === 'conflicts') return !!fieldConflict(field);
      return true;
    },
    [activeChip, fieldConflict, profile]
  );

  const matchesSearch = useCallback(
    (field: ScreenField) => {
      const query = searchValue.trim().toLowerCase();
      if (!query) return true;
      // Wyszukiwarka Menu 3 filtruje po etykiecie W JĘZYKU UŻYTKOWNIKA — inaczej
      // użytkownik EN musiałby wpisać polskie słowo, żeby cokolwiek znaleźć.
      return t(field.labelKey, field.en).toLowerCase().includes(query);
    },
    [searchValue, t]
  );

  const shownFields = useMemo(
    () => visibleFields.filter((field) => matchesChip(field) && matchesSearch(field)),
    [matchesChip, matchesSearch, visibleFields]
  );

  const shows = useCallback(
    (id: keyof OrgProfile) => shownFields.some((field) => field.id === id),
    [shownFields]
  );

  const sectionHasContent = useCallback(
    (section: IdentityOperatingSection) => shownFields.some((field) => field.section === section),
    [shownFields]
  );

  /**
   * Widoczność pigułki zakładki NIE MOŻE zależeć od filtra chipów/wyszukiwarki
   * (inaczej pigułka migałaby przy każdej zmianie filtra) — liczy się tylko,
   * czy dla bieżącego typu organizacji („Model dostawy" jest warunkowy przez
   * `showDeliveryModel`/`showRevenueModel`) ISTNIEJE choć jedno pole. Defekt
   * odbioru na żywo 05.09: „Model dostawy" była martwą pigułką (podświetlała
   * się, ale treść się nie zmieniała) dla organizacji bez ustawionego typu —
   * `sectionHasContent('delivery')` było `false`, więc `<div ref=.../>` nigdy
   * się nie renderował i nie było czego przewinąć. Rozwiązanie: nie pokazuj
   * pigułki zakładki, która nie ma treści dla tego typu organizacji (tak jak
   * stary ekran warunkowo chował całą sekcję „Model operacji" z nawigacji).
   */
  const sectionApplicable = useCallback(
    (section: IdentityOperatingSection) => visibleFields.some((field) => field.section === section),
    [visibleFields]
  );

  const handleSectionChange = useCallback((id: string) => {
    setActiveSection(id as IdentityOperatingSection);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleSave = useCallback(async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const completeness = computeCompleteness(profile);
      await Api.put(`/organization-profiles/${orgId}`, {
        ...profile,
        profile_completeness: completeness,
      });
      // Readback 1:1 ze starym ekranem: „zapisane" znaczy „odczytane z bazy".
      const readback = await Api.get(`/organization-profiles/${orgId}`);
      const persisted = Number(readback?.profile?.profile_completeness);
      if (!readback?.exists || !readback?.profile || persisted !== completeness) {
        throw new Error(
          t(
            'organization.profile.readbackFailed',
            'Save request completed, but durable profile readback could not be verified.'
          )
        );
      }
      setProfile((previous) => ({ ...previous, ...readback.profile }));
      toast.success(t('organization.profile.saved', 'Profile saved'));
    } catch (error) {
      toast.error(
        (error as Error)?.message || t('organization.profile.saveFailed', 'Failed to save')
      );
    } finally {
      setSaving(false);
    }
  }, [orgId, profile, t]);

  const goToSources = useCallback(() => {
    navigate(`${ROUTES.ORGANIZATION.ROOT}/sources/claims-sources`);
  }, [navigate]);

  const registerSection = (id: IdentityOperatingSection) => (node: HTMLDivElement | null) => {
    sectionRefs.current[id] = node;
  };

  const conflictStatus = (field: ScreenField) => {
    const conflict = fieldConflict(field);
    if (!conflict) return undefined;
    const values = conflict.values?.length ?? 0;
    return {
      tone: 'warning' as const,
      label: t('organization.redesign.status.conflictingValues', '{{count}} conflicting values from sources', { count: values }),
    };
  };

  const sections: StandardModuleTab[] = IDENTITY_OPERATING_SECTIONS.filter((section) =>
    sectionApplicable(section.id)
  ).map((section) => ({
    id: section.id,
    label: t(section.labelKey, section.en),
  }));

  // Jeżeli aktywna zakładka zniknęła (np. użytkownik wyczyścił „Typ
  // organizacji", a był na „Model dostawy"), wróć na pierwszą dostępną —
  // nigdy nie zostawiaj podświetlonej pigułki bez odpowiadającej treści.
  useEffect(() => {
    if (sections.length === 0) return;
    if (!sections.some((section) => section.id === activeSection)) {
      setActiveSection(sections[0].id as IdentityOperatingSection);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.map((section) => section.id).join('|')]);

  const chips: StandardCounterChip[] = [
    { id: 'all', label: t('organization.redesign.chips.all', 'All'), count: counts.all },
    { id: 'filled', label: t('organization.redesign.chips.filled', 'Filled in'), count: counts.filled },
    { id: 'missing', label: t('organization.redesign.chips.missing', 'To fill in'), count: counts.missing },
    { id: 'conflicts', label: t('organization.redesign.chips.conflicts', 'Conflicts'), count: counts.conflicts },
  ];

  const statePanel: OrganizationStatePanelProps = {
    versionLabel: context?.schemaVersion ? `v${context.schemaVersion}` : undefined,
    filledFields: counts.filled,
    totalFields: counts.all,
    approvedFacts: context?.counts?.claims,
    decisions: (context?.conflicts ?? [])
      .filter((conflict) =>
        visibleFields.some((field) => field.claimPath && field.claimPath === conflict.claimPath)
      )
      .slice(0, 5)
      .map((conflict) => ({
        id: conflict.claimPath,
        field: conflict.claimPath,
        detail: t('organization.redesign.status.conflictingValuesDetail', '{{count}} values from sources do not agree', {
          count: conflict.values?.length ?? 0,
        }),
      })),
    onResolveDecisions: goToSources,
    sourcesSummary:
      typeof context?.counts?.claims === 'number'
        ? t('organization.redesign.sources.claimsCount', '{{count}} claims', { count: context.counts.claims })
        : undefined,
    sources: context
      ? [
          {
            id: 'context-items',
            label: t('organization.redesign.sources.contextItems', 'Context items'),
            detail: t('organization.redesign.sources.contextItemsDetail', '{{count}} source records', {
              count: context.counts?.items ?? 0,
            }),
            status: (context.counts?.conflicts ?? 0) > 0 ? 'warning' : 'ok',
            statusLabel:
              (context.counts?.conflicts ?? 0) > 0
                ? t('organization.redesign.sources.conflicts', 'Conflicts')
                : 'OK',
          },
          {
            id: 'context-updated',
            label: t('organization.redesign.sources.lastUpdate', 'Last update'),
            detail: formatRelative(context.snapshotUpdatedAt, t),
          },
        ]
      : [],
    onShowFieldSources: goToSources,
    onSave: handleSave,
    saving,
    onPublish: goToSources,
  };

  const deliveryMissingCount = visibleFields.filter(
    (field) => field.section === 'delivery' && !isFilled(profile, field.id)
  ).length;

  const content = loading ? (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-c-border-subtle bg-c-surface p-6 text-[13px] text-c-text-muted"
    >
      {t('organization.redesign.loading.profile', 'Loading the organization profile…')}
    </div>
  ) : (
    <>
      {sectionHasContent('identity') && (
        <div ref={registerSection('identity')}>
          <OrgSectionCard
            id="identity"
            title={t('organization.redesign.sections.identity', 'Identity')}
            icon={Building2}
            lead={t('organization.redesign.identity.lead', 'The organization type decides what Teresa asks about next.')}
            status={
              counts.conflicts > 0
                ? {
                    tone: 'warning',
                    label: t('organization.redesign.status.sourceConflicts', '{{count}} source conflicts', {
                      count: counts.conflicts,
                    }),
                  }
                : undefined
            }
            techDetails={
              orgId
                ? [{ label: t('organization.redesign.techDetails.orgId', 'Organization identifier'), value: orgId }]
                : undefined
            }
          >
            {shows('organization_type') && (
              <div className="mb-4">
                <OrgChoiceSegment
                  label={t('organization.redesign.fields.organizationType', 'Organization type')}
                  value={profile.organization_type}
                  options={ORG_TYPES.map((type) => ({
                    value: type.value as string,
                    label: t(
                      `organization.profile.options.organizationType.${type.value}.label`,
                      type.label
                    ),
                  }))}
                  onChange={(value) =>
                    update('organization_type', value as OrgProfile['organization_type'])
                  }
                />
              </div>
            )}
            <OrgFieldGrid>
              <OrgFieldColumn>
                {shows('industry') && (
                  <OrgSelectField
                    id="org-industry"
                    label={t('organization.profile.fields.industry', 'Industry')}
                    value={profile.industry}
                    status={conflictStatus(fieldById('industry'))}
                    provenance={provenanceFor('industry')}
                    options={INDUSTRIES.map((industry) => ({
                      value: industry,
                      label: t(
                        `organization.profile.options.industry.${optionKey(industry)}`,
                        industry
                      ),
                    }))}
                    onChange={(value) => update('industry', value)}
                  />
                )}
                {shows('industry_subsector') && (
                  <OrgTextField
                    id="org-subsector"
                    label={t('organization.profile.fields.subIndustry', 'Sub-Industry')}
                    value={profile.industry_subsector}
                    onChange={(value) => update('industry_subsector', value)}
                  />
                )}
                {shows('industry_code') && (
                  <OrgTextField
                    id="org-industry-code"
                    label={t('organization.profile.fields.industryCode', 'Industry Code')}
                    value={profile.industry_code}
                    onChange={(value) => update('industry_code', value)}
                  />
                )}
              </OrgFieldColumn>
              <OrgFieldColumn>
                {shows('description') && (
                  <OrgTextField
                    id="org-description"
                    label={t('organization.redesign.fields.organizationDescription', 'Organization description')}
                    multiline
                    value={profile.description}
                    status={conflictStatus(fieldById('description'))}
                    provenance={provenanceFor('description')}
                    onChange={(value) => update('description', value)}
                  />
                )}
              </OrgFieldColumn>
            </OrgFieldGrid>
          </OrgSectionCard>
        </div>
      )}

      {sectionHasContent('scale') && (
        <div ref={registerSection('scale')}>
          <OrgSectionCard
            id="scale"
            title={t('organization.redesign.sections.scale', 'Scale')}
            icon={BarChart3}
          >
            <OrgFieldGrid>
              <OrgFieldColumn>
                {shows('companySize') && (
                  <OrgSelectField
                    id="org-company-size"
                    label={t('organization.profile.fields.companySize', 'Company Size')}
                    value={profile.companySize}
                    provenance={provenanceFor('companySize')}
                    options={COMPANY_SIZES.map((size) => ({
                      value: size.value,
                      label: t(
                        `organization.profile.options.companySize.${size.value}`,
                        size.label
                      ),
                    }))}
                    onChange={(value) => update('companySize', value)}
                  />
                )}
                {shows('employee_count') && (
                  <OrgTextField
                    id="org-employee-count"
                    label={t('organization.profile.fields.employeeCount', 'Employee Count')}
                    type="number"
                    value={profile.employee_count === null ? '' : String(profile.employee_count)}
                    onChange={(value) =>
                      update('employee_count', value ? Number.parseInt(value, 10) : null)
                    }
                  />
                )}
                {shows('annual_revenue') && (
                  <OrgTextField
                    id="org-annual-revenue"
                    label={t('organization.profile.fields.annualRevenue', 'Annual Revenue')}
                    type="number"
                    value={profile.annual_revenue === null ? '' : String(profile.annual_revenue)}
                    onChange={(value) =>
                      update('annual_revenue', value ? Number.parseFloat(value) : null)
                    }
                  />
                )}
              </OrgFieldColumn>
              <OrgFieldColumn>
                {shows('headquarters_country') && (
                  <OrgTextField
                    id="org-hq-country"
                    label={t('organization.profile.fields.headquartersCountry', 'Headquarters Country')}
                    value={profile.headquarters_country}
                    onChange={(value) => update('headquarters_country', value)}
                  />
                )}
                {shows('founding_year') && (
                  <OrgTextField
                    id="org-founding-year"
                    label={t('organization.profile.fields.foundingYear', 'Founding Year')}
                    type="number"
                    value={profile.founding_year === null ? '' : String(profile.founding_year)}
                    onChange={(value) =>
                      update('founding_year', value ? Number.parseInt(value, 10) : null)
                    }
                  />
                )}
              </OrgFieldColumn>
            </OrgFieldGrid>
          </OrgSectionCard>
        </div>
      )}

      {sectionHasContent('delivery') && (
        <div ref={registerSection('delivery')}>
          <OrgSectionCard
            id="delivery"
            title={t('organization.redesign.sections.delivery', 'Delivery model')}
            icon={Briefcase}
            status={
              deliveryMissingCount > 0
                ? {
                    tone: 'muted',
                    label: t('organization.redesign.status.fieldsToFill', '{{count}} fields to fill in', {
                      count: deliveryMissingCount,
                    }),
                  }
                : undefined
            }
          >
            <OrgFieldGrid>
              <OrgFieldColumn>
                {shows('delivery_model') && (
                  <OrgSelectField
                    id="org-delivery-model"
                    label={t('organization.profile.fields.deliveryModel', 'Delivery Model')}
                    value={profile.delivery_model}
                    provenance={provenanceFor('delivery_model')}
                    options={DELIVERY_MODELS.map((model) => ({
                      value: model,
                      label: t(
                        `organization.profile.options.deliveryModel.${optionKey(model)}`,
                        model
                      ),
                    }))}
                    onChange={(value) => update('delivery_model', value)}
                  />
                )}
              </OrgFieldColumn>
              <OrgFieldColumn>
                {shows('revenue_model') && (
                  <OrgSelectField
                    id="org-revenue-model"
                    label={t('organization.profile.fields.revenueFundingModel', 'Revenue / Funding Model')}
                    value={profile.revenue_model}
                    provenance={provenanceFor('revenue_model')}
                    options={REVENUE_MODELS.map((model) => ({
                      value: model,
                      label: t(
                        `organization.profile.options.revenueModel.${optionKey(model)}`,
                        model
                      ),
                    }))}
                    onChange={(value) => update('revenue_model', value)}
                  />
                )}
              </OrgFieldColumn>
            </OrgFieldGrid>
          </OrgSectionCard>
        </div>
      )}

      {sectionHasContent('markets') && (
        <div ref={registerSection('markets')}>
          <OrgSectionCard
            id="markets"
            title={t('organization.redesign.sections.marketsFull', 'Markets & core systems')}
            icon={Globe}
          >
            <OrgFieldGrid className="mb-4">
              <OrgFieldColumn>
                {shows('primary_markets') && (
                  <OrgListField
                    id="org-primary-markets"
                    label={t('organization.profile.fields.primaryMarkets', 'Primary Markets')}
                    value={profile.primary_markets}
                    onChange={(value) => update('primary_markets', value)}
                  />
                )}
                {shows('customer_segments') && (
                  <OrgListField
                    id="org-customer-segments"
                    label={t('organization.profile.fields.customerSegments', 'Customer Segments')}
                    value={profile.customer_segments}
                    onChange={(value) => update('customer_segments', value)}
                  />
                )}
              </OrgFieldColumn>
              <OrgFieldColumn>
                {shows('key_competitors') && (
                  <OrgListField
                    id="org-key-competitors"
                    label={t('organization.profile.fields.keyCompetitors', 'Key Competitors')}
                    value={profile.key_competitors}
                    onChange={(value) => update('key_competitors', value)}
                  />
                )}
              </OrgFieldColumn>
            </OrgFieldGrid>
            {shows('core_systems') && (
              <OrgTagToggleGroup
                label={t('organization.profile.fields.coreSystems', 'Core Systems')}
                options={CORE_SYSTEMS_OPTIONS}
                value={profile.core_systems}
                onChange={(value) => update('core_systems', value)}
              />
            )}
          </OrgSectionCard>
        </div>
      )}

      {shownFields.length === 0 && (
        <p className="rounded-xl border border-c-border-subtle bg-c-surface p-6 text-[13px] text-c-text-muted">
          {t('organization.redesign.filter.noMatch', 'No field on this screen matches the selected filter.')}
        </p>
      )}
    </>
  );

  return (
    <>
      {children({
        sections,
        activeSection,
        onSectionChange: handleSectionChange,
        chips,
        activeChip,
        onChipChange: setActiveChip,
        searchValue,
        onSearch: setSearchValue,
        primaryCta: {
          label: t('organization.redesign.cta.addSource', 'Add source'),
          icon: Plus,
          onClick: goToSources,
        },
        statePanel,
        content,
      })}
    </>
  );
};

export default OrganizationIdentityOperatingScreen;
