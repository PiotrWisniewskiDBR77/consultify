/**
 * Interview Modality Guide (V6-F02)
 *
 * Canonical answer-type definitions, per-question policy defaults,
 * question-family → modality mapping, and the AI prompt-pack builder
 * used by the TemplateBuilder's generation and review flows.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnswerModalityRule {
  answerType: string;
  label: string;
  description: string;
  defaultPolicies: {
    allowVoice: boolean;
    allowFileUpload: boolean;
    allowUrl: boolean;
    allowContextNote: boolean;
  };
  bestFor: string[];
  expectedAnswerShapeHint: string;
  evidencePromptHint?: string;
}

export type EvidencePolicy = 'light' | 'standard' | 'heavy';

export interface QuestionFamilyModality {
  recommendedType: string;
  evidencePolicy: EvidencePolicy;
  voiceRecommended: boolean;
}

export type ExpectedLength = 'pulse' | 'standard' | 'deep_dive';

export interface AIGenerationPromptParams {
  brief: string;
  audience?: string;
  industry?: string;
  tone?: string;
  expectedLength?: ExpectedLength;
  answerDesignGuide?: string;
}

// ---------------------------------------------------------------------------
// Answer Modality Rules
// ---------------------------------------------------------------------------

export const ANSWER_MODALITY_RULES: AnswerModalityRule[] = [
  {
    answerType: 'long_text',
    label: 'Long text',
    description: 'Open-ended narrative answer, typically 2-10 sentences.',
    defaultPolicies: {
      allowVoice: true,
      allowFileUpload: true,
      allowUrl: true,
      allowContextNote: true,
    },
    bestFor: [
      'strategic reasoning',
      'narrative explanations',
      'process descriptions',
      'pain-point elaboration',
      'opinion with justification',
    ],
    expectedAnswerShapeHint:
      '2-5 sentences explaining the reasoning, context, and any supporting examples.',
    evidencePromptHint: 'Please share any documents, links, or data that support your answer.',
  },
  {
    answerType: 'short_text',
    label: 'Short text',
    description: 'Brief factual answer — a name, title, or one-liner.',
    defaultPolicies: {
      allowVoice: false,
      allowFileUpload: false,
      allowUrl: false,
      allowContextNote: true,
    },
    bestFor: ['names', 'titles', 'brief facts', 'labels', 'one-word or one-phrase answers'],
    expectedAnswerShapeHint: 'A single word, name, or short phrase.',
  },
  {
    answerType: 'single_choice',
    label: 'Single choice',
    description: 'Pick exactly one option from a predefined list.',
    defaultPolicies: {
      allowVoice: false,
      allowFileUpload: false,
      allowUrl: false,
      allowContextNote: true,
    },
    bestFor: [
      'categorical decisions',
      'binary choices',
      'priority selection',
      'maturity-level classification',
    ],
    expectedAnswerShapeHint: 'One selected option from the provided list.',
  },
  {
    answerType: 'multi_choice',
    label: 'Multiple choice',
    description: 'Select all applicable options from a predefined list.',
    defaultPolicies: {
      allowVoice: false,
      allowFileUpload: false,
      allowUrl: false,
      allowContextNote: true,
    },
    bestFor: [
      'selecting multiple applicable items',
      'tool inventories',
      'capability checklists',
      'multi-factor assessments',
    ],
    expectedAnswerShapeHint: 'One or more selected options from the provided list.',
  },
  {
    answerType: 'yes_no',
    label: 'Yes / No',
    description: 'Simple boolean confirmation.',
    defaultPolicies: {
      allowVoice: false,
      allowFileUpload: false,
      allowUrl: false,
      allowContextNote: true,
    },
    bestFor: [
      'confirmation questions',
      'existence checks',
      'gate-keeping filters',
      'binary status',
    ],
    expectedAnswerShapeHint: '"Yes" or "No".',
  },
  {
    answerType: 'rating',
    label: 'Rating scale',
    description: 'Numeric scale (e.g. 1-5 or 1-10) for subjective assessment.',
    defaultPolicies: {
      allowVoice: false,
      allowFileUpload: false,
      allowUrl: false,
      allowContextNote: true,
    },
    bestFor: [
      'satisfaction measurement',
      'maturity scoring',
      'confidence levels',
      'NPS-style scales',
    ],
    expectedAnswerShapeHint: 'A numeric value on the defined scale (e.g. 1-5).',
  },
  {
    answerType: 'number',
    label: 'Number',
    description: 'Exact numeric value — metric, count, percentage, or currency.',
    defaultPolicies: {
      allowVoice: false,
      allowFileUpload: false,
      allowUrl: false,
      allowContextNote: true,
    },
    bestFor: ['metrics', 'counts', 'percentages', 'financial figures', 'headcount'],
    expectedAnswerShapeHint: 'A numeric value, optionally with unit (e.g. "42%", "1.2M USD").',
    evidencePromptHint: 'Please cite the data source or report this number comes from.',
  },
  {
    answerType: 'date',
    label: 'Date',
    description: 'Calendar date or date range.',
    defaultPolicies: {
      allowVoice: false,
      allowFileUpload: false,
      allowUrl: false,
      allowContextNote: true,
    },
    bestFor: ['timelines', 'deadlines', 'milestones', 'launch dates'],
    expectedAnswerShapeHint: 'A date in YYYY-MM-DD format or a descriptive timeframe.',
  },
  {
    answerType: 'dropdown',
    label: 'Dropdown',
    description: 'Select one value from a longer predefined list (compact UI).',
    defaultPolicies: {
      allowVoice: false,
      allowFileUpload: false,
      allowUrl: false,
      allowContextNote: true,
    },
    bestFor: [
      'selecting from a long predefined list',
      'department selection',
      'region/country pickers',
      'role classification',
    ],
    expectedAnswerShapeHint: 'One selected value from the dropdown list.',
  },
];

// ---------------------------------------------------------------------------
// Question Family → Modality Map
// ---------------------------------------------------------------------------

export const QUESTION_FAMILY_MODALITY_MAP: Record<string, QuestionFamilyModality> = {
  strategic_direction: {
    recommendedType: 'long_text',
    evidencePolicy: 'heavy',
    voiceRecommended: true,
  },
  pain_point: {
    recommendedType: 'long_text',
    evidencePolicy: 'standard',
    voiceRecommended: true,
  },
  metric_baseline: {
    recommendedType: 'number',
    evidencePolicy: 'standard',
    voiceRecommended: false,
  },
  process_description: {
    recommendedType: 'long_text',
    evidencePolicy: 'standard',
    voiceRecommended: true,
  },
  satisfaction_rating: {
    recommendedType: 'rating',
    evidencePolicy: 'light',
    voiceRecommended: false,
  },
  existence_check: {
    recommendedType: 'yes_no',
    evidencePolicy: 'light',
    voiceRecommended: false,
  },
  tool_inventory: {
    recommendedType: 'multi_choice',
    evidencePolicy: 'standard',
    voiceRecommended: false,
  },
  timeline: {
    recommendedType: 'date',
    evidencePolicy: 'light',
    voiceRecommended: false,
  },
  stakeholder_identification: {
    recommendedType: 'short_text',
    evidencePolicy: 'light',
    voiceRecommended: false,
  },
  priority_ranking: {
    recommendedType: 'single_choice',
    evidencePolicy: 'light',
    voiceRecommended: false,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const QUESTION_COUNT_BY_LENGTH: Record<ExpectedLength, { min: number; max: number }> = {
  pulse: { min: 5, max: 8 },
  standard: { min: 10, max: 18 },
  deep_dive: { min: 18, max: 35 },
};

export function getQuestionCountRange(length: ExpectedLength = 'standard'): {
  min: number;
  max: number;
} {
  return QUESTION_COUNT_BY_LENGTH[length] ?? QUESTION_COUNT_BY_LENGTH.standard;
}

export function getModalityRuleByType(answerType: string): AnswerModalityRule | undefined {
  return ANSWER_MODALITY_RULES.find((r) => r.answerType === answerType);
}

function buildModalityReferenceBlock(): string {
  const lines = ANSWER_MODALITY_RULES.map((r) => {
    const policies = Object.entries(r.defaultPolicies)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ');
    return [
      `- ${r.answerType} (${r.label}): ${r.description}`,
      `  Best for: ${r.bestFor.join('; ')}`,
      `  Default policies: ${policies || 'none'}`,
      `  Expected shape: ${r.expectedAnswerShapeHint}`,
      r.evidencePromptHint ? `  Evidence prompt: ${r.evidencePromptHint}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  });
  return lines.join('\n');
}

function buildFamilyMapBlock(): string {
  return Object.entries(QUESTION_FAMILY_MODALITY_MAP)
    .map(([family, m]) => {
      return `- ${family} → ${m.recommendedType}, evidence: ${m.evidencePolicy}, voice: ${m.voiceRecommended ? 'yes' : 'no'}`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// AI Prompt-Pack Builder
// ---------------------------------------------------------------------------

export function buildAIGenerationPromptPack(params: AIGenerationPromptParams): string {
  const {
    brief,
    audience,
    industry,
    tone,
    expectedLength = 'standard',
    answerDesignGuide,
  } = params;

  const { min, max } = getQuestionCountRange(expectedLength);

  const contextLines: string[] = [];
  if (audience) contextLines.push(`Target audience: ${audience}`);
  if (industry) contextLines.push(`Industry context: ${industry}`);
  if (tone) contextLines.push(`Desired tone: ${tone}`);
  const contextBlock =
    contextLines.length > 0 ? contextLines.join('\n') : 'No additional context provided.';

  const designGuideBlock = answerDesignGuide
    ? `\n## Answer Design Guide (template-level override)\nThe template author provided the following constraints — follow them strictly:\n${answerDesignGuide}\n`
    : '';

  return `You are a senior management consultant and survey methodologist designing a premium interview template.

## Brief
${brief}

## Context
${contextBlock}
${designGuideBlock}
## Answer Type Reference
${buildModalityReferenceBlock()}

## Question Family → Recommended Modality
${buildFamilyMapBlock()}

## Survey Science Guardrails
1. NO leading questions — never embed the desired answer in the phrasing.
2. NO double-barreled questions — each question must ask about exactly one thing.
3. NO jargon-heavy or overly abstract wording — keep language accessible to the target audience.
4. Keep questions concise: aim for ≤25 words per question stem.
5. Avoid negation in question stems ("Which of the following is NOT…").
6. For scale/rating questions always define the anchors (e.g. 1 = Very dissatisfied, 5 = Very satisfied).
7. Place sensitive or complex questions in the middle, not at the start.
8. Group related questions by topic; start with easier warm-up questions.
9. Ensure logical flow — later questions should not contradict assumptions of earlier ones.
10. Every question must earn its place: if it doesn't inform a decision, cut it.

## Modality Assignment Rules
- Match each question's intent to the most appropriate answer type from the reference above.
- Set per-question policies (allowVoice, allowFileUpload, allowUrl, allowContextNote) based on the answer type defaults unless the question context demands an override.
- For open-ended strategic or narrative questions, enable voice recording.
- For numeric/metric questions, add an evidence prompt asking for the data source.
- For heavy-evidence families (strategic_direction), set allowFileUpload and allowUrl to true.

## Output Requirements
- Generate between ${min} and ${max} questions.
- For each question provide: questionText, answerType, isRequired, helpHint, expectedAnswerShape, answerOptions (if applicable), allowVoice, allowFileUpload, allowUrl, allowContextNote.
- Include a brief "questionFamily" tag (from the family map above or a custom one) so the template author can see the intent classification.
- Return ONLY valid JSON matching the schema below. No prose, no markdown fences.

## JSON Schema
{
  "template": {
    "name": "string",
    "description": "string",
    "estimatedTimeMinutes": number,
    "runtimeModeDefault": "one_question_per_screen"
  },
  "questions": [
    {
      "category": "strategy|operations|digital|people|finance",
      "questionFamily": "string",
      "questionText": "string",
      "answerType": "long_text|short_text|single_choice|multi_choice|yes_no|rating|number|date|dropdown",
      "isRequired": boolean,
      "helpHint": "string",
      "expectedAnswerShape": "string",
      "answerOptions": ["string"],
      "allowVoice": boolean,
      "allowFileUpload": boolean,
      "allowUrl": boolean,
      "allowContextNote": boolean,
      "evidencePrompt": "string | null"
    }
  ]
}`;
}
