/**
 * StudioView - Main View for Consultify Studio
 * 
 * Split-panel layout with AI chat and React Flow canvas.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Node, Edge, ReactFlowProvider } from 'reactflow';
import { 
    PanelLeft, 
    PanelLeftClose,
    Save,
    FileText,
    Link2,
    Download,
    Settings,
    History,
    Loader2,
    Plus,
    FolderOpen,
    ChevronDown,
    X
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { StudioCanvas } from '../components/Studio/StudioCanvas';
import { StudioChat } from '../components/Studio/StudioChat';
import { useStudioDocument } from '../components/Studio/hooks/useStudioDocument';
import { useStudioAI } from '../components/Studio/hooks/useStudioAI';
import { StudioToolbar } from '../components/Studio/StudioToolbar';
import { StudioSidebar } from '../components/Studio/StudioSidebar';
import { StudioExportModal } from '../components/Studio/StudioExportModal';
import { StudioLinkModal } from '../components/Studio/StudioLinkModal';

interface StudioViewProps {
    documentId?: string | null;
    linkedTaskId?: string;
    linkedProjectId?: string;
    linkedInitiativeId?: string;
    onClose?: () => void;
}

export const StudioView: React.FC<StudioViewProps> = ({
    documentId: initialDocumentId,
    linkedTaskId,
    linkedProjectId,
    linkedInitiativeId,
    onClose
}) => {
    // UI State
    const [showChat, setShowChat] = useState(true);
    const [showSidebar, setShowSidebar] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Document hook
    const {
        document,
        nodes,
        edges,
        loading,
        saving,
        hasUnsavedChanges,
        lastSaved,
        onNodesChange,
        onEdgesChange,
        onConnect,
        replaceAll,
        saveDocument,
        createDocument,
        updateMetadata
    } = useStudioDocument({ 
        documentId: initialDocumentId,
        autoSave: true 
    });

    // AI hook
    const {
        messages,
        isProcessing,
        sendMessage,
        clearMessages,
        getSuggestions
    } = useStudioAI({
        documentId: document?.id,
        onDiagramUpdate: (newNodes, newEdges, action) => {
            if (action === 'replace') {
                replaceAll(newNodes, newEdges);
            } else {
                replaceAll(newNodes, newEdges);
            }
        }
    });

    // Create new document if none provided
    useEffect(() => {
        if (!initialDocumentId && !document && !loading) {
            createDocument({
                name: 'Untitled Diagram',
                type: 'process_flow',
                linkedTaskId,
                linkedProjectId,
                linkedInitiativeId
            });
        }
    }, [initialDocumentId, document, loading, createDocument, linkedTaskId, linkedProjectId, linkedInitiativeId]);

    // Handle chat message
    const handleSendMessage = useCallback(async (message: string) => {
        await sendMessage(message, { nodes, edges });
    }, [sendMessage, nodes, edges]);

    // Handle node click
    const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
    }, []);

    // Handle pane click (deselect)
    const handlePaneClick = useCallback(() => {
        setSelectedNodeId(null);
    }, []);

    // Handle save
    const handleSave = useCallback(async () => {
        await saveDocument(true);
    }, [saveDocument]);

    // Handle export
    const handleExport = useCallback(() => {
        setShowExportModal(true);
    }, []);

    // Handle link
    const handleLink = useCallback(() => {
        setShowLinkModal(true);
    }, []);

    if (loading && !document) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-950">
                <div className="text-center">
                    <Loader2 size={32} className="text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Loading Studio...</p>
                </div>
            </div>
        );
    }

    return (
        <ReactFlowProvider>
            <div className="h-full flex flex-col bg-slate-950">
                {/* Header */}
                <header className="shrink-0 h-14 px-4 flex items-center justify-between border-b border-white/10 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        {/* Toggle Sidebar */}
                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <FolderOpen size={18} />
                        </button>

                        {/* Document Title */}
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={document?.name || 'Untitled'}
                                onChange={(e) => updateMetadata({ name: e.target.value })}
                                className="bg-transparent border-none text-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1"
                            />
                            {hasUnsavedChanges && (
                                <span className="w-2 h-2 bg-amber-500 rounded-full" title="Unsaved changes" />
                            )}
                        </div>

                        {/* Document Type Badge */}
                        <div className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-md capitalize">
                            {document?.type?.replace('_', ' ') || 'Diagram'}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Save Status */}
                        {lastSaved && (
                            <span className="text-xs text-slate-500">
                                Saved {new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}

                        {/* Save Button */}
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors text-sm"
                        >
                            {saving ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Save size={14} />
                            )}
                            Save
                        </button>

                        {/* Link Button */}
                        <button
                            onClick={handleLink}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Link to Task/Project"
                        >
                            <Link2 size={18} />
                        </button>

                        {/* Export Button */}
                        <button
                            onClick={handleExport}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Export"
                        >
                            <Download size={18} />
                        </button>

                        {/* Toggle Chat */}
                        <button
                            onClick={() => setShowChat(!showChat)}
                            className={`p-2 rounded-lg transition-colors ${
                                showChat 
                                    ? 'bg-blue-500/20 text-blue-400' 
                                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                            title={showChat ? 'Hide AI Chat' : 'Show AI Chat'}
                        >
                            {showChat ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
                        </button>

                        {/* Close Button */}
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Documents Sidebar */}
                    {showSidebar && (
                        <StudioSidebar
                            currentDocumentId={document?.id}
                            onSelectDocument={(id) => {
                                // Would need to implement document switching
                                toast('Document switching coming soon!');
                            }}
                            onClose={() => setShowSidebar(false)}
                        />
                    )}

                    {/* Chat Panel */}
                    {showChat && (
                        <div className="w-80 shrink-0 border-r border-white/10">
                            <StudioChat
                                messages={messages}
                                isProcessing={isProcessing}
                                onSendMessage={handleSendMessage}
                                onClear={clearMessages}
                            />
                        </div>
                    )}

                    {/* Canvas */}
                    <div className="flex-1 relative">
                        <StudioCanvas
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onNodeClick={handleNodeClick}
                            onPaneClick={handlePaneClick}
                            selectedNodeId={selectedNodeId}
                            onExport={handleExport}
                            onSnapshot={() => saveDocument(true)}
                        />

                        {/* Toolbar */}
                        <StudioToolbar
                            diagramType={document?.type || 'process_flow'}
                            onAddNode={(type) => {
                                // Add node logic
                                toast('Add node via toolbar coming soon!');
                            }}
                        />
                    </div>
                </div>

                {/* Export Modal */}
                {showExportModal && (
                    <StudioExportModal
                        documentId={document?.id || ''}
                        documentName={document?.name || 'diagram'}
                        onClose={() => setShowExportModal(false)}
                    />
                )}

                {/* Link Modal */}
                {showLinkModal && (
                    <StudioLinkModal
                        documentId={document?.id || ''}
                        currentLinks={{
                            taskId: document?.linkedTaskId,
                            projectId: document?.linkedProjectId,
                            initiativeId: document?.linkedInitiativeId
                        }}
                        onLink={(links) => {
                            updateMetadata(links);
                            setShowLinkModal(false);
                            toast.success('Links updated');
                        }}
                        onClose={() => setShowLinkModal(false)}
                    />
                )}
            </div>
        </ReactFlowProvider>
    );
};

export default StudioView;



