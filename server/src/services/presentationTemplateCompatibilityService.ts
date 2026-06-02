function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

export function normalizeTemplatePayload(row: any) {
  const template = { ...(row || {}) };
  template.outline_json = safeJsonParse(template.outline_json, []);
  template.must_have_intents = safeJsonParse(template.must_have_intents, []);
  template.recommended_visuals = safeJsonParse(template.recommended_visuals, []);
  template.template_recipe_json = safeJsonParse(template.template_recipe_json, {
    slideRecipes: [],
    headerFooter: {
      enabled: true,
      hideOnCover: true,
      showPageNumbers: true,
      showConfidentiality: true,
    },
  });
  template.source_requirements_json = safeJsonParse(template.source_requirements_json, []);
  template.layout_policy_json = safeJsonParse(template.layout_policy_json, {});
  template.template_family = String(
    template.template_family || template.deck_type || 'Custom Deck'
  );
  template.language_default = String(template.language_default || 'en');
  template.confidentiality_default = String(template.confidentiality_default || 'internal');
  template.max_slides = Number(template.max_slides || 25);
  template.min_slides = Number(template.min_slides || 5);
  return template;
}
