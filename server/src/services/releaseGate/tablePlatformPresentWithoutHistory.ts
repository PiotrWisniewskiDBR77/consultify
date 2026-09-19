export interface PresentWithoutHistoryQueryable {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>;
}

const BUSINESS_TEMPLATES_SEED = '20260412_seed_business_templates.sql';
const ORIGIN_RUNTIME_REPAIR = '20262105_seed_business_templates_origin_runtime_repair.sql';

const BUSINESS_TEMPLATE_ORIGINS = [
  ['bt-doc-weekly', 'report_template'],
  ['bt-doc-steering', 'report_template'],
  ['bt-doc-benefits', 'report_template'],
  ['bt-doc-portfolio', 'report_template'],
  ['bt-doc-kickoff', 'report_template'],
  ['bt-doc-risk', 'report_template'],
  ['bt-doc-dd', 'report_template'],
  ['bt-doc-market', 'report_template'],
  ['bt-sheet-finmodel', 'sheet_template'],
  ['bt-sheet-budget', 'sheet_template'],
  ['bt-sheet-resource', 'sheet_template'],
  ['bt-sheet-risk', 'sheet_template'],
  ['bt-sheet-timeline', 'sheet_template'],
  ['bt-sheet-competitive', 'sheet_template'],
  ['bt-sheet-recruit', 'sheet_template'],
  ['bt-sheet-okr', 'sheet_template'],
  ['bt-deck-steering', 'presentation_template'],
  ['bt-deck-status', 'presentation_template'],
  ['bt-deck-pitch', 'presentation_template'],
  ['bt-deck-workshop', 'presentation_template'],
  ['bt-deck-qbr', 'presentation_template'],
  ['bt-deck-strategy', 'presentation_template'],
  ['bt-deck-invest', 'presentation_template'],
  ['bt-deck-digital', 'presentation_template'],
] as const;

const BUSINESS_TEMPLATE_REQUIRED_RUNTIMES = [
  'report_template',
  'presentation_template',
  'sheet_template',
] as const;

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

async function getOriginRuntimeConstraintDefinition(
  db: PresentWithoutHistoryQueryable
): Promise<string> {
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
  return String(res.rows[0]?.definition ?? '');
}

function constraintIncludes(definition: string, value: string): boolean {
  return definition.includes(`'${value}'::text`) || definition.includes(`'${value}'`);
}

async function tableExists(db: PresentWithoutHistoryQueryable, table: string): Promise<boolean> {
  const res = await db.query<{ present: boolean }>(
    `SELECT to_regclass($1) IS NOT NULL AS present`,
    [`public.${table}`]
  );
  return Boolean(res.rows[0]?.present);
}

async function attestBusinessTemplatesSeed(db: PresentWithoutHistoryQueryable): Promise<boolean> {
  const [artifactsPresent, linksPresent] = await Promise.all([
    tableExists(db, 'v8_output_artifacts'),
    tableExists(db, 'v8_artifact_origin_links'),
  ]);
  if (!artifactsPresent || !linksPresent) return false;

  const artifactIds = BUSINESS_TEMPLATE_ORIGINS.map(([artifactId]) => artifactId);
  const runtimes = BUSINESS_TEMPLATE_ORIGINS.map(([, runtime]) => runtime);
  const res = await db.query<{ artifact_count: number | string; link_count: number | string }>(
    `WITH expected AS (
       SELECT * FROM unnest($1::text[], $2::text[]) AS e(artifact_id, origin_runtime)
     )
     SELECT
       (SELECT count(*)::int
          FROM expected e
          JOIN v8_output_artifacts a
            ON a.artifact_id = e.artifact_id
           AND a.organization_id = '__system__'
           AND a.artifact_family = 'template') AS artifact_count,
       (SELECT count(*)::int
          FROM expected e
          JOIN v8_artifact_origin_links l
            ON l.artifact_id = e.artifact_id
           AND l.organization_id = '__system__'
           AND l.origin_runtime = e.origin_runtime
           AND l.origin_record_id = e.artifact_id
           AND l.is_primary_origin::text IN ('true', 't', '1')) AS link_count`,
    [artifactIds, runtimes]
  );
  const row = res.rows[0];
  const expectedCount = BUSINESS_TEMPLATE_ORIGINS.length;
  const artifactCount = Number(row?.artifact_count ?? 0);
  const linkCount = Number(row?.link_count ?? 0);
  if (artifactCount !== expectedCount || linkCount !== expectedCount) return false;

  const definition = await getOriginRuntimeConstraintDefinition(db);
  return BUSINESS_TEMPLATE_REQUIRED_RUNTIMES.every((value) => constraintIncludes(definition, value));
}

async function attestOriginRuntimeRepair(db: PresentWithoutHistoryQueryable): Promise<boolean> {
  if (!(await tableExists(db, 'v8_artifact_origin_links'))) return false;
  const definition = await getOriginRuntimeConstraintDefinition(db);
  return ORIGIN_RUNTIME_REQUIRED_VALUES.every((value) => constraintIncludes(definition, value));
}

export async function attestTablePlatformPresentWithoutHistory(
  db: PresentWithoutHistoryQueryable,
  filename: string
): Promise<boolean> {
  if (filename === BUSINESS_TEMPLATES_SEED) return attestBusinessTemplatesSeed(db);
  if (filename === ORIGIN_RUNTIME_REPAIR) return attestOriginRuntimeRepair(db);
  return false;
}
