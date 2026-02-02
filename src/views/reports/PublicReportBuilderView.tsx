/**
 * PublicReportBuilderView
 *
 * Public view for shared Report Builder reports.
 * Accessed via /shared/report/:token
 */

import { AlertTriangle, Calendar, Clock, Download, FileText, Loader2, Lock } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useParams, useSearchParams } from 'react-router-dom';

import {
  AssessmentMatrix,
  type AssessmentMatrixData,
} from '../../components/ReportBuilder/visuals/AssessmentMatrix';

// ==========================================
// TYPES
// ==========================================

interface PublicReportSection {
  sectionKey: string;
  sectionType: string;
  title: string;
  content: string;
  renderKind?: string;
}

interface PublicReportData {
  report: {
    id: string;
    title: string;
    sourceName?: string;
    status: string;
    createdAt: string;
  };
  sections: PublicReportSection[];
  branding: {
    showCompanyLogo: boolean;
    showConsultinityBranding: boolean;
    customMessage?: string;
  };
}

// ==========================================
// COMPONENT
// ==========================================

export const PublicReportBuilderView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [data, setData] = useState<PublicReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const fetchReport = useCallback(
    async (pwd?: string) => {
      try {
        setLoading(true);
        setPasswordError(false);

        const url = pwd
          ? `/api/public/report/${token}?password=${encodeURIComponent(pwd)}`
          : `/api/public/report/${token}`;

        const response = await fetch(url);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          if (response.status === 401 && errorData.requiresPassword) {
            setRequiresPassword(true);
            if (pwd) setPasswordError(true);
            setLoading(false);
            return;
          }

          if (response.status === 404) {
            throw new Error('notfound');
          }

          throw new Error(errorData.error || 'Failed to load report');
        }

        const result = await response.json();
        setData(result);
        setRequiresPassword(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (token) {
      // Check if password is in URL (for PDF download links)
      const urlPassword = searchParams.get('password');
      fetchReport(urlPassword || undefined);
    }
  }, [token, searchParams, fetchReport]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport(password);
  };

  const handleDownloadPdf = () => {
    const url = password
      ? `/api/public/report/${token}/pdf?password=${encodeURIComponent(password)}`
      : `/api/public/report/${token}/pdf`;
    window.open(url, '_blank');
  };

  // Render section content
  const renderSectionContent = (section: PublicReportSection) => {
    const isMatrix = section.sectionType === 'matrix' || section.renderKind === 'matrix';

    if (isMatrix) {
      try {
        const matrixData = JSON.parse(section.content) as AssessmentMatrixData;
        if (matrixData.type === 'assessment_matrix') {
          return <AssessmentMatrix data={matrixData} />;
        }
      } catch {
        // Fall through to markdown
      }
    }

    return (
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <ReactMarkdown>{section.content || '*No content*'}</ReactMarkdown>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {isPl ? 'Ładowanie raportu...' : 'Loading report...'}
          </p>
        </div>
      </div>
    );
  }

  // Password required
  if (requiresPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full mx-4 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-blue-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {isPl ? 'Raport chroniony hasłem' : 'Password Protected Report'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {isPl
                ? 'Wprowadź hasło, aby wyświetlić ten raport'
                : 'Enter the password to view this report'}
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isPl ? 'Hasło' : 'Password'}
                className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 ${
                  passwordError ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'
                }`}
                autoFocus
              />
              {passwordError && (
                <p className="mt-2 text-sm text-red-500">
                  {isPl ? 'Nieprawidłowe hasło' : 'Invalid password'}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              {isPl ? 'Wyświetl raport' : 'View Report'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Error states
  if (error === 'notfound') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {isPl ? 'Link wygasł lub nie istnieje' : 'Link Expired or Not Found'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {isPl
              ? 'Ten link do raportu wygasł lub został unieważniony.'
              : 'This report link has expired or has been revoked.'}
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Lock className="w-4 h-4" />
            <span>
              {isPl ? 'Skontaktuj się z autorem raportu' : 'Contact the report author for access'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {isPl ? 'Wystąpił błąd' : 'An Error Occurred'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  // Main report view
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6" />
              <div>
                <h1 className="font-semibold">{data.report.title}</h1>
                {data.report.sourceName && (
                  <p className="text-sm text-white/70">{data.report.sourceName}</p>
                )}
              </div>
            </div>

            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>PDF</span>
            </button>
          </div>

          {data.branding.customMessage && (
            <div className="mt-3 p-3 bg-white/10 rounded-lg text-sm">
              {data.branding.customMessage}
            </div>
          )}
        </div>
      </div>

      {/* Report Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          {data.sections.map((section, index) => (
            <div
              key={section.sectionKey}
              className={`p-6 ${index > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''}`}
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {section.title}
              </h2>
              {renderSectionContent(section)}
            </div>
          ))}

          {data.sections.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              {isPl ? 'Brak treści w raporcie' : 'No content in this report'}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center text-sm text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(data.report.createdAt).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <Lock className="w-4 h-4" />
              {isPl ? 'Udostępniony raport' : 'Shared Report'}
            </span>
          </div>
          {data.branding.showConsultinityBranding && (
            <p className="mt-2 text-xs">Powered by Consultify</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicReportBuilderView;
