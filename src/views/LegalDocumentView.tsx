import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Cookie,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  FileText,
  Home,
  List,
  Lock,
  RotateCcw,
  Scale,
  Shield,
  Users,
  Zap,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import { LoadingState } from '@/components/ui/primitives';

interface LegalDocument {
  id: string;
  doc_type: string;
  version: string;
  title: string;
  content_md: string;
  effective_from: string;
  created_at: string;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

const DOCUMENT_ROUTES: Record<string, string> = {
  terms: 'TOS',
  privacy: 'PRIVACY',
  cookies: 'COOKIES',
  'acceptable-use': 'AUP',
  'ai-policy': 'AI_POLICY',
  subscription: 'SUBSCRIPTION',
  dpa: 'DPA',
  sla: 'SLA',
  refunds: 'REFUND',
  security: 'SECURITY',
  'customer-security': 'CUSTOMER_SECURITY',
  subprocessors: 'SUBPROCESSORS',
};

const DOCUMENT_INFO: Record<
  string,
  {
    title: string;
    description: string;
    icon: React.FC<{ className?: string }>;
    color: string;
  }
> = {
  TOS: {
    title: 'Terms of Service',
    description: 'Main agreement governing your use of Consultify',
    icon: Scale,
    color: 'from-primary-500 to-crimson-600',
  },
  PRIVACY: {
    title: 'Privacy Policy',
    description: 'How we collect, use, and protect your personal data under GDPR',
    icon: Shield,
    color: 'from-blue-500 to-blue-600',
  },
  COOKIES: {
    title: 'Cookie Policy',
    description: 'Information about cookies and tracking technologies',
    icon: Cookie,
    color: 'from-amber-500 to-amber-600',
  },
  AUP: {
    title: 'Acceptable Use Policy',
    description: 'Rules and guidelines for using the platform',
    icon: AlertTriangle,
    color: 'from-danger-500 to-pink-600',
  },
  AI_POLICY: {
    title: 'AI Usage Policy',
    description: 'Transparency about AI features, BYOK, and data handling',
    icon: Brain,
    color: 'from-primary-500 to-primary-600',
  },
  SUBSCRIPTION: {
    title: 'Subscription Agreement',
    description: 'Pricing plans, AI Credits, billing terms, and seat licensing',
    icon: CreditCard,
    color: 'from-emerald-500 to-blue-600',
  },
  DPA: {
    title: 'Data Processing Addendum',
    description: 'GDPR Article 28 compliant data processing terms',
    icon: Database,
    color: 'from-sky-500 to-blue-600',
  },
  SLA: {
    title: 'Service Level Agreement',
    description: 'Uptime commitments and support response times',
    icon: Zap,
    color: 'from-yellow-500 to-amber-600',
  },
  REFUND: {
    title: 'Refund & Cancellation Policy',
    description: 'Subscription changes, cancellations, and refunds',
    icon: RotateCcw,
    color: 'from-lime-500 to-green-600',
  },
  SECURITY: {
    title: 'Security Overview',
    description: 'Our security practices and certifications',
    icon: Lock,
    color: 'from-slate-500 to-zinc-600',
  },
  CUSTOMER_SECURITY: {
    title: 'Customer Data Security',
    description: 'How we protect your data: encryption, isolation, incident response',
    icon: Shield,
    color: 'from-crimson-500 to-primary-600',
  },
  SUBPROCESSORS: {
    title: 'Sub-processor List',
    description: 'Third parties who process data on our behalf',
    icon: Users,
    color: 'from-hbs-magenta-500 to-hbs-magenta-700',
  },
};

// Helper to generate slug from heading text
const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

// Extract TOC from markdown content
const extractToc = (markdown: string): TocItem[] => {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const toc: TocItem[] = [];
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].replace(/\*\*/g, '').trim();
    toc.push({
      id: generateSlug(text),
      text,
      level,
    });
  }

  return toc;
};

export const LegalDocumentView: React.FC = () => {
  const { docSlug } = useParams<{ docSlug: string }>();
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [tocOpen, setTocOpen] = useState(true);
  const contentRef = useRef<HTMLElement>(null);

  const docType = docSlug ? DOCUMENT_ROUTES[docSlug] : null;
  const docInfo = docType ? DOCUMENT_INFO[docType] : null;
  const IconComponent = docInfo?.icon || FileText;

  useEffect(() => {
    if (!docType) {
      setError('Document not found');
      setLoading(false);
      return;
    }

    fetchDocument(docType);
  }, [docType]);

  useEffect(() => {
    if (document?.content_md) {
      setToc(extractToc(document.content_md));
    }
  }, [document]);

  const fetchDocument = async (type: string) => {
    try {
      setLoading(true);

      // Try new V2 endpoint first, fall back to legacy
      let response = await fetch(`/api/legal/active/${type}`);

      if (response.ok) {
        const data = await response.json();
        setDocument({
          id: data.id,
          doc_type: data.docType,
          version: data.version,
          title: data.title,
          content_md: data.contentMd || '',
          effective_from: data.effectiveFrom || '',
          created_at: data.createdAt || '',
        });
        return;
      }

      // Fallback to legacy endpoint
      response = await fetch(`/api/legal/document/${type}`);
      if (!response.ok) {
        throw new Error('Failed to load document');
      }

      const data = await response.json();
      setDocument(data.document);
    } catch (err) {
      setError('Failed to load document. Please try again later.');
      console.error('Error loading legal document:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const scrollToSection = (id: string) => {
    const element = window.document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 flex items-center justify-center">
        <LoadingState variant="spinner" label="Loading document..." />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 bg-c-surface-raised dark:bg-c-surface/5 rounded-xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-c-text-secondary" />
          </div>
          <h1 className="text-2xl font-bold text-c-text mb-3">Document Not Found</h1>
          <p className="text-c-text-secondary mb-8">
            {error || 'The requested document could not be found.'}
          </p>
          <Link
            to="/legal"
            className="inline-flex items-center gap-2 p-4 py-2.5 bg-gradient-to-r from-primary-600 to-crimson-600 text-white rounded-xl hover:from-primary-500 hover:to-crimson-500 transition-all shadow-lg shadow-primary-500/25"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Legal Documents
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      {/* Header */}
      <header
        className={`sticky top-0 z-50 bg-gradient-to-r ${docInfo?.color || 'from-primary-600 to-crimson-600'} text-white shadow-lg`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                to="/legal"
                className="p-2 rounded-lg bg-c-bg/50 dark:bg-navy-950/30 hover:bg-c-surface/20 transition-colors"
                title="Back to Legal Center"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-c-surface/20 rounded-xl flex items-center justify-center">
                  <IconComponent className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">{docInfo?.title || document.title}</h1>
                  <p className="text-sm text-white/80">Version {document.version}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="flex items-center gap-2 px-3 py-2 text-sm bg-c-bg/50 dark:bg-navy-950/30 hover:bg-c-surface/20 rounded-lg transition-colors"
                title="Back to Homepage"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Home</span>
              </Link>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-c-bg/50 dark:bg-navy-950/30 hover:bg-c-surface/20 rounded-lg transition-colors"
                title="Print or save as PDF"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Print</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
          {/* Table of Contents - Sidebar */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24 bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden shadow-sm">
              <div className="p-4 border-b border-c-border-subtle">
                <div className="flex items-center gap-2 text-c-text-secondary">
                  <List className="w-4 h-4" />
                  <span className="font-semibold">Table of Contents</span>
                </div>
              </div>
              <div className="p-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                {toc.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-c-surface-raised dark:hover:bg-c-surface/5 ${
                      item.level === 2
                        ? 'font-medium text-c-text-secondary'
                        : 'pl-6 text-c-text-muted'
                    }`}
                  >
                    {item.text}
                  </button>
                ))}
              </div>
            </nav>
          </aside>

          {/* Mobile TOC */}
          <div className="lg:hidden mb-6">
            <button
              onClick={() => setTocOpen(!tocOpen)}
              className="w-full flex items-center justify-between p-4 bg-c-surface rounded-xl border border-c-border-subtle"
            >
              <div className="flex items-center gap-2 text-c-text-secondary">
                <List className="w-4 h-4" />
                <span className="font-semibold">Table of Contents</span>
              </div>
              {tocOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {tocOpen && (
              <div className="mt-2 p-2 bg-c-surface rounded-xl border border-c-border-subtle max-h-64 overflow-y-auto">
                {toc.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      scrollToSection(item.id);
                      setTocOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-c-surface-raised dark:hover:bg-c-surface/5 ${
                      item.level === 2
                        ? 'font-medium text-c-text-secondary'
                        : 'pl-6 text-c-text-muted'
                    }`}
                  >
                    {item.text}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Main Content */}
          <main>
            {/* Meta Info Card */}
            <div className="mb-8 p-4 bg-c-surface rounded-xl border border-c-border-subtle shadow-sm">
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary-100 dark:bg-primary-500/20 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <p className="text-xs text-c-text-muted">Effective Date</p>
                    <p className="font-medium text-c-text-secondary">
                      {new Date(document.effective_from).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-c-text-muted">Version</p>
                    <p className="font-medium text-c-text-secondary">{document.version}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Document Content */}
            <article
              ref={contentRef}
              className="legal-document bg-c-surface rounded-xl border border-c-border-subtle shadow-sm p-6 sm:p-8 lg:p-10"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Headings with anchor links
                  h1: ({ children }) => (
                    <h1 className="text-3xl font-bold text-c-text border-b-2 border-c-border-subtle pb-4 mb-8 mt-2">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => {
                    const text = String(children);
                    const id = generateSlug(text);
                    return (
                      <h2
                        id={id}
                        className="text-2xl font-bold text-c-text mt-12 mb-5 pb-3 border-b border-c-border-subtle scroll-mt-24"
                      >
                        {children}
                      </h2>
                    );
                  },
                  h3: ({ children }) => {
                    const text = String(children);
                    const id = generateSlug(text);
                    return (
                      <h3
                        id={id}
                        className="text-xl font-semibold text-c-text-secondary mt-8 mb-4 scroll-mt-24"
                      >
                        {children}
                      </h3>
                    );
                  },
                  h4: ({ children }) => (
                    <h4 className="text-lg font-semibold text-c-text-secondary mt-6 mb-3">
                      {children}
                    </h4>
                  ),
                  // Paragraphs
                  p: ({ children }) => (
                    <p className="text-c-text-secondary leading-relaxed mb-4">{children}</p>
                  ),
                  // Links
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline underline-offset-2 font-medium transition-colors"
                    >
                      {children}
                    </a>
                  ),
                  // Strong/bold
                  strong: ({ children }) => (
                    <strong className="font-semibold text-c-text">{children}</strong>
                  ),
                  // Lists
                  ul: ({ children }) => <ul className="space-y-2 my-4 ml-1">{children}</ul>,
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-2 my-4 ml-1 text-c-text-secondary">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="flex items-start gap-3 text-c-text-secondary">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-500 dark:bg-primary-400 mt-2.5 shrink-0" />
                      <span>{children}</span>
                    </li>
                  ),
                  // Tables - Beautiful styling
                  table: ({ children }) => (
                    <div className="my-6 overflow-x-auto rounded-xl border border-c-border-subtle">
                      <table
                        /* §27-exempt: tabela dokumentowa/raportowa read-only, do druku/eksportu */ className="w-full text-sm"
                      >
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-white/10 dark:to-white/5 border-b border-c-border-subtle">
                      {children}
                    </thead>
                  ),
                  tbody: ({ children }) => (
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                      {children}
                    </tbody>
                  ),
                  tr: ({ children }) => (
                    <tr className="hover:bg-c-bg dark:hover:bg-c-surface/5 transition-colors">
                      {children}
                    </tr>
                  ),
                  th: ({ children }) => (
                    <th className="px-4 py-3 text-left font-semibold text-c-text-secondary whitespace-nowrap">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-4 py-3 text-c-text-secondary">{children}</td>
                  ),
                  // Code
                  code: ({ className, children }) => {
                    const isBlock = className?.includes('language-');
                    if (isBlock) {
                      return (
                        <code className="block bg-slate-900 dark:bg-black/50 text-slate-100 p-4 rounded-xl text-sm font-mono overflow-x-auto">
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code className="bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded text-sm font-mono">
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => <pre className="my-4">{children}</pre>,
                  // Blockquote
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary-500 bg-primary-50 dark:bg-primary-500/10 px-4 py-3 my-4 rounded-r-xl">
                      {children}
                    </blockquote>
                  ),
                  // Horizontal rule
                  hr: () => <hr className="my-10 border-c-border-subtle" />,
                  // Images
                  img: ({ src, alt }) => (
                    <img src={src} alt={alt} className="rounded-xl my-4 max-w-full h-auto" />
                  ),
                }}
              >
                {document.content_md}
              </ReactMarkdown>
            </article>

            {/* Footer Navigation */}
            <nav className="mt-10 p-6 bg-c-surface rounded-xl border border-c-border-subtle shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-c-text mb-4">
                <ExternalLink className="w-4 h-4" />
                Related Legal Documents
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(DOCUMENT_ROUTES)
                  .filter(([slug]) => slug !== docSlug)
                  .slice(0, 4)
                  .map(([slug, type]) => {
                    const info = DOCUMENT_INFO[type];
                    const Icon = info?.icon || FileText;
                    return (
                      <Link
                        key={slug}
                        to={`/legal/${slug}`}
                        className="flex items-center gap-3 p-3 bg-c-bg dark:bg-c-surface/5 rounded-xl border border-c-border-subtle hover:border-primary-300 dark:hover:border-primary-500/50 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-all group"
                      >
                        <div
                          className={`w-9 h-9 bg-gradient-to-br ${info?.color || 'from-slate-400 to-slate-500'} rounded-lg flex items-center justify-center shrink-0`}
                        >
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-c-text-secondary group-hover:text-primary-600 dark:group-hover:text-primary-400 truncate">
                            {info?.title || type}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-c-text-secondary group-hover:text-primary-600 dark:group-hover:text-primary-400 shrink-0" />
                      </Link>
                    );
                  })}
              </div>
              <div className="mt-4 pt-4 border-t border-c-border-subtle">
                <Link
                  to="/legal"
                  className="inline-flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
                >
                  View all legal documents
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </nav>
          </main>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
                @media print {
                    header, aside, nav, button { display: none !important; }
                    main { padding: 0 !important; }
                    .legal-document {
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                    }
                    .lg\\:grid { display: block !important; }
                }
            `}</style>
    </div>
  );
};

export default LegalDocumentView;
