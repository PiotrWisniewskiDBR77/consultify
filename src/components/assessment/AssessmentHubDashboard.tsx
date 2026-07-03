/**
 * Assessment Hub Dashboard
 * Unified view of all assessment types (DRD, RapidLean, External Digital, Generic Reports)
 */

import axios from 'axios';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BarChart3,
  FileText,
  PlusCircle,
  Target,
  TrendingUp,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  EmptyState as SharedEmptyState,
  LoadingState as SharedLoadingState,
} from '@/components/shared/states';

import { AppView } from '../../types';
import { SplitLayout } from '../layout/SplitLayout';
import { RapidLeanWorkspace } from './RapidLeanWorkspace';

interface AssessmentHubProps {
  projectId: string;
  organizationId: string;
}

interface OverviewData {
  drd: any;
  rapidLean: any;
  externalDigital: any;
  genericReports: any;
  consolidated: {
    totalAssessments: number;
    completedModules: number;
    overallReadiness: number;
    strongestAreas: string[];
    weakestAreas: string[];
  };
}

export const AssessmentHubDashboard: React.FC<AssessmentHubProps> = ({
  projectId,
  organizationId,
}) => {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRapidLeanWorkspace, setShowRapidLeanWorkspace] = useState(false);

  useEffect(() => {
    fetchOverview();
  }, [projectId]);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/sessions/${projectId}/assessment-overview`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setOverview(response.data);
    } catch (error) {
      console.error('Error fetching overview:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SplitLayout
        title={t('licensedTools.hubTitle', 'Licensed Tools Hub')}
        currentView={AppView.ASSESSMENT_OVERVIEW}
      >
        <div className="p-6">
          <SharedLoadingState
            template="card"
            count={4}
            label={t('assessment.overview.loading', 'Loading assessment overview…')}
          />
        </div>
      </SplitLayout>
    );
  }

  // Show RapidLean Workspace if requested
  if (showRapidLeanWorkspace) {
    return (
      <SplitLayout title="RapidLean Assessment" currentView={AppView.ASSESSMENT_OVERVIEW}>
        <div className="h-full">
          <div className="mb-4">
            <button
              onClick={() => setShowRapidLeanWorkspace(false)}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('licensedTools.backToHub', 'Back to Licensed Tools Hub')}
            </button>
          </div>
          <RapidLeanWorkspace projectId={projectId} organizationId={organizationId} />
        </div>
      </SplitLayout>
    );
  }

  if (!overview) {
    return (
      <SplitLayout
        title={t('licensedTools.hubTitle', 'Licensed Tools Hub')}
        currentView={AppView.ASSESSMENT_OVERVIEW}
      >
        <div className="flex items-center justify-center h-64">
          <SharedEmptyState
            variant="error"
            title={t('assessment.overview.emptyTitle', 'No assessment data yet')}
            description={t(
              'assessment.overview.emptyDesc',
              'We could not load the assessment overview. Refresh to try again.'
            )}
            onRetry={() => void fetchOverview()}
          />
        </div>
      </SplitLayout>
    );
  }

  const { consolidated } = overview;
  const readinessPercentage = (consolidated.overallReadiness / 7) * 100;

  return (
    <SplitLayout
      title={t('licensedTools.hubTitle', 'Licensed Tools Hub')}
      currentView={AppView.ASSESSMENT_OVERVIEW}
    >
      <div className="p-6 max-w-7xl mx-auto overflow-y-auto h-full">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
            <Award className="w-10 h-10 text-yellow-500" />
            {t('licensedTools.hubTitle', 'Licensed Tools Hub')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Unified view of all organizational assessments
          </p>
        </div>

        {/* Overall Readiness Score */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl shadow-2xl p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Overall Digital Readiness</h2>
              <p className="text-blue-100">
                Based on {consolidated.totalAssessments} assessment(s) across{' '}
                {consolidated.completedModules} module(s)
              </p>
            </div>
            <div className="text-right">
              <div className="text-6xl font-bold">{consolidated.overallReadiness.toFixed(1)}</div>
              <div className="text-xl text-blue-100">/ 7.0</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="h-4 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white dark:bg-navy-900 transition-all duration-1000"
                style={{ width: `${readinessPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* DRD Card */}
          <ModuleCard
            title="DRD Assessment"
            icon={<BarChart3 className="w-8 h-8" />}
            status={overview.drd.exists ? 'complete' : 'pending'}
            score={overview.drd.exists ? overview.drd.overallScore : null}
            details={overview.drd.exists ? `Gap: ${overview.drd.gap.toFixed(1)}` : 'Not started'}
            color="blue"
            actionLabel={overview.drd.exists ? 'View Details' : 'Start Assessment'}
            onAction={() => {
              /* Navigate to DRD */
            }}
          />

          {/* RapidLean Card */}
          <ModuleCard
            title="RapidLean"
            icon={<TrendingUp className="w-8 h-8" />}
            status={overview.rapidLean.exists ? 'complete' : 'pending'}
            score={overview.rapidLean.exists ? overview.rapidLean.overallScore : null}
            details={
              overview.rapidLean.exists
                ? `Benchmark: ${overview.rapidLean.benchmark.toFixed(1)}`
                : 'Not started'
            }
            color="green"
            actionLabel={overview.rapidLean.exists ? 'View Results' : 'Start Assessment'}
            onAction={() => setShowRapidLeanWorkspace(true)}
          />

          {/* External Digital Card */}
          <ModuleCard
            title="External Assessments"
            icon={<FileText className="w-8 h-8" />}
            status={overview.externalDigital.exists ? 'complete' : 'pending'}
            score={null}
            details={
              overview.externalDigital.exists
                ? `${overview.externalDigital.totalCount} framework(s)`
                : 'No uploads'
            }
            color="purple"
            actionLabel="Upload Report"
            onAction={() => {
              /* Navigate to External */
            }}
          />

          {/* Generic Reports Card */}
          <ModuleCard
            title="Generic Reports"
            icon={<FileText className="w-8 h-8" />}
            status={overview.genericReports.exists ? 'complete' : 'pending'}
            score={null}
            details={
              overview.genericReports.exists
                ? `${overview.genericReports.totalCount} report(s)`
                : 'No uploads'
            }
            color="orange"
            actionLabel="Upload Report"
            onAction={() => {
              /* Navigate to Generic Reports */
            }}
          />
        </div>

        {/* Strongest/Weakest Areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strongest Areas */}
          <div className="bg-white dark:bg-navy-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-green-600">
              <Target className="w-6 h-6" />
              Strengths
            </h3>
            {consolidated.strongestAreas && consolidated.strongestAreas.length > 0 ? (
              <ul className="space-y-2">
                {consolidated.strongestAreas.map((area, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-2 text-slate-700 dark:text-slate-300"
                  >
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    {area}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 dark:text-slate-400 italic">
                Complete assessments to see strengths
              </p>
            )}
          </div>

          {/* Weakest Areas */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-rose-600">
              <AlertCircle className="w-6 h-6" />
              Priority Gaps
            </h3>
            {consolidated.weakestAreas && consolidated.weakestAreas.length > 0 ? (
              <ul className="space-y-2">
                {consolidated.weakestAreas.map((area, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-2 text-slate-700 dark:text-slate-300"
                  >
                    <div className="w-2 h-2 bg-rose-500 rounded-full" />
                    {area}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 dark:text-slate-400 italic">
                Complete assessments to identify gaps
              </p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-slate-50 dark:bg-navy-900 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowRapidLeanWorkspace(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Start RapidLean Assessment
            </button>
            <button className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Upload External Assessment
            </button>
            <button className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Upload Generic Report
            </button>
          </div>
        </div>
      </div>
    </SplitLayout>
  );
};

// Module Card Component
interface ModuleCardProps {
  title: string;
  icon: React.ReactNode;
  status: 'complete' | 'pending';
  score: number | null;
  details: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
  actionLabel: string;
  onAction: () => void;
}

const ModuleCard: React.FC<ModuleCardProps> = ({
  title,
  icon,
  status,
  score,
  details,
  color,
  actionLabel,
  onAction,
}) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-indigo-500 to-indigo-600',
    orange: 'from-amber-500 to-amber-600',
  };

  return (
    <div className="bg-white dark:bg-navy-800 rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
      <div className={`bg-gradient-to-br ${colorClasses[color]} text-white p-4`}>
        <div className="flex items-center justify-between mb-2">
          {icon}
          <span
            className={`px-2 py-1 text-xs rounded ${status === 'complete' ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/10'}`}
          >
            {status === 'complete' ? 'Complete' : 'Pending'}
          </span>
        </div>
        <h3 className="font-bold text-lg">{title}</h3>
      </div>

      <div className="p-4">
        {score !== null && (
          <div className="text-3xl font-bold text-slate-800 dark:text-white mb-2">
            {score.toFixed(1)}
          </div>
        )}
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{details}</p>
        <button
          onClick={onAction}
          className="w-full px-4 py-2 bg-slate-100 dark:bg-navy-700 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-600 transition-colors text-sm font-medium"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
};
