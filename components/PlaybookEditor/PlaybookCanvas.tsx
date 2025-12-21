import React, { useRef } from 'react';
import {
    PlaybookNode as PlaybookNodeType,
    PlaybookEdge,
    PlaybookNodeType as NodeType
} from '../../types';
import { PlaybookNode } from './PlaybookNode';

interface PlaybookCanvasProps {
    nodes: PlaybookNodeType[];
    edges: PlaybookEdge[];
    selectedNodeId: string | null;
    onNodeSelect: (nodeId: string | null) => void;
    onNodeMove: (nodeId: string, position: { x: number; y: number }) => void;
}

/**
 * PlaybookCanvas Component
 * Step 13: Visual Playbook Editor
 * 
 * Main canvas for the playbook graph visualization with nodes and edges.
 */
export const PlaybookCanvas: React.FC<PlaybookCanvasProps> = ({
    nodes,
    edges,
    selectedNodeId,
    onNodeSelect,
    onNodeMove
}) => {
    const canvasRef = useRef<HTMLDivElement>(null);

    const handleNodeDragEnd = (nodeId: string, e: React.DragEvent) => {
        if (!canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - 60; // Adjust for node width
        const y = e.clientY - rect.top - 20;  // Adjust for node height

        onNodeMove(nodeId, { x: Math.max(0, x), y: Math.max(0, y) });
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (e.target === canvasRef.current) {
            onNodeSelect(null);
        }
    };

    // Calculate edge paths
    const renderEdges = () => {
        return edges.map(edge => {
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);

            if (!fromNode || !toNode) return null;

            // Calculate connection points (bottom of from, top of to)
            const fromX = fromNode.position.x + 60; // Half node width
            const fromY = fromNode.position.y + 45; // Node height
            const toX = toNode.position.x + 60;
            const toY = toNode.position.y;

            // Create curved path
            const midY = (fromY + toY) / 2;
            const path = `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;

            return (
                <g key={edge.id}>
                    <path
                        d={path}
                        fill="none"
                        stroke="#9CA3AF"
                        strokeWidth="2"
                        markerEnd="url(#arrowhead)"
                    />
                    {edge.label && edge.label !== 'default' && (
                        <text
                            x={(fromX + toX) / 2}
                            y={midY - 5}
                            textAnchor="middle"
                            className="text-xs fill-gray-500"
                        >
                            {edge.label}
                        </text>
                    )}
                </g>
            );
        });
    };

    return (
        <div
            ref={canvasRef}
            className="relative flex-1 bg-gray-50 overflow-auto"
            onClick={handleCanvasClick}
            style={{ minHeight: '600px' }}
        >
            {/* Grid Background */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                }}
            />

            {/* SVG for edges */}
            <svg
                className="absolute inset-0 pointer-events-none"
                style={{ width: '100%', height: '100%', minWidth: '800px', minHeight: '600px' }}
            >
                <defs>
                    <marker
                        id="arrowhead"
                        markerWidth="10"
                        markerHeight="7"
                        refX="9"
                        refY="3.5"
                        orient="auto"
                    >
                        <polygon points="0 0, 10 3.5, 0 7" fill="#9CA3AF" />
                    </marker>
                </defs>
                {renderEdges()}
            </svg>

            {/* Nodes */}
            {nodes.map(node => (
                <PlaybookNode
                    key={node.id}
                    node={node}
                    isSelected={selectedNodeId === node.id}
                    onClick={() => onNodeSelect(node.id)}
                    onDragStart={(e) => {
                        e.dataTransfer.setData('nodeId', node.id);
                    }}
                />
            ))}

            {/* Empty state */}
            {nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                        <p className="text-lg mb-2">Empty Canvas</p>
                        <p className="text-sm">Use the toolbar to add nodes</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlaybookCanvas;
