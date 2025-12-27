/**
 * RACI Matrix Component
 * 
 * PMO Standards Compliant Responsibility Matrix
 * 
 * Standards:
 * - ISO 21500:2021 - Responsibility Matrix (Clause 4.6.5)
 * - PMI PMBOK 7th Edition - RACI Chart
 * - PRINCE2 - Organization Theme (Responsibility Assignment)
 * 
 * RACI:
 * - R = Responsible (does the work)
 * - A = Accountable (approves/owns outcome)
 * - C = Consulted (provides input)
 * - I = Informed (receives updates)
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  User,
  CheckCircle,
  AlertCircle,
  Info,
  HelpCircle
} from 'lucide-react';
import { RACIType, RACIMatrix as RACIMatrixType, PMOProjectRole } from '../../types';
import { api } from '../../services/api';

interface RACIMatrixProps {
  projectId: string;
}

const RACI_LABELS: Record<RACIType, { label: string; fullLabel: string; color: string }> = {
  'R': { label: 'R', fullLabel: 'Responsible', color: 'bg-blue-500 text-white' },
  'A': { label: 'A', fullLabel: 'Accountable', color: 'bg-red-500 text-white' },
  'C': { label: 'C', fullLabel: 'Consulted', color: 'bg-yellow-500 text-white' },
  'I': { label: 'I', fullLabel: 'Informed', color: 'bg-green-500 text-white' },
};

const OBJECT_TYPES = [
  'PROJECT',
  'INITIATIVE',
  'TASK',
  'DECISION',
  'CHANGE_REQUEST',
  'ASSESSMENT',
  'ROADMAP',
  'STAGE_GATE'
] as const;

type ObjectType = typeof OBJECT_TYPES[number];

const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  PROJECT: 'Project',
  INITIATIVE: 'Initiative',
  TASK: 'Task',
  DECISION: 'Decision',
  CHANGE_REQUEST: 'Change Request',
  ASSESSMENT: 'Assessment',
  ROADMAP: 'Roadmap',
  STAGE_GATE: 'Stage Gate'
};

export const RACIMatrix: React.FC<RACIMatrixProps> = ({ projectId }) => {
  const { t } = useTranslation();
  const [matrix, setMatrix] = useState<RACIMatrixType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    loadMatrix();
  }, [projectId]);

  const loadMatrix = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/projects/${projectId}/raci-matrix`);
      setMatrix(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load RACI matrix');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
        <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      </div>
    );
  }

  if (!matrix) {
    return null;
  }

  // Collect all unique users from the matrix
  const allUsers = new Set<string>();
  Object.values(matrix.matrix).forEach(raciByType => {
    Object.values(raciByType).forEach((users: any[]) => {
      users.forEach(user => allUsers.add(JSON.stringify(user)));
    });
  });
  const uniqueUsers = Array.from(allUsers).map(u => JSON.parse(u));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Table className="w-5 h-5" />
              {t('pmo.raciMatrix', 'RACI Matrix')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              ISO 21500 (4.6.5) / PMBOK 7 / PRINCE2 Organization Theme
            </p>
          </div>

          <button
            onClick={() => setShowLegend(!showLegend)}
            className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <HelpCircle className="w-4 h-4" />
            {t('pmo.legend', 'Legend')}
          </button>
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(RACI_LABELS).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${value.color}`}>
                    {value.label}
                  </span>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {value.fullLabel}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {key === 'R' && 'Does the work'}
                      {key === 'A' && 'Approves/owns outcome'}
                      {key === 'C' && 'Provides input'}
                      {key === 'I' && 'Receives updates'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('pmo.objectType', 'Object Type')}
              </th>
              {(['R', 'A', 'C', 'I'] as RACIType[]).map(type => (
                <th key={type} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${RACI_LABELS[type].color}`}>
                      {type}
                    </span>
                    <span className="hidden md:inline">{RACI_LABELS[type].fullLabel}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {OBJECT_TYPES.map(objectType => {
              const raciData = matrix.matrix[objectType] || {};
              
              return (
                <tr key={objectType} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {OBJECT_TYPE_LABELS[objectType]}
                    </div>
                  </td>
                  {(['R', 'A', 'C', 'I'] as RACIType[]).map(type => {
                    const users = raciData[type] || [];
                    return (
                      <td key={type} className="px-4 py-3 text-center">
                        {users.length > 0 ? (
                          <div className="flex flex-wrap justify-center gap-1">
                            {users.map((user: any, idx: number) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-700 dark:text-gray-300"
                                title={`${user.name} (${user.role})`}
                              >
                                <User className="w-3 h-3" />
                                {user.name?.split(' ')[0]}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/30 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
        <Info className="w-3.5 h-3.5" />
        {t('pmo.raciGenerated', 'Generated at')}: {new Date(matrix.generatedAt).toLocaleString()}
      </div>
    </div>
  );
};

export default RACIMatrix;



