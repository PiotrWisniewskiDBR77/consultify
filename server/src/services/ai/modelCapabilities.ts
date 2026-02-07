/**
 * Model capabilities registry.
 *
 * Purpose:
 * - Prevent routing to models that cannot satisfy a required contract
 *   (e.g. OpenAI Structured Outputs / JSON Schema for confirm steps).
 *
 * NOTE:
 * - This is intentionally a conservative registry. Unknown models default to
 *   "no" for advanced capabilities (structured_outputs/tools/vision/reasoning).
 * - Expand this over time as you add providers/models.
 */
export type ModelCapabilityFlag =
  | 'structured_outputs'
  | 'tools'
  | 'vision'
  | 'streaming'
  | 'reasoning';

export type ModelRequirements = Partial<Record<ModelCapabilityFlag, boolean>>;

export type ModelCapabilitySet = Record<ModelCapabilityFlag, boolean>;

const DEFAULT_CAPABILITIES: ModelCapabilitySet = {
  structured_outputs: false,
  tools: false,
  vision: false,
  streaming: true,
  reasoning: false,
};

/**
 * Known model capability declarations (best-effort).
 * Keys must match the model ids used in routing (e.g. 'gpt-4o-mini').
 */
export const MODEL_CAPABILITIES: Record<string, Partial<ModelCapabilitySet>> = {
  // OpenAI
  'gpt-4o': { structured_outputs: true, tools: true, vision: true, streaming: true },
  'gpt-4o-mini': { structured_outputs: true, tools: true, vision: true, streaming: true },
  'gpt-4-turbo': { structured_outputs: true, tools: true, vision: true, streaming: true },
  'gpt-3.5-turbo': { structured_outputs: false, tools: true, vision: false, streaming: true },
  o1: { structured_outputs: false, tools: false, vision: false, streaming: true, reasoning: true },
  'o1-mini': {
    structured_outputs: false,
    tools: false,
    vision: false,
    streaming: true,
    reasoning: true,
  },
  'o1-preview': {
    structured_outputs: false,
    tools: false,
    vision: false,
    streaming: true,
    reasoning: true,
  },

  // Anthropic (tooling supported; structured JSON schema is not a guaranteed "contract" here)
  'claude-3-5-sonnet': { tools: true, vision: true, streaming: true },
  'claude-3-5-sonnet-20241022': { tools: true, vision: true, streaming: true },
  'claude-3-opus': { tools: true, vision: true, streaming: true },
  'claude-3-sonnet': { tools: true, vision: true, streaming: true },
  'claude-3-haiku': { tools: true, vision: true, streaming: true },
  'claude-3-haiku-20240307': { tools: true, vision: true, streaming: true },

  // Google (Gemini)
  'gemini-1.5-flash': { tools: true, vision: true, streaming: true },
  'gemini-1.5-pro': { tools: true, vision: true, streaming: true },
  'gemini-2.0-flash': { tools: true, vision: true, streaming: true },
  'gemini-pro': { tools: false, vision: false, streaming: true },

  // Others (best-effort defaults; refine as providers are integrated)
  'deepseek-chat': { tools: false, vision: false, streaming: true },
  'deepseek-coder': { tools: false, vision: false, streaming: true },
  'qwen-turbo': { tools: false, vision: false, streaming: true },
  'qwen-max': { tools: false, vision: false, streaming: true },
  'command-r': { tools: true, streaming: true },
  'command-r-plus': { tools: true, streaming: true },
  'glm-4-plus': { tools: false, streaming: true },
  'glm-4': { tools: false, streaming: true },
  'glm-4.6': { tools: false, streaming: true },
};

export function getModelCapabilities(modelId: string): ModelCapabilitySet {
  const key = String(modelId || '').trim();
  const declared = key ? MODEL_CAPABILITIES[key] : undefined;
  return { ...DEFAULT_CAPABILITIES, ...(declared || {}) };
}

export function modelMeetsRequirements(modelId: string, requirements?: ModelRequirements): boolean {
  if (!requirements) return true;
  const caps = getModelCapabilities(modelId);
  for (const [k, v] of Object.entries(requirements)) {
    if (v === undefined) continue;
    const flag = k as ModelCapabilityFlag;
    if (v === true && caps[flag] !== true) return false;
    if (v === false && caps[flag] !== false) return false;
  }
  return true;
}

