/**
 * Changelog View
 *
 * Release notes and version history for the platform.
 * Features: Version timeline, breaking changes alerts, migration guides.
 *
 * Route: /docs/changelog
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Bug,
  Calendar,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  Rocket,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/primitives/Button';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

type ChangeType = 'feature' | 'improvement' | 'fix' | 'breaking' | 'security';

interface ChangeItem {
  type: ChangeType;
  title: string;
  description?: string;
  module?: string;
}

interface Release {
  version: string;
  date: string;
  title: string;
  description: string;
  isLatest?: boolean;
  isMajor?: boolean;
  changes: ChangeItem[];
}

// ============================================
// MOCK DATA
// ============================================

const RELEASES: Release[] = [
  {
    version: '6.2.0',
    date: '2026-01-30',
    title: 'Enterprise Documentation Portal',
    description:
      'Complete documentation overhaul with interactive API reference and enhanced knowledge base.',
    isLatest: true,
    isMajor: true,
    changes: [
      {
        type: 'feature',
        title: 'Interactive API Reference',
        description: 'Stripe-style API explorer with code samples',
        module: 'Docs',
      },
      {
        type: 'feature',
        title: 'Changelog Section',
        description: 'Version history with breaking changes tracking',
        module: 'Docs',
      },
      {
        type: 'feature',
        title: 'Security & Compliance Hub',
        description: 'GDPR, SOC 2 compliance documentation',
        module: 'Docs',
      },
      {
        type: 'improvement',
        title: 'Search Performance',
        description: 'Sub-100ms search response time',
        module: 'Docs',
      },
      {
        type: 'improvement',
        title: 'Mobile Documentation Experience',
        description: 'Fully responsive documentation portal',
        module: 'Docs',
      },
    ],
  },
  {
    version: '6.1.4',
    date: '2026-01-28',
    title: 'Testing Infrastructure Expansion',
    description: 'Major expansion of automated testing with 7,800+ global tests.',
    changes: [
      {
        type: 'improvement',
        title: '19 Industrial Modules Test Coverage',
        description: '100% logic verification',
        module: 'Testing',
      },
      {
        type: 'improvement',
        title: 'Professional Testing Toolkit v2.1',
        description: 'Modular factories and custom matchers',
        module: 'Testing',
      },
      {
        type: 'fix',
        title: 'ESLint Error Resolution',
        description: 'Resolved 11,000+ linting errors',
        module: 'Core',
      },
    ],
  },
  {
    version: '6.1.3',
    date: '2026-01-25',
    title: 'Codebase Hygiene & Stabilization',
    description: 'Technical debt liquidation and TypeScript stabilization.',
    changes: [
      {
        type: 'improvement',
        title: 'Repository Cleanup',
        description: 'Removed 1.1GB+ of technical bloat',
        module: 'Core',
      },
      {
        type: 'improvement',
        title: 'TypeScript Strict Mode Progress',
        description: 'Safe refactoring protocol implementation',
        module: 'Core',
      },
      {
        type: 'fix',
        title: 'ESM Module Resolution',
        description: 'Fixed circular dependencies',
        module: 'Core',
      },
    ],
  },
  {
    version: '6.1.0',
    date: '2026-01-20',
    title: 'AI & Communication Unification',
    description: 'Consolidated AI framework with multi-channel communication.',
    isMajor: true,
    changes: [
      {
        type: 'feature',
        title: 'AI Action Registry',
        description: 'Centralized AI capabilities catalog',
        module: 'AI',
      },
      {
        type: 'feature',
        title: 'Unified Inbox',
        description: 'Multi-channel notification hub',
        module: 'Communication',
      },
      {
        type: 'improvement',
        title: 'Context Provider Pattern',
        description: 'Decentralized AI context management',
        module: 'AI',
      },
      {
        type: 'breaking',
        title: 'AI API Changes',
        description: 'New endpoint structure for AI actions',
        module: 'AI',
      },
    ],
  },
  {
    version: '6.0.0',
    date: '2026-01-15',
    title: 'Consultify 6.0 - Transformation AI Platform',
    description: 'Major platform evolution to Consultify 6.0 with 19 transformation modules.',
    isMajor: true,
    changes: [
      {
        type: 'feature',
        title: 'Platform Rebrand',
        description: 'Transition to Industrial Excellence Platform',
        module: 'Platform',
      },
      {
        type: 'feature',
        title: '19 Industrial Modules',
        description: 'MES, WMS, QMS, CMMS, IoT, GEMBA, HSE, ESG, and more',
        module: 'Industrial',
      },
      {
        type: 'feature',
        title: 'Multi-Framework Assessment',
        description: 'SIRI, ADMA, CMMI, Lean 4.0 support',
        module: 'Assessment',
      },
      {
        type: 'feature',
        title: '6-Language Support',
        description: 'EN, PL, DE, ES, AR, JA with RTL',
        module: 'Localization',
      },
      {
        type: 'breaking',
        title: 'New Navigation Structure',
        description: 'Reorganized module sidebar',
        module: 'UI',
      },
      {
        type: 'breaking',
        title: 'Database Schema Updates',
        description: 'Migration required from 5.x',
        module: 'Database',
      },
    ],
  },
];

// ============================================
// HELPER COMPONENTS
// ============================================

const CHANGE_TYPE_CONFIG: Record<
  ChangeType,
  { icon: React.ElementType; label: string; color: string }
> = {
  feature: {
    icon: Sparkles,
    label: 'New Feature',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  improvement: {
    icon: Zap,
    label: 'Improvement',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  fix: {
    icon: Bug,
    label: 'Bug Fix',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  breaking: {
    icon: AlertTriangle,
    label: 'Breaking',
    color: 'bg-danger-500/20 text-danger-400 border-danger-500/30',
  },
  security: {
    icon: CheckCircle2,
    label: 'Security',
    color: 'bg-c-accent-soft text-c-accent border-c-accent/30',
  },
};

function ChangeTypeBadge({ type }: { type: ChangeType }) {
  const config = CHANGE_TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border',
        config.color
      )}
    >
      <Icon size={12} />
      {config.label}
    </span>
  );
}

function ReleaseCard({ release }: { release: Release }) {
  const [isExpanded, setIsExpanded] = useState(release.isLatest);

  const featureCount = release.changes.filter((c) => c.type === 'feature').length;
  const improvementCount = release.changes.filter((c) => c.type === 'improvement').length;
  const fixCount = release.changes.filter((c) => c.type === 'fix').length;
  const breakingCount = release.changes.filter((c) => c.type === 'breaking').length;

  return (
    <motion.div
      layout
      className={cn(
        'relative border rounded-xl overflow-hidden',
        release.isLatest ? 'border-blue-500/50 bg-blue-500/5' : 'border-c-border bg-c-surface'
      )}
    >
      {/* Timeline connector */}
      <div className="absolute left-8 top-0 bottom-0 w-px bg-c-border" />

      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start gap-6 p-6 text-left hover:bg-c-surface-raised transition-colors"
      >
        {/* Version marker */}
        <div
          className={cn(
            'relative z-10 flex-shrink-0 w-4 h-4 rounded-full border-2',
            release.isMajor ? 'bg-blue-500 border-blue-400' : 'bg-c-surface-raised border-c-border-strong'
          )}
        />

        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-white">{release.version}</h3>
            {release.isLatest && (
              <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                Latest
              </Badge>
            )}
            {release.isMajor && (
              <Badge
                variant="outline"
                className="bg-c-accent-soft text-c-accent border-c-accent/50"
              >
                <Star size={12} className="mr-1" />
                Major
              </Badge>
            )}
          </div>

          <h4 className="text-lg text-c-text mb-2">{release.title}</h4>
          <p className="text-sm text-c-text-muted mb-3">{release.description}</p>

          <div className="flex items-center gap-4 text-xs text-c-text-muted">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {new Date(release.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            {featureCount > 0 && <span className="text-green-400">{featureCount} features</span>}
            {improvementCount > 0 && (
              <span className="text-blue-400">{improvementCount} improvements</span>
            )}
            {fixCount > 0 && <span className="text-amber-400">{fixCount} fixes</span>}
            {breakingCount > 0 && <span className="text-danger-400">{breakingCount} breaking</span>}
          </div>
        </div>

        <ChevronRight
          size={20}
          className={cn('text-c-text-muted transition-transform', isExpanded && 'rotate-90')}
        />
      </button>

      {/* Changes List */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-c-border px-6 py-4 ml-16"
        >
          <div className="space-y-3">
            {release.changes.map((change, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <ChangeTypeBadge type={change.type} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-c-text">{change.title}</span>
                    {change.module && (
                      <span className="text-xs text-c-text-muted bg-c-surface-raised px-1.5 py-0.5 rounded">
                        {change.module}
                      </span>
                    )}
                  </div>
                  {change.description && (
                    <p className="text-xs text-c-text-muted mt-0.5">{change.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DocsChangelogView() {
  const [filter, setFilter] = useState<'all' | 'major' | 'breaking'>('all');

  const filteredReleases = RELEASES.filter((release) => {
    if (filter === 'major') return release.isMajor;
    if (filter === 'breaking') return release.changes.some((c) => c.type === 'breaking');
    return true;
  });

  return (
    <div className="min-h-screen bg-c-bg">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-c-accent-soft to-c-bg border-b border-c-border">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <GitBranch className="text-c-accent" size={32} />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">Changelog</h1>
            <p className="text-xl text-c-text-secondary max-w-2xl mx-auto mb-8">
              Track all updates, new features, and improvements to the Consultify platform.
            </p>

            {/* Subscribe Button */}
            <Button variant="outline" className="gap-2">
              <Bookmark size={16} />
              Subscribe to Updates
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Filter & Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="flex items-center gap-2 mb-8">
          <span className="text-sm text-c-text-muted">Filter:</span>
          {(['all', 'major', 'breaking'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'primary' : 'ghost'}
              onClick={() => setFilter(f)}
              className={cn(filter === f ? 'bg-c-surface-raised' : 'text-c-text-muted')}
            >
              {f === 'all' && 'All Releases'}
              {f === 'major' && 'Major Only'}
              {f === 'breaking' && 'Breaking Changes'}
            </Button>
          ))}
        </div>

        {/* Releases Timeline */}
        <div className="space-y-4">
          {filteredReleases.map((release, index) => (
            <motion.div
              key={release.version}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <ReleaseCard release={release} />
            </motion.div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 text-center space-y-4">
          <p className="text-c-text-muted">
            Looking for older releases? Check our{' '}
            <a href="#" className="text-blue-400 hover:underline">
              release archive
            </a>
            .
          </p>
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 text-c-accent hover:text-c-accent/80 transition-colors"
          >
            <ArrowRight size={16} />
            Back to Documentation Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default DocsChangelogView;
