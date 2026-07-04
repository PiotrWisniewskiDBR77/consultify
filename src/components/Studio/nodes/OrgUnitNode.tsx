/**
 * OrgUnitNode - Organization chart unit
 *
 * Card-style node for organization charts with role and department info.
 */

import { Building2, User, Users } from 'lucide-react';
import React, { memo } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';

interface OrgUnitData {
  label: string;
  role?: string;
  department?: string;
  avatarUrl?: string;
  type?: 'person' | 'department' | 'team';
  reportCount?: number;
}

export const OrgUnitNode: React.FC<NodeProps<OrgUnitData>> = memo(
  ({ data, selected, isConnectable }: any) => {
    const { label, role, department, avatarUrl, type = 'person', reportCount } = data;

    const typeConfig = {
      person: {
        icon: User,
        borderColor: 'border-blue-500',
        iconBg: 'bg-blue-500/20',
        iconColor: 'text-blue-400',
      },
      department: {
        icon: Building2,
        borderColor: 'border-primary-500',
        iconBg: 'bg-primary-500/20',
        iconColor: 'text-primary-400',
      },
      team: {
        icon: Users,
        borderColor: 'border-blue-500',
        iconBg: 'bg-blue-500/20',
        iconColor: 'text-blue-400',
      },
    };

    const config = (typeConfig as any)[type];
    const Icon = config.icon;

    return (
      <div
        className={`
                w-48 bg-slate-800 rounded-lg border-2 overflow-hidden
                transition-all duration-200 ${config.borderColor}
                ${selected ? 'ring-2 ring-c-border ring-offset-2 ring-offset-slate-900' : ''}
            `}
      >
        {/* Input Handle (from parent) */}
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={isConnectable}
          className="!w-3 !h-3 !bg-slate-50 dark:bg-navy-800/300 !border-2 !border-slate-800"
        />

        {/* Header */}
        <div className={`px-3 py-2 ${config.iconBg} flex items-center gap-2`}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={label}
              className="w-8 h-8 rounded-full object-cover border-2 border-slate-700"
            />
          ) : (
            <div
              className={`w-8 h-8 rounded-full ${config.iconBg} flex items-center justify-center`}
            >
              <Icon size={16} className={config.iconColor} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-white truncate">{label || 'Name'}</div>
            {role && (
              <div className="text-xs text-slate-600 dark:text-slate-500 truncate">{role}</div>
            )}
          </div>
        </div>

        {/* Footer */}
        {(department || reportCount !== undefined) && (
          <div className="px-3 py-2 border-t border-slate-700 flex items-center justify-between">
            {department && (
              <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <Building2 size={10} />
                <span className="truncate max-w-[80px]">{department}</span>
              </div>
            )}
            {reportCount !== undefined && reportCount > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-500">
                <Users size={10} />
                <span>{reportCount}</span>
              </div>
            )}
          </div>
        )}

        {/* Output Handle (to reports) */}
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={isConnectable}
          className="!w-3 !h-3 !bg-slate-50 dark:bg-navy-800/300 !border-2 !border-slate-800"
        />
      </div>
    );
  }
);

OrgUnitNode.displayName = 'OrgUnitNode';

export default OrgUnitNode;
