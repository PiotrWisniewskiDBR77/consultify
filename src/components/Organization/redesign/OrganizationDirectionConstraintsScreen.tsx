/**
 * „Kierunek i ograniczenia" — DRUGI realny ekran redesignu v1 (etap B).
 *
 * Powstaje z połączenia dwóch dzisiejszych ekranów Profilu (mapa konsolidacji
 * §2, pozycje #3 „Pozycja i kierunek" + #4 „Technologia, kultura i ograniczenia").
 * Cztery sekcje ekranu = cztery pigułki Menu 2, dokładnie te same obszary co
 * w starym `OrganizationProfileModule` (`PROFILE_SCREEN_AREAS['position-direction']`
 * = `['strategic']`, `PROFILE_SCREEN_AREAS['technology-culture-constraints']`
 * = `['digital', 'communication', 'constraints']`): Pozycja i priorytety ·
 * Technologia · Kultura i komunikacja · Ograniczenia i ryzyko.
 *
 * DANE SĄ REALNE — te same wywołania co `OrganizationProfileModule`:
 *   GET/PUT `/organization-profiles/:orgId` (+ readback po zapisie, 1:1 z legacy)
 *   GET `/organization-context` → liczba twierdzeń, znacznik ostatniej przebudowy.
 * Taksonomia (pozycje konkurencyjne, etapy wzrostu, poziomy chmury, regulacje…)
 * pochodzi z JEDNEGO źródła — `organizationProfileTaxonomy.tsx` — wspólnego ze
 * starym ekranem i z „Tożsamość i model działania".
 *
 * Konflikty źródeł (`profile.*` claimPath): tylko pola, dla których etap A już
 * ustalił bezpieczne ścieżki. Reszta pól tego ekranu nie ma dziś potwierdzonego
 * `claimPath` z backendu — świadomie NIE zgadujemy nowych ścieżek (zero atrap).
 *
 * Zapis: JEDEN przycisk „Zapisz zmiany" w prawym panelu stanu zapisuje KOMPLET
 * pól ekranu — §5.3 dokumentu konsolidacji.
 */

import { Cpu, MessageSquare, Shield, Target } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../../routes/routeConfig';
import { Api } from '../../../services/api';
import { useAppStore } from '../../../store/useAppStore';
import {
  CLOUD_LEVELS,
  COMMUNICATION_STYLES,
  COMPETITIVE_POSITIONS,
  EMPTY_PROFILE,
  GROWTH_STAGES,
  JARGON_LEVELS,
  REGULATIONS,
  RISK_APPETITES,
  computeCompleteness,
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

export type DirectionConstraintsSection = 'position' | 'technology' | 'culture' | 'constraints';

export const DIRECTION_CONSTRAINTS_SECTIONS: Array<{
  id: DirectionConstraintsSection;
  labelKey: string;
  en: string;
}> = [
  { id: 'position', labelKey: 'organization.redesign.direction.sections.position', en: 'Position & priorities' },
  { id: 'technology', labelKey: 'organization.redesign.direction.sections.technology', en: 'Technology' },
  { id: 'culture', labelKey: 'organization.redesign.direction.sections.culture', en: 'Culture & communication' },
  { id: 'constraints', labelKey: 'organization.redesign.direction.sections.constraints', en: 'Constraints & risk' },
];

interface OrgContextResponse {
  snapshotUpdatedAt?: string | null;
  schemaVersion?: number;
  counts?: { items?: number; claims?: number; conflicts?: number };
  conflicts?: Array<{ claimPath: string; values?: unknown[]; sourceTypes?: string[] }>;
}

interface ScreenField {
  id: keyof OrgProfile;
  section: DirectionConstraintsSection;
  /** Klucz i18n etykiety pola — literał nigdy nie trafia do JSX (PLAN §2 pkt 4). */
  labelKey: string;
  en: string;
}

const SCREEN_FIELDS: ScreenField[] = [
  { id: 'competitive_position', section: 'position', labelKey: 'organization.profile.fields.competitivePosition', en: 'Competitive Position' },
  { id: 'growth_stage', section: 'position', labelKey: 'organization.profile.fields.growthStage', en: 'Growth Stage' },
  { id: 'strategic_priorities', section: 'position', labelKey: 'organization.profile.fields.strategicPriorities', en: 'Strategic Priorities' },
  { id: 'mission_statement', section: 'position', labelKey: 'organization.profile.fields.missionStatement', en: 'Mission Statement' },
  { id: 'vision_statement', section: 'position', labelKey: 'organization.profile.fields.visionStatement', en: 'Vision Statement' },
  { id: 'digital_maturity_overall', section: 'technology', labelKey: 'organization.profile.fields.digitalMaturity', en: 'Digital Maturity (1-7)' },
  { id: 'cloud_adoption_level', section: 'technology', labelKey: 'organization.profile.fields.cloudAdoption', en: 'Cloud Adoption' },
  { id: 'technology_stack', section: 'technology', labelKey: 'organization.profile.fields.technologyStack', en: 'Technology Stack' },
  { id: 'digital_budget_percent', section: 'technology', labelKey: 'organization.profile.fields.digitalBudget', en: 'Digital Budget (% of IT spend)' },
  { id: 'communication_style', section: 'culture', labelKey: 'organization.profile.fields.communicationStyle', en: 'Communication Style' },
  { id: 'industry_jargon_level', section: 'culture', labelKey: 'organization.profile.fields.jargonLevel', en: 'Industry Jargon Level' },
  { id: 'regulatory_environment', section: 'constraints', labelKey: 'organization.profile.fields.regulatoryEnvironment', en: 'Regulatory Environment' },
  { id: 'risk_appetite', section: 'constraints', labelKey: 'organization.profile.fields.riskAppetite', en: 'Risk Appetite' },
  { id: 'budget_constraints', section: 'constraints', labelKey: 'organization.profile.fields.budgetConstraints', en: 'Budget Constraints' },
  { id: 'timeline_constraints', section: 'constraints', labelKey: 'organization.profile.fields.timelineConstraints', en: 'Timeline Constraints' },
];

function isFilled(profile: OrgProfile, field: keyof OrgProfile): boolean {
  const value = profile[field];
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return String(value ?? '').trim().length > 0;
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

export interface DirectionConstraintsRenderArgs {
  sections: StandardModuleTab[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  chips: StandardCounterChip[];
  activeChip: string;
  onChipChange: (id: string) => void;
  searchValue: string;
  onSearch: (query: string) => void;
  statePanel: OrganizationStatePanelProps;
  content: React.ReactNode;
}

export const OrganizationDirectionConstraintsScreen: React.FC<{
  children: (args: DirectionConstraintsRenderArgs) => React.ReactNode;
}> = ({ children }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, currentOrganization } = useAppStore();
  const orgId = currentOrganization?.id || currentUser?.organizationId;

  const [profile, setProfile] = useState<OrgProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [context, setContext] = useState<OrgContextResponse | null>(null);
  const [activeSection, setActiveSection] = useState<DirectionConstraintsSection>('position');
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

  const counts = useMemo(() => {
    const filled = SCREEN_FIELDS.filter((field) => isFilled(profile, field.id));
    return { all: SCREEN_FIELDS.length, filled: filled.length, missing: SCREEN_FIELDS.length - filled.length };
  }, [profile]);

  const matchesChip = useCallback(
    (field: ScreenField) => {
      if (activeChip === 'filled') return isFilled(profile, field.id);
      if (activeChip === 'missing') return !isFilled(profile, field.id);
      return true;
    },
    [activeChip, profile]
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
    () => SCREEN_FIELDS.filter((field) => matchesChip(field) && matchesSearch(field)),
    [matchesChip, matchesSearch]
  );

  const shows = useCallback(
    (id: keyof OrgProfile) => shownFields.some((field) => field.id === id),
    [shownFields]
  );

  const sectionHasContent = useCallback(
    (section: DirectionConstraintsSection) => shownFields.some((field) => field.section === section),
    [shownFields]
  );

  const handleSectionChange = useCallback((id: string) => {
    setActiveSection(id as DirectionConstraintsSection);
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
        (error as Error)?.message || t('organization.profile.saveFailed', 'Failed to save')
      );
    } finally {
      setSaving(false);
    }
  }, [orgId, profile, t]);

  const goToSources = useCallback(() => {
    navigate(`${ROUTES.ORGANIZATION.ROOT}/sources/claims-sources`);
  }, [navigate]);

  const registerSection = (id: DirectionConstraintsSection) => (node: HTMLDivElement | null) => {
    sectionRefs.current[id] = node;
  };

  const sections: StandardModuleTab[] = DIRECTION_CONSTRAINTS_SECTIONS.map((section) => ({
    id: section.id,
    label: t(section.labelKey, section.en),
  }));

  const chips: StandardCounterChip[] = [
    { id: 'all', label: t('organization.redesign.chips.all', 'All'), count: counts.all },
    { id: 'filled', label: t('organization.redesign.chips.filled', 'Filled in'), count: counts.filled },
    { id: 'missing', label: t('organization.redesign.chips.missing', 'To fill in'), count: counts.missing },
  ];

  const statePanel: OrganizationStatePanelProps = {
    versionLabel: context?.schemaVersion ? `v${context.schemaVersion}` : undefined,
    filledFields: counts.filled,
    totalFields: counts.all,
    approvedFacts: context?.counts?.claims,
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
      {sectionHasContent('position') && (
        <div ref={registerSection('position')}>
          <OrgSectionCard id="position" title={t('organization.redesign.direction.sections.position', 'Position & priorities')} icon={Target}>
            <OrgFieldGrid>
              <OrgFieldColumn>
                {shows('competitive_position') && (
                  <OrgSelectField
                    id="org-competitive-position"
                    label={t('organization.profile.fields.competitivePosition', 'Competitive Position')}
                    value={profile.competitive_position}
                    options={COMPETITIVE_POSITIONS.map((position) => ({
                      value: position.value,
                      label: t(
                        `organization.profile.options.competitivePosition.${position.value}`,
                        position.label
                      ),
                    }))}
                    onChange={(value) => update('competitive_position', value)}
                  />
                )}
                {shows('growth_stage') && (
                  <OrgSelectField
                    id="org-growth-stage"
                    label={t('organization.profile.fields.growthStage', 'Growth Stage')}
                    value={profile.growth_stage}
                    options={GROWTH_STAGES.map((stage) => ({
                      value: stage.value,
                      label: t(`organization.profile.options.growthStage.${stage.value}`, stage.label),
                    }))}
                    onChange={(value) => update('growth_stage', value)}
                  />
                )}
                {shows('strategic_priorities') && (
                  <OrgListField
                    id="org-strategic-priorities"
                    label={t('organization.profile.fields.strategicPriorities', 'Strategic Priorities')}
                    value={profile.strategic_priorities}
                    onChange={(value) => update('strategic_priorities', value)}
                  />
                )}
              </OrgFieldColumn>
              <OrgFieldColumn>
                {shows('mission_statement') && (
                  <OrgTextField
                    id="org-mission"
                    label={t('organization.profile.fields.missionStatement', 'Mission Statement')}
                    multiline
                    value={profile.mission_statement}
                    onChange={(value) => update('mission_statement', value)}
                  />
                )}
                {shows('vision_statement') && (
                  <OrgTextField
                    id="org-vision"
                    label={t('organization.profile.fields.visionStatement', 'Vision Statement')}
                    multiline
                    value={profile.vision_statement}
                    onChange={(value) => update('vision_statement', value)}
                  />
                )}
              </OrgFieldColumn>
            </OrgFieldGrid>
          </OrgSectionCard>
        </div>
      )}

      {sectionHasContent('technology') && (
        <div ref={registerSection('technology')}>
          <OrgSectionCard id="technology" title={t('organization.redesign.direction.sections.technology', 'Technology')} icon={Cpu}>
            <OrgFieldGrid>
              <OrgFieldColumn>
                {shows('digital_maturity_overall') && (
                  <OrgTextField
                    id="org-digital-maturity"
                    label={t('organization.profile.fields.digitalMaturity', 'Digital Maturity (1-7)')}
                    type="number"
                    value={
                      profile.digital_maturity_overall === null
                        ? ''
                        : String(profile.digital_maturity_overall)
                    }
                    onChange={(value) =>
                      update('digital_maturity_overall', value ? Number.parseFloat(value) : null)
                    }
                  />
                )}
                {shows('cloud_adoption_level') && (
                  <OrgSelectField
                    id="org-cloud-adoption"
                    label={t('organization.profile.fields.cloudAdoption', 'Cloud Adoption')}
                    value={profile.cloud_adoption_level}
                    options={CLOUD_LEVELS.map((level) => ({
                      value: level,
                      label: t(
                        `organization.profile.options.cloudAdoption.${level}`,
                        level.replace(/_/g, ' ')
                      ),
                    }))}
                    onChange={(value) => update('cloud_adoption_level', value)}
                  />
                )}
              </OrgFieldColumn>
              <OrgFieldColumn>
                {shows('technology_stack') && (
                  <OrgListField
                    id="org-technology-stack"
                    label={t('organization.profile.fields.technologyStack', 'Technology Stack')}
                    value={profile.technology_stack}
                    onChange={(value) => update('technology_stack', value)}
                  />
                )}
                {shows('digital_budget_percent') && (
                  <OrgTextField
                    id="org-digital-budget"
                    label={t('organization.profile.fields.digitalBudget', 'Digital Budget (% of IT spend)')}
                    type="number"
                    value={
                      profile.digital_budget_percent === null
                        ? ''
                        : String(profile.digital_budget_percent)
                    }
                    onChange={(value) =>
                      update('digital_budget_percent', value ? Number.parseFloat(value) : null)
                    }
                  />
                )}
              </OrgFieldColumn>
            </OrgFieldGrid>
          </OrgSectionCard>
        </div>
      )}

      {sectionHasContent('culture') && (
        <div ref={registerSection('culture')}>
          <OrgSectionCard
            id="culture"
            title={t('organization.redesign.direction.sections.culture', 'Culture & communication')}
            icon={MessageSquare}
            hint={t('organization.redesign.direction.cultureHint', 'These settings help Teresa match her communication style to the organization\'s culture.')}
          >
            <OrgFieldGrid>
              <OrgFieldColumn>
                {shows('communication_style') && (
                  <OrgSelectField
                    id="org-communication-style"
                    label={t('organization.profile.fields.communicationStyle', 'Communication Style')}
                    value={profile.communication_style}
                    options={COMMUNICATION_STYLES.map((style) => ({
                      value: style.value,
                      label: t(
                        `organization.profile.options.communicationStyle.${style.value}`,
                        style.label
                      ),
                    }))}
                    onChange={(value) => update('communication_style', value)}
                  />
                )}
              </OrgFieldColumn>
              <OrgFieldColumn>
                {shows('industry_jargon_level') && (
                  <OrgSelectField
                    id="org-jargon-level"
                    label={t('organization.profile.fields.jargonLevel', 'Industry Jargon Level')}
                    value={profile.industry_jargon_level}
                    options={JARGON_LEVELS.map((level) => ({
                      value: level.value,
                      label: t(`organization.profile.options.jargonLevel.${level.value}`, level.label),
                    }))}
                    onChange={(value) => update('industry_jargon_level', value)}
                  />
                )}
              </OrgFieldColumn>
            </OrgFieldGrid>
          </OrgSectionCard>
        </div>
      )}

      {sectionHasContent('constraints') && (
        <div ref={registerSection('constraints')}>
          <OrgSectionCard id="constraints" title={t('organization.redesign.direction.sections.constraints', 'Constraints & risk')} icon={Shield}>
            {shows('regulatory_environment') && (
              <div className="mb-4">
                <OrgTagToggleGroup
                  label={t('organization.profile.fields.regulatoryEnvironment', 'Regulatory Environment')}
                  options={REGULATIONS}
                  value={profile.regulatory_environment}
                  onChange={(value) => update('regulatory_environment', value)}
                />
              </div>
            )}
            {shows('risk_appetite') && (
              <div className="mb-4">
                <OrgChoiceSegment
                  label={t('organization.profile.fields.riskAppetite', 'Risk Appetite')}
                  value={profile.risk_appetite}
                  options={RISK_APPETITES.map((appetite) => ({
                    value: appetite.value,
                    label: t(
                      `organization.profile.options.riskAppetite.${appetite.value}`,
                      appetite.label
                    ),
                  }))}
                  onChange={(value) => update('risk_appetite', value)}
                />
              </div>
            )}
            <OrgFieldGrid>
              <OrgFieldColumn>
                {shows('budget_constraints') && (
                  <OrgTextField
                    id="org-budget-constraints"
                    label={t('organization.profile.fields.budgetConstraints', 'Budget Constraints')}
                    multiline
                    value={profile.budget_constraints}
                    onChange={(value) => update('budget_constraints', value)}
                  />
                )}
              </OrgFieldColumn>
              <OrgFieldColumn>
                {shows('timeline_constraints') && (
                  <OrgTextField
                    id="org-timeline-constraints"
                    label={t('organization.profile.fields.timelineConstraints', 'Timeline Constraints')}
                    multiline
                    value={profile.timeline_constraints}
                    onChange={(value) => update('timeline_constraints', value)}
                  />
                )}
              </OrgFieldColumn>
            </OrgFieldGrid>
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
        statePanel,
        content,
      })}
    </>
  );
};

export default OrganizationDirectionConstraintsScreen;
