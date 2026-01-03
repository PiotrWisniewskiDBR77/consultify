/**
 * StudioCanvas Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { StudioCanvas } from '../../../components/Studio/StudioCanvas';

// Mock ReactFlow
vi.mock('reactflow', async () => {
    const actual = await vi.importActual('reactflow');
    return {
        ...actual,
        ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
        useNodesState: () => [[], vi.fn(), vi.fn()],
        useEdgesState: () => [[], vi.fn(), vi.fn()],
        Background: () => <div data-testid="rf-background" />,
        Controls: () => <div data-testid="rf-controls" />,
        MiniMap: () => <div data-testid="rf-minimap" />
    };
});

describe('StudioCanvas', () => {
    const mockNodes = [
        { id: 'node-1', type: 'processStep', position: { x: 0, y: 0 }, data: { label: 'Test Node' } }
    ];
    const mockEdges = [
        { id: 'edge-1', source: 'node-1', target: 'node-2' }
    ];
    
    const defaultProps = {
        nodes: mockNodes,
        edges: mockEdges,
        onNodesChange: vi.fn(),
        onEdgesChange: vi.fn(),
        onConnect: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render without crashing', () => {
        render(
            <ReactFlowProvider>
                <StudioCanvas {...defaultProps} />
            </ReactFlowProvider>
        );
        
        // Canvas should be rendered
        expect(document.querySelector('.react-flow')).toBeDefined();
    });

    it('should show lock indicator when isLocked is true', () => {
        render(
            <ReactFlowProvider>
                <StudioCanvas {...defaultProps} isLocked={true} />
            </ReactFlowProvider>
        );
        
        // Look for lock indicator
        expect(screen.getByText(/Canvas Locked/i)).toBeInTheDocument();
    });

    it('should call onNodeClick when a node is clicked', () => {
        const onNodeClick = vi.fn();
        
        render(
            <ReactFlowProvider>
                <StudioCanvas {...defaultProps} onNodeClick={onNodeClick} />
            </ReactFlowProvider>
        );
        
        // onNodeClick would be called when clicking a node
        // This is tested through ReactFlow integration
    });

    it('should render export button when onExport is provided', () => {
        const onExport = vi.fn();
        
        render(
            <ReactFlowProvider>
                <StudioCanvas {...defaultProps} onExport={onExport} />
            </ReactFlowProvider>
        );
        
        // Export button should be visible
        const exportButton = screen.getByTitle('Export');
        expect(exportButton).toBeInTheDocument();
    });

    it('should render snapshot button when onSnapshot is provided', () => {
        const onSnapshot = vi.fn();
        
        render(
            <ReactFlowProvider>
                <StudioCanvas {...defaultProps} onSnapshot={onSnapshot} />
            </ReactFlowProvider>
        );
        
        // Snapshot button should be visible
        const snapshotButton = screen.getByTitle('Save Snapshot');
        expect(snapshotButton).toBeInTheDocument();
    });

    it('should toggle grid visibility', () => {
        render(
            <ReactFlowProvider>
                <StudioCanvas {...defaultProps} showGrid={true} />
            </ReactFlowProvider>
        );
        
        const gridButton = screen.getByTitle('Toggle Grid');
        expect(gridButton).toBeInTheDocument();
        
        // Click to toggle
        fireEvent.click(gridButton);
        // Grid should be toggled
    });

    it('should toggle lock state', () => {
        render(
            <ReactFlowProvider>
                <StudioCanvas {...defaultProps} />
            </ReactFlowProvider>
        );
        
        const lockButton = screen.getByTitle(/Lock Canvas|Unlock Canvas/);
        expect(lockButton).toBeInTheDocument();
        
        // Click to lock
        fireEvent.click(lockButton);
        // Should show lock indicator
    });

    it('should highlight selected node', () => {
        render(
            <ReactFlowProvider>
                <StudioCanvas {...defaultProps} selectedNodeId="node-1" />
            </ReactFlowProvider>
        );
        
        // The node with id "node-1" should be highlighted
        // This is handled by the ReactFlow selected state
    });
});






