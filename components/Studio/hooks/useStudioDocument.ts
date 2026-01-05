/**
 * useStudioDocument - Hook for managing Studio document state
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { addEdge, Connection, Edge, Node, useEdgesState, useNodesState } from 'reactflow';

import { Api } from '../../../services/api';

export interface StudioDocument {
    id: string;
    name: string;
    description?: string;
    type: string;
    nodes: Node[];
    edges: Edge[];
    viewport?: { x: number; y: number; zoom: number };
    linkedTaskId?: string;
    linkedProjectId?: string;
    linkedInitiativeId?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface UseStudioDocumentOptions {
    documentId?: string | null;
    autoSave?: boolean;
    autoSaveDelay?: number;
}

export const useStudioDocument = (options: UseStudioDocumentOptions = {}) => {
    const { documentId, autoSave = true, autoSaveDelay = 3000 } = options;

    const [document, setDocument] = useState<StudioDocument | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Load document
    const loadDocument = useCallback(
        async (id: string) => {
            setLoading(true);
            try {
                const response = await Api.get(`/api/studio/documents/${id}`);
                const doc = response.data || response;

                setDocument(doc);
                setNodes(doc.nodes || []);
                setEdges(doc.edges || []);
                setHasUnsavedChanges(false);
                setLastSaved(doc.updatedAt ? new Date(doc.updatedAt) : null);
            } catch (error) {
                console.error('[Studio] Failed to load document:', error);
                toast.error('Failed to load document');
            } finally {
                setLoading(false);
            }
        },
        [setNodes, setEdges],
    );

    // Save document
    const saveDocument = useCallback(
        async (createSnapshot = false) => {
            if (!document?.id) return;

            setSaving(true);
            try {
                await Api.put(`/api/studio/documents/${document.id}`, {
                    nodes,
                    edges,
                    createSnapshot,
                    snapshotReason: createSnapshot ? 'manual' : undefined,
                });

                setHasUnsavedChanges(false);
                setLastSaved(new Date());
                if (createSnapshot) {
                    toast.success('Snapshot saved');
                }
            } catch (error) {
                console.error('[Studio] Failed to save document:', error);
                toast.error('Failed to save');
            } finally {
                setSaving(false);
            }
        },
        [document?.id, nodes, edges],
    );

    // Create new document
    const createDocument = useCallback(
        async (data: Partial<StudioDocument>) => {
            setLoading(true);
            try {
                const response = await Api.post('/api/studio/documents', {
                    name: data.name || 'Untitled Diagram',
                    description: data.description,
                    type: data.type || 'process_flow',
                    nodes: data.nodes || [],
                    edges: data.edges || [],
                    linkedTaskId: data.linkedTaskId,
                    linkedProjectId: data.linkedProjectId,
                    linkedInitiativeId: data.linkedInitiativeId,
                });

                const doc = response.data || response;
                setDocument(doc);
                setNodes(doc.nodes || []);
                setEdges(doc.edges || []);
                setHasUnsavedChanges(false);
                toast.success('Document created');
                return doc;
            } catch (error) {
                console.error('[Studio] Failed to create document:', error);
                toast.error('Failed to create document');
                return null;
            } finally {
                setLoading(false);
            }
        },
        [setNodes, setEdges],
    );

    // Delete document
    const deleteDocument = useCallback(async () => {
        if (!document?.id) return;

        try {
            await Api.delete(`/api/studio/documents/${document.id}`);
            setDocument(null);
            setNodes([]);
            setEdges([]);
            toast.success('Document deleted');
        } catch (error) {
            console.error('[Studio] Failed to delete document:', error);
            toast.error('Failed to delete');
        }
    }, [document?.id, setNodes, setEdges]);

    // Update document metadata
    const updateMetadata = useCallback(
        async (metadata: Partial<StudioDocument>) => {
            if (!document?.id) return;

            try {
                await Api.put(`/api/studio/documents/${document.id}`, metadata);
                setDocument((prev) => (prev ? { ...prev, ...metadata } : null));
                toast.success('Updated');
            } catch (error) {
                console.error('[Studio] Failed to update metadata:', error);
                toast.error('Failed to update');
            }
        },
        [document?.id],
    );

    // Handle connection
    const onConnect = useCallback(
        (connection: Connection) => {
            setEdges((eds) =>
                addEdge(
                    {
                        ...connection,
                        type: 'smoothstep',
                        animated: false,
                    },
                    eds,
                ),
            );
            setHasUnsavedChanges(true);
        },
        [setEdges],
    );

    // Track changes for auto-save
    const handleNodesChange = useCallback(
        (changes: any) => {
            onNodesChange(changes);
            // Only mark as changed for position/data changes, not selection
            const hasRealChanges = changes.some(
                (c: any) => c.type === 'position' || c.type === 'remove' || c.type === 'add',
            );
            if (hasRealChanges) {
                setHasUnsavedChanges(true);
            }
        },
        [onNodesChange],
    );

    const handleEdgesChange = useCallback(
        (changes: any) => {
            onEdgesChange(changes);
            const hasRealChanges = changes.some((c: any) => c.type === 'remove' || c.type === 'add');
            if (hasRealChanges) {
                setHasUnsavedChanges(true);
            }
        },
        [onEdgesChange],
    );

    // Replace all nodes and edges (for AI generation)
    const replaceAll = useCallback(
        (newNodes: Node[], newEdges: Edge[]) => {
            setNodes(newNodes);
            setEdges(newEdges);
            setHasUnsavedChanges(true);
        },
        [setNodes, setEdges],
    );

    // Add nodes
    const addNodes = useCallback(
        (newNodes: Node[]) => {
            setNodes((prev) => [...prev, ...newNodes]);
            setHasUnsavedChanges(true);
        },
        [setNodes],
    );

    // Add edges
    const addEdges = useCallback(
        (newEdges: Edge[]) => {
            setEdges((prev) => [...prev, ...newEdges]);
            setHasUnsavedChanges(true);
        },
        [setEdges],
    );

    // Load document on mount if ID provided
    useEffect(() => {
        if (documentId) {
            loadDocument(documentId);
        }
    }, [documentId, loadDocument]);

    // Auto-save
    useEffect(() => {
        if (!autoSave || !hasUnsavedChanges || !document?.id) return;

        const timer = setTimeout(() => {
            saveDocument(false);
        }, autoSaveDelay);

        return () => clearTimeout(timer);
    }, [autoSave, autoSaveDelay, hasUnsavedChanges, document?.id, saveDocument]);

    return {
        // Document state
        document,
        nodes,
        edges,
        loading,
        saving,
        hasUnsavedChanges,
        lastSaved,

        // Node/Edge state handlers
        onNodesChange: handleNodesChange,
        onEdgesChange: handleEdgesChange,
        onConnect,

        // Mutations
        setNodes,
        setEdges,
        replaceAll,
        addNodes,
        addEdges,

        // Document operations
        loadDocument,
        saveDocument,
        createDocument,
        deleteDocument,
        updateMetadata,
    };
};

export default useStudioDocument;
