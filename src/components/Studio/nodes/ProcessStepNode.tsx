/**
 * ProcessStepNode - Rectangular process step
 *
 * Standard rectangular node for process steps/actions.
 */

import React, { memo } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';

interface ProcessStepData {
    label: string;
    description?: string;
    status?: 'pending' | 'active' | 'completed' | 'error';
    icon?: React.ReactNode;
}

export const ProcessStepNode: React.FC<NodeProps<ProcessStepData>> = memo(({ data, selected, isConnectable }: any) => {
    const { label, description, status = 'pending', icon } = data;

    const statusColors = {
        pending: 'border-slate-600 bg-slate-800',
        active: 'border-blue-500 bg-blue-500/10',
        completed: 'border-green-500 bg-green-500/10',
        error: 'border-red-500 bg-red-500/10',
    };

    const statusIndicator = {
        pending: 'bg-slate-500',
        active: 'bg-blue-500 animate-pulse',
        completed: 'bg-green-500',
        error: 'bg-red-500',
    };

    return (
        <div
            className={`
                min-w-[160px] max-w-[240px] rounded-lg border-2 transition-all duration-200
                ${(statusColors as any)[status]}
                ${selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900' : ''}
            `}
        >
            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Left}
                isConnectable={isConnectable}
                className="!w-3 !h-3 !bg-blue-500 !border-2 !border-slate-800"
            />

            {/* Content */}
            <div className="p-3">
                <div className="flex items-start gap-2">
                    {/* Status Indicator */}
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${(statusIndicator as any)[status]}`} />

                    <div className="flex-1 min-w-0">
                        {/* Icon */}
                        {icon && <div className="text-slate-400 mb-1">{icon}</div>}

                        {/* Label */}
                        <div className="font-medium text-sm text-white truncate">{label || 'Process Step'}</div>

                        {/* Description */}
                        {description && <div className="text-xs text-slate-400 mt-1 line-clamp-2">{description}</div>}
                    </div>
                </div>
            </div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                isConnectable={isConnectable}
                className="!w-3 !h-3 !bg-blue-500 !border-2 !border-slate-800"
            />
        </div>
    );
});

ProcessStepNode.displayName = 'ProcessStepNode';

export default ProcessStepNode;
