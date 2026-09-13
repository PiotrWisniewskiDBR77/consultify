/** My Work personal tasks are not Runtime-v1 execution_task aggregates.
 * Source-backed tasks need source access resolution. Supplemental task payloads
 * have separate writers and are deliberately unresolved in this first slice.
 */
type Row = Record<string, unknown>;
const identityColumns = [
  'id',
  'organization_id',
  'task_type',
  'source',
  'source_type',
  'source_id',
  'project_id',
  'initiative_id',
  'roadmap_initiative_id',
  'parent_task_id',
  'idea_id',
  'kpi_id',
  'raid_item_id',
  'blocked_by_decision_id',
  'assignee_id',
  'reporter_id',
  'created_by',
  'owner_id',
  'created_at',
  'updated_at',
  'completed_at',
  'status',
  'priority',
  'due_date',
] as const;
const manualFields = ['title', 'description', 'tags'] as const;
const externalEdges = [
  'source_type',
  'source_id',
  'project_id',
  'initiative_id',
  'roadmap_initiative_id',
  'parent_task_id',
  'idea_id',
  'kpi_id',
  'raid_item_id',
  'blocked_by_decision_id',
  'list_id',
  'workstream_id',
  'sprint_id',
] as const;

export function projectPersonalTaskExport(row: Row): Row {
  const manual =
    row.task_type === 'personal' &&
    row.source === 'manual' &&
    externalEdges.every((key) => row[key] === null || row[key] === undefined);
  const columns: readonly string[] = manual
    ? [...identityColumns, ...manualFields]
    : identityColumns;
  return {
    ...Object.fromEntries(columns.filter((key) => key in row).map((key) => [key, row[key]])),
    export_payload_scope: manual
      ? 'manual_personal_fields_supplemental_unresolved'
      : 'task_lineage_source_content_unresolved',
  };
}
