export interface PresentWithoutHistoryQueryable {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>;
}

const ORIGIN_RUNTIME_REPAIR = '20262105_seed_business_templates_origin_runtime_repair.sql';
const ORIGIN_RUNTIME_REQUIRED_VALUES = [
  'report',
  'presentation',
  'sheet',
  'native_artifact',
  'assessment_report',
  'report_template',
  'presentation_template',
  'sheet_template',
  'document_template',
] as const;

export async function attestTablePlatformPresentWithoutHistory(
  db: PresentWithoutHistoryQueryable,
  filename: string
): Promise<boolean> {
  if (filename !== ORIGIN_RUNTIME_REPAIR) return false;

  const res = await db.query<{ definition: string | null }>(
    `SELECT pg_get_constraintdef(c.oid) AS definition
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'v8_artifact_origin_links'
        AND c.conname = 'v8_artifact_origin_links_origin_runtime_check'
      LIMIT 1`
  );
  const definition = String(res.rows[0]?.definition ?? '');
  return ORIGIN_RUNTIME_REQUIRED_VALUES.every((value) => definition.includes(`'${value}'::text`));
}
