import { getArtifactPath } from '@/utils/artifactLinks';

import { resolveTemplateDuplicateCommand, type TemplateUseTarget } from './artifactNavigation';

export interface TemplateDuplicateDependencies {
  post: (path: string, body: Record<string, unknown>) => Promise<unknown>;
  clonePresentation: (templateId: string) => Promise<{ id: string }>;
  buildWorkbook: (
    templateId: string,
    payload: { params: Record<string, unknown> }
  ) => Promise<unknown>;
}

export interface TemplateDuplicateResult {
  openPath: string;
}

/** Execute one real duplicate operation and return the new object's canonical UI path. */
export async function duplicateTemplateFromLibrary(
  target: TemplateUseTarget,
  dependencies: TemplateDuplicateDependencies
): Promise<TemplateDuplicateResult> {
  const command = resolveTemplateDuplicateCommand(target);
  if (!command) throw new Error('template_duplicate_unavailable');
  if (command.kind === 'navigate') return { openPath: command.path };

  const canonicalId = String(target.canonicalTemplateId || '').trim();
  if (target.originRuntime === 'presentation_template') {
    const cloned = await dependencies.clonePresentation(canonicalId);
    if (!cloned.id) throw new Error('presentation_template_clone_missing_id');
    return {
      openPath: `/presentations/templates/deck/${encodeURIComponent(cloned.id)}`,
    };
  }
  if (target.originRuntime === 'document_template') {
    const response = (await dependencies.post(command.path, {})) as {
      data?: { template?: { templateId?: unknown } };
    };
    const templateId = String(response?.data?.template?.templateId || '').trim();
    if (!templateId) throw new Error('document_template_clone_missing_id');
    return {
      openPath: `/presentations/templates/document/${encodeURIComponent(templateId)}`,
    };
  }
  if (target.originRuntime === 'sheet_template') {
    const response = (await dependencies.buildWorkbook(canonicalId, { params: {} })) as {
      id?: unknown;
      workbook?: { id?: unknown };
    };
    const workbookId = String(response?.id || response?.workbook?.id || '').trim();
    if (!workbookId) throw new Error('sheet_template_build_missing_id');
    return { openPath: getArtifactPath('sheet', workbookId) };
  }
  throw new Error('template_duplicate_runtime_unsupported');
}
