/**
 * TeamRoutingRules - Team routing rules configuration component
 *
 * Features:
 * - Rule list with conditions and actions
 * - Priority ordering (drag and drop)
 * - Enable/disable individual rules
 * - Add new rule with wizard
 * - Test rule with sample input
 *
 * Design: Card-based rule list with condition builder
 */

import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit2,
  GripVertical,
  HelpCircle,
  Play,
  Plus,
  Settings,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Condition types
export type ConditionField =
  | 'user.department'
  | 'user.role'
  | 'user.location'
  | 'user.title'
  | 'task.type'
  | 'task.priority'
  | 'task.project'
  | 'custom';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'regex';

// Rule condition
export interface RuleCondition {
  id: string;
  field: ConditionField;
  operator: ConditionOperator;
  value: string | string[];
  customField?: string;
}

// Rule action
export type ActionType =
  | 'assign_team'
  | 'assign_user'
  | 'add_tag'
  | 'set_priority'
  | 'notify'
  | 'webhook';

export interface RuleAction {
  id: string;
  type: ActionType;
  value: string;
  additionalParams?: Record<string, string>;
}

// Routing rule
export interface RoutingRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  conditions: RuleCondition[];
  conditionLogic: 'and' | 'or';
  actions: RuleAction[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  matchCount?: number;
}

interface TeamRoutingRulesProps {
  rules: RoutingRule[];
  teams: { id: string; name: string }[];
  onSave?: (rules: RoutingRule[]) => void;
  onAddRule?: () => void;
  onEditRule?: (rule: RoutingRule) => void;
  onDeleteRule?: (ruleId: string) => void;
  onTestRule?: (rule: RoutingRule) => void;
  className?: string;
}

export const TeamRoutingRules: React.FC<TeamRoutingRulesProps> = ({
  rules,
  teams,
  onSave,
  onAddRule,
  onEditRule,
  onDeleteRule,
  onTestRule,
  className,
}) => {
  const { t } = useTranslation();
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [localRules, setLocalRules] = useState<RoutingRule[]>(rules);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Get operator label
  const getOperatorLabel = (operator: ConditionOperator) => {
    switch (operator) {
      case 'equals':
        return '=';
      case 'not_equals':
        return '≠';
      case 'contains':
        return 'contains';
      case 'starts_with':
        return 'starts with';
      case 'ends_with':
        return 'ends with';
      case 'in':
        return 'in';
      case 'not_in':
        return 'not in';
      case 'regex':
        return 'matches';
      default:
        return operator;
    }
  };

  // Get action label
  const getActionLabel = (type: ActionType) => {
    switch (type) {
      case 'assign_team':
        return t('admin.team.routing.assignTeam', 'Assign to team');
      case 'assign_user':
        return t('admin.team.routing.assignUser', 'Assign to user');
      case 'add_tag':
        return t('admin.team.routing.addTag', 'Add tag');
      case 'set_priority':
        return t('admin.team.routing.setPriority', 'Set priority');
      case 'notify':
        return t('admin.team.routing.notify', 'Send notification');
      case 'webhook':
        return t('admin.team.routing.webhook', 'Trigger webhook');
      default:
        return type;
    }
  };

  // Toggle rule enabled
  const toggleRuleEnabled = useCallback((ruleId: string) => {
    setLocalRules((prev) =>
      prev.map((rule) => (rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule))
    );
  }, []);

  // Move rule up/down
  const moveRule = useCallback((index: number, direction: 'up' | 'down') => {
    setLocalRules((prev) => {
      const newRules = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newRules.length) return prev;

      [newRules[index], newRules[targetIndex]] = [newRules[targetIndex], newRules[index]];

      // Update priorities
      return newRules.map((rule, i) => ({ ...rule, priority: i + 1 }));
    });
  }, []);

  // Duplicate rule
  const duplicateRule = useCallback(
    (rule: RoutingRule) => {
      const newRule: RoutingRule = {
        ...rule,
        id: `${rule.id}-copy-${Date.now()}`,
        name: `${rule.name} (Copy)`,
        enabled: false,
        priority: localRules.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        matchCount: 0,
      };
      setLocalRules((prev) => [...prev, newRule]);
    },
    [localRules.length]
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            {t('admin.team.routing.title', 'Team Routing Rules')}
            <Tooltip
              content={t(
                'admin.team.routing.tooltip',
                'Rules are evaluated in priority order. The first matching rule is applied.'
              )}
            >
              <HelpCircle size={16} className="text-slate-400 dark:text-slate-500" />
            </Tooltip>
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t(
              'admin.team.routing.subtitle',
              'Automatically route tasks and users to the right teams'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onSave && (
            <Button variant="outline" size="sm" onClick={() => onSave(localRules)}>
              {t('admin.team.routing.saveOrder', 'Save Order')}
            </Button>
          )}
          {onAddRule && (
            <Button size="sm" onClick={onAddRule} icon={<Plus size={16} />}>
              {t('admin.team.routing.addRule', 'Add Rule')}
            </Button>
          )}
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {localRules.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 border-dashed">
            <Zap size={48} className="mx-auto mb-4 text-slate-300 dark:text-navy-600" />
            <h4 className="font-medium text-navy-900 dark:text-white mb-2">
              {t('admin.team.routing.noRules', 'No routing rules yet')}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {t(
                'admin.team.routing.noRulesDesc',
                'Create rules to automatically route work to the right teams.'
              )}
            </p>
            {onAddRule && (
              <Button onClick={onAddRule} icon={<Plus size={16} />}>
                {t('admin.team.routing.createFirstRule', 'Create First Rule')}
              </Button>
            )}
          </div>
        ) : (
          localRules.map((rule, index) => {
            const isExpanded = expandedRule === rule.id;

            return (
              <div
                key={rule.id}
                className={cn(
                  'bg-white dark:bg-navy-800 rounded-xl border transition-all',
                  rule.enabled
                    ? 'border-slate-200 dark:border-navy-700'
                    : 'border-slate-200 dark:border-navy-700 opacity-60',
                  isExpanded && 'ring-2 ring-c-info/20'
                )}
              >
                {/* Rule Header */}
                <div className="flex items-center gap-3 p-4">
                  {/* Drag Handle */}
                  <div className="cursor-grab text-slate-400 hover:text-slate-600 dark:text-slate-400">
                    <GripVertical size={18} />
                  </div>

                  {/* Priority Badge */}
                  <span className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg">
                    {index + 1}
                  </span>

                  {/* Enable Toggle */}
                  <button
                    onClick={() => toggleRuleEnabled(rule.id)}
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
                      rule.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-navy-600'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 w-4 h-4 bg-white dark:bg-navy-900 rounded-full shadow transition-transform',
                        rule.enabled ? 'left-5' : 'left-0.5'
                      )}
                    />
                  </button>

                  {/* Rule Info */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-navy-900 dark:text-white truncate">
                        {rule.name}
                      </h4>
                      {rule.matchCount !== undefined && (
                        <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded-full">
                          {rule.matchCount} matches
                        </span>
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {rule.description}
                      </p>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-1">
                    <Tooltip content={t('admin.team.routing.moveUp', 'Move up')}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveRule(index, 'up')}
                        disabled={index === 0}
                        className="h-8 w-8 p-0"
                      >
                        <ArrowUp size={14} />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t('admin.team.routing.moveDown', 'Move down')}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveRule(index, 'down')}
                        disabled={index === localRules.length - 1}
                        className="h-8 w-8 p-0"
                      >
                        <ArrowDown size={14} />
                      </Button>
                    </Tooltip>
                    {onTestRule && (
                      <Tooltip content={t('admin.team.routing.testRule', 'Test rule')}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onTestRule(rule)}
                          className="h-8 w-8 p-0"
                        >
                          <Play size={14} />
                        </Button>
                      </Tooltip>
                    )}
                  </div>

                  {/* Expand Button */}
                  <button
                    onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                    className="text-slate-400 hover:text-slate-600 dark:text-slate-400"
                  >
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-200 dark:border-navy-700">
                    <div className="pt-4 space-y-4">
                      {/* Conditions */}
                      <div>
                        <h5 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                          <Settings size={14} />
                          {t('admin.team.routing.conditions', 'Conditions')}{' '}
                          <span className="text-xs font-normal">
                            ({rule.conditionLogic.toUpperCase()})
                          </span>
                        </h5>
                        <div className="space-y-2">
                          {rule.conditions.map((condition, idx) => (
                            <div key={condition.id} className="flex items-center gap-2 text-sm">
                              {idx > 0 && (
                                <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-navy-700 text-slate-500 dark:text-slate-400 rounded uppercase">
                                  {rule.conditionLogic}
                                </span>
                              )}
                              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-mono text-xs">
                                {condition.customField || condition.field}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400">
                                {getOperatorLabel(condition.operator)}
                              </span>
                              <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded font-mono text-xs">
                                {Array.isArray(condition.value)
                                  ? condition.value.join(', ')
                                  : condition.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex justify-center">
                        <ArrowRight size={24} className="text-slate-300 dark:text-navy-600" />
                      </div>

                      {/* Actions */}
                      <div>
                        <h5 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                          <Zap size={14} />
                          {t('admin.team.routing.actions', 'Actions')}
                        </h5>
                        <div className="space-y-2">
                          {rule.actions.map((action) => (
                            <div
                              key={action.id}
                              className="flex items-center gap-2 text-sm p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg"
                            >
                              <span className="text-primary-600 dark:text-primary-400">
                                {getActionLabel(action.type)}:
                              </span>
                              <span className="font-medium text-navy-900 dark:text-white">
                                {action.type === 'assign_team'
                                  ? teams.find((t) => t.id === action.value)?.name || action.value
                                  : action.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions Footer */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-navy-700">
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {t('admin.team.routing.lastUpdated', 'Last updated:')}{' '}
                          {new Date(rule.updatedAt).toLocaleDateString()}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => duplicateRule(rule)}
                            icon={<Copy size={14} />}
                          >
                            {t('admin.team.routing.duplicate', 'Duplicate')}
                          </Button>
                          {onEditRule && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEditRule(rule)}
                              icon={<Edit2 size={14} />}
                            >
                              {t('admin.team.routing.edit', 'Edit')}
                            </Button>
                          )}
                          {onDeleteRule && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteRule(rule.id)}
                              className="text-danger-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                              icon={<Trash2 size={14} />}
                            >
                              {t('admin.team.routing.delete', 'Delete')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Info */}
      {localRules.length > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
            />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">
                {t('admin.team.routing.howItWorks', 'How routing works')}
              </p>
              <p>
                {t(
                  'admin.team.routing.howItWorksDesc',
                  'Rules are evaluated from top to bottom. The first rule that matches will be applied. Drag and drop to reorder rules, or use the arrows to change priority.'
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamRoutingRules;
