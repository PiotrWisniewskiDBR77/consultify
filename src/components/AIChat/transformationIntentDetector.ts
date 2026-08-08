const TRANSFORMATION_PLAN_PATTERNS = [
  /\b(przygotuj|opracuj|stw[oó]rz|zaplanuj)\b[\s\S]{0,80}\bplan(?:u)?\s+transformacj/i,
  /\b(prepare|create|build|develop)\b[\s\S]{0,80}\btransformation\s+plan\b/i,
];

/** Conservative explicit intent only; ordinary transformation discussion stays in normal chat. */
export function detectTransformationPlanIntent(message: string): boolean {
  const normalized = String(message || '').trim();
  if (normalized.length < 12) return false;
  return TRANSFORMATION_PLAN_PATTERNS.some((pattern) => pattern.test(normalized));
}
