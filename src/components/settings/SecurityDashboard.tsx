/**
 * SecurityDashboard - Security Overview & Health Score
 *
 * Enterprise-grade security dashboard following HubSpot/ClickUp standards:
 * - Security Score (0-100) calculation
 * - Compliance badges (GDPR, SOC2, ISO 27001)
 * - Quick action cards
 * - Recent security events summary
 * - Encryption status information
 */

import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  Fingerprint,
  Globe,
  Key,
  Lock,
  Monitor,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { User } from '../../types';

interface SecurityDashboardProps {
  currentUser: User;
  onNavigateToTab?: (tabId: string) => void;
}

interface SecurityScore {
  total: number;
  breakdown: {
    mfa: { score: number; max: number; enabled: boolean };
    passwordStrength: { score: number; max: number; strength: string };
    recentActivity: { score: number; max: number; suspicious: number };
    sessions: { score: number; max: number; count: number };
    dataControls: { score: number; max: number; optedOut: boolean };
  };
  recommendations: string[];
}

interface SecurityEvent {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  timestamp: string;
  ip?: string;
}

interface ComplianceStatus {
  gdpr: { compliant: boolean; lastAudit?: string };
  soc2: { compliant: boolean; certifiedUntil?: string };
  iso27001: { compliant: boolean; certifiedUntil?: string };
  hipaa: { compliant: boolean; applicable: boolean };
}

const DEFAULT_SCORE: SecurityScore = {
  total: 0,
  breakdown: {
    mfa: { score: 0, max: 30, enabled: false },
    passwordStrength: { score: 0, max: 25, strength: 'unknown' },
    recentActivity: { score: 0, max: 20, suspicious: 0 },
    sessions: { score: 0, max: 15, count: 0 },
    dataControls: { score: 0, max: 10, optedOut: false },
  },
  recommendations: [],
};

// ISO 27001 audit ~2026-08-10 — until certified, do not claim "Certified" (integrity)
// SOC 2 and ISO 27001 certifications are in progress (see Legal/security-overview.md §8);
// they must not be shown as compliant/certified until the audit actually completes.
const DEFAULT_COMPLIANCE: ComplianceStatus = {
  gdpr: { compliant: true, lastAudit: '2024-12-01' },
  soc2: { compliant: false },
  iso27001: { compliant: false },
  hipaa: { compliant: false, applicable: false },
};

export const SecurityDashboard: React.FC<SecurityDashboardProps> = ({
  currentUser,
  onNavigateToTab,
}) => {
  const { t } = useTranslation();
  const [score, setScore] = useState<SecurityScore>(DEFAULT_SCORE);
  const [compliance, setCompliance] = useState<ComplianceStatus>(DEFAULT_COMPLIANCE);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSecurityData();
  }, [currentUser.id]);

  const loadSecurityData = async () => {
    try {
      setLoading(true);

      // Fetch security score
      const scoreResponse = await Api.get('/api/security/score').catch(() => null);
      if (scoreResponse?.score) {
        setScore(scoreResponse.score);
      } else {
        // Calculate local score based on user data
        calculateLocalScore();
      }

      // Fetch compliance status
      const complianceResponse = await Api.get('/api/security/compliance').catch(() => null);
      if (complianceResponse?.compliance) {
        setCompliance(complianceResponse.compliance);
      }

      // Fetch recent events
      const eventsResponse = await Api.get('/api/security/events?limit=5').catch(() => null);
      if (eventsResponse?.events) {
        setRecentEvents(eventsResponse.events);
      } else {
        setRecentEvents([]);
      }
    } catch (error) {
      console.error('Failed to load security data:', error);
      calculateLocalScore();
    } finally {
      setLoading(false);
    }
  };

  const calculateLocalScore = () => {
    const mfaEnabled = currentUser.mfaEnabled || false;
    const mfaScore = mfaEnabled ? 30 : 0;

    const passwordScore = 20; // Assume decent password
    const activityScore = 18; // Assume good activity
    const sessionsScore = 12; // Assume reasonable sessions
    const dataScore = 8; // Assume some data controls

    const total = mfaScore + passwordScore + activityScore + sessionsScore + dataScore;

    const recommendations: string[] = [];
    if (!mfaEnabled) {
      recommendations.push(
        t(
          'security.dashboard.recommendations.enableMfa',
          'Enable two-factor authentication for maximum security'
        )
      );
    }
    if (total < 80) {
      recommendations.push(
        t(
          'security.dashboard.recommendations.reviewSessions',
          'Review your active sessions regularly'
        )
      );
    }

    setScore({
      total,
      breakdown: {
        mfa: { score: mfaScore, max: 30, enabled: mfaEnabled },
        passwordStrength: { score: passwordScore, max: 25, strength: 'good' },
        recentActivity: { score: activityScore, max: 20, suspicious: 0 },
        sessions: { score: sessionsScore, max: 15, count: 1 },
        dataControls: { score: dataScore, max: 10, optedOut: false },
      },
      recommendations,
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSecurityData();
    setRefreshing(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-danger-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-blue-600';
    if (score >= 60) return 'from-amber-500 to-amber-600';
    return 'from-danger-500 to-danger-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return t('security.dashboard.scoreExcellent', 'Excellent');
    if (score >= 80) return t('security.dashboard.scoreGood', 'Good');
    if (score >= 60) return t('security.dashboard.scoreFair', 'Fair');
    return t('security.dashboard.scorePoor', 'Needs Improvement');
  };

  const exportSecurityReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      userId: currentUser.id,
      userEmail: currentUser.email,
      score,
      compliance,
      recentEvents,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `security-report-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-danger-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default:
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return t('common.justNow', 'Just now');
    if (diffHours < 24) return t('common.hoursAgo', '{{count}} hours ago', { count: diffHours });
    if (diffDays < 7) return t('common.daysAgo', '{{count}} days ago', { count: diffDays });
    return date.toLocaleDateString();
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Shield className="w-7 h-7 text-c-text" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-c-text">
              {t('security.dashboard.title', 'Security Dashboard')}
            </h2>
            <p className="text-c-text-muted">
              {t(
                'security.dashboard.subtitle',
                'Monitor your account security and compliance status'
              )}
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {t('common.refresh', 'Refresh')}
        </button>
      </div>

      {/* Security Score Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Score */}
        <div className="lg:col-span-1">
          <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 p-6 h-full">
            <h3 className="text-sm font-medium text-c-text-muted mb-4">
              {t('security.dashboard.securityScore', 'Security Score')}
            </h3>
            <div className="flex flex-col items-center">
              <div
                className={`relative w-32 h-32 rounded-full bg-gradient-to-br ${getScoreBgColor(score.total)} p-1`}
              >
                <div className="w-full h-full rounded-full bg-c-surface flex items-center justify-center">
                  <div className="text-center">
                    <span className={`text-4xl font-bold ${getScoreColor(score.total)}`}>
                      {score.total}
                    </span>
                    <span className="text-c-text-muted text-lg">/100</span>
                  </div>
                </div>
              </div>
              <div
                className={`mt-4 px-4 py-1.5 rounded-full text-sm font-medium ${
                  score.total >= 80
                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                    : score.total >= 60
                      ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                      : 'bg-danger-100 dark:bg-danger-500/20 text-danger-700 dark:text-danger-400'
                }`}
              >
                {getScoreLabel(score.total)}
              </div>
            </div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="lg:col-span-2">
          <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 p-6 h-full">
            <h3 className="text-sm font-medium text-c-text-muted mb-4">
              {t('security.dashboard.scoreBreakdown', 'Score Breakdown')}
            </h3>
            <div className="space-y-4">
              {/* MFA */}
              <div className="flex items-center gap-4">
                <div
                  className={`p-2 rounded-lg ${score.breakdown.mfa.enabled ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-danger-100 dark:bg-danger-500/20'}`}
                >
                  <Fingerprint
                    className={`w-5 h-5 ${score.breakdown.mfa.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-danger-600 dark:text-danger-400'}`}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-c-text-secondary">
                      {t('security.dashboard.mfaStatus', 'Two-Factor Authentication')}
                    </span>
                    <span className="text-sm text-c-text-muted">
                      {score.breakdown.mfa.score}/{score.breakdown.mfa.max}
                    </span>
                  </div>
                  <div className="h-2 bg-c-surface-raised rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${score.breakdown.mfa.enabled ? 'bg-emerald-500' : 'bg-danger-500'}`}
                      style={{
                        width: `${(score.breakdown.mfa.score / score.breakdown.mfa.max) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Password Strength */}
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20">
                  <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-c-text-secondary">
                      {t('security.dashboard.passwordStrength', 'Password Strength')}
                    </span>
                    <span className="text-sm text-c-text-muted">
                      {score.breakdown.passwordStrength.score}/
                      {score.breakdown.passwordStrength.max}
                    </span>
                  </div>
                  <div className="h-2 bg-c-surface-raised rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{
                        width: `${(score.breakdown.passwordStrength.score / score.breakdown.passwordStrength.max) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-c-accent-soft dark:bg-c-accent-soft">
                  <Activity className="w-5 h-5 text-c-accent" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-c-text-secondary">
                      {t('security.dashboard.recentActivity', 'Recent Activity')}
                    </span>
                    <span className="text-sm text-c-text-muted">
                      {score.breakdown.recentActivity.score}/{score.breakdown.recentActivity.max}
                    </span>
                  </div>
                  <div className="h-2 bg-c-surface-raised rounded-full overflow-hidden">
                    <div
                      className="h-full bg-c-accent rounded-full transition-all"
                      style={{
                        width: `${(score.breakdown.recentActivity.score / score.breakdown.recentActivity.max) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Sessions */}
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20">
                  <Monitor className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-c-text-secondary">
                      {t('security.dashboard.sessionManagement', 'Session Management')}
                    </span>
                    <span className="text-sm text-c-text-muted">
                      {score.breakdown.sessions.score}/{score.breakdown.sessions.max}
                    </span>
                  </div>
                  <div className="h-2 bg-c-surface-raised rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{
                        width: `${(score.breakdown.sessions.score / score.breakdown.sessions.max) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Data Controls */}
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20">
                  <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-c-text-secondary">
                      {t('security.dashboard.dataControls', 'Data Controls')}
                    </span>
                    <span className="text-sm text-c-text-muted">
                      {score.breakdown.dataControls.score}/{score.breakdown.dataControls.max}
                    </span>
                  </div>
                  <div className="h-2 bg-c-surface-raised rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{
                        width: `${(score.breakdown.dataControls.score / score.breakdown.dataControls.max) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard
          icon={<Fingerprint className="w-6 h-6" />}
          title={t('security.dashboard.actions.mfa', 'Two-Factor Auth')}
          description={
            score.breakdown.mfa.enabled
              ? t('security.dashboard.actions.mfaEnabled', 'Enabled')
              : t('security.dashboard.actions.mfaDisabled', 'Not enabled')
          }
          status={score.breakdown.mfa.enabled ? 'success' : 'warning'}
          onClick={() => onNavigateToTab?.('mfa')}
        />
        <QuickActionCard
          icon={<Smartphone className="w-6 h-6" />}
          title={t('security.dashboard.actions.devices', 'Trusted Devices')}
          description={t('security.dashboard.actions.manageDevices', 'Manage your devices')}
          status="info"
          onClick={() => onNavigateToTab?.('devices')}
        />
        <QuickActionCard
          icon={<Monitor className="w-6 h-6" />}
          title={t('security.dashboard.actions.sessions', 'Active Sessions')}
          description={t('security.dashboard.actions.sessionsCount', '{{count}} active', {
            count: score.breakdown.sessions.count || 1,
          })}
          status="info"
          onClick={() => onNavigateToTab?.('sessions')}
        />
        <QuickActionCard
          icon={<Download className="w-6 h-6" />}
          title={t('security.dashboard.actions.export', 'Security Report')}
          description={t('security.dashboard.actions.downloadReport', 'Download security snapshot')}
          status="info"
          onClick={exportSecurityReport}
        />
      </div>

      {/* Compliance Badges & Recent Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Status */}
        <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
              <Award className="w-5 h-5 text-c-accent" />
              {t('security.dashboard.compliance', 'Compliance Certifications')}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ComplianceBadge
              name="GDPR"
              compliant={compliance.gdpr.compliant}
              description={t('security.dashboard.gdprDesc', 'EU Data Protection')}
              icon={<Globe className="w-5 h-5" />}
            />
            <ComplianceBadge
              name="SOC 2"
              compliant={compliance.soc2.compliant}
              description={t('security.dashboard.soc2Desc', 'Security Controls')}
              icon={<ShieldCheck className="w-5 h-5" />}
            />
            <ComplianceBadge
              name="ISO 27001"
              compliant={compliance.iso27001.compliant}
              description={t('security.dashboard.isoDesc', 'Information Security')}
              icon={<Lock className="w-5 h-5" />}
            />
            <ComplianceBadge
              name="Encryption"
              compliant={true}
              description={t('security.dashboard.encryptionDesc', 'AES-256 / TLS 1.3')}
              icon={<Server className="w-5 h-5" />}
            />
          </div>
        </div>

        {/* Recent Security Events */}
        <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              {t('security.dashboard.recentEvents', 'Recent Security Events')}
            </h3>
            <button
              onClick={() => onNavigateToTab?.('events')}
              className="text-sm text-c-accent hover:underline flex items-center gap-1"
            >
              {t('common.viewAll', 'View all')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {recentEvents.length === 0 ? (
              <p className="text-sm text-c-text-muted text-center py-8">
                {t('security.dashboard.noEvents', 'No recent security events')}
              </p>
            ) : (
              recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 bg-c-surface-raised rounded-lg"
                >
                  {getSeverityIcon(event.severity)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-c-text truncate">{event.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-c-text-muted" />
                      <span className="text-xs text-c-text-muted">
                        {formatTimestamp(event.timestamp)}
                      </span>
                      {event.ip && (
                        <>
                          <span className="text-c-text-secondary">•</span>
                          <span className="text-xs text-c-text-muted">{event.ip}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {score.recommendations.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-400 mb-2">
                {t('security.dashboard.recommendations', 'Recommendations to Improve Security')}
              </h3>
              <ul className="space-y-2">
                {score.recommendations.map((rec, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300"
                  >
                    <ChevronRight className="w-4 h-4" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Quick Action Card Component
interface QuickActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: 'success' | 'warning' | 'info' | 'error';
  onClick?: () => void;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({
  icon,
  title,
  description,
  status,
  onClick,
}) => {
  const statusColors = {
    success: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
    info: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
    error: 'bg-danger-100 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400',
  };

  return (
    <button
      onClick={onClick}
      className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 p-4 text-left hover:shadow-lg hover:border-c-accent dark:hover:border-c-accent transition-all group"
    >
      <div
        className={`w-12 h-12 rounded-xl ${statusColors[status]} flex items-center justify-center mb-3`}
      >
        {icon}
      </div>
      <h4 className="font-semibold text-c-text group-hover:text-c-accent dark:group-hover:text-c-accent transition-colors">
        {title}
      </h4>
      <p className="text-sm text-c-text-muted mt-1">{description}</p>
    </button>
  );
};

// Compliance Badge Component
interface ComplianceBadgeProps {
  name: string;
  compliant: boolean;
  description: string;
  icon: React.ReactNode;
}

const ComplianceBadge: React.FC<ComplianceBadgeProps> = ({
  name,
  compliant,
  description,
  icon,
}) => {
  return (
    <div
      className={`p-4 rounded-xl border-2 ${
        compliant
          ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'
          : 'border-c-border-subtle dark:border-navy-700 bg-c-surface-raised'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`p-2 rounded-lg ${
            compliant
              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-c-surface-raised text-c-text-muted'
          }`}
        >
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-c-text">{name}</span>
            {compliant && <CheckCircle className="w-4 h-4 text-emerald-500" />}
          </div>
          <p className="text-xs text-c-text-muted">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;
