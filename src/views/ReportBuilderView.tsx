/**
 * ReportBuilderView
 *
 * Main view for the Report Builder module.
 * In V3, the library/list view lives in the unified "Presentations" module (Reports & Presentations Hub).
 * This route is kept as the editor/wizard surface for report creation and editing.
 */

import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { NewAssessmentReportModal } from '../components/assessment/modals/NewAssessmentReportModal';
import {
  getReportBuilderTemplateDetails,
  ReportTemplateResolveClientError,
  resolveReportBuilderTemplate,
} from '../components/ReportBuilder/libraryTemplateResolveClient';
import { ReportEditor } from '../components/ReportBuilder/ReportEditor';
import { ReportsComposer } from '../components/ReportBuilder/ReportsComposer';
import SourceSelectStep from '../components/ReportBuilder/steps/SourceSelectStep';
import { TemplatePickerModal } from '../components/ReportBuilder/TemplatePickerModal';
import type { ReportSourceType, SourceOption } from '../components/ReportBuilder/useReportBuilder';
import { Api } from '../services/api';

// ==========================================
// LIBRARY „UŻYJ WZORCA" / „KLONUJ" (report_template, 2026-07-26)
// ==========================================

type LibraryFlowAssessmentOption = { id: string; name: string; type?: string; status?: string };

const LIBRARY_TEMPLATE_ERROR_MESSAGES: Record<string, string> = {
  TEMPLATE_NOT_INDEXED: 'Tego wzorca nie ma w Twoim indeksie Biblioteki. Wybierz inny wzorzec.',
  TEMPLATE_ORPHANED:
    'Ten wzorzec nie ma już kanonicznego rekordu — nie ma z czego generować. Wybierz inny wzorzec w Bibliotece.',
  TEMPLATE_FORBIDDEN: 'Nie masz dostępu do tego wzorca.',
  TEMPLATE_DEPRECATED:
    'Ten wzorzec został wycofany i nie może już sterować generacją. Wybierz aktualny wzorzec.',
  TEMPLATE_FORMAT_UNSUPPORTED: 'Ten wzorzec nie tworzy raportu z assessmentu.',
  TEMPLATE_SOURCE_UNSUPPORTED:
    'Ten wzorzec jest przypisany do innego źródła niż assessment. „Użyj wzorca" z Biblioteki obsługuje dziś wyłącznie raporty z assessmentu.',
  TEMPLATE_RESOLVE_FAILED: 'Nie udało się rozwiązać wzorca. Spróbuj ponownie.',
};

/**
 * Ekran-bramka dla wejścia `?new=true&templateArtifactId=<id indeksu>`
 * (Biblioteka „Użyj wzorca" / „Klonuj" dla `report_template`, akcja czatu
 * `USE_TEMPLATE`). Klient dostał tylko id wiersza indeksu — kanoniczny rekord
 * (`report_builder_templates.id`) ustala SERWER
 * (`POST /report-builder/templates/resolve` → `resolveDocumentTemplateForCreation`,
 * ten sam resolver co Document Studio), który sprawdza dostęp organizacji,
 * scope, status i istnienie rekordu źródłowego — zero cichego fallbacku do
 * generacji bez sekcji szablonu.
 *
 * Po udanym rozwiązaniu: kreator z polem szablonu ZABLOKOWANYM na zresolwowany
 * rekord + wyborem zatwierdzonego assessmentu (jedyne dziś obsługiwane źródło
 * dla tej trasy) — dalej ISTNIEJĄCA ścieżka `POST /report-builder` +
 * `POST /report-builder/:id/generate` (ta sama, której używa
 * `AssessmentHub` → `NewAssessmentReportModal`).
 */
const LibraryTemplateReportCreateFlow: React.FC<{
  templateArtifactId: string;
  onCancel: () => void;
  onCreated: (reportId: string) => void;
}> = ({ templateArtifactId, onCancel, onCreated }) => {
  const [phase, setPhase] = useState<'resolving' | 'ready' | 'error'>('resolving');
  const [errorCode, setErrorCode] = useState<string>('TEMPLATE_RESOLVE_FAILED');
  const [resolvedTemplate, setResolvedTemplate] = useState<{
    id: string;
    name: string;
    description?: string | null;
    reportType?: string | null;
  } | null>(null);
  const [assessments, setAssessments] = useState<LibraryFlowAssessmentOption[]>([]);
  const [assessmentsWarning, setAssessmentsWarning] = useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setPhase('resolving');
    void (async () => {
      try {
        const resolved = await resolveReportBuilderTemplate(templateArtifactId);
        const details = await getReportBuilderTemplateDetails(resolved.canonicalTemplateId);
        if (cancelled) return;
        // Scope guard: this create flow only offers an assessment picker.
        // A template registered for a different source (interview/tool/…)
        // would fail `reportBuilderService.createReport`'s compatibility
        // check downstream anyway — reject honestly here instead.
        if (details.sourceType && details.sourceType.toUpperCase() !== 'ASSESSMENT') {
          setErrorCode('TEMPLATE_SOURCE_UNSUPPORTED');
          setPhase('error');
          return;
        }
        setResolvedTemplate({
          id: resolved.canonicalTemplateId,
          name: details.name || 'Szablon',
          description: details.description,
          reportType: details.reportType,
        });
        setPhase('ready');
      } catch (err) {
        if (cancelled) return;
        setErrorCode(
          err instanceof ReportTemplateResolveClientError ? err.code : 'TEMPLATE_RESOLVE_FAILED'
        );
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateArtifactId]);

  React.useEffect(() => {
    if (phase !== 'ready') return;
    let cancelled = false;
    void (async () => {
      try {
        const res: any = await Api.listAssessments({ limit: 200, offset: 0 });
        const items = Array.isArray(res?.items) ? res.items : [];
        if (!cancelled) {
          setAssessments(
            items.map((a: any) => ({ id: a.id, name: a.name, type: a.type, status: a.status }))
          );
        }
      } catch (e: any) {
        if (!cancelled) {
          setAssessmentsWarning(
            e?.message || 'Nie udało się wczytać listy assessmentów. Spróbuj ponownie.'
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  if (phase === 'resolving') {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="w-full max-w-md bg-white dark:bg-navy-900 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500 dark:text-slate-400" />
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Sprawdzam wzorzec z Biblioteki…
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    const message =
      LIBRARY_TEMPLATE_ERROR_MESSAGES[errorCode] ||
      LIBRARY_TEMPLATE_ERROR_MESSAGES.TEMPLATE_RESOLVE_FAILED;
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="w-full max-w-md bg-white dark:bg-navy-900 rounded-2xl shadow-2xl p-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-navy-900 dark:text-white">
                Nie można użyć tego wzorca
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{message}</div>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="h-10 px-4 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950 text-sm font-semibold"
            >
              Powrót do Biblioteki
            </button>
          </div>
        </div>
      </div>
    );
  }

  // phase === 'ready'
  return (
    <NewAssessmentReportModal
      isOpen
      assessments={assessments}
      initialTemplate={
        resolvedTemplate
          ? {
              id: resolvedTemplate.id,
              name: resolvedTemplate.name,
              description: resolvedTemplate.description,
              reportType: resolvedTemplate.reportType,
            }
          : null
      }
      lockTemplate
      titleOverride="Nowy raport z wzorca"
      subtitleOverride={
        assessmentsWarning || 'Wybierz assessment — szablon z Biblioteki jest już ustawiony.'
      }
      onClose={onCancel}
      onCreated={onCreated}
    />
  );
};

function unwrap<T = any>(res: any): T {
  const d = res?.data;
  if (d && typeof d === 'object' && 'data' in d) return d.data;
  return d;
}

// ==========================================
// NEW REPORT WIZARD (source → template)
// ==========================================

const NewReportWizard: React.FC<{
  initialTemplateId?: string | null;
  onCancel: () => void;
  onComplete: (args: {
    sourceType: ReportSourceType;
    sourceId: string;
    sourceName?: string;
    templateId: string;
  }) => void;
}> = ({ initialTemplateId, onCancel, onComplete }) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [sourceType, setSourceType] = useState<ReportSourceType | null>(null);
  const [selectedSource, setSelectedSource] = useState<SourceOption | null>(null);
  const [reportTitle, setReportTitle] = useState('');
  const [reportDescription, setReportDescription] = useState('');

  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    initialTemplateId || null
  );
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>('');

  React.useEffect(() => {
    if (initialTemplateId && !selectedTemplateId) {
      setSelectedTemplateId(initialTemplateId);
    }
  }, [initialTemplateId, selectedTemplateId]);

  const fetchSources = useCallback(async (type: ReportSourceType) => {
    const resp = await Api.get(`/report-builder/sources/${type.toLowerCase()}`);
    return (resp?.sources || []) as SourceOption[];
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl max-h-[92vh] bg-white dark:bg-navy-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isPl ? 'Nowy raport' : 'New report'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isPl
              ? 'Wybierz źródło oraz szablon, a potem przejdź do edytora.'
              : 'Select the source and a template, then continue to the editor.'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <SourceSelectStep
            sourceType={sourceType}
            selectedSource={selectedSource}
            reportTitle={reportTitle}
            reportDescription={reportDescription}
            onSourceTypeChange={setSourceType}
            onSourceSelect={setSelectedSource}
            onTitleChange={setReportTitle}
            onDescriptionChange={setReportDescription}
            fetchSources={fetchSources}
            isLoading={false}
          />

          {/* Template selection */}
          {sourceType && selectedSource && (
            <div className="pt-6 border-t border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white">
                    {isPl ? 'Szablon raportu' : 'Report template'}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {isPl
                      ? 'Wybierz szablon dopasowany do kontekstu.'
                      : 'Pick a template matched to this context.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTemplatePickerOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  {selectedTemplateId ? (isPl ? 'Zmień' : 'Change') : isPl ? 'Wybierz' : 'Select'}
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-900/40 p-4">
                {selectedTemplateId ? (
                  <div className="text-sm text-slate-700 dark:text-slate-200">
                    <span className="text-slate-500 dark:text-slate-400">
                      {isPl ? 'Wybrany:' : 'Selected:'}
                    </span>{' '}
                    <span className="font-medium">
                      {selectedTemplateName || selectedTemplateId}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {isPl ? 'Brak wybranego szablonu.' : 'No template selected.'}
                  </div>
                )}
              </div>

              <TemplatePickerModal
                isOpen={isTemplatePickerOpen}
                onClose={() => setIsTemplatePickerOpen(false)}
                sourceType={sourceType}
                framework={
                  sourceType === 'ASSESSMENT'
                    ? String((selectedSource as any)?.framework || '')
                    : undefined
                }
                onSelectTemplate={(templateId, templateName) => {
                  setSelectedTemplateId(templateId);
                  setSelectedTemplateName(templateName);
                  setIsTemplatePickerOpen(false);
                }}
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={!sourceType || !selectedSource || !selectedTemplateId}
            onClick={() => {
              if (!sourceType || !selectedSource || !selectedTemplateId) return;
              onComplete({
                sourceType,
                sourceId: selectedSource.id,
                sourceName: selectedSource.name,
                templateId: selectedTemplateId,
              });
            }}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-medium transition-colors"
          >
            {isPl ? 'Otwórz edytor' : 'Open editor'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// MAIN VIEW
// ==========================================

export const ReportBuilderView: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ reportId?: string }>();
  const [searchParams] = useSearchParams();
  const templateArtifactId = searchParams.get('templateArtifactId');
  const [resolvedTemplateId, setResolvedTemplateId] = useState<string | null>(null);

  const isNew = searchParams.get('new') === 'true';
  const tab = searchParams.get('tab') as 'composer' | 'blocks' | 'templates' | 'profiles' | null;
  // Backward compatibility: allow ?reportId=... (older admin links)
  const reportId = params.reportId || searchParams.get('reportId') || undefined;

  // Get initial source from URL params (when coming from Assessment)
  const initialSourceType = searchParams.get('sourceType') as ReportSourceType | null;
  const initialSourceId = searchParams.get('sourceId');
  const initialSourceName = searchParams.get('sourceName');
  const initialTemplateId = searchParams.get('templateId') || resolvedTemplateId;

  // ★ R1 Library „Użyj wzorca" / „Klonuj" (raport, 2026-07-26): `templateArtifactId`
  // WITHOUT sourceType/sourceId means the Library (or the chat USE_TEMPLATE
  // action) sent us here with only the index id and no assessment context.
  // This variant does NOT use the legacy client-side resolution below (an
  // unvalidated `/artifacts/:id` fetch with no orphan/deprecated/forbidden
  // checks) — it goes through the server resolver + a creator with the
  // template field locked (see `LibraryTemplateReportCreateFlow`).
  const isLibraryTemplateEntry = Boolean(
    templateArtifactId && isNew && !reportId && !initialSourceType && !initialSourceId
  );

  React.useEffect(() => {
    let mounted = true;
    if (!templateArtifactId || isLibraryTemplateEntry) {
      setResolvedTemplateId(null);
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const res = await Api.get(`/artifacts/${templateArtifactId}`);
        const payload = unwrap(res) as any;
        const links = Array.isArray(payload?.originLinks) ? payload.originLinks : [];
        const primary = links.find(
          (l: any) => String(l?.originRuntime || '') === 'report_template'
        );
        const legacyTemplateId = String(primary?.originRecordId || '').trim();
        if (mounted) {
          setResolvedTemplateId(legacyTemplateId || null);
        }
      } catch {
        if (mounted) setResolvedTemplateId(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [templateArtifactId, isLibraryTemplateEntry]);

  // Determine view mode
  const isComposerTab =
    tab === 'composer' || tab === 'blocks' || tab === 'templates' || tab === 'profiles';
  const showNewWizard =
    !isComposerTab &&
    isNew &&
    !reportId &&
    (!initialSourceType || !initialSourceId) &&
    !isLibraryTemplateEntry;
  const showEditor = !isComposerTab && !showNewWizard && (isNew || !!reportId);

  const handleOpenReport = useCallback(
    (id: string) => {
      navigate(`/reports/builder/${id}`);
    },
    [navigate]
  );

  const handleManageComposer = useCallback(() => {
    navigate('/reports/builder?tab=composer');
  }, [navigate]);

  const handleEditorClose = useCallback(() => {
    // If we came from an assessment (or any other view), navigate back there
    const returnUrl = searchParams.get('returnUrl');
    navigate(returnUrl ? decodeURIComponent(returnUrl) : '/presentations?tab=documents');
  }, [navigate, searchParams]);

  const handleEditorSave = useCallback((id: string) => {
    // Stay in editor after save
  }, []);

  // Composer view
  if (isComposerTab) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <ReportsComposer
            onBack={() => navigate('/presentations?tab=templates')}
            initialTab={
              tab === 'composer' ? 'blocks' : (tab as 'blocks' | 'templates' | 'profiles')
            }
          />
        </div>
      </div>
    );
  }

  // Library „Użyj wzorca" / „Klonuj" (report_template) — server-resolved,
  // template field locked, assessment picker only.
  if (isLibraryTemplateEntry && templateArtifactId) {
    return (
      <LibraryTemplateReportCreateFlow
        templateArtifactId={templateArtifactId}
        onCancel={handleEditorClose}
        onCreated={(id) => navigate(`/reports/builder/${id}`)}
      />
    );
  }

  // Editor view
  if (showNewWizard) {
    return (
      <NewReportWizard
        initialTemplateId={initialTemplateId}
        onCancel={handleEditorClose}
        onComplete={({ sourceType, sourceId, sourceName, templateId }) => {
          const qs = new URLSearchParams({
            new: 'true',
            sourceType,
            sourceId,
            sourceName: sourceName || '',
            templateId,
          });
          navigate(`/reports/builder?${qs.toString()}`);
        }}
      />
    );
  }

  if (showEditor) {
    return (
      <ReportEditor
        reportId={reportId}
        sourceType={initialSourceType || undefined}
        sourceId={initialSourceId || undefined}
        sourceName={initialSourceName || undefined}
        templateId={initialTemplateId || undefined}
        onSave={handleEditorSave}
        onClose={handleEditorClose}
      />
    );
  }

  // The outputs library uses `documents` as the canonical reports tab query.
  return <Navigate to="/presentations?tab=documents" replace />;
};

export default ReportBuilderView;
