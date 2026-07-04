/**
 * PublicReportBuilderView
 *
 * Professional public report viewer for shared Report Builder reports.
 * Accessed via /shared/report/:token
 *
 * Features:
 * - Full SmartBlockRenderer for all visual block types
 * - Professional cover page with report metadata
 * - Table of contents with chapter grouping
 * - Sticky header with report title
 * - Auth-gated downloads (PDF free, DOCX/PPTX for logged-in users)
 * - Password protection
 * - Print-friendly layout
 */

import {
  AlertTriangle,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  Loader2,
  Lock,
  LogIn,
  Presentation,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';

import SmartBlockRenderer from '../../components/ReportBuilder/blocks/SmartBlockRenderer';

// ==========================================
// TYPES
// ==========================================

interface PublicReportSection {
  sectionKey: string;
  sectionType: string;
  title: string;
  content: string;
  renderKind?: string;
  blockTypeId?: string;
  blockConfig?: Record<string, unknown>;
  contentFormat?: string;
  orderIndex: number;
  chapter?: string;
}

interface ChapterConfig {
  id: string;
  title: string;
  color?: string;
}

interface PublicReportData {
  report: {
    id: string;
    title: string;
    description?: string;
    sourceName?: string;
    sourceFramework?: string;
    status: string;
    createdAt: string;
    config?: {
      intent?: Record<string, unknown>;
      styling?: {
        primaryColor?: string;
        accentColor?: string;
        fontFamily?: string;
      };
      language?: string;
      chapters?: ChapterConfig[];
    };
  };
  sections: PublicReportSection[];
  branding: {
    showCompanyLogo: boolean;
    showConsultifyBranding: boolean;
    customMessage?: string;
  };
}

interface AuthState {
  authenticated: boolean;
  userName?: string;
}

// ==========================================
// HELPERS
// ==========================================

function groupByChapter(
  sections: PublicReportSection[],
  chapters: ChapterConfig[]
): Array<{ chapter: ChapterConfig | null; sections: PublicReportSection[] }> {
  if (!chapters || chapters.length === 0) {
    return [{ chapter: null, sections }];
  }

  const chapterMap = new Map<string, ChapterConfig>();
  chapters.forEach((ch) => chapterMap.set(ch.id, ch));

  const groups: Array<{ chapter: ChapterConfig | null; sections: PublicReportSection[] }> = [];
  let currentChapterId: string | null = null;
  let currentGroup: PublicReportSection[] = [];

  for (const section of sections) {
    const chapterId = section.chapter || null;
    if (chapterId !== currentChapterId) {
      if (currentGroup.length > 0) {
        groups.push({
          chapter: currentChapterId ? chapterMap.get(currentChapterId) || null : null,
          sections: currentGroup,
        });
      }
      currentChapterId = chapterId;
      currentGroup = [section];
    } else {
      currentGroup.push(section);
    }
  }

  if (currentGroup.length > 0) {
    groups.push({
      chapter: currentChapterId ? chapterMap.get(currentChapterId) || null : null,
      sections: currentGroup,
    });
  }

  return groups;
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

const CoverPage: React.FC<{
  report: PublicReportData['report'];
  branding: PublicReportData['branding'];
  isPl: boolean;
}> = ({ report, branding, isPl }) => {
  const primaryColor = report.config?.styling?.primaryColor || '#1e3a5f';

  return (
    <div
      className="relative overflow-hidden rounded-2xl mb-8 print:mb-4"
      style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}
    >
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/20 -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-white/10 translate-y-1/3 -translate-x-1/4" />
      </div>

      <div className="relative px-8 py-12 md:px-12 md:py-16 text-white">
        {/* Source badge */}
        {report.sourceFramework && (
          <div className="inline-block px-3 py-1 mb-6 text-xs font-medium bg-white/15 rounded-full backdrop-blur-sm border border-c-border">
            {report.sourceFramework}
          </div>
        )}

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4 max-w-3xl">
          {report.title}
        </h1>

        {/* Description */}
        {report.description && (
          <p className="text-lg text-white/80 max-w-2xl mb-8 leading-relaxed">
            {report.description}
          </p>
        )}

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-white/70">
          {report.sourceName && (
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              {report.sourceName}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {new Date(report.createdAt).toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>

        {/* Custom message */}
        {branding.customMessage && (
          <div className="mt-6 px-4 py-3 bg-white/10 rounded-lg backdrop-blur-sm border border-c-border-subtle text-sm text-white/90">
            {branding.customMessage}
          </div>
        )}
      </div>
    </div>
  );
};

const TableOfContents: React.FC<{
  groups: Array<{ chapter: ChapterConfig | null; sections: PublicReportSection[] }>;
  onNavigate: (sectionKey: string) => void;
  isPl: boolean;
}> = ({ groups, onNavigate, isPl }) => {
  const [collapsed, setCollapsed] = useState(false);

  const totalSections = groups.reduce((sum, g) => sum + g.sections.length, 0);
  if (totalSections < 3) return null;

  return (
    <div className="bg-c-surface rounded-xl border border-c-border-subtle mb-8 overflow-hidden print:hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-c-surface-raised transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-c-info" />
          <span className="font-semibold text-c-text">
            {isPl ? 'Spis Treści' : 'Table of Contents'}
          </span>
          <span className="text-sm text-c-text-secondary">({totalSections})</span>
        </div>
        {collapsed ? (
          <ChevronRight className="w-5 h-5 text-c-text-secondary" />
        ) : (
          <ChevronDown className="w-5 h-5 text-c-text-secondary" />
        )}
      </button>

      {!collapsed && (
        <div className="px-6 pb-5 space-y-1">
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.chapter && (
                <div className="flex items-center gap-2 mt-3 mb-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: group.chapter.color || '#3B82F6' }}
                  />
                  <span className="text-sm font-medium text-c-text-secondary uppercase tracking-wider">
                    {group.chapter.title}
                  </span>
                </div>
              )}
              {group.sections
                .filter((s) => s.sectionType !== 'cover')
                .map((section, si) => (
                  <button
                    key={section.sectionKey}
                    onClick={() => onNavigate(section.sectionKey)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-c-surface-raised transition-colors group"
                  >
                    <span className="text-xs text-c-text-secondary font-mono w-6 text-right">
                      {gi > 0 ? `${gi}.${si + 1}` : `${si + 1}`}
                    </span>
                    <span className="text-sm text-c-text-secondary group-hover:text-c-info transition-colors">
                      {section.title}
                    </span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DownloadBar: React.FC<{
  token: string;
  password: string;
  authState: AuthState;
  isPl: boolean;
  onLoginRedirect: () => void;
}> = ({ token, password, authState, isPl, onLoginRedirect }) => {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (format: 'pdf' | 'pptx' | 'docx') => {
    setDownloading(format);
    try {
      const pwdParam = password ? `?password=${encodeURIComponent(password)}` : '';
      const url = `/api/public/report/${token}/${format}${pwdParam}`;

      if (format === 'pdf') {
        // PDF is public — simple redirect
        window.open(url, '_blank');
      } else {
        // PPTX/DOCX require auth — use fetch with bearer token
        const storedToken = localStorage.getItem('token');
        const response = await fetch(url, {
          headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Download failed');
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `report.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      console.error(`Failed to download ${format}:`, err);
    } finally {
      setTimeout(() => setDownloading(null), 1500);
    }
  };

  return (
    <div className="flex items-center gap-2 print:hidden">
      {/* PDF — always available */}
      <button
        onClick={() => handleDownload('pdf')}
        disabled={downloading === 'pdf'}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white backdrop-blur-sm"
      >
        {downloading === 'pdf' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        PDF
      </button>

      {/* PPTX / DOCX — require login */}
      {authState.authenticated ? (
        <>
          <button
            onClick={() => handleDownload('pptx')}
            disabled={downloading === 'pptx'}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white backdrop-blur-sm"
          >
            {downloading === 'pptx' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Presentation className="w-4 h-4" />
            )}
            PPTX
          </button>
          <button
            onClick={() => handleDownload('docx')}
            disabled={downloading === 'docx'}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white backdrop-blur-sm"
          >
            {downloading === 'docx' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            DOCX
          </button>
        </>
      ) : (
        <button
          onClick={onLoginRedirect}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-c-accent/80 hover:bg-c-accent rounded-lg transition-colors text-white backdrop-blur-sm"
          title={isPl ? 'Zaloguj się aby pobrać PPTX/DOCX' : 'Sign in to download PPTX/DOCX'}
        >
          <LogIn className="w-4 h-4" />
          {isPl ? 'Zaloguj aby pobrać więcej' : 'Sign in for more'}
        </button>
      )}
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const PublicReportBuilderView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [data, setData] = useState<PublicReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [authState, setAuthState] = useState<AuthState>({ authenticated: false });

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Check auth state
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        if (!storedToken) {
          setAuthState({ authenticated: false });
          return;
        }
        const resp = await fetch(`/api/public/report/${token}/check-auth`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        const result = await resp.json();
        setAuthState(result);
      } catch {
        setAuthState({ authenticated: false });
      }
    };
    if (token) checkAuth();
  }, [token]);

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
      const urlPassword = searchParams.get('password');
      fetchReport(urlPassword || undefined);
    }
  }, [token, searchParams, fetchReport]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport(password);
  };

  const handleLoginRedirect = () => {
    // Store current URL so we can redirect back after login
    const currentUrl = window.location.pathname + window.location.search;
    window.location.href = `/login?redirect=${encodeURIComponent(currentUrl)}`;
  };

  const navigateToSection = useCallback((sectionKey: string) => {
    const el = sectionRefs.current[sectionKey];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Group sections by chapter
  const chapterGroups = useMemo(() => {
    if (!data) return [];
    const chapters = (data.report.config?.chapters || []) as ChapterConfig[];
    return groupByChapter(data.sections, chapters);
  }, [data]);

  const primaryColor = data?.report.config?.styling?.primaryColor || '#1e3a5f';
  const accentColor = data?.report.config?.styling?.accentColor;

  // ==========================================
  // LOADING STATE
  // ==========================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-c-bg">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-c-info mx-auto mb-4" />
          <p className="text-c-text-secondary">
            {isPl ? 'Ładowanie raportu...' : 'Loading report...'}
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // PASSWORD REQUIRED
  // ==========================================

  if (requiresPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-c-bg">
        <div className="max-w-md w-full mx-4 p-8 bg-c-surface rounded-2xl shadow-xl border border-c-border-subtle">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-c-info/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-c-info" />
            </div>
            <h1 className="text-xl font-bold text-c-text">
              {isPl ? 'Raport chroniony hasłem' : 'Password Protected Report'}
            </h1>
            <p className="text-c-text-muted mt-2 text-sm">
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
                className={`w-full px-4 py-3 border rounded-xl bg-c-surface text-c-text focus:ring-2 focus:ring-c-focus focus:border-transparent transition-all ${
                  passwordError
                    ? 'border-danger-400 ring-2 ring-danger-100'
                    : 'border-c-border'
                }`}
                autoFocus
              />
              {passwordError && (
                <p className="mt-2 text-sm text-danger-500">
                  {isPl ? 'Nieprawidłowe hasło' : 'Invalid password'}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full px-4 py-3 bg-c-accent text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-c-accent/25"
            >
              {isPl ? 'Wyświetl raport' : 'View Report'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // ERROR STATES
  // ==========================================

  if (error === 'notfound') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-c-bg">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-danger-100 dark:bg-danger-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-danger-500" />
          </div>
          <h1 className="text-2xl font-bold text-c-text mb-2">
            {isPl ? 'Link wygasł lub nie istnieje' : 'Link Expired or Not Found'}
          </h1>
          <p className="text-c-text-muted mb-6">
            {isPl
              ? 'Ten link do raportu wygasł lub został unieważniony.'
              : 'This report link has expired or has been revoked.'}
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-c-text-secondary">
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
      <div className="min-h-screen flex items-center justify-center bg-c-bg">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertTriangle className="w-16 h-16 text-danger-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-c-text mb-2">
            {isPl ? 'Wystąpił błąd' : 'An Error Occurred'}
          </h1>
          <p className="text-c-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // MAIN REPORT VIEW
  // ==========================================

  return (
    <div className="min-h-screen bg-c-bg">
      {/* ── Sticky Header ── */}
      <header
        className="sticky top-0 z-50 backdrop-blur-xl border-b border-c-border-subtle print:static"
        style={{ backgroundColor: `${primaryColor}f0` }}
      >
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white min-w-0">
            <FileText className="w-5 h-5 flex-shrink-0 opacity-70" />
            <div className="min-w-0">
              <h1 className="font-semibold text-sm truncate">{data.report.title}</h1>
              {data.report.sourceName && (
                <p className="text-xs text-white/60 truncate">{data.report.sourceName}</p>
              )}
            </div>
          </div>

          <DownloadBar
            token={token || ''}
            password={password}
            authState={authState}
            isPl={!!isPl}
            onLoginRedirect={handleLoginRedirect}
          />
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        {/* Cover Page */}
        <CoverPage report={data.report} branding={data.branding} isPl={!!isPl} />

        {/* Table of Contents */}
        <TableOfContents groups={chapterGroups} onNavigate={navigateToSection} isPl={!!isPl} />

        {/* Auth info banner */}
        {authState.authenticated && (
          <div className="flex items-center gap-2 px-4 py-2 mb-6 bg-c-success/10 border border-c-success/30 rounded-lg text-sm text-c-success print:hidden">
            <Eye className="w-4 h-4" />
            <span>
              {isPl
                ? `Zalogowany jako ${authState.userName || 'użytkownik'} — pełne opcje pobierania dostępne`
                : `Signed in as ${authState.userName || 'user'} — full download options available`}
            </span>
          </div>
        )}

        {/* Report Sections */}
        <div className="space-y-1">
          {chapterGroups.map((group, gi) => (
            <React.Fragment key={gi}>
              {/* Chapter Divider */}
              {group.chapter && (
                <div className="pt-8 pb-4 first:pt-0">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-1 h-8 rounded-full"
                      style={{ backgroundColor: group.chapter.color || primaryColor }}
                    />
                    <h2 className="text-xl font-bold text-c-text tracking-tight">
                      {group.chapter.title}
                    </h2>
                  </div>
                </div>
              )}

              {/* Sections in this chapter */}
              {group.sections.map((section) => {
                const isCover = section.sectionType === 'cover';
                if (isCover) return null; // Cover is rendered above

                const hasContent = section.content && section.content.trim().length > 0;

                return (
                  <div
                    key={section.sectionKey}
                    ref={(el) => {
                      sectionRefs.current[section.sectionKey] = el;
                    }}
                    className="bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden mb-4 shadow-sm hover:shadow-md transition-shadow print:shadow-none print:border print:mb-2"
                    id={`section-${section.sectionKey}`}
                  >
                    {/* Section Header */}
                    <div className="px-6 py-4 border-b border-c-border-subtle">
                      <h3 className="text-lg font-semibold text-c-text">
                        {section.title}
                      </h3>
                    </div>

                    {/* Section Content */}
                    <div className="px-6 py-5">
                      {hasContent ? (
                        <SmartBlockRenderer
                          content={section.content}
                          blockType={section.blockTypeId || section.sectionType}
                          renderKind={section.renderKind}
                          primaryColor={primaryColor?.replace('#', '')}
                          accentColor={accentColor?.replace('#', '')}
                          blockSettings={section.blockConfig}
                        />
                      ) : (
                        <p className="text-c-text-secondary italic text-sm">
                          {isPl ? 'Sekcja bez treści' : 'No content in this section'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}

          {data.sections.length === 0 && (
            <div className="bg-c-surface rounded-xl p-12 text-center text-c-text-secondary border border-c-border-subtle">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{isPl ? 'Brak treści w raporcie' : 'No content in this report'}</p>
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="max-w-5xl mx-auto px-6 py-8 print:py-2">
        <div className="border-t border-c-border-subtle pt-6 print:pt-2">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-c-text-muted">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {new Date(data.report.createdAt).toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4" />
                {isPl ? 'Udostępniony raport' : 'Shared Report'}
              </span>
            </div>

            {data.branding.showConsultifyBranding && (
              <p className="text-xs font-medium tracking-wide">
                Powered by <span className="text-c-accent">Consultify</span>
              </p>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicReportBuilderView;
