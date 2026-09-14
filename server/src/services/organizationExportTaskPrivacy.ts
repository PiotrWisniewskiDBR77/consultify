/** DEC-493 exports task business content while removing person identification. */
type Row = Record<string, unknown>;
const exportedColumns = [
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
  'created_at',
  'updated_at',
  'completed_at',
  'status',
  'priority',
  'due_date',
  'title',
  'description',
  'tags',
  'why',
  'expected_outcome',
  'decision_impact',
  'evidence_required',
  'strategic_contribution',
  'progress',
  'blocked_reason',
  'acceptance_criteria',
  'blocking_issues',
] as const;

export function projectPersonalTaskExport(row: Row): Row {
  return {
    ...Object.fromEntries(
      exportedColumns.filter((key) => key in row).map((key) => [key, row[key]])
    ),
    export_payload_scope: 'task_business_content_identity_removed_dec493',
  };
}
