/**
 * Security & Compliance View
 *
 * Trust center with security certifications, privacy policies, and compliance docs.
 * Features: Security overview, GDPR/SOC2 status, penetration test reports.
 *
 * Route: /docs/security
 */

import { motion } from 'framer-motion';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  FileCheck,
  Globe,
  Key,
  Lock,
  Server,
  Shield,
  ShieldCheck,
  Users,
} from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/primitives/Button';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface Certification {
  name: string;
  status: 'certified' | 'in-progress' | 'planned';
  icon: React.ElementType;
  description: string;
  validUntil?: string;
  badge?: string;
}

interface SecurityFeature {
  title: string;
  description: string;
  icon: React.ElementType;
}

// ============================================
// DATA
// ============================================

const CERTIFICATIONS: Certification[] = [
  {
    name: 'SOC 2 Type II',
    status: 'certified',
    icon: ShieldCheck,
    description: 'Independent audit of security, availability, and confidentiality controls.',
    validUntil: '2027-01-15',
    badge: 'Certified',
  },
  {
    name: 'ISO 27001',
    status: 'certified',
    icon: Award,
    description: 'International standard for information security management systems.',
    validUntil: '2026-12-01',
    badge: 'Certified',
  },
  {
    name: 'GDPR Compliant',
    status: 'certified',
    icon: Globe,
    description: 'Full compliance with EU General Data Protection Regulation.',
    badge: 'Compliant',
  },
  {
    name: 'CCPA Compliant',
    status: 'certified',
    icon: Globe,
    description: 'California Consumer Privacy Act compliance for US operations.',
    badge: 'Compliant',
  },
  {
    name: 'ISO 22301',
    status: 'in-progress',
    icon: Server,
    description: 'Business continuity management certification.',
    badge: 'In Progress',
  },
  {
    name: 'FedRAMP',
    status: 'planned',
    icon: Shield,
    description: 'US federal cloud security authorization.',
    badge: 'Planned 2027',
  },
];

const SECURITY_FEATURES: SecurityFeature[] = [
  {
    title: 'End-to-End Encryption',
    description: 'All data is encrypted at rest (AES-256) and in transit (TLS 1.3).',
    icon: Lock,
  },
  {
    title: 'Multi-Factor Authentication',
    description: 'TOTP, SMS, and hardware security keys (FIDO2/WebAuthn) supported.',
    icon: Key,
  },
  {
    title: 'Role-Based Access Control',
    description: 'Granular permissions with organization, team, and project-level controls.',
    icon: Users,
  },
  {
    title: 'Audit Logging',
    description: 'Comprehensive activity logs with 90-day retention and export capabilities.',
    icon: FileCheck,
  },
  {
    title: 'Data Residency',
    description: 'Choose your data region: EU (Frankfurt), US (Virginia), or APAC (Singapore).',
    icon: Globe,
  },
  {
    title: 'Penetration Testing',
    description: 'Annual third-party penetration tests with remediation tracking.',
    icon: Shield,
  },
];

const GDPR_RIGHTS = [
  'Right to Access (Article 15)',
  'Right to Rectification (Article 16)',
  'Right to Erasure (Article 17)',
  'Right to Data Portability (Article 20)',
  'Right to Object (Article 21)',
  'Right to Withdraw Consent',
];

// ============================================
// HELPER COMPONENTS
// ============================================

function CertificationCard({ cert }: { cert: Certification }) {
  const Icon = cert.icon;

  return (
    <div
      className={cn(
        'p-6 rounded-xl border transition-colors',
        cert.status === 'certified'
          ? 'bg-green-500/5 border-green-500/30 hover:border-green-500/50'
          : cert.status === 'in-progress'
            ? 'bg-yellow-500/5 border-yellow-500/30 hover:border-yellow-500/50'
            : 'bg-c-surface-raised border-c-border hover:border-c-border-strong'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            'p-3 rounded-lg',
            cert.status === 'certified'
              ? 'bg-green-500/20'
              : cert.status === 'in-progress'
                ? 'bg-yellow-500/20'
                : 'bg-c-surface-raised'
          )}
        >
          <Icon
            size={24}
            className={cn(
              cert.status === 'certified'
                ? 'text-green-400'
                : cert.status === 'in-progress'
                  ? 'text-yellow-400'
                  : 'text-c-text-muted'
            )}
          />
        </div>
        <span
          className={cn(
            'text-xs font-medium px-2 py-1 rounded-full',
            cert.status === 'certified'
              ? 'bg-green-500/20 text-green-400'
              : cert.status === 'in-progress'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-c-surface-raised text-c-text-muted'
          )}
        >
          {cert.badge}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-c-text mb-2">{cert.name}</h3>
      <p className="text-sm text-c-text-secondary mb-4">{cert.description}</p>

      {cert.validUntil && (
        <p className="text-xs text-c-text-muted">
          Valid until:{' '}
          {new Date(cert.validUntil).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      )}
    </div>
  );
}

function SecurityFeatureCard({ feature }: { feature: SecurityFeature }) {
  const Icon = feature.icon;

  return (
    <div className="flex gap-4 p-4 rounded-lg bg-c-surface-raised border border-c-border hover:border-c-border-strong transition-colors">
      <div className="flex-shrink-0 p-2 rounded-lg bg-blue-500/10">
        <Icon size={20} className="text-blue-400" />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-c-text mb-1">{feature.title}</h4>
        <p className="text-xs text-c-text-muted">{feature.description}</p>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DocsSecurityView() {
  return (
    <div className="min-h-screen bg-c-bg">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-c-success/10 to-c-bg border-b border-c-border">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="text-green-400" size={32} />
            </div>
            <h1 className="text-4xl font-bold text-c-text mb-4">Security & Compliance</h1>
            <p className="text-xl text-c-text-secondary max-w-2xl mx-auto mb-8">
              Enterprise-grade security built into every layer of the Consultify platform. Your data
              protection is our top priority.
            </p>

            <div className="flex items-center justify-center gap-4">
              <Button className="gap-2 bg-green-600 hover:bg-green-700">
                <Download size={16} />
                Download Security Whitepaper
              </Button>
              <Button variant="outline" className="gap-2">
                <ExternalLink size={16} />
                Request SOC 2 Report
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Certifications Grid */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-16"
        >
          <h2 className="text-2xl font-bold text-c-text mb-6 flex items-center gap-3">
            <Award className="text-green-400" />
            Certifications & Compliance
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CERTIFICATIONS.map((cert) => (
              <CertificationCard key={cert.name} cert={cert} />
            ))}
          </div>
        </motion.section>

        {/* Security Features */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-16"
        >
          <h2 className="text-2xl font-bold text-c-text mb-6 flex items-center gap-3">
            <Lock className="text-blue-400" />
            Security Features
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {SECURITY_FEATURES.map((feature) => (
              <SecurityFeatureCard key={feature.title} feature={feature} />
            ))}
          </div>
        </motion.section>

        {/* GDPR Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-16"
        >
          <div className="bg-c-surface border border-c-border rounded-xl p-8">
            <h2 className="text-2xl font-bold text-c-text mb-4 flex items-center gap-3">
              <Globe className="text-c-accent" />
              GDPR Compliance
            </h2>
            <p className="text-c-text-secondary mb-6">
              We are fully compliant with the EU General Data Protection Regulation (GDPR). Here's
              how we protect your rights:
            </p>

            <div className="grid md:grid-cols-2 gap-3 mb-6">
              {GDPR_RIGHTS.map((right) => (
                <div key={right} className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                  <span className="text-sm text-c-text-secondary">{right}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <Button variant="outline" size="sm" className="gap-2">
                <FileCheck size={14} />
                Privacy Policy
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <FileCheck size={14} />
                Data Processing Agreement
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <FileCheck size={14} />
                Cookie Policy
              </Button>
            </div>
          </div>
        </motion.section>

        {/* Data Residency */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-16"
        >
          <h2 className="text-2xl font-bold text-c-text mb-6 flex items-center gap-3">
            <Server className="text-blue-400" />
            Infrastructure & Data Residency
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { region: 'EU (Frankfurt)', provider: 'AWS eu-central-1', flag: '🇪🇺' },
              { region: 'US (Virginia)', provider: 'AWS us-east-1', flag: '🇺🇸' },
              { region: 'APAC (Singapore)', provider: 'AWS ap-southeast-1', flag: '🇸🇬' },
            ].map((dc) => (
              <div
                key={dc.region}
                className="p-6 bg-c-surface-raised border border-c-border rounded-xl text-center"
              >
                <span className="text-4xl mb-3 block">{dc.flag}</span>
                <h4 className="text-lg font-semibold text-c-text mb-1">{dc.region}</h4>
                <p className="text-sm text-c-text-muted">{dc.provider}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Vulnerability Disclosure */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-12"
        >
          <div className="bg-gradient-to-r from-c-info/10 to-c-accent-soft border border-c-info/30 rounded-xl p-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Shield size={24} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-c-text mb-2">
                  Responsible Disclosure Program
                </h3>
                <p className="text-c-text-secondary mb-4">
                  Found a security vulnerability? We appreciate your help in keeping Consultify
                  secure. Report issues responsibly and you may be eligible for our bug bounty
                  program.
                </p>
                <Button className="gap-2">
                  <ChevronRight size={16} />
                  Report a Vulnerability
                </Button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Footer CTA */}
        <div className="text-center">
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors"
          >
            <ArrowRight size={16} />
            Back to Documentation Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default DocsSecurityView;
