/**
 * cardSets — DEFAULT_CARD_SETS + catalog of cards per N-mode artifact type
 *
 * SSOT for the CARD-MANAGEMENT system of the N-pattern (wzorzec N §3.5).
 * Every N artifact (Insight · Initiative · Decision · Task) declares:
 *
 *   • `catalog`  — ALL cards that CAN appear on this artifact (id + bilingual
 *                  label + icon id). Drives the "+ Nowa karta ▾" picker.
 *   • `sets`     — one or more named default sets; each set lists which cards are
 *                  visible and in which order. The first set is the canonical
 *                  default (used by `resetToDefault`); extra sets are variants
 *                  (e.g. Initiative "minimal" vs "full").
 *
 * This is DATA ONLY (no React, no persistence). The `useCardLayout` hook turns a
 * default set into a live `{ id, visible, order }[]` layout, and each artifact
 * persists that layout via its own `onLayoutChange` callback.
 *
 * Card ids MUST match the section ids the artifact renders (INSIGHT_SECTIONS,
 * Decision/Task NModeSection ids, Initiative registry keys) so a layout maps 1:1
 * onto the artifact's sections.
 *
 * Icons are referenced by a small string id (resolved by the consumer against
 * lucide-react) so this file stays free of React imports and can be shared with
 * non-React code (tests, server hints) without pulling the icon bundle.
 *
 * @see Harvard/wdrozenie-100/_WZORZEC_N_KARTY_DOKUMENTACJA_2026-07-07.md §3.5
 * @see Harvard/wdrozenie-100/_ARTEFAKTY_MENU_STRUKTURA_2026-07-06.md
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type NModeArtifactType = 'insight' | 'initiative' | 'decision' | 'task';

export interface CardCatalogEntry {
  /** Card id — MUST equal the artifact's section id. */
  id: string;
  /** Bilingual card label (matches the section label). */
  label: { en: string; pl: string };
  /** lucide-react icon id (resolved by the consumer). */
  icon: string;
  /** Optional group label (mirrors NModeSection.group buckets). */
  group?: string;
  /**
   * When true the card is a fixed/core card that cannot be removed from the
   * artifact (only hidden). Prevents "+ Nowa karta" from ever re-offering a
   * card the artifact structurally always owns.
   */
  core?: boolean;
}

export interface CardSet {
  /** Set id (e.g. 'default', 'minimal', 'full'). */
  id: string;
  /** Bilingual set name for the picker. */
  label: { en: string; pl: string };
  /** Ordered list of card ids that are VISIBLE in this set. */
  cards: string[];
}

export interface ArtifactCardSpec {
  /** All cards this artifact can show. */
  catalog: CardCatalogEntry[];
  /** Named sets; `sets[0]` is the canonical default. */
  sets: CardSet[];
}

// ── Insight (Rekord/Dokument analityczny) ──────────────────────────────────────
// Cards mirror INSIGHT_SECTIONS in InsightViewer.tsx. The default set is the
// core analytical spine; the "full" set adds the deep between-the-lines cards.

const INSIGHT_SPEC: ArtifactCardSpec = {
  catalog: [
    { id: 'artifact-actions', label: { en: 'Next Actions', pl: 'Dalsze akcje' }, icon: 'Rocket', group: 'INSIGHT', core: true },
    { id: 'executive-summary', label: { en: 'Executive Summary', pl: 'Podsumowanie' }, icon: 'Star', group: 'INSIGHT', core: true },
    { id: 'consulting-readout', label: { en: 'Consulting Readout', pl: 'Odczyt konsultingowy' }, icon: 'Sparkles', group: 'INSIGHT' },
    { id: 'themes', label: { en: 'Themes', pl: 'Tematy' }, icon: 'Layers', group: 'INSIGHT' },
    { id: 'issues-risks', label: { en: 'Issues & Risks', pl: 'Problemy i ryzyka' }, icon: 'ShieldAlert', group: 'INSIGHT' },
    { id: 'opportunities', label: { en: 'Opportunity Spaces', pl: 'Przestrzenie szans' }, icon: 'TrendingUp', group: 'INSIGHT' },
    { id: 'people', label: { en: 'People', pl: 'Perspektywy' }, icon: 'Users', group: 'BETWEEN THE LINES' },
    { id: 'signals', label: { en: 'Signals', pl: 'Sygnały' }, icon: 'Radio', group: 'BETWEEN THE LINES' },
    { id: 'analysis-matrix', label: { en: 'Analysis Matrix', pl: 'Macierz Analizy' }, icon: 'BarChart3', group: 'BETWEEN THE LINES' },
    { id: 'consensus-divergence', label: { en: 'Consensus & Divergence', pl: 'Zgoda i rozbieżności' }, icon: 'GitCompare', group: 'BETWEEN THE LINES' },
    { id: 'implicit-assumptions', label: { en: 'Implicit Assumptions', pl: 'Ukryte założenia' }, icon: 'Brain', group: 'BETWEEN THE LINES' },
    { id: 'silences', label: { en: 'Silences', pl: 'Przemilczenia' }, icon: 'EyeOff', group: 'BETWEEN THE LINES' },
    { id: 'evidence-map', label: { en: 'Evidence Map', pl: 'Mapa dowodów' }, icon: 'MapIcon', group: 'EVIDENCE' },
    { id: 'candidate-triage', label: { en: 'Findings & Evidence', pl: 'Wnioski i dowody' }, icon: 'Eye', group: 'EVIDENCE' },
    { id: 'source-pack', label: { en: 'Sources', pl: 'Źródła' }, icon: 'Link2', group: 'EVIDENCE' },
    { id: 'report-pack', label: { en: 'Report Pack', pl: 'Pakiet raportu' }, icon: 'FileText', group: 'DELIVERABLES' },
    { id: 'comments', label: { en: 'Comments', pl: 'Komentarze' }, icon: 'MessageSquare', group: 'AUDIT' },
    { id: 'activity-log', label: { en: 'Activity Log', pl: 'Aktywność' }, icon: 'History', group: 'AUDIT' },
  ],
  sets: [
    {
      id: 'default',
      label: { en: 'Standard', pl: 'Standardowy' },
      cards: [
        'artifact-actions',
        'executive-summary',
        'consulting-readout',
        'themes',
        'issues-risks',
        'opportunities',
        'evidence-map',
        'candidate-triage',
        'source-pack',
        'report-pack',
        'comments',
        'activity-log',
      ],
    },
    {
      id: 'full',
      label: { en: 'Deep analysis', pl: 'Pełna analiza' },
      cards: [
        'artifact-actions',
        'executive-summary',
        'consulting-readout',
        'themes',
        'issues-risks',
        'opportunities',
        'people',
        'signals',
        'analysis-matrix',
        'consensus-divergence',
        'implicit-assumptions',
        'silences',
        'evidence-map',
        'candidate-triage',
        'source-pack',
        'report-pack',
        'comments',
        'activity-log',
      ],
    },
    {
      id: 'minimal',
      label: { en: 'Minimal', pl: 'Minimalny' },
      cards: ['executive-summary', 'themes', 'issues-risks', 'opportunities'],
    },
  ],
};

// ── Initiative (Rekord) ─────────────────────────────────────────────────────────
// Card ids mirror the Initiative section registry keys (registry.ts).

const INITIATIVE_SPEC: ArtifactCardSpec = {
  catalog: [
    { id: 'overview', label: { en: 'Overview', pl: 'Przegląd' }, icon: 'FileText', group: 'CONTENT', core: true },
    { id: 'problemDefinition', label: { en: 'Problem Definition', pl: 'Definicja problemu' }, icon: 'ShieldAlert', group: 'CONTENT' },
    { id: 'targetState', label: { en: 'Target State', pl: 'Stan docelowy' }, icon: 'Target', group: 'CONTENT' },
    { id: 'scope', label: { en: 'Scope', pl: 'Zakres' }, icon: 'Layers', group: 'CONTENT' },
    { id: 'tasks', label: { en: 'Tasks & Milestones', pl: 'Zadania i kamienie milowe' }, icon: 'CheckSquare', group: 'CONTENT' },
    { id: 'decisions', label: { en: 'Decisions', pl: 'Decyzje' }, icon: 'GitCompare', group: 'CONTENT' },
    { id: 'raid', label: { en: 'RAID', pl: 'RAID' }, icon: 'AlertTriangle', group: 'CONTENT' },
    { id: 'gates', label: { en: 'Gate Readiness', pl: 'Gotowość bramek' }, icon: 'Flag', group: 'CONTENT' },
    { id: 'financialAnalysis', label: { en: 'Financial Analysis', pl: 'Analiza finansowa' }, icon: 'BarChart3', group: 'CONTENT' },
    { id: 'financialImpact', label: { en: 'Financial Impact', pl: 'Wpływ finansowy' }, icon: 'TrendingUp', group: 'CONTENT' },
    { id: 'kpis', label: { en: 'KPIs', pl: 'KPI' }, icon: 'Gauge', group: 'CONTENT' },
    { id: 'competencyRequirements', label: { en: 'Competency Requirements', pl: 'Wymagane kompetencje' }, icon: 'GraduationCap', group: 'CONTENT' },
    { id: 'skillsGap', label: { en: 'Skills Gap', pl: 'Luki kompetencyjne' }, icon: 'Users', group: 'CONTENT' },
    { id: 'pilot', label: { en: 'Pilot', pl: 'Pilotaż' }, icon: 'Rocket', group: 'CONTENT' },
    { id: 'comments', label: { en: 'Comments', pl: 'Komentarze' }, icon: 'MessageSquare', group: 'AUDIT' },
    { id: 'history', label: { en: 'History', pl: 'Historia' }, icon: 'History', group: 'AUDIT' },
    { id: 'control', label: { en: 'Control', pl: 'Kontrola' }, icon: 'Settings', group: 'CONTROL', core: true },
    { id: 'team', label: { en: 'Team', pl: 'Zespół' }, icon: 'Users', group: 'CONTROL' },
    { id: 'timeline', label: { en: 'Timeline', pl: 'Oś czasu' }, icon: 'Clock', group: 'CONTROL' },
    { id: 'resources', label: { en: 'Resources', pl: 'Zasoby' }, icon: 'Package', group: 'CONTROL' },
    { id: 'stakeholders', label: { en: 'Stakeholders', pl: 'Interesariusze' }, icon: 'Users', group: 'CONTROL' },
    { id: 'dependencies', label: { en: 'Dependencies', pl: 'Zależności' }, icon: 'Link2', group: 'CONTROL' },
    { id: 'attachments', label: { en: 'Attachments', pl: 'Załączniki' }, icon: 'Paperclip', group: 'CONTROL' },
    { id: 'tags', label: { en: 'Tags', pl: 'Tagi' }, icon: 'Tag', group: 'CONTROL' },
    { id: 'reminders', label: { en: 'Reminders', pl: 'Przypomnienia' }, icon: 'Bell', group: 'CONTROL' },
  ],
  sets: [
    {
      id: 'default',
      label: { en: 'Standard', pl: 'Standardowy' },
      cards: [
        'overview',
        'problemDefinition',
        'targetState',
        'scope',
        'tasks',
        'decisions',
        'raid',
        'gates',
        'financialAnalysis',
        'financialImpact',
        'kpis',
        'competencyRequirements',
        'skillsGap',
        'comments',
        'history',
        'control',
        'team',
        'timeline',
        'resources',
        'stakeholders',
        'dependencies',
        'attachments',
        'tags',
        'reminders',
      ],
    },
    {
      id: 'minimal',
      label: { en: 'Minimal', pl: 'Minimalny' },
      cards: ['overview', 'problemDefinition', 'targetState', 'scope', 'tasks', 'kpis', 'control'],
    },
    {
      id: 'full',
      label: { en: 'Full (with pilot)', pl: 'Pełny (z pilotażem)' },
      cards: [
        'overview',
        'problemDefinition',
        'targetState',
        'scope',
        'tasks',
        'decisions',
        'raid',
        'gates',
        'financialAnalysis',
        'financialImpact',
        'kpis',
        'competencyRequirements',
        'skillsGap',
        'pilot',
        'comments',
        'history',
        'control',
        'team',
        'timeline',
        'resources',
        'stakeholders',
        'dependencies',
        'attachments',
        'tags',
        'reminders',
      ],
    },
  ],
};

// ── Decision (Rekord) ───────────────────────────────────────────────────────────
// Card ids mirror DecisionDetailView NModeSection ids.

const DECISION_SPEC: ArtifactCardSpec = {
  catalog: [
    { id: 'context-problem', label: { en: 'Decision Scope', pl: 'Zakres decyzji' }, icon: 'FileText', group: 'DECISION', core: true },
    { id: 'options-tradeoffs', label: { en: 'Options & Trade-offs', pl: 'Opcje i trade-offy' }, icon: 'GitCompare', group: 'DECISION' },
    { id: 'risk-impact', label: { en: 'Risk & Impact', pl: 'Ryzyko i wpływ' }, icon: 'ShieldAlert', group: 'DECISION' },
    { id: 'consequences', label: { en: 'Consequences', pl: 'Konsekwencje' }, icon: 'Clock', group: 'DECISION' },
    { id: 'governance-escalation', label: { en: 'RACI & Escalation', pl: 'RACI i eskalacja' }, icon: 'Users', group: 'CONTROL' },
    { id: 'comments', label: { en: 'Comments', pl: 'Komentarze' }, icon: 'MessageSquare', group: 'AUDIT' },
    { id: 'resources-links', label: { en: 'Attachments & Links', pl: 'Załączniki i powiązania' }, icon: 'Paperclip', group: 'CONTROL' },
    { id: 'activity-log', label: { en: 'Activity Log', pl: 'Logi aktywności' }, icon: 'History', group: 'AUDIT' },
  ],
  sets: [
    {
      id: 'default',
      label: { en: 'Standard', pl: 'Standardowy' },
      cards: [
        'context-problem',
        'options-tradeoffs',
        'risk-impact',
        'consequences',
        'governance-escalation',
        'comments',
        'resources-links',
        'activity-log',
      ],
    },
    {
      id: 'minimal',
      label: { en: 'Minimal', pl: 'Minimalny' },
      cards: ['context-problem', 'options-tradeoffs', 'risk-impact', 'consequences'],
    },
  ],
};

// ── Task (Rekord) ───────────────────────────────────────────────────────────────
// Card ids mirror TaskDetailView NModeSection ids.

const TASK_SPEC: ArtifactCardSpec = {
  catalog: [
    { id: 'description-scope', label: { en: 'Description & Scope', pl: 'Opis i zakres' }, icon: 'FileText', group: 'TASK', core: true },
    { id: 'implementation', label: { en: 'Implementation Ideas', pl: 'Pomysły realizacji' }, icon: 'Sparkles', group: 'TASK' },
    { id: 'risk-alternatives', label: { en: 'Risk & Alternatives', pl: 'Ryzyko i alternatywy' }, icon: 'ShieldAlert', group: 'TASK' },
    { id: 'checklist', label: { en: 'Checklist', pl: 'Lista kontrolna' }, icon: 'CheckSquare', group: 'TASK' },
    { id: 'dependencies', label: { en: 'Dependencies', pl: 'Zależności' }, icon: 'Link2', group: 'TASK' },
    { id: 'evidence', label: { en: 'Evidence', pl: 'Dowody' }, icon: 'Eye', group: 'TASK' },
    { id: 'governance', label: { en: 'RACI & Escalation', pl: 'RACI i eskalacja' }, icon: 'Users', group: 'CONTROL' },
    { id: 'comments', label: { en: 'Comments', pl: 'Komentarze' }, icon: 'MessageSquare', group: 'AUDIT' },
    { id: 'attachments-links', label: { en: 'Attachments & Links', pl: 'Załączniki i powiązania' }, icon: 'Paperclip', group: 'CONTROL' },
    { id: 'activity-log', label: { en: 'Activity Log', pl: 'Aktywność' }, icon: 'History', group: 'AUDIT' },
  ],
  sets: [
    {
      id: 'default',
      label: { en: 'Standard', pl: 'Standardowy' },
      cards: [
        'description-scope',
        'implementation',
        'risk-alternatives',
        'checklist',
        'dependencies',
        'evidence',
        'governance',
        'comments',
        'attachments-links',
        'activity-log',
      ],
    },
    {
      id: 'minimal',
      label: { en: 'Minimal', pl: 'Minimalny' },
      cards: ['description-scope', 'checklist', 'dependencies'],
    },
  ],
};

// ── Registry ────────────────────────────────────────────────────────────────────

export const DEFAULT_CARD_SETS: Record<NModeArtifactType, ArtifactCardSpec> = {
  insight: INSIGHT_SPEC,
  initiative: INITIATIVE_SPEC,
  decision: DECISION_SPEC,
  task: TASK_SPEC,
};

/** Resolve the spec for an artifact type (undefined if the type is unknown). */
export function getCardSpec(type: NModeArtifactType): ArtifactCardSpec | undefined {
  return DEFAULT_CARD_SETS[type];
}
