/**
 * Materiały — kontrakt szablonów (SSOT dla frontendu).
 *
 * Te typy odwzorowują 1:1 kontrakt uzgodniony z backendem indeksu artefaktów
 * (`GET /api/artifacts?artifactFamily=template` → `originSummary.template`).
 * Nazwy są ZABLOKOWANE — nie zmieniaj ich lokalnie w modułach; importuj stąd.
 *
 * Dlaczego osobny plik: dotychczas Biblioteka wzorców miała własne, luźniejsze
 * uniony (`'application'` jako zakres, `'active'` jako status), które maskowały
 * brak danych — mapper podstawiał „poprawnie wyglądający" stan zamiast przyznać,
 * że backend nic nie przysłał. SSOT ma jawny wariant `'unknown'`, żeby braku
 * danych nie dało się pomylić z realnym stanem.
 */

/**
 * Zakres widoczności szablonu.
 * ★ ZAKAZ wariantu `'application'` — kanoniczna nazwa to `'system'`.
 * `'unknown'` = backend nie podał zakresu (NIE domyślaj `'organization'`).
 */
export type TemplateScope = 'system' | 'organization' | 'personal' | 'unknown';

/**
 * Status cyklu życia szablonu.
 * `'unknown'` = backend nie podał statusu (NIE domyślaj `'approved'`/`'active'`).
 */
export type TemplateStatus = 'approved' | 'published' | 'draft' | 'deprecated' | 'unknown';

/**
 * Runtime, z którego pochodzi kanoniczny rekord szablonu. Rozstrzyga, DOKĄD
 * kieruje „Użyj wzorca" — `document_template` to Document Studio (Mode 3),
 * `report_template` to legacy generator report-buildera.
 */
export type TemplateOriginRuntime =
  | 'document_template'
  | 'report_template'
  | 'presentation_template'
  | 'sheet_template';

/** `'legacy'` = rekord z `report_builder_templates`; `'canonical'` = nowy rejestr. */
export type TemplateSource = 'canonical' | 'legacy';

/**
 * Suma rozłączna referencji do szablonu.
 * `library` — wskazujemy wiersz INDEKSU artefaktów (id artefaktu w bibliotece).
 * `internal` — wskazujemy KANONICZNY rekord szablonu w jego runtime.
 * ★ To dwie różne tożsamości; mylenie ich było źródłem błędu „templateId ginie".
 */
export type TemplateRef =
  | { kind: 'library'; templateArtifactId: string }
  | { kind: 'internal'; canonicalTemplateId: string; originRuntime: TemplateOriginRuntime };

/** Ładunek `originSummary.template` z indeksu artefaktów (część istotna dla FE). */
export interface TemplateOriginSummary {
  canonicalTemplateId?: string | null;
  originRuntime?: TemplateOriginRuntime | string | null;
  source?: TemplateSource | string | null;
  legacy?: boolean | null;
  /** true = kanoniczny rekord szablonu nie istnieje → wpis NIE jest gotowy do użycia. */
  orphaned?: boolean | null;
  scope?: TemplateScope | string | null;
  status?: TemplateStatus | string | null;
}

const SCOPE_VALUES: readonly TemplateScope[] = ['system', 'organization', 'personal', 'unknown'];
const STATUS_VALUES: readonly TemplateStatus[] = [
  'approved',
  'published',
  'draft',
  'deprecated',
  'unknown',
];
const ORIGIN_RUNTIME_VALUES: readonly TemplateOriginRuntime[] = [
  'document_template',
  'report_template',
  'presentation_template',
  'sheet_template',
];

export function isTemplateScope(value: unknown): value is TemplateScope {
  return SCOPE_VALUES.includes(value as TemplateScope);
}

export function isTemplateStatus(value: unknown): value is TemplateStatus {
  return STATUS_VALUES.includes(value as TemplateStatus);
}

export function isTemplateOriginRuntime(value: unknown): value is TemplateOriginRuntime {
  return ORIGIN_RUNTIME_VALUES.includes(value as TemplateOriginRuntime);
}
