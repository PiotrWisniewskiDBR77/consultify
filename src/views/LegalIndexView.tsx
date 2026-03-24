import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  Cookie,
  CreditCard,
  Database,
  ExternalLink,
  FileText,
  Globe,
  Lock,
  Mail,
  Phone,
  Receipt,
  Scale,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

interface LegalDocumentCard {
  slug: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  required?: boolean;
  category: 'core' | 'business' | 'reference';
}

const LEGAL_DOCUMENTS: LegalDocumentCard[] = [
  {
    slug: 'terms',
    title: 'Terms of Service',
    description: 'The main agreement governing your use of the Consultify platform.',
    icon: <Scale className="w-5 h-5" />,
    iconBg: 'from-purple-500 to-indigo-600',
    required: true,
    category: 'core',
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    description: 'How we collect, use, store, and protect your personal data under GDPR.',
    icon: <Shield className="w-5 h-5" />,
    iconBg: 'from-blue-500 to-cyan-600',
    required: true,
    category: 'core',
  },
  {
    slug: 'cookies',
    title: 'Cookie Policy',
    description: 'Information about cookies and similar tracking technologies.',
    icon: <Cookie className="w-5 h-5" />,
    iconBg: 'from-amber-500 to-orange-600',
    required: false,
    category: 'core',
  },
  {
    slug: 'acceptable-use',
    title: 'Acceptable Use Policy',
    description: 'Rules and guidelines for appropriate use of the platform.',
    icon: <FileText className="w-5 h-5" />,
    iconBg: 'from-rose-500 to-pink-600',
    required: false,
    category: 'core',
  },
  {
    slug: 'ai-policy',
    title: 'AI Usage Policy',
    description: 'Transparency about our AI features, BYOK, data handling, and your controls.',
    icon: <Bot className="w-5 h-5" />,
    iconBg: 'from-violet-500 to-purple-600',
    required: false,
    category: 'core',
  },
  {
    slug: 'subscription',
    title: 'Subscription Agreement',
    description: 'Pricing plans, AI Credits, billing terms, and seat licensing.',
    icon: <Receipt className="w-5 h-5" />,
    iconBg: 'from-emerald-500 to-teal-600',
    required: false,
    category: 'business',
  },
  {
    slug: 'dpa',
    title: 'Data Processing Addendum',
    description: 'GDPR Article 28 compliant data processing terms for business customers.',
    icon: <Database className="w-5 h-5" />,
    iconBg: 'from-sky-500 to-blue-600',
    required: false,
    category: 'business',
  },
  {
    slug: 'sla',
    title: 'Service Level Agreement',
    description: 'Our uptime commitments, support response times, and service credits.',
    icon: <Clock className="w-5 h-5" />,
    iconBg: 'from-yellow-500 to-amber-600',
    required: false,
    category: 'business',
  },
  {
    slug: 'refunds',
    title: 'Refund & Cancellation',
    description: 'Policies for subscription changes, cancellations, and refunds.',
    icon: <CreditCard className="w-5 h-5" />,
    iconBg: 'from-lime-500 to-green-600',
    required: false,
    category: 'business',
  },
  {
    slug: 'security',
    title: 'Security Overview',
    description: 'Our security practices, certifications, and compliance measures.',
    icon: <Lock className="w-5 h-5" />,
    iconBg: 'from-slate-500 to-zinc-600',
    required: false,
    category: 'reference',
  },
  {
    slug: 'customer-security',
    title: 'Customer Data Security',
    description: 'How we protect your data: encryption, isolation, and incident response.',
    icon: <ShieldCheck className="w-5 h-5" />,
    iconBg: 'from-indigo-500 to-violet-600',
    required: false,
    category: 'reference',
  },
  {
    slug: 'subprocessors',
    title: 'Sub-processor List',
    description: 'Third-party services that process data on our behalf.',
    icon: <Users className="w-5 h-5" />,
    iconBg: 'from-fuchsia-500 to-pink-600',
    required: false,
    category: 'reference',
  },
];

const DocumentCard: React.FC<{ doc: LegalDocumentCard }> = ({ doc }) => (
  <Link
    to={`/legal/${doc.slug}`}
    className="group relative overflow-hidden p-4 bg-white dark:bg-navy-900 rounded-xl border border-slate-200/80 dark:border-navy-700 
                   hover:border-slate-300 dark:border-navy-700 dark:hover:border-white/20 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/20
                   transition-all duration-300 hover:-translate-y-1"
  >
    {/* Gradient background on hover */}
    <div
      className={`absolute inset-0 bg-gradient-to-br ${doc.iconBg} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`}
    />

    <div className="relative flex items-start gap-4">
      <div
        className={`p-2.5 rounded-xl bg-gradient-to-br ${doc.iconBg} text-white shadow-lg shadow-slate-200/50 dark:shadow-black/20`}
      >
        {doc.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {doc.title}
          </h3>
          {doc.required && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-md">
              Required
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
          {doc.description}
        </p>
      </div>
      <ArrowRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-purple-500 dark:group-hover:text-purple-400 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
    </div>
  </Link>
);

const SectionHeader: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
}> = ({ title, description, icon, gradient }) => (
  <div className="flex items-start gap-4 mb-6">
    <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
      {icon}
    </div>
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{title}</h2>
      <p className="text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  </div>
);

export const LegalIndexView: React.FC = () => {
  const coreDocuments = LEGAL_DOCUMENTS.filter((d) => d.category === 'core');
  const businessDocuments = LEGAL_DOCUMENTS.filter((d) => d.category === 'business');
  const referenceDocuments = LEGAL_DOCUMENTS.filter((d) => d.category === 'reference');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      {/* Navigation Bar */}
      <nav className="bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-2 text-white/80 hover:text-white transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Back to Home</span>
            </Link>
            <Link to="/" className="flex items-center gap-2 text-white">
              <img src="/assets/logos/logo-dark.svg?v=20260319" alt="Consultify" className="h-6" />
              <span className="font-bold">Consultify</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative bg-gradient-to-br from-slate-900 via-purple-900/90 to-indigo-900 text-white overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
              <Scale className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold">Legal Center</h1>
              <p className="text-purple-200 text-lg mt-1">Consultify by DBR77 Robotics</p>
            </div>
          </div>
          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl leading-relaxed">
            Transparency is fundamental to our relationship with you. Here you'll find all the legal
            documents that govern the use of Consultify and how we handle your data.
          </p>

          {/* Company Info Badges */}
          <div className="mt-10 flex flex-wrap gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm border border-white/10">
              <Building2 className="w-4 h-4 text-purple-300" />
              <span className="text-sm">DBR77 Robotics Sp. z o.o.</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm border border-white/10">
              <Globe className="w-4 h-4 text-purple-300" />
              <span className="text-sm">Toruń, Poland</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 rounded-full backdrop-blur-sm border border-emerald-400/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-100">GDPR Compliant</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 rounded-full backdrop-blur-sm border border-blue-400/20">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-100">EU Data Residency</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Core Documents */}
        <section className="mb-16">
          <SectionHeader
            title="Core Agreements"
            description="Fundamental documents for all users of Consultify."
            icon={<FileText className="w-6 h-6" />}
            gradient="from-purple-500 to-indigo-600"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {coreDocuments.map((doc) => (
              <DocumentCard key={doc.slug} doc={doc} />
            ))}
          </div>
        </section>

        {/* Business Documents */}
        <section className="mb-16">
          <SectionHeader
            title="Business & Billing"
            description="Additional terms for business customers and paid subscriptions."
            icon={<CreditCard className="w-6 h-6" />}
            gradient="from-emerald-500 to-teal-600"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {businessDocuments.map((doc) => (
              <DocumentCard key={doc.slug} doc={doc} />
            ))}
          </div>
        </section>

        {/* Reference Documents */}
        <section className="mb-16">
          <SectionHeader
            title="Security & Compliance"
            description="Reference documentation about our security practices and data processing."
            icon={<Lock className="w-6 h-6" />}
            gradient="from-slate-500 to-zinc-600"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {referenceDocuments.map((doc) => (
              <DocumentCard key={doc.slug} doc={doc} />
            ))}
          </div>
        </section>

        {/* Contact Section */}
        <section className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-8 sm:p-10 shadow-sm">
          <div className="flex items-start gap-4 mb-8">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Questions?</h2>
              <p className="text-slate-600 dark:text-slate-400">
                If you have any questions about these documents or need clarification, please
                contact us.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ContactCard
              label="Legal Inquiries"
              email="legal@dbr77.com"
              gradient="from-purple-500 to-indigo-600"
            />
            <ContactCard
              label="Privacy Matters"
              email="privacy@dbr77.com"
              gradient="from-blue-500 to-cyan-600"
            />
            <ContactCard
              label="Security Issues"
              email="security@dbr77.com"
              gradient="from-rose-500 to-pink-600"
            />
            <ContactCard
              label="Billing Questions"
              email="billing@dbr77.com"
              gradient="from-emerald-500 to-teal-600"
            />
          </div>
        </section>

        {/* Company Details */}
        <section className="mt-10 p-8 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200/50 dark:border-navy-700">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Company Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
            <div className="space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                DBR77 Robotics Sp. z o.o.
              </p>
              <p className="text-slate-600 dark:text-slate-400">ul. Żółkiewskiego 31</p>
              <p className="text-slate-600 dark:text-slate-400">87-100 Toruń, Poland</p>
            </div>
            <div className="space-y-1">
              <p className="text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">NIP:</span>{' '}
                8792725331
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">KRS:</span>{' '}
                0000860440
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">REGON:</span>{' '}
                387073039
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">Type:</span> Polish
                LLC (Sp. z o.o.)
              </p>
              <a
                href="https://dbr77.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline"
              >
                dbr77.com
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </section>

        {/* Last Updated */}
        <footer className="mt-12 text-center text-sm text-slate-500 dark:text-slate-400">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-full">
            <Sparkles className="w-4 h-4" />
            <span>Last updated: January 1, 2025 · Version 1.0</span>
          </div>
        </footer>
      </main>
    </div>
  );
};

const ContactCard: React.FC<{ label: string; email: string; gradient: string }> = ({
  label,
  email,
  gradient,
}) => (
  <a
    href={`mailto:${email}`}
    className="group block p-4 bg-slate-50 dark:bg-white/5 rounded-xl hover:bg-white dark:hover:bg-white/10 border border-transparent hover:border-slate-200 dark:border-navy-700 dark:hover:border-white/10 transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-black/20"
  >
    <div className="flex items-center gap-3 mb-2">
      <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${gradient}`} />
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
    </div>
    <p className="text-sm text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
      {email}
    </p>
  </a>
);

export default LegalIndexView;
