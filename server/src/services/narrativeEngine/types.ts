/**
 * Narrative Engine — Type Definitions
 *
 * Shared types for the 5-layer narrative generation pipeline:
 *   L1: Fact Extraction
 *   L2: Observation Selection
 *   L3: Discourse Planning
 *   L4: Linguistic Realization
 *   L5: Post-Checks
 */

export interface FactSet {
  fact_id: string;
  category: string;
  label: string;
  value: string | number;
  unit?: string;
  source_ref: { artifact_id: string; artifact_type: string; artifact_name: string };
  timestamp?: string;
}

export interface Observation {
  observation_id: string;
  type:
    | 'deviation'
    | 'trend_change'
    | 'overdue'
    | 'risk'
    | 'pending_decision'
    | 'achievement'
    | 'anomaly';
  severity: 'high' | 'medium' | 'low';
  related_facts: string[];
  narrative_hint: string;
  section_key?: string;
}

export interface NarrativeSegment {
  order: number;
  segment_type: 'observation' | 'explanation' | 'implication' | 'recommendation';
  content_hint: string;
  related_observations: string[];
  target_word_count: number;
}

export interface DiscoursePlan {
  section_key: string;
  section_title: string;
  segments: NarrativeSegment[];
  communication_register: string;
  density: string;
}

export interface PostCheckResult {
  passed: boolean;
  warnings: Array<{ code: string; message: string; section_key?: string }>;
  errors: Array<{ code: string; message: string; section_key?: string }>;
}

export interface NarrativeEngineInput {
  context_pack: any;
  organizationId?: string;
  report_config: {
    report_type_v3: string;
    goal_v3: string;
    communication_register: string;
    density: string;
    form: string;
    data_level: string;
    language: string;
  };
  section_key: string;
  section_type: string;
  section_title: string;
  aiPurpose?: string;
  previous_sections_summaries?: Array<{ key: string; summary: string }>;
  /**
   * R4 — Free-text per-slide rewrite directive. When present, it is injected
   * into the LLM system + user prompt as an explicit author instruction
   * ("rewrite this slide so that…"). Optional; absence = default behaviour.
   */
  user_instruction?: string;
}

export interface NarrativeEngineOutput {
  content: string;
  facts_used: string[];
  observations_used: string[];
  discourse_plan: DiscoursePlan;
  post_check: PostCheckResult;
}
