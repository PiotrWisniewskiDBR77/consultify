/**
 * ReportBuilderView
 *
 * Main view for the Report Builder module.
 * In V3, the library/list view lives in the unified "Presentations" module (Reports & Presentations Hub).
 * This route is kept as the editor/wizard surface for report creation and editing.
 */

import { Sparkles } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ReportEditor } from '../components/ReportBuilder/ReportEditor';
import { ReportsComposer } from '../components/ReportBuilder/ReportsComposer';
import SourceSelectStep from '../components/ReportBuilder/steps/SourceSelectStep';
import { TemplatePickerModal } from '../components/ReportBuilder/TemplatePickerModal';
import type { ReportSourceType, SourceOption } from '../components/ReportBuilder/useReportBuilder';
import { Api } from '../services/api';

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

  const isNew = searchParams.get('new') === 'true';
  const tab = searchParams.get('tab') as 'composer' | 'blocks' | 'templates' | 'profiles' | null;
  // Backward compatibility: allow ?reportId=... (older admin links)
  const reportId = params.reportId || searchParams.get('reportId') || undefined;

  // Get initial source from URL params (when coming from Assessment)
  const initialSourceType = searchParams.get('sourceType') as ReportSourceType | null;
  const initialSourceId = searchParams.get('sourceId');
  const initialSourceName = searchParams.get('sourceName');
  const initialTemplateId = searchParams.get('templateId');

  // Determine view mode
  const isComposerTab =
    tab === 'composer' || tab === 'blocks' || tab === 'templates' || tab === 'profiles';
  const showNewWizard =
    !isComposerTab && isNew && !reportId && (!initialSourceType || !initialSourceId);
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
    navigate(returnUrl ? decodeURIComponent(returnUrl) : '/presentations?tab=reports');
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

  // In V3 the list/library lives in the unified hub under Presentations.
  return <Navigate to="/presentations?tab=reports" replace />;
};

export default ReportBuilderView;
