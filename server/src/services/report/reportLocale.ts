export type ReportLocale = 'en' | 'pl';

export interface ReportMessage {
  key: ReportMessageKey;
  params?: Record<string, string | number>;
}

const MESSAGES = {
  // These labels live below `labels` because `status`, `level`, `rag`,
  // `metric`, `value` and `empty` are already i18n namespaces in the client.
  'executionReports.labels.status': { en: 'Status', pl: 'Status' },
  'executionReports.labels.level': { en: 'Report level', pl: 'Poziom raportu' },
  'executionReports.labels.period': { en: 'Period', pl: 'Okres' },
  'executionReports.labels.asOf': { en: 'Data as of', pl: 'Stan danych na' },
  'executionReports.labels.rag': { en: 'RAG assessment', pl: 'Ocena RAG' },
  'executionReports.labels.metric': { en: 'Metric', pl: 'Miernik' },
  'executionReports.labels.value': { en: 'Value', pl: 'Wartość' },
  'executionReports.labels.empty': {
    en: 'No data is available for this period.',
    pl: 'Brak danych w tym okresie.',
  },
  'executionReports.kpiResults': { en: 'KPI results', pl: 'Wyniki KPI' },
  'executionReports.initiative': { en: 'Initiative', pl: 'Inicjatywa' },
  'executionReports.kpi': { en: 'KPI', pl: 'KPI' },
  'executionReports.result': { en: 'Result', pl: 'Wynik' },
  'executionReports.target': { en: 'Target', pl: 'Cel' },
  'executionReports.measuredAt': { en: 'Measured at', pl: 'Zmierzono' },
  'executionReports.notMeasured': { en: 'Not measured', pl: 'Nie zmierzono' },
  'executionReports.noTarget': { en: 'No target', pl: 'Brak celu' },
  'executionReports.noKpiResults': {
    en: 'No KPI results have been recorded for initiatives in this organization.',
    pl: 'Nie zapisano wyników KPI dla inicjatyw w tej organizacji.',
  },
  'executionReports.status.DRAFT': { en: 'Draft', pl: 'Szkic' },
  'executionReports.status.PUBLISHED': { en: 'Published', pl: 'Opublikowany' },
  'executionReports.level.OWNER': { en: 'Initiative owner', pl: 'Właściciel inicjatywy' },
  'executionReports.level.PMO': { en: 'PMO', pl: 'PMO' },
  'executionReports.level.STEERCO': { en: 'Steering committee', pl: 'Komitet sterujący' },
  'executionReports.level.BOARD': { en: 'Board', pl: 'Zarząd' },
  'executionReports.rag.GREEN': { en: 'Green', pl: 'Zielony' },
  'executionReports.rag.AMBER': { en: 'Amber', pl: 'Żółty' },
  'executionReports.rag.RED': { en: 'Red', pl: 'Czerwony' },
  'executionReports.rag.GREY': { en: 'Grey (data gap)', pl: 'Szary (luka danych)' },
  'executionReports.source': {
    en: 'Consultify · Execution · {level}',
    pl: 'Consultify · Realizacja · {level}',
  },
  'scheduledReports.subject': { en: 'Report “{name}” is ready', pl: 'Raport „{name}” gotowy' },
  'scheduledReports.generated': {
    en: 'The scheduled report <strong>{name}</strong> has been generated.',
    pl: 'Zaplanowany raport <strong>{name}</strong> został wygenerowany.',
  },
  'scheduledReports.reportId': {
    en: 'Report identifier: <code>{reportId}</code>',
    pl: 'Identyfikator raportu: <code>{reportId}</code>',
  },
  'scheduledReports.attachment': {
    en: 'The complete file bundle (DOCX+XLSX+PPTX) is attached.',
    pl: 'W załączniku znajdziesz komplet plików (DOCX+XLSX+PPTX).',
  },
  'scheduledReports.library': {
    en: 'The report is available in the Materials library.',
    pl: 'Materiał jest dostępny w bibliotece „Materiały”.',
  },
  'scheduledReports.dashboard': {
    en: 'Report available in dashboard',
    pl: 'Raport dostępny w panelu',
  },
  'scheduledReports.smtpAccepted': {
    en: 'Frozen PDF accepted by configured SMTP provider',
    pl: 'Zamrożony PDF został przyjęty przez skonfigurowanego dostawcę SMTP',
  },
  'scheduledReports.workReportText': {
    en: 'Consultify work report: {title}',
    pl: 'Raport z pracy Consultify: {title}',
  },
  'scheduledReports.workReportHtml': {
    en: 'Consultify work report: <strong>{title}</strong>',
    pl: 'Raport z pracy Consultify: <strong>{title}</strong>',
  },
} as const;

export type ReportMessageKey = keyof typeof MESSAGES;

export const REPORT_MESSAGE_KEYS = Object.freeze(
  Object.keys(MESSAGES) as ReportMessageKey[]
);

export function normalizeReportLocale(value: unknown): ReportLocale | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace('_', '-').split('-')[0];
  return normalized === 'en' || normalized === 'pl' ? normalized : null;
}

/** DEC-510: the first valid job/user/org locale wins; server fallback is English. */
export function resolveReportLocale(...candidates: unknown[]): ReportLocale {
  for (const candidate of candidates) {
    const locale = normalizeReportLocale(candidate);
    if (locale) return locale;
  }
  return 'en';
}

export function reportMessage(
  locale: ReportLocale,
  key: ReportMessageKey,
  params: Record<string, string | number> = {}
): string {
  const template = MESSAGES[key][locale] ?? MESSAGES[key].en;
  return String(template).replace(/\{([A-Za-z0-9_]+)\}/g, (_match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`
  );
}

export function localizedReportMessage(
  locale: ReportLocale,
  key: ReportMessageKey,
  params?: Record<string, string | number>
): ReportMessage & { value: string; locale: ReportLocale } {
  return { key, ...(params ? { params } : {}), value: reportMessage(locale, key, params), locale };
}
