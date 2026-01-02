/**
 * SwimLaneNode - Horizontal swimlane container
 * 
 * Container node for swimlane diagrams representing departments/roles.
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from 'reactflow';
import { User, Building2, Users } from 'lucide-react';

interface SwimLaneData {
    label: string;
    color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan' | 'slate';
    icon?: 'user' | 'building' | 'team';
}

export const SwimLaneNode: React.FC<NodeProps<SwimLaneData>> = memo(({ 
    data, 
    selected,
    isConnectable
}) => {
    const { label, color = 'blue', icon = 'building' } = data;

    const colorClasses = {
        blue: 'bg-blue-500/5 border-blue-500/30',
        green: 'bg-green-500/5 border-green-500/30',
        amber: 'bg-amber-500/5 border-amber-500/30',
        red: 'bg-red-500/5 border-red-500/30',
        purple: 'bg-purple-500/5 border-purple-500/30',
        cyan: 'bg-cyan-500/5 border-cyan-500/30',
        slate: 'bg-slate-500/5 border-slate-500/30'
    };

    const headerColors = {
        blue: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
        green: 'bg-green-500/20 border-green-500/50 text-green-300',
        amber: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
        red: 'bg-red-500/20 border-red-500/50 text-red-300',
        purple: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
        cyan: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300',
        slate: 'bg-slate-500/20 border-slate-500/50 text-slate-300'
    };

    const icons = {
        user: User,
        building: Building2,
        team: Users
    };

    const Icon = icons[icon];

    return (
        <>
            {/* Node Resizer - allows resizing the swimlane */}
            <NodeResizer 
                color={selected ? '#3b82f6' : '#64748b'}
                isVisible={selected}
                minWidth={300}
                minHeight={100}
            />

            <div
                className={`
                    w-full h-full min-w-[300px] min-h-[100px] rounded-lg border-2
                    transition-all duration-200 ${colorClasses[color]}
                    ${selected ? 'ring-2 ring-blue-400/30' : ''}
                `}
            >
                {/* Lane Header */}
                <div 
                    className={`
                        absolute left-0 top-0 bottom-0 w-10 rounded-l-lg border-r-2
                        flex items-center justify-center ${headerColors[color]}
                    `}
                >
                    <div className="flex flex-col items-center gap-2 -rotate-90 whitespace-nowrap">
                        <Icon size={14} className="rotate-90" />
                        <span className="text-xs font-medium">
                            {label || 'Lane'}
                        </span>
                    </div>
                </div>

                {/* Content Area - nodes can be placed here */}
                <div className="ml-10 h-full p-4">
                    {/* This area is for dropping other nodes */}
                </div>
            </div>

            {/* Connection handles on left and right for connecting lanes */}
            <Handle
                type="target"
                position={Position.Left}
                isConnectable={isConnectable}
                className="!w-3 !h-3 !bg-slate-500 !border-2 !border-slate-800 !left-[-8px]"
                style={{ top: '50%' }}
            />
            <Handle
                type="source"
                position={Position.Right}
                isConnectable={isConnectable}
                className="!w-3 !h-3 !bg-slate-500 !border-2 !border-slate-800 !right-[-8px]"
                style={{ top: '50%' }}
            />
        </>
    );
});

SwimLaneNode.displayName = 'SwimLaneNode';

export default SwimLaneNode;



