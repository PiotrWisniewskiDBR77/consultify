/**
 * SeatTypesManager - Seat types system management component
 *
 * Features:
 * - Seat type cards (View-only, Core, Developer, Sales Pro)
 * - Feature comparison matrix
 * - Pricing configuration
 * - User assignment counts
 * - Add/edit seat types
 *
 * Design: Card grid with feature comparison table
 */

import {
  Check,
  ChevronRight,
  Code,
  Crown,
  DollarSign,
  Edit2,
  Eye,
  HelpCircle,
  Plus,
  Settings,
  ShoppingBag,
  Star,
  Users,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Seat type definition
export interface SeatTypeDefinition {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  priceMonthly: number;
  priceAnnual?: number;
  features: string[];
  limitations?: string[];
  maxUsers?: number;
  currentUsers: number;
  isDefault?: boolean;
  isCustom?: boolean;
}

// Feature for comparison
export interface SeatFeature {
  id: string;
  name: string;
  category?: string;
  description?: string;
}

interface SeatTypesManagerProps {
  seatTypes: SeatTypeDefinition[];
  features: SeatFeature[];
  onEditType?: (seatType: SeatTypeDefinition) => void;
  onAddType?: () => void;
  onViewUsers?: (seatTypeId: string) => void;
  className?: string;
}

// Default seat types
const defaultSeatTypes: SeatTypeDefinition[] = [
  {
    id: 'view-only',
    name: 'View-only',
    description: 'Read-only access to workspace content',
    icon: Eye,
    color: 'slate',
    priceMonthly: 0,
    features: ['view_workspace', 'view_projects', 'view_reports'],
    limitations: ['no_edit', 'no_create', 'no_delete'],
    currentUsers: 0,
  },
  {
    id: 'core',
    name: 'Core',
    description: 'Standard access for team members',
    icon: Star,
    color: 'violet',
    priceMonthly: 15,
    priceAnnual: 12,
    features: ['view_workspace', 'edit_tasks', 'create_projects', 'basic_reports'],
    currentUsers: 0,
    isDefault: true,
  },
  {
    id: 'developer',
    name: 'Developer',
    description: 'Extended access with API and integrations',
    icon: Code,
    color: 'blue',
    priceMonthly: 25,
    priceAnnual: 20,
    features: ['all_core', 'api_access', 'webhooks', 'integrations', 'advanced_reports'],
    currentUsers: 0,
  },
  {
    id: 'sales-pro',
    name: 'Sales Pro',
    description: 'Full CRM and sales pipeline access',
    icon: ShoppingBag,
    color: 'emerald',
    priceMonthly: 30,
    priceAnnual: 24,
    features: ['all_core', 'crm_access', 'pipeline_management', 'advanced_reports', 'forecasting'],
    currentUsers: 0,
  },
];

// Default features
const defaultFeatures: SeatFeature[] = [
  { id: 'view_workspace', name: 'View workspace', category: 'Basic' },
  { id: 'view_projects', name: 'View projects', category: 'Basic' },
  { id: 'edit_tasks', name: 'Edit tasks', category: 'Basic' },
  { id: 'create_projects', name: 'Create projects', category: 'Projects' },
  { id: 'delete_projects', name: 'Delete projects', category: 'Projects' },
  { id: 'basic_reports', name: 'Basic reports', category: 'Reports' },
  { id: 'advanced_reports', name: 'Advanced reports', category: 'Reports' },
  { id: 'api_access', name: 'API access', category: 'Developer' },
  { id: 'webhooks', name: 'Webhooks', category: 'Developer' },
  { id: 'integrations', name: 'Third-party integrations', category: 'Developer' },
  { id: 'crm_access', name: 'CRM access', category: 'Sales' },
  { id: 'pipeline_management', name: 'Pipeline management', category: 'Sales' },
  { id: 'forecasting', name: 'Sales forecasting', category: 'Sales' },
];

export const SeatTypesManager: React.FC<SeatTypesManagerProps> = ({
  seatTypes = defaultSeatTypes,
  features = defaultFeatures,
  onEditType,
  onAddType,
  onViewUsers,
  className,
}) => {
  const { t } = useTranslation();
  const [showComparison, setShowComparison] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Get color classes
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'slate':
        return {
          bg: 'bg-slate-100 dark:bg-slate-800',
          text: 'text-slate-600 dark:text-slate-400',
          gradient: 'from-slate-500 to-slate-600',
        };
      case 'violet':
        return {
          bg: 'bg-primary-100 dark:bg-primary-900/30',
          text: 'text-primary-600 dark:text-primary-400',
          gradient: 'from-primary-500 to-primary-600',
        };
      case 'blue':
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          text: 'text-blue-600 dark:text-blue-400',
          gradient: 'from-blue-500 to-blue-600',
        };
      case 'emerald':
        return {
          bg: 'bg-emerald-100 dark:bg-emerald-900/30',
          text: 'text-emerald-600 dark:text-emerald-400',
          gradient: 'from-emerald-500 to-emerald-600',
        };
      default:
        return {
          bg: 'bg-slate-100 dark:bg-slate-800',
          text: 'text-slate-600 dark:text-slate-400',
          gradient: 'from-slate-500 to-slate-600',
        };
    }
  };

  // Check if seat type has feature
  const hasFeature = (seatType: SeatTypeDefinition, featureId: string): boolean => {
    if (seatType.features.includes('all_core')) {
      const coreType = seatTypes.find((t) => t.id === 'core');
      if (coreType?.features.includes(featureId)) return true;
    }
    return seatType.features.includes(featureId);
  };

  // Group features by category
  const featuresByCategory = useMemo(() => {
    const groups: Record<string, SeatFeature[]> = {};
    features.forEach((feature) => {
      const category = feature.category || 'General';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(feature);
    });
    return groups;
  }, [features]);

  // Total users
  const totalUsers = useMemo(() => {
    return seatTypes.reduce((sum, type) => sum + type.currentUsers, 0);
  }, [seatTypes]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            {t('admin.billing.seatTypes.title', 'Seat Types')}
            <Tooltip
              content={t(
                'admin.billing.seatTypes.tooltip',
                'Configure different access levels and their pricing'
              )}
            >
              <HelpCircle size={16} className="text-slate-400 dark:text-slate-500" />
            </Tooltip>
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('admin.billing.seatTypes.subtitle', '{{count}} users across {{types}} seat types', {
              count: totalUsers,
              types: seatTypes.length,
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowComparison(!showComparison)}>
            {showComparison
              ? t('admin.billing.seatTypes.hideComparison', 'Hide Comparison')
              : t('admin.billing.seatTypes.showComparison', 'Compare Features')}
          </Button>
          {onAddType && (
            <Button size="sm" onClick={onAddType} icon={<Plus size={16} />}>
              {t('admin.billing.seatTypes.addType', 'Add Type')}
            </Button>
          )}
        </div>
      </div>

      {/* Seat Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {seatTypes.map((seatType) => {
          const colors = getColorClasses(seatType.color);
          const Icon = seatType.icon;
          const isSelected = selectedType === seatType.id;

          return (
            <div
              key={seatType.id}
              className={cn(
                'relative p-4 bg-white dark:bg-navy-800 rounded-xl border transition-all cursor-pointer',
                isSelected
                  ? 'border-primary-500 ring-2 ring-primary-500/20'
                  : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
              )}
              onClick={() => setSelectedType(isSelected ? null : seatType.id)}
            >
              {/* Default Badge */}
              {seatType.isDefault && (
                <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                  {t('admin.billing.seatTypes.default', 'Default')}
                </span>
              )}

              {/* Icon */}
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center mb-4',
                  `bg-gradient-to-br ${colors.gradient}`
                )}
              >
                <Icon size={24} className="text-c-text" />
              </div>

              {/* Info */}
              <h4 className="font-semibold text-navy-900 dark:text-white mb-1">{seatType.name}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {seatType.description}
              </p>

              {/* Pricing */}
              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-navy-900 dark:text-white">
                    ${seatType.priceMonthly}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">/month</span>
                </div>
                {seatType.priceAnnual && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    ${seatType.priceAnnual}/mo billed annually
                  </p>
                )}
              </div>

              {/* User Count */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-navy-700">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-slate-400 dark:text-slate-500" />
                  <span className="text-sm font-medium text-navy-900 dark:text-white">
                    {seatType.currentUsers}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('admin.billing.seatTypes.users', 'users')}
                  </span>
                </div>
                {onViewUsers && seatType.currentUsers > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewUsers(seatType.id);
                    }}
                    className="h-7 px-2"
                  >
                    <ChevronRight size={14} />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature Comparison Matrix */}
      {showComparison && (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-navy-700">
            <h4 className="font-semibold text-navy-900 dark:text-white">
              {t('admin.billing.seatTypes.featureComparison', 'Feature Comparison')}
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table
              /* §27-exempt: panel konfiguracyjny/billingowy, mala tabela ustawien poza zakresem listowym */ className="w-full"
            >
              <thead>
                <tr className="bg-slate-50 dark:bg-navy-900">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-600 dark:text-slate-400 min-w-[200px]">
                    {t('admin.billing.seatTypes.feature', 'Feature')}
                  </th>
                  {seatTypes.map((type) => {
                    const colors = getColorClasses(type.color);
                    return (
                      <th key={type.id} className="px-4 py-3 text-center min-w-[100px]">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full',
                            colors.bg,
                            colors.text
                          )}
                        >
                          {type.name}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {Object.entries(featuresByCategory).map(([category, categoryFeatures]) => (
                  <React.Fragment key={category}>
                    {/* Category Header */}
                    <tr className="bg-slate-50/50 dark:bg-navy-900/50">
                      <td colSpan={seatTypes.length + 1} className="px-4 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {category}
                        </span>
                      </td>
                    </tr>
                    {/* Features */}
                    {categoryFeatures.map((feature) => (
                      <tr
                        key={feature.id}
                        className="border-t border-slate-100 dark:border-navy-700"
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm text-navy-900 dark:text-white">
                            {feature.name}
                          </span>
                        </td>
                        {seatTypes.map((type) => (
                          <td key={`${type.id}-${feature.id}`} className="px-4 py-3 text-center">
                            {hasFeature(type, feature.id) ? (
                              <Check size={16} className="mx-auto text-emerald-500" />
                            ) : (
                              <X size={16} className="mx-auto text-slate-300 dark:text-navy-600" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected Type Details */}
      {selectedType && onEditType && (
        <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
          {(() => {
            const type = seatTypes.find((t) => t.id === selectedType);
            if (!type) return null;

            return (
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-navy-900 dark:text-white">
                    {t('admin.billing.seatTypes.selectedType', 'Selected: {{name}}', {
                      name: type.name,
                    })}
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {type.features.length}{' '}
                    {t('admin.billing.seatTypes.featuresIncluded', 'features included')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditType(type)}
                  icon={<Edit2 size={14} />}
                >
                  {t('admin.billing.seatTypes.editType', 'Edit Type')}
                </Button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default SeatTypesManager;
