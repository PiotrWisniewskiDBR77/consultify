export type TaskGeneratedSectionKey =
  | 'description-scope'
  | 'checklist'
  | 'dependencies'
  | 'evidence';

export type TaskGeneratedSectionPersistence = 'task-save' | 'local-only' | 'reference-only';

export const TASK_GENERATED_SECTION_PERSISTENCE: Record<
  TaskGeneratedSectionKey,
  TaskGeneratedSectionPersistence
> = {
  'description-scope': 'task-save',
  checklist: 'task-save',
  evidence: 'local-only',
  dependencies: 'reference-only',
};

