/** [ODMROZENIE 07_MY_WORK_AGENT DEC-411] */
export interface TaskConditionalSectionData {
  implementationIdeas: readonly unknown[];
  risks: readonly unknown[];
  alternatives: readonly unknown[];
  stakeholders: readonly unknown[];
  escalationRules: readonly unknown[];
}

/**
 * Sekcje zaakceptowane przez CTO warunkowo nie mogą obiecywać treści, której
 * rekord nie ma. Pozostałe sekcje zadania są bezwarunkową częścią kontraktu.
 */
export function isTaskSectionVisible(
  sectionId: string,
  data: TaskConditionalSectionData
): boolean {
  if (sectionId === 'implementation') return data.implementationIdeas.length > 0;
  if (sectionId === 'risk-alternatives') return data.risks.length + data.alternatives.length > 0;
  if (sectionId === 'governance') return data.stakeholders.length + data.escalationRules.length > 0;
  return true;
}
