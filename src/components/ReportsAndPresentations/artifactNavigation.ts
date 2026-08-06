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
    const canonicalTemplateId = String(target.canonicalTemplateId || '').trim();
    if (!canonicalTemplateId) return null;
    return `/reports?tab=workbook_templates&workbookTemplateId=${encodeURIComponent(canonicalTemplateId)}`;
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

export function resolveTemplateClonePath(templateId: string, templateType: TemplateType): string {
  if (templateType === 'presentation') {
    return '/presentations?tab=template_architect';
  }
  return `/reports/builder?new=true&templateArtifactId=${encodeURIComponent(templateId)}`;
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
