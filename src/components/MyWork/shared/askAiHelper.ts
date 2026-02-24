/**
 * Shared helper for building contextual AI kickoff messages.
 * Used by detail views to open the chat panel with pre-filled context.
 */

export interface AskAIEntity {
  type: 'task' | 'decision' | 'idea' | 'notebook';
  title: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  description?: string;
  projectName?: string;
}

const TYPE_INSTRUCTIONS: Record<AskAIEntity['type'], string> = {
  task: 'Provide: task breakdown suggestions, potential blockers, and recommended next actions.',
  decision:
    'Provide: key pros/cons, stakeholder impact, risk assessment, and a recommended approach.',
  idea: 'Provide: feasibility assessment, quick wins, potential challenges, and next steps to validate.',
  notebook:
    'Provide: key takeaways, missing perspectives, and suggested next steps or action items.',
};

export function buildAskAIMessage(entity: AskAIEntity): string {
  const lines = [`Analyze this ${entity.type}: "${entity.title}"`];

  const meta: string[] = [];
  if (entity.status) meta.push(`Status: ${entity.status}`);
  if (entity.priority) meta.push(`Priority: ${entity.priority}`);
  if (entity.dueDate) meta.push(`Due: ${entity.dueDate}`);
  if (entity.projectName) meta.push(`Project: ${entity.projectName}`);
  if (meta.length) lines.push(meta.join(' | '));

  if (entity.description) {
    lines.push(`Context: ${entity.description.slice(0, 500)}`);
  }

  lines.push(TYPE_INSTRUCTIONS[entity.type]);
  return lines.join('\n');
}
