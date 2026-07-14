export type TemplateScope = 'system' | 'organization' | 'private';

export type TemplateSourceFilter = 'all' | 'application' | 'organization' | 'user';

export const INTERVIEW_TEMPLATE_AREA_TAG_OPTIONS = [
  'strategy',
  'operations',
  'digital',
  'finance',
  'people',
  'sales',
  'marketing',
  'procurement',
  'customer-service',
  'delivery',
  'it',
  'data',
  'risk',
  'compliance',
  'hr',
  'pmo',
] as const;

export type InterviewTemplateAreaTag = (typeof INTERVIEW_TEMPLATE_AREA_TAG_OPTIONS)[number];

const AREA_TAG_SET = new Set<string>(INTERVIEW_TEMPLATE_AREA_TAG_OPTIONS);

export const normalizeInterviewTemplateAreaTags = (value: unknown): InterviewTemplateAreaTag[] => {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  return raw
    .map((item) =>
      String(item || '')
        .trim()
        .toLowerCase()
    )
    .filter((item, index, array) => array.indexOf(item) === index)
    .filter((item): item is InterviewTemplateAreaTag => AREA_TAG_SET.has(item))
    .slice(0, 6);
};

export const getTemplateSourceFilterFromScope = (scope?: string | null): TemplateSourceFilter => {
  if (scope === 'system') return 'application';
  if (scope === 'organization') return 'organization';
  if (scope === 'private') return 'user';
  return 'all';
};

export const getTemplateSourceLabel = (
  scope: string | undefined,
  t: (key: string) => string
): string => {
  const filter = getTemplateSourceFilterFromScope(scope);
  if (filter === 'application') return t('interview.templateLibraryMeta.application');
  if (filter === 'organization') return t('interview.templateLibraryMeta.organization');
  if (filter === 'user') return t('interview.templateLibraryMeta.user');
  return t('interview.templateLibraryMeta.all');
};

export const getTemplateAreaTagLabel = (tag: string, t: (key: string) => string): string => {
  const normalized = String(tag || '')
    .trim()
    .toLowerCase();
  if (!AREA_TAG_SET.has(normalized)) return normalized;
  // i18next bez tłumaczenia zwraca sam klucz — wtedy fallback na surowy tag
  // (odpowiednik defaultValue, ale bez poszerzania sygnatury `t`, na którą
  // nie da się kontrawariantnie podstawić TFunction).
  const key = `interview.templateLibraryMeta.areaTag.${normalized}`;
  const label = t(key);
  return label === key ? normalized : label;
};
