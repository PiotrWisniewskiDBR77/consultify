import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import {
    PlaybookTemplateVersion,
    PlaybookNode,
    PlaybookEdge,
    TemplateGraph,
    PlaybookNodeType,
    TemplateValidationError
} from '../../types';
import { PlaybookCanvas, PlaybookPropertiesPanel, PlaybookToolbar } from '../../components/PlaybookEditor';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

interface PlaybookEditorViewProps {
    templateId?: string;
    onBack: () => void;
}

/**
 * PlaybookEditorView
 * Step 13: Visual Playbook Editor
 * 
 * Full-page editor for creating and editing playbook templates.
 */
export const PlaybookEditorView: React.FC<PlaybookEditorViewProps> = ({
    templateId,
    onBack
}) => {
    const { token } = useStore();
    const [template, setTemplate] = useState<PlaybookTemplateVersion | null>(null);
    const [nodes, setNodes] = useState<PlaybookNode[]>([]);
    const [edges, setEdges] = useState<PlaybookEdge[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [validating, setValidating] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [validationErrors, setValidationErrors] = useState<TemplateValidationError[]>([]);

    // Load template
    useEffect(() => {
        if (templateId) {
            loadTemplate();
        } else {
            // Create new empty template
            initializeEmptyTemplate();
        }
    }, [templateId]);

    const loadTemplate = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/ai/playbooks/templates/${templateId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to load template');

            const data = await res.json();
            setTemplate(data);

            if (data.templateGraph) {
                setNodes(data.templateGraph.nodes || []);
                setEdges(data.templateGraph.edges || []);
            } else {
                initializeEmptyGraph();
            }
        } catch (err) {
            toast.error('Failed to load template');
            onBack();
        } finally {
            setLoading(false);
        }
    };

    const initializeEmptyTemplate = () => {
        setTemplate({
            id: '',
            key: '',
            title: 'New Template',
            description: '',
            triggerSignal: '',
            version: 1,
            status: 'DRAFT' as any,
            templateGraph: null,
            estimatedDurationMins: 30,
            isActive: true
        });
        initializeEmptyGraph();
        setLoading(false);
    };

    const initializeEmptyGraph = () => {
        const startId = `node-start-${uuidv4().slice(0, 8)}`;
        const endId = `node-end-${uuidv4().slice(0, 8)}`;

        setNodes([
            {
                id: startId,
                type: PlaybookNodeType.START,
                title: 'Start',
                data: {},
                position: { x: 300, y: 50 }
            },
            {
                id: endId,
                type: PlaybookNodeType.END,
                title: 'End',
                data: {},
                position: { x: 300, y: 400 }
            }
        ]);

        setEdges([
            {
                id: `edge-${startId}-${endId}`,
                from: startId,
                to: endId,
                label: 'default'
            }
        ]);
    };

    const handleAddNode = (type: PlaybookNodeType) => {
        const id = `node-${type.toLowerCase()}-${uuidv4().slice(0, 8)}`;
        const newNode: PlaybookNode = {
            id,
            type,
            title: type === PlaybookNodeType.BRANCH ? 'Branch' :
                type === PlaybookNodeType.CHECK ? 'Check' : 'New Action',
            data: {
                actionType: type === PlaybookNodeType.ACTION ? 'TASK_CREATE' : undefined
            },
            position: { x: 200, y: 200 } // Default position
        };

        setNodes(prev => [...prev, newNode]);
        setSelectedNodeId(id);
        setIsDirty(true);
    };

    const handleNodeMove = (nodeId: string, position: { x: number; y: number }) => {
        setNodes(prev => prev.map(n =>
            n.id === nodeId ? { ...n, position } : n
        ));
        setIsDirty(true);
    };

    const handleNodeUpdate = (updates: Partial<PlaybookNode>) => {
        if (!selectedNodeId || !updates.id) return;

        setNodes(prev => prev.map(n =>
            n.id === updates.id ? { ...n, ...updates } : n
        ));
        setIsDirty(true);
    };

    const handleDeleteSelected = () => {
        if (!selectedNodeId) return;

        const node = nodes.find(n => n.id === selectedNodeId);
        if (node?.type === PlaybookNodeType.START || node?.type === PlaybookNodeType.END) {
            toast.error('Cannot delete START or END nodes');
            return;
        }

        setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
        setEdges(prev => prev.filter(e => e.from !== selectedNodeId && e.to !== selectedNodeId));
        setSelectedNodeId(null);
        setIsDirty(true);
    };

    const handleSave = async () => {
        if (!template) return;

        try {
            setSaving(true);

            const graph: TemplateGraph = {
                nodes,
                edges,
                meta: { trigger_signal: template.triggerSignal || '' }
            };

            const res = await fetch(`/api/ai/playbooks/templates/${template.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: template.title,
                    description: template.description,
                    triggerSignal: template.triggerSignal,
                    templateGraph: graph,
                    estimatedDurationMins: template.estimatedDurationMins
                })
            });

            if (!res.ok) throw new Error('Save failed');

            toast.success('Template saved');
            setIsDirty(false);
        } catch (err) {
            toast.error('Failed to save template');
        } finally {
            setSaving(false);
        }
    };

    const handleValidate = async () => {
        if (!template) return;

        try {
            setValidating(true);

            const res = await fetch(`/api/ai/playbooks/templates/${template.id}/validate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });

            const result = await res.json();
            setValidationErrors(result.errors || []);

            if (result.ok) {
                toast.success('Template is valid ✓');
            } else {
                toast.error(`${result.errors.length} validation error(s) found`);
            }
        } catch (err) {
            toast.error('Validation failed');
        } finally {
            setValidating(false);
        }
    };

    const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-gray-100">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <input
                        type="text"
                        value={template?.title || ''}
                        onChange={(e) => {
                            if (template) {
                                setTemplate({ ...template, title: e.target.value });
                                setIsDirty(true);
                            }
                        }}
                        className="text-lg font-semibold text-gray-900 border-none focus:ring-0 bg-transparent"
                        placeholder="Template Title"
                    />
                    <span className="ml-2 text-xs text-gray-500">
                        {template?.status} • v{template?.version}
                    </span>
                </div>
            </div>

            {/* Toolbar */}
            <PlaybookToolbar
                onAddNode={handleAddNode}
                onSave={handleSave}
                onValidate={handleValidate}
                onDeleteSelected={handleDeleteSelected}
                hasSelectedNode={!!selectedNodeId}
                isSaving={saving}
                isValidating={validating}
                isDirty={isDirty}
            />

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Canvas */}
                <PlaybookCanvas
                    nodes={nodes}
                    edges={edges}
                    selectedNodeId={selectedNodeId}
                    onNodeSelect={setSelectedNodeId}
                    onNodeMove={handleNodeMove}
                />

                {/* Properties Panel */}
                <PlaybookPropertiesPanel
                    node={selectedNode}
                    onUpdate={handleNodeUpdate}
                    onClose={() => setSelectedNodeId(null)}
                />
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
                <div className="bg-red-50 border-t border-red-200 px-4 py-2">
                    <div className="flex items-center gap-2 text-red-700 text-sm">
                        <AlertTriangle size={16} />
                        <span className="font-medium">Validation Errors:</span>
                        {validationErrors.map((err, i) => (
                            <span key={i} className="bg-red-100 px-2 py-0.5 rounded text-xs">
                                {err.message}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlaybookEditorView;
