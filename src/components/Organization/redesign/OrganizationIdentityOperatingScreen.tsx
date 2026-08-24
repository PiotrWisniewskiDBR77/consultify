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
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../../routes/routeConfig';
import { Api } from '../../../services/api';
import { useAppStore } from '../../../store/useAppStore';
import {
  COMPANY_SIZES,
  CORE_SYSTEMS_OPTIONS,
  DELIVERY_MODELS,
  EMPTY_PROFILE,
  INDUSTRIES,
  ORG_TYPES,
  REVENUE_MODELS,
  computeCompleteness,
  optionKey,
  showCoreSystems,
  showDeliveryModel,
  showRevenueModel,
  type OrganizationType,
  type OrgProfile,
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
  label: string;
}> = [
  { id: 'identity', label: 'Tożsamość' },
  { id: 'scale', label: 'Skala' },
  { id: 'delivery', label: 'Model dostawy' },
  { id: 'markets', label: 'Rynki i systemy' },
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
  label: string;
  /** Ścieżka twierdzenia w kontekście organizacji — wiąże pole z konfliktem. */
  claimPath?: string;
}

const SCREEN_FIELDS: ScreenField[] = [
  { id: 'organization_type', section: 'identity', label: 'Typ organizacji', claimPath: 'profile.organizationType' },
  { id: 'industry', section: 'identity', label: 'Branża', claimPath: 'profile.industry' },
  { id: 'industry_subsector', section: 'identity', label: 'Podbranża', claimPath: 'profile.industrySubsector' },
  { id: 'industry_code', section: 'identity', label: 'Kod branży (PKD)', claimPath: 'profile.industryCode' },
  { id: 'description', section: 'identity', label: 'Opis organizacji', claimPath: 'profile.description' },
  { id: 'companySize', section: 'scale', label: 'Wielkość firmy', claimPath: 'profile.companySize' },
  { id: 'employee_count', section: 'scale', label: 'Liczba pracowników', claimPath: 'profile.employeeCount' },
  { id: 'annual_revenue', section: 'scale', label: 'Przychód roczny', claimPath: 'profile.annualRevenue' },
  { id: 'founding_year', section: 'scale', label: 'Rok założenia', claimPath: 'profile.foundingYear' },
  { id: 'headquarters_country', section: 'scale', label: 'Kraj siedziby', claimPath: 'profile.location' },
  { id: 'delivery_model', section: 'delivery', label: 'Model dostarczania', claimPath: 'operations.deliveryModel' },
  { id: 'revenue_model', section: 'delivery', label: 'Model przychodowy / finansowania', claimPath: 'profile.revenueModel' },
  { id: 'primary_markets', section: 'markets', label: 'Rynki podstawowe' },
  { id: 'customer_segments', section: 'markets', label: 'Segmenty klientów' },
  { id: 'key_competitors', section: 'markets', label: 'Kluczowi konkurenci' },
  { id: 'core_systems', section: 'markets', label: 'Systemy rdzeniowe', claimPath: 'systems.coreSystems' },
];

function fieldById(id: keyof OrgProfile): ScreenField {
  const found = SCREEN_FIELDS.find((field) => field.id === id);
  if (!found) throw new Error(`Nieznane pole ekranu: ${String(id)}`);
  return found;
}

function isFilled(profile: OrgProfile, field: keyof OrgProfile): boolean {
  const value = profile[field];
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return String(value ?? '').trim().length > 0;
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'nigdy';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'nigdy';
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return 'przed chwilą';
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;
  return `${Math.floor(hours / 24)} dni temu`;
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
    (field: ScreenField) => (field.claimPath ? conflictByClaimPath.get(field.claimPath) : undefined),
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
      return field.label.toLowerCase().includes(query);
    },
    [searchValue]
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
      toast.success(t('organization.profile.saved', 'Profil zapisany'));
    } catch (error) {
      toast.error(
        (error as Error)?.message || t('organization.profile.saveFailed', 'Nie udało się zapisać')
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
      label: `${values} niezgodnych wartości ze źródeł`,
    };
  };

  const sections: StandardModuleTab[] = IDENTITY_OPERATING_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
  }));

  const chips: StandardCounterChip[] = [
    { id: 'all', label: 'Wszystkie', count: counts.all },
    { id: 'filled', label: 'Uzupełnione', count: counts.filled },
    { id: 'missing', label: 'Do uzupełnienia', count: counts.missing },
    { id: 'conflicts', label: 'Konflikty', count: counts.conflicts },
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
        detail: `${conflict.values?.length ?? 0} wartości ze źródeł jest niezgodnych`,
      })),
    onResolveDecisions: goToSources,
    sourcesSummary:
      typeof context?.counts?.claims === 'number' ? `${context.counts.claims} twierdzeń` : undefined,
    sources: context
      ? [
          {
            id: 'context-items',
            label: 'Elementy kontekstu',
            detail: `${context.counts?.items ?? 0} pozycji źródłowych`,
            status: (context.counts?.conflicts ?? 0) > 0 ? 'warning' : 'ok',
            statusLabel: (context.counts?.conflicts ?? 0) > 0 ? 'Konflikty' : 'OK',
          },
          {
            id: 'context-updated',
            label: 'Ostatnia aktualizacja',
            detail: formatRelative(context.snapshotUpdatedAt),
          },
        ]
      : [],
    onShowFieldSources: goToSources,
    onSave: handleSave,
    saving,
    onPublish: goToSources,
  };

  const content = loading ? (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-c-border-subtle bg-c-surface p-6 text-[13px] text-c-text-muted"
    >
      Wczytywanie profilu organizacji…
    </div>
  ) : (
    <>
      {sectionHasContent('identity') && (
        <div ref={registerSection('identity')}>
          <OrgSectionCard
            id="identity"
            title="Tożsamość"
            icon={Building2}
            lead="Typ organizacji ustala, o co Teresa pyta dalej."
            status={
              counts.conflicts > 0
                ? { tone: 'warning', label: `${counts.conflicts} konfliktów źródeł` }
                : undefined
            }
          >
            {shows('organization_type') && (
              <div className="mb-4">
                <OrgChoiceSegment
                  label="Typ organizacji"
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
                    label="Branża"
                    value={profile.industry}
                    status={conflictStatus(fieldById("industry"))}
                    options={INDUSTRIES.map((industry) => ({
                      value: industry,
                      label: t(`organization.profile.options.industry.${optionKey(industry)}`, industry),
                    }))}
                    onChange={(value) => update('industry', value)}
                  />
                )}
                {shows('industry_subsector') && (
                  <OrgTextField
                    id="org-subsector"
                    label="Podbranża"
                    value={profile.industry_subsector}
                    onChange={(value) => update('industry_subsector', value)}
                  />
                )}
                {shows('industry_code') && (
                  <OrgTextField
                    id="org-industry-code"
                    label="Kod branży (PKD)"
                    value={profile.industry_code}
                    onChange={(value) => update('industry_code', value)}
                  />
                )}
              </OrgFieldColumn>
              <OrgFieldColumn>
                {shows('description') && (
                  <OrgTextField
                    id="org-description"
                    label="Opis organizacji"
                    multiline
                    value={profile.description}
                    status={conflictStatus(fieldById("description"))}
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
          <OrgSectionCard id="scale" title="Skala" icon={BarChart3}>
            <OrgFieldGrid>
              <OrgFieldColumn>
                {shows('companySize') && (
                  <OrgSelectField
                    id="org-company-size"
                    label="Wielkość firmy"
                    value={profile.companySize}
                    options={COMPANY_SIZES.map((size) => ({
                      value: size.value,
                      label: t(`organization.profile.options.companySize.${size.value}`, size.label),
                    }))}
                    onChange={(value) => update('companySize', value)}
                  />
                )}
                {shows('employee_count') && (
                  <OrgTextField
                    id="org-employee-count"
                    label="Liczba pracowników"
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
                    label="Przychód roczny"
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
                    label="Kraj siedziby"
                    value={profile.headquarters_country}
                    onChange={(value) => update('headquarters_country', value)}
                  />
                )}
                {shows('founding_year') && (
                  <OrgTextField
                    id="org-founding-year"
                    label="Rok założenia"
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
            title="Model dostawy"
            icon={Briefcase}
            status={
              !isFilled(profile, 'delivery_model') || !isFilled(profile, 'revenue_model')
                ? { tone: 'muted', label: 'pola do uzupełnienia' }
                : undefined
            }
          >
            <OrgFieldGrid>
              <OrgFieldColumn>
                {shows('delivery_model') && (
                  <OrgSelectField
                    id="org-delivery-model"
                    label="Model dostarczania"
                    value={profile.delivery_model}
                    options={DELIVERY_MODELS.map((model) => ({
                      value: model,
                      label: t(`organization.profile.options.deliveryModel.${optionKey(model)}`, model),
                    }))}
                    onChange={(value) => update('delivery_model', value)}
                  />
                )}
              </OrgFieldColumn>
              <OrgFieldColumn>
                {shows('revenue_model') && (
                  <OrgSelectField
                    id="org-revenue-model"
                    label="Model przychodowy / finansowania"
                    value={profile.revenue_model}
                    options={REVENUE_MODELS.map((model) => ({
                      value: model,
                      label: t(`organization.profile.options.revenueModel.${optionKey(model)}`, model),
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
          <OrgSectionCard id="markets" title="Rynki i systemy rdzeniowe" icon={Globe}>
            <OrgFieldGrid className="mb-4">
              <OrgFieldColumn>
                {shows('primary_markets') && (
                  <OrgListField
                    id="org-primary-markets"
                    label="Rynki podstawowe"
                    value={profile.primary_markets}
                    onChange={(value) => update('primary_markets', value)}
                  />
                )}
                {shows('customer_segments') && (
                  <OrgListField
                    id="org-customer-segments"
                    label="Segmenty klientów"
                    value={profile.customer_segments}
                    onChange={(value) => update('customer_segments', value)}
                  />
                )}
              </OrgFieldColumn>
              <OrgFieldColumn>
                {shows('key_competitors') && (
                  <OrgListField
                    id="org-key-competitors"
                    label="Kluczowi konkurenci"
                    value={profile.key_competitors}
                    onChange={(value) => update('key_competitors', value)}
                  />
                )}
              </OrgFieldColumn>
            </OrgFieldGrid>
            {shows('core_systems') && (
              <OrgTagToggleGroup
                label="Systemy rdzeniowe"
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
          Żadne pole tego ekranu nie pasuje do wybranego filtra.
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
        primaryCta: { label: 'Dodaj źródło', icon: Plus, onClick: goToSources },
        statePanel,
        content,
      })}
    </>
  );
};

export default OrganizationIdentityOperatingScreen;
