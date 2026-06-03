/**
 * OrganizationChart - Organization chart visualization component
 *
 * Features:
 * - Hierarchical tree view of organization structure
 * - Expandable/collapsible nodes
 * - User cards with avatar, name, role, team
 * - Click to view/edit user details
 * - Zoom and pan controls
 * - Export to image
 *
 * Design: Interactive tree visualization with user cards
 */

import {
  ChevronDown,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Users,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Avatar } from '../../ui/primitives/Avatar';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Organization node
export interface OrgNode {
  id: string;
  userId?: string;
  name: string;
  title: string;
  email?: string;
  avatarUrl?: string;
  department?: string;
  teamName?: string;
  directReports?: OrgNode[];
  isExpanded?: boolean;
}

interface OrganizationChartProps {
  rootNode: OrgNode;
  onNodeClick?: (node: OrgNode) => void;
  onEditNode?: (node: OrgNode) => void;
  className?: string;
}

// Recursive Node component
const OrgNodeCard: React.FC<{
  node: OrgNode;
  level: number;
  isLast: boolean;
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  onNodeClick?: (node: OrgNode) => void;
}> = ({ node, level, isLast, expandedNodes, onToggle, onNodeClick }) => {
  const hasChildren = node.directReports && node.directReports.length > 0;
  const isExpanded = expandedNodes.has(node.id);

  return (
    <div className="relative">
      {/* Connection lines */}
      {level > 0 && (
        <>
          {/* Horizontal line from parent */}
          <div className="absolute -left-6 top-8 w-6 h-px bg-slate-300 dark:bg-navy-600" />
          {/* Vertical line to siblings */}
          {!isLast && (
            <div className="absolute -left-6 top-8 w-px h-full bg-slate-300 dark:bg-navy-600" />
          )}
        </>
      )}

      {/* Node Card */}
      <div
        className={cn(
          'relative flex items-center gap-3 p-3 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer',
          level === 0 &&
            'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20'
        )}
        onClick={() => onNodeClick?.(node)}
      >
        {/* Expand/Collapse button */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-full flex items-center justify-center hover:bg-slate-50 dark:hover:bg-navy-700 z-10"
          >
            {isExpanded ? (
              <Minus size={12} className="text-slate-500 dark:text-slate-400" />
            ) : (
              <Plus size={12} className="text-slate-500 dark:text-slate-400" />
            )}
          </button>
        )}

        <Avatar name={node.name} src={node.avatarUrl} size="md" />

        <div className="flex-1 min-w-0">
          <p className="font-medium text-navy-900 dark:text-white truncate">{node.name}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{node.title}</p>
          {node.teamName && (
            <p className="text-xs text-slate-600 dark:text-slate-500 truncate">{node.teamName}</p>
          )}
        </div>

        {hasChildren && (
          <span className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded-full">
            <Users size={12} />
            {node.directReports!.length}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="ml-10 mt-3 space-y-3">
          {node.directReports!.map((child, index) => (
            <OrgNodeCard
              key={child.id}
              node={child}
              level={level + 1}
              isLast={index === node.directReports!.length - 1}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const OrganizationChart: React.FC<OrganizationChartProps> = ({
  rootNode,
  onNodeClick,
  onEditNode,
  className,
}) => {
  const { t } = useTranslation();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([rootNode.id]));
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Count total nodes
  const totalNodes = useMemo(() => {
    const count = (node: OrgNode): number => {
      let total = 1;
      if (node.directReports) {
        node.directReports.forEach((child) => {
          total += count(child);
        });
      }
      return total;
    };
    return count(rootNode);
  }, [rootNode]);

  // Toggle node expansion
  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Expand all nodes
  const expandAll = useCallback(() => {
    const allIds = new Set<string>();
    const collect = (node: OrgNode) => {
      allIds.add(node.id);
      node.directReports?.forEach(collect);
    };
    collect(rootNode);
    setExpandedNodes(allIds);
  }, [rootNode]);

  // Collapse all nodes
  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set([rootNode.id]));
  }, [rootNode.id]);

  // Zoom controls
  const zoomIn = () => setZoom((prev) => Math.min(prev + 10, 150));
  const zoomOut = () => setZoom((prev) => Math.max(prev - 10, 50));
  const resetZoom = () => setZoom(100);

  return (
    <div
      className={cn(
        'bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden',
        isFullscreen && 'fixed inset-4 z-50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
        <div>
          <h3 className="font-semibold text-navy-900 dark:text-white">
            {t('admin.team.orgChart.title', 'Organization Chart')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('admin.team.orgChart.totalMembers', '{{count}} team members', {
              count: totalNodes,
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Expand/Collapse */}
          <div className="flex items-center gap-1 border border-slate-200 dark:border-navy-700 rounded-lg p-1">
            <Button variant="ghost" size="sm" onClick={expandAll} className="h-7 px-2">
              <ChevronDown size={14} />
              <span className="ml-1 text-xs">{t('admin.team.orgChart.expandAll', 'Expand')}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll} className="h-7 px-2">
              <ChevronRight size={14} />
              <span className="ml-1 text-xs">
                {t('admin.team.orgChart.collapseAll', 'Collapse')}
              </span>
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 border border-slate-200 dark:border-navy-700 rounded-lg p-1">
            <Tooltip content={t('admin.team.orgChart.zoomOut', 'Zoom out')}>
              <Button
                variant="ghost"
                size="sm"
                onClick={zoomOut}
                disabled={zoom <= 50}
                className="h-7 w-7 p-0"
              >
                <ZoomOut size={14} />
              </Button>
            </Tooltip>
            <button
              onClick={resetZoom}
              className="px-2 text-xs text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white"
            >
              {zoom}%
            </button>
            <Tooltip content={t('admin.team.orgChart.zoomIn', 'Zoom in')}>
              <Button
                variant="ghost"
                size="sm"
                onClick={zoomIn}
                disabled={zoom >= 150}
                className="h-7 w-7 p-0"
              >
                <ZoomIn size={14} />
              </Button>
            </Tooltip>
          </div>

          {/* Fullscreen */}
          <Tooltip
            content={
              isFullscreen
                ? t('admin.team.orgChart.exitFullscreen', 'Exit fullscreen')
                : t('admin.team.orgChart.fullscreen', 'Fullscreen')
            }
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 w-8 p-0"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Chart Area */}
      <div
        className="p-6 overflow-auto"
        style={{
          maxHeight: isFullscreen ? 'calc(100vh - 140px)' : '500px',
        }}
      >
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top left',
            transition: 'transform 0.2s ease',
          }}
        >
          <OrgNodeCard
            node={rootNode}
            level={0}
            isLast={true}
            expandedNodes={expandedNodes}
            onToggle={toggleNode}
            onNodeClick={onNodeClick}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('admin.team.orgChart.clickToView', 'Click on a person to view their details')}
        </p>
        <Button variant="ghost" size="sm" icon={<Download size={14} />}>
          {t('admin.team.orgChart.export', 'Export')}
        </Button>
      </div>
    </div>
  );
};

export default OrganizationChart;
