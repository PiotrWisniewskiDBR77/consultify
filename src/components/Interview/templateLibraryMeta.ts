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

export const getTemplateSourceLabel = (scope: string | undefined, isPolish: boolean): string => {
  const filter = getTemplateSourceFilterFromScope(scope);
  if (filter === 'application') return isPolish ? 'Aplikacja' : 'Application';
  if (filter === 'organization') return isPolish ? 'Organizacja' : 'Organization';
  if (filter === 'user') return isPolish ? 'Użytkownik' : 'User';
  return isPolish ? 'Wszystkie' : 'All';
};

export const getTemplateAreaTagLabel = (tag: string, isPolish: boolean): string => {
  const normalized = String(tag || '')
    .trim()
    .toLowerCase();
  const labels: Record<string, { pl: string; en: string }> = {
    strategy: { pl: 'Strategia', en: 'Strategy' },
    operations: { pl: 'Operacje', en: 'Operations' },
    digital: { pl: 'Digital', en: 'Digital' },
    finance: { pl: 'Finanse', en: 'Finance' },
    people: { pl: 'Ludzie', en: 'People' },
    sales: { pl: 'Sprzedaż', en: 'Sales' },
    marketing: { pl: 'Marketing', en: 'Marketing' },
    procurement: { pl: 'Zakupy', en: 'Procurement' },
    'customer-service': { pl: 'Obsługa klienta', en: 'Customer service' },
    delivery: { pl: 'Dostarczenie', en: 'Delivery' },
    it: { pl: 'IT', en: 'IT' },
    data: { pl: 'Dane', en: 'Data' },
    risk: { pl: 'Ryzyko', en: 'Risk' },
    compliance: { pl: 'Compliance', en: 'Compliance' },
    hr: { pl: 'HR', en: 'HR' },
    pmo: { pl: 'PMO', en: 'PMO' },
  };
  return labels[normalized]?.[isPolish ? 'pl' : 'en'] || normalized;
};
