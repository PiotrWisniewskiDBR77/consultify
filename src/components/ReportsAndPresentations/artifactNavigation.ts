import { isDocumentViewerEnabled } from '@/components/documents/documentViewerFlag';
import type { TemplateOriginRuntime } from '@/types/materials';
import { getArtifactPath } from '@/utils/artifactLinks';

import type { ArtifactGovernanceSummary, TemplateType } from './types';

type ArtifactNavigationKind = 'document' | 'presentation' | 'sheet';

export function resolveArtifactOpenPath(params: {
  kind: ArtifactNavigationKind;
  originRecordId: string;
  governance?: ArtifactGovernanceSummary | null;
}): string | null {
  const explicitOpenPath = String(params.governance?.openPath || '').trim();
  if (explicitOpenPath) return explicitOpenPath;

  const id = String(params.originRecordId || '').trim();
  if (!id) return null;

  // HOTFIX task#63 (UI-M5): a promoted assessment is NOT a report-builder doc — no
  // report_builder_reports row exists for its originRecordId. Falling back to
  // /reports/builder/{id} opens an empty "Add first block" builder that looks like
  // data loss. Detect the assessment origin from governance and route back to the
  // assessment run instead of the empty builder.
  const authority = String(params.governance?.authority || '').trim();
  const sourceType = String(
    (params.governance?.originSummary as { sourceType?: unknown } | null | undefined)?.sourceType ||
      ''
  )
    .trim()
    .toUpperCase();
  if (authority === 'assessment_workbench' || sourceType === 'ASSESSMENT') {
    return `/assessment?assessmentId=${encodeURIComponent(id)}`;
  }

  // Same primary URL as deep links / chat (getArtifactPath) — preview “Open” must not fork truth.
  if (params.kind === 'document') return getArtifactPath('report', id);
  if (params.kind === 'presentation') return getArtifactPath('presentation', id);
  if (params.kind === 'sheet') return getArtifactPath('sheet', id);
  return null;
}

/**
 * DOC-0 etap 1 (b) (DEC-593) — REALNE rozwidlenie otwarcia z listy.
 *
 * Powyższe `:36` (`kind === 'document'` → `getArtifactPath('report', id)`) kieruje
 * każdy dokument do Report Buildera. Przy fladze `VITE_DOC0_DOCUMENT_VIEWER` ON
 * ZATWIERDZONY dokument otwiera się zamiast tego w JEDNYM `DocumentViewer`
 * (read-only); Report Builder zostaje osiągalny wyłącznie przez jawne „Edit"
 * z viewera. Flag OFF / szkic / prezentacja / arkusz / brak `artifactId` —
 * `mode: 'path'` z DOKŁADNIE dotychczasową trasą (parytet bajt w bajt).
 *
 * „Zatwierdzony" = pozytywny słownik statusów dostarczenia zmierzony w karcie
 * wiersza (OutputsAggregateTabContent `statusLabel`: draft | generated | editing |
 * ready | exported | shared | archived). Fail-closed: status nieznany albo
 * roboczy NIE otwiera viewera, tylko starą trasę — tak samo jak flaga.
 */
const APPROVED_DOCUMENT_STATUS_KEYS = new Set([
  'ready',
  'exported',
  'shared',
  'published',
  'approved',
  'final',
]);

export type ArtifactOpenTarget =
  | { mode: 'viewer'; artifactId: string }
  | { mode: 'path'; path: string | null };

export function resolveArtifactOpenTarget(params: {
  kind: ArtifactNavigationKind;
  originRecordId: string;
  artifactId?: string | null;
  statusKey?: string | null;
  governance?: ArtifactGovernanceSummary | null;
}): ArtifactOpenTarget {
  if (params.kind === 'document' && isDocumentViewerEnabled()) {
    const artifactId = String(params.artifactId || '').trim();
    const statusKey = String(params.statusKey || '').trim().toLowerCase();
    if (artifactId && APPROVED_DOCUMENT_STATUS_KEYS.has(statusKey)) {
      return { mode: 'viewer', artifactId };
    }
  }
  return {
    mode: 'path',
    path: resolveArtifactOpenPath({
      kind: params.kind,
      originRecordId: params.originRecordId,
      governance: params.governance,
    }),
  };
}

/**
 * DOC-0 etap 2a (DEC-593) — samodzielna trasa widoku dokumentu `/documents/:artifactId`.
 *
 * ONE helper for all callers (panel inicjatywy, My Work, Workspace) so the
 * branching cannot drift per screen; `null` = keep the pre-DOC-0 path, which is
 * what flag OFF must produce byte-for-byte.
 */
export function resolveDocumentViewerPath(artifactId?: string | null): string | null {
  if (!isDocumentViewerEnabled()) return null;
  const id = String(artifactId || '').trim();
  return id ? `/documents/${encodeURIComponent(id)}` : null;
}

/**
 * Back target and OFF redirect: the documents list with the row selected.
 *
 * Pomiar 18.09 konwencji flagowanych tras obiektowych w `AppRoutes.tsx`
 * (`AuditPackObjectRoute` → `/audit-programs?tab=library`,
 * `AssessmentOutput*Route` → lista Oceny): przy OFF ZAWSZE redirect, nigdzie
 * 404. `artifactId` przechowane w query, bo Hub czyta go jako `initialArtifactId`.
 */
export function buildDocumentViewerListPath(artifactId: string): string {
  return `/presentations?tab=documents&artifactId=${encodeURIComponent(String(artifactId || '').trim())}`;
}

/**
 * Cel akcji „Użyj wzorca". ★ Dwa RÓŻNE identyfikatory:
 *  - `artifactIndexId` — wiersz indeksu artefaktów (dotychczasowe `templateArtifactId`),
 *  - `canonicalTemplateId` — rekord szablonu w runtime, którego oczekuje generator.
 */
export interface TemplateUseTarget {
  artifactIndexId: string;
  templateType: TemplateType;
  canonicalTemplateId?: string | null;
  originRuntime?: TemplateOriginRuntime | null;
  orphaned?: boolean;
}

/**
 * Trasa „Użyj wzorca".
 *
 * Zwraca `null`, gdy wzorca NIE da się uczciwie użyć:
 *  - wpis osierocony (`orphaned`) — brak kanonicznego rekordu.
 *
 * ★ Szablon dokumentu (`originRuntime === 'document_template'`) kieruje do
 * Document Studio Mode 3 z identyfikatorem INDEKSU (`templateArtifactId`).
 * Kanonicznego id NIE wolno tu przekazywać: parametr URL pochodzi od klienta,
 * więc byłby niezweryfikowanym wskaźnikiem prosto do generatora. Tłumaczenie
 * indeks → rekord kanoniczny robi serwer (`POST /document-studio/templates/resolve`
 * → `resolveDocumentTemplateForCreation`), który sprawdza dostęp organizacji,
 * scope, status i istnienie rekordu źródłowego.
 *
 * ★ Legacy `report_template` (report_builder_templates) — NAPRAWA 2026-07-26:
 * dotychczasowa trasa `/wordy?templateArtifactId=...` gubiła wzorzec po cichu
 * (WordyView bierze tylko title/description; POST /artifact-runs/from-chat nie
 * zna templateArtifactId — sections_json szablonu nigdy nie było użyte).
 * Kieruje teraz do Report Buildera z tym samym schematem co Document Studio:
 * indeks id w URL, serwer (`POST /report-builder/templates/resolve` →
 * ten sam `resolveDocumentTemplateForCreation`) tłumaczy na kanoniczny
 * `report_builder_templates.id` i otwiera kreator z zablokowanym polem
 * szablonu. Wszystko, czego indeks jeszcze nie oznaczył originRuntime —
 * dotychczasowa trasa per-typ, bez zmiany generacji.
 */
export function resolveTemplateUsePath(target: TemplateUseTarget): string | null {
  const artifactIndexId = String(target.artifactIndexId || '').trim();
  if (!artifactIndexId) return null;
  if (target.orphaned) return null;

  if (target.originRuntime === 'document_template') {
    return `/document-studio?entry=template&templateArtifactId=${encodeURIComponent(artifactIndexId)}`;
  }

  if (target.originRuntime === 'report_template') {
    return `/reports/builder?new=true&templateArtifactId=${encodeURIComponent(artifactIndexId)}`;
  }

  if (target.originRuntime === 'sheet_template') {
    // The old deep link opened the parametric-template catalogue. A custom
    // SHEET-BASE id is not present in that nine-item catalogue, so the click
    // silently selected nothing. Keep "Use template" disabled; "Duplicate"
    // executes the real POST /api/workbook/templates/:id/build action.
    return null;
  }

  // Wszystko, czego indeks jeszcze nie oznaczył originRuntime: dotychczasowa
  // trasa per-typ, bez zmiany generacji.
  const routeMap: Record<TemplateType, string> = {
    report: '/wordy',
    sheet: '/tabele',
    presentation: '/prezentacje',
  };
  const base = routeMap[target.templateType] || '/wordy';
  return `${base}?templateArtifactId=${encodeURIComponent(artifactIndexId)}`;
}

/**
 * Edycja/klon szablonu PREZENTACJI — scalenie wejść 2026-07-27
 * (Harvard/wdrozenie-100/_INWENTARZ_GENERATORY_3_FORMATY_2026-07-27.md, sekcja
 * "DO SCALENIA" #1). `PresentationWizard` (`/presentations/wizard`) był
 * osierocony z nawigacji i miał kliencki resolver templateArtifactId→canoniczne
 * id BEZ walidacji serwera (luka z 26.07). Kanoniczne wejście do
 * edycji/klonowania szablonu decka to Architekt szablonów
 * (`PresentationTemplateArchitectView`, montowany pod `/presentations` z
 * `templatesView==='deckArchitect'` — deep-link `?tab=template_architect`,
 * patrz ReportsAndPresentationsHub.tsx). Architekt dziś NIE przyjmuje
 * deep-linka do KONKRETNEGO szablonu (brak propsa/parametru selekcji) — user
 * ląduje na liście architekta i sam wybiera wiersz; to jest świadomy,
 * tymczasowy kompromis (sprzątanie wejść, nie budowa nowej funkcji).
 */
export function resolveTemplateEditPath(
  templateId: string,
  templateType: TemplateType,
  canonicalTemplateId?: string | null
): string {
  if (templateType === 'presentation') {
    return '/presentations?tab=template_architect';
  }
  if (templateType === 'sheet') {
    const canonicalId = String(canonicalTemplateId || '').trim();
    if (!canonicalId) return '/presentations?tab=templates';
    return `/presentations?tab=templates&editWorkbookTemplateId=${encodeURIComponent(canonicalId)}`;
  }
  return `/reports/builder?tab=templates&templateArtifactId=${encodeURIComponent(templateId)}&edit=true`;
}

/** Open the exact canonical template in its builder whenever its identity is known. */
export function resolveTemplateBuildPath(target: TemplateUseTarget): string {
  const canonicalId = String(target.canonicalTemplateId || '').trim();
  if (canonicalId && target.originRuntime === 'document_template') {
    return `/presentations/templates/document/${encodeURIComponent(canonicalId)}`;
  }
  if (canonicalId && target.originRuntime === 'presentation_template') {
    return `/presentations/templates/deck/${encodeURIComponent(canonicalId)}`;
  }
  return resolveTemplateEditPath(target.artifactIndexId, target.templateType, canonicalId);
}

export function resolveTemplateClonePath(
  templateId: string,
  templateType: TemplateType,
  canonicalTemplateId?: string | null,
  originRuntime?: TemplateOriginRuntime | null
): string {
  const canonicalId = String(canonicalTemplateId || '').trim();
  if (templateType === 'presentation') {
    return canonicalId
      ? `/presentations/templates/deck/${encodeURIComponent(canonicalId)}`
      : '/presentations?tab=template_architect';
  }
  if (templateType === 'sheet') {
    return canonicalId
      ? `/presentations?tab=workbook_templates&workbookTemplateId=${encodeURIComponent(canonicalId)}`
      : '/presentations?tab=workbook_templates';
  }
  if (originRuntime === 'document_template' && canonicalId) {
    return `/presentations/templates/document/${encodeURIComponent(canonicalId)}`;
  }
  return `/reports/builder?new=true&templateArtifactId=${encodeURIComponent(templateId)}`;
}

export interface TemplateDuplicateCommand {
  kind: 'request' | 'navigate';
  path: string;
}

/** Real duplicate operation for each template runtime. */
export function resolveTemplateDuplicateCommand(
  target: TemplateUseTarget
): TemplateDuplicateCommand | null {
  const artifactIndexId = String(target.artifactIndexId || '').trim();
  const canonicalId = String(target.canonicalTemplateId || '').trim();
  if (!artifactIndexId || target.orphaned) return null;

  if (target.originRuntime === 'report_template') {
    return {
      kind: 'navigate',
      path: `/reports/builder?new=true&templateArtifactId=${encodeURIComponent(artifactIndexId)}`,
    };
  }
  if (!canonicalId) return null;
  if (target.originRuntime === 'document_template') {
    return {
      kind: 'request',
      path: `/document-studio/templates/${encodeURIComponent(canonicalId)}/new-version`,
    };
  }
  if (target.originRuntime === 'presentation_template') {
    return {
      kind: 'request',
      path: `/presentations/templates/${encodeURIComponent(canonicalId)}/clone`,
    };
  }
  if (target.originRuntime === 'sheet_template') {
    return {
      kind: 'request',
      path: `/workbook/templates/${encodeURIComponent(canonicalId)}/build`,
    };
  }
  return null;
}

/**
 * Trasa „Przejdź do Pochodzenie i prawa" (AGENT_WZORCE_SYSTEMOWE_ATESTACJA_20260905).
 *
 * Cel: kolejka atestacji dla wzorców ORGANIZACJI (`TemplateProvenanceApprovalDialog`,
 * zamontowany w `ReportsAndPresentationsHub` pod zakładką „Szablony"). Komunikat
 * 409 `TEMPLATE_PROVENANCE_UNVERIFIED` (Document Studio / Report Builder /
 * Prezentacje — wszystkie trzy resolwery w `creationIntent.ts`) prowadzi tu
 * jednym klikiem zamiast zostawiać użytkownika z samym opisem "otwórz
 * Bibliotekę → Pochodzenie i prawa" bez działającego przycisku.
 *
 * `openProvenance=1` czyta `resolveTemplatesDeepLink` niżej — wymusza zakładkę
 * „Szablony" i sygnalizuje Hubowi, że ma od razu otworzyć dialog.
 */
export function resolveTemplateProvenancePath(): string {
  return '/presentations?tab=templates&openProvenance=1';
}

export function appendArtifactOpenAction(path: string | null, action: string): string | null {
  const normalizedPath = String(path || '').trim();
  const normalizedAction = String(action || '').trim();
  if (!normalizedPath || !normalizedAction) return normalizedPath || null;

  const [base, query = ''] = normalizedPath.split('?');
  const params = new URLSearchParams(query);
  params.set('action', normalizedAction);
  const serialized = params.toString();

  return serialized ? `${base}?${serialized}` : base;
}

/**
 * ODBIÓR NA ŻYWO 05.09 (pakiet 10 · Materiały) — CZYTELNIK trasy „Edytuj".
 *
 * `resolveTemplateEditPath` (wyżej, w TYM pliku) produkuje dla wzorca Arkusza
 * adres `?tab=templates&editWorkbookTemplateId=<kanoniczne id>`. Przez cały
 * czas w `src/` NIE BYŁO ani jednego czytelnika tego parametru — kebab →
 * „Edytuj" zmieniał adres i nic więcej: builder się nie otwierał, użytkownik
 * zostawał na liście („martwy przewód").
 *
 * Ta funkcja jest tym czytelnikiem i leży CELOWO obok producenta: dopóki oba
 * końce przewodu są w jednym pliku i pod jednym testem, nie da się znów zmienić
 * jednego bez drugiego. Hub (`ReportsAndPresentationsHub`) tylko ją woła i
 * przekłada wynik na swój stan.
 */
export interface TemplatesDeepLinkTarget {
  /** Podwidok zakładki „Szablony": lista, Architekt (Deck) albo Generator (Excel). */
  templatesView: 'library' | 'deckArchitect' | 'workbookTemplates';
  /** Kanoniczne id wzorca Arkusza do otwarcia w builderze; `null` = lista. */
  workbookTemplateId: string | null;
  /** `true`, gdy adres wymusza zakładkę „Szablony" niezależnie od `?tab=`. */
  forcesTemplatesTab: boolean;
  /**
   * `true`, gdy adres ma od razu otworzyć dialog „Pochodzenie i prawa"
   * (`?openProvenance=1`, produkowane przez `resolveTemplateProvenancePath`).
   */
  openProvenance: boolean;
}

export function resolveTemplatesDeepLink(
  search: string | URLSearchParams
): TemplatesDeepLinkTarget {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const openProvenance = (params.get('openProvenance') || '').trim() === '1';
  const editWorkbookTemplateId = (params.get('editWorkbookTemplateId') || '').trim();
  if (editWorkbookTemplateId) {
    return {
      templatesView: 'workbookTemplates',
      workbookTemplateId: editWorkbookTemplateId,
      forcesTemplatesTab: true,
      openProvenance,
    };
  }
  const tab = (params.get('tab') || '').trim();
  if (tab === 'template_architect') {
    return {
      templatesView: 'deckArchitect',
      workbookTemplateId: null,
      forcesTemplatesTab: true,
      openProvenance,
    };
  }
  if (tab === 'workbook_templates') {
    return {
      templatesView: 'workbookTemplates',
      workbookTemplateId: (params.get('workbookTemplateId') || '').trim() || null,
      forcesTemplatesTab: true,
      openProvenance,
    };
  }
  return {
    templatesView: 'library',
    workbookTemplateId: (params.get('workbookTemplateId') || '').trim() || null,
    forcesTemplatesTab: openProvenance,
    openProvenance,
  };
}
