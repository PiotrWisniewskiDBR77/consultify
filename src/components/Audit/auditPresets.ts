/**
 * auditPresets — static, built-in audit blueprints for the Audit Orchestrator
 * wizard.
 *
 * Two MVP capabilities live here as honest static data structures:
 *
 *  1. ISO 27001 preset (#19c): the ~14 Annex A control areas of ISO/IEC 27001,
 *     each mapped to a suggested owning role. Selecting this preset pre-populates
 *     the wizard with an objective + a "who fills what" plan skeleton. This is a
 *     legitimate MVP — a real, useful starting point that the consultant then
 *     refines by attaching templates + assignees.
 *
 *  2. "New company" heuristic planner (#19b): given the org's available roles
 *     (derived from picked assignees / common consulting roles), suggest which
 *     control areas each role should cover. This is a deterministic heuristic,
 *     NOT an AI call. The AI-generated planning is the documented enhancement —
 *     see suggestPlanForRoles() and the TODO in AuditOrchestratorWizard.
 *
 * Bilingual: every label carries { en, pl }.
 */

import { AUDIT_ISO27001_LEGACY_PRESET_ENABLED } from '@/utils/auditIso27001LegacyPresetGate';

export interface LocalizedLabel {
  en: string;
  pl: string;
}

export interface PresetArea {
  /** Stable key (used as React key + plan row id). */
  key: string;
  label: LocalizedLabel;
  /** Suggested owning role for this area (heuristic). */
  suggestedRole: LocalizedLabel;
}

export interface AuditPreset {
  id: string;
  label: LocalizedLabel;
  description: LocalizedLabel;
  objective: LocalizedLabel;
  areas: PresetArea[];
}

/**
 * ISO/IEC 27001 Annex A control areas (the classic 14 domains, A.5–A.18).
 * Roles are heuristic suggestions for who typically owns each domain.
 */
export const ISO_27001_PRESET: AuditPreset = {
  id: 'iso27001',
  label: { en: 'ISO 27001 readiness audit', pl: 'Audyt gotowości ISO 27001' },
  description: {
    en: 'Pre-built blueprint covering the 14 ISO/IEC 27001 Annex A control areas.',
    pl: 'Gotowy szablon obejmujący 14 obszarów kontroli z Załącznika A normy ISO/IEC 27001.',
  },
  objective: {
    en: 'Assess organizational readiness against ISO/IEC 27001 Annex A controls.',
    pl: 'Ocena gotowości organizacji względem kontroli z Załącznika A normy ISO/IEC 27001.',
  },
  areas: [
    {
      key: 'a5',
      label: { en: 'Information security policies', pl: 'Polityki bezpieczeństwa informacji' },
      suggestedRole: { en: 'CISO', pl: 'CISO' },
    },
    {
      key: 'a6',
      label: {
        en: 'Organization of information security',
        pl: 'Organizacja bezpieczeństwa informacji',
      },
      suggestedRole: { en: 'CISO', pl: 'CISO' },
    },
    {
      key: 'a7',
      label: { en: 'Human resource security', pl: 'Bezpieczeństwo zasobów ludzkich' },
      suggestedRole: { en: 'HR Lead', pl: 'Kierownik HR' },
    },
    {
      key: 'a8',
      label: { en: 'Asset management', pl: 'Zarządzanie aktywami' },
      suggestedRole: { en: 'IT Lead', pl: 'Kierownik IT' },
    },
    {
      key: 'a9',
      label: { en: 'Access control', pl: 'Kontrola dostępu' },
      suggestedRole: { en: 'IT Lead', pl: 'Kierownik IT' },
    },
    {
      key: 'a10',
      label: { en: 'Cryptography', pl: 'Kryptografia' },
      suggestedRole: { en: 'Security Engineer', pl: 'Inżynier bezpieczeństwa' },
    },
    {
      key: 'a11',
      label: {
        en: 'Physical and environmental security',
        pl: 'Bezpieczeństwo fizyczne i środowiskowe',
      },
      suggestedRole: { en: 'Facilities Lead', pl: 'Kierownik administracji' },
    },
    {
      key: 'a12',
      label: { en: 'Operations security', pl: 'Bezpieczeństwo operacyjne' },
      suggestedRole: { en: 'IT Operations', pl: 'Operacje IT' },
    },
    {
      key: 'a13',
      label: { en: 'Communications security', pl: 'Bezpieczeństwo komunikacji' },
      suggestedRole: { en: 'Network Lead', pl: 'Kierownik sieci' },
    },
    {
      key: 'a14',
      label: {
        en: 'System acquisition, development & maintenance',
        pl: 'Pozyskiwanie, rozwój i utrzymanie systemów',
      },
      suggestedRole: { en: 'Dev Lead', pl: 'Kierownik zespołu dev' },
    },
    {
      key: 'a15',
      label: { en: 'Supplier relationships', pl: 'Relacje z dostawcami' },
      suggestedRole: { en: 'Procurement Lead', pl: 'Kierownik zakupów' },
    },
    {
      key: 'a16',
      label: {
        en: 'Information security incident management',
        pl: 'Zarządzanie incydentami bezpieczeństwa',
      },
      suggestedRole: { en: 'SOC Lead', pl: 'Kierownik SOC' },
    },
    {
      key: 'a17',
      label: {
        en: 'Business continuity management',
        pl: 'Zarządzanie ciągłością działania',
      },
      suggestedRole: { en: 'BCM Lead', pl: 'Kierownik ciągłości działania' },
    },
    {
      key: 'a18',
      label: { en: 'Compliance', pl: 'Zgodność' },
      suggestedRole: { en: 'Compliance Officer', pl: 'Specjalista ds. zgodności' },
    },
  ],
};

/**
 * Generic "new company" discovery preset (#19b). Lighter blueprint of common
 * functional areas to map to roles when there is no formal standard in play.
 */
export const NEW_COMPANY_PRESET: AuditPreset = {
  id: 'new-company',
  label: { en: 'New company discovery', pl: 'Diagnoza nowej firmy' },
  description: {
    en: 'Heuristic blueprint of core functional areas for a first-pass company audit.',
    pl: 'Heurystyczny szablon kluczowych obszarów funkcjonalnych dla pierwszego audytu firmy.',
  },
  objective: {
    en: 'Map the organization across core functions to plan who answers what.',
    pl: 'Zmapuj organizację w kluczowych funkcjach, aby zaplanować kto na co odpowiada.',
  },
  areas: [
    {
      key: 'strategy',
      label: { en: 'Strategy & leadership', pl: 'Strategia i przywództwo' },
      suggestedRole: { en: 'CEO / Founder', pl: 'CEO / Założyciel' },
    },
    {
      key: 'finance',
      label: { en: 'Finance & operations', pl: 'Finanse i operacje' },
      suggestedRole: { en: 'CFO / Ops Lead', pl: 'CFO / Kierownik operacyjny' },
    },
    {
      key: 'sales',
      label: { en: 'Sales & marketing', pl: 'Sprzedaż i marketing' },
      suggestedRole: { en: 'Sales Lead', pl: 'Kierownik sprzedaży' },
    },
    {
      key: 'product',
      label: { en: 'Product & delivery', pl: 'Produkt i dostarczanie' },
      suggestedRole: { en: 'Product Lead', pl: 'Kierownik produktu' },
    },
    {
      key: 'people',
      label: { en: 'People & culture', pl: 'Ludzie i kultura' },
      suggestedRole: { en: 'HR Lead', pl: 'Kierownik HR' },
    },
    {
      key: 'tech',
      label: { en: 'Technology & data', pl: 'Technologia i dane' },
      suggestedRole: { en: 'CTO / IT Lead', pl: 'CTO / Kierownik IT' },
    },
  ],
};

// AMD-AUD-RIGHTS-001: the legacy ISO 27001 preset bypasses the rights kernel
// (no audit_norm_sources row, no packValidator gate) and is hard-disabled per
// the 2026-08-17 owner decision — no runtime input (query / localStorage /
// env / E2E override) may re-enable it. See
// src/utils/auditIso27001LegacyPresetGate.ts.
//
// This array is the PRIMARY choke point: excluding the preset here also empties
// getPresetById('iso27001') below, so even a hand-crafted openWizard('iso27001')
// call resolves to no preset rather than silently applying ISO content.
export const AUDIT_PRESETS: AuditPreset[] = AUDIT_ISO27001_LEGACY_PRESET_ENABLED
  ? [ISO_27001_PRESET, NEW_COMPANY_PRESET]
  : [NEW_COMPANY_PRESET];

export function getPresetById(id: string | null | undefined): AuditPreset | null {
  if (!id) return null;
  return AUDIT_PRESETS.find((p) => p.id === id) ?? null;
}

/** A suggested plan row produced by a preset (advisory only at MVP). */
export interface SuggestedPlanRow {
  areaKey: string;
  area: string;
  suggestedRole: string;
}

/**
 * Build a "who fills what" plan skeleton from a preset, localized.
 *
 * NOTE (#19b enhancement boundary): this is a deterministic mapping of preset
 * area → suggested role. The AI-generated planning that actually picks real
 * assignees + templates from org context is the documented enhancement; if/when
 * an AI suggest endpoint exists, call it here instead. There is intentionally no
 * fake AI call in the MVP.
 */
export function buildPlanFromPreset(preset: AuditPreset, isPolish: boolean): SuggestedPlanRow[] {
  return preset.areas.map((a) => ({
    areaKey: a.key,
    area: isPolish ? a.label.pl : a.label.en,
    suggestedRole: isPolish ? a.suggestedRole.pl : a.suggestedRole.en,
  }));
}
