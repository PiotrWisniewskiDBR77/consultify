/**
 * useAutoLayout Hook
 *
 * Auto-layout algorithm for Discovery Canvas nodes.
 * Arranges nodes by category in a grid layout.
 */

import { useCallback, useMemo } from 'react';

import { useDiscoveryStore } from '@/store/useDiscoveryStore';
import {
  CANVAS_CATEGORIES,
  CanvasCategory,
  DiscoveryNode,
  DiscoveryNodePosition,
} from '@/types/discovery';

interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  nodeGapX: number;
  nodeGapY: number;
  columnsPerCategory: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  nodeWidth: 180,
  nodeHeight: 100,
  nodeGapX: 20,
  nodeGapY: 15,
  columnsPerCategory: 3,
};

/**
 * Get category for a node type
 */
const getCategoryForType = (type: DiscoveryNode['type']): CanvasCategory => {
  switch (type) {
    case 'painPoint':
      return 'pains';
    case 'insight':
    case 'quote':
      return 'insights';
    case 'opportunity':
      return 'opportunities';
    case 'recommendation':
    case 'tool':
    case 'assessment':
    case 'initiative':
      return 'recommendations';
    default:
      return 'pains';
  }
};

/**
 * Hook for auto-layout functionality
 */
export const useAutoLayout = (config: Partial<LayoutConfig> = {}) => {
  const { nodes } = useDiscoveryStore();

  const layoutConfig = useMemo(
    () => ({
      ...DEFAULT_CONFIG,
      ...config,
    }),
    [config]
  );

  /**
   * Calculate position for a new node
   */
  const calculatePosition = useCallback(
    (type: DiscoveryNode['type'], existingNodes?: DiscoveryNode[]): DiscoveryNodePosition => {
      const nodeList = existingNodes || nodes;
      const category = getCategoryForType(type);
      const categoryConfig = CANVAS_CATEGORIES.find((c) => c.id === category);

      if (!categoryConfig) {
        return { x: 100, y: 100 };
      }

      const nodesInCategory = nodeList.filter((n) => getCategoryForType(n.type) === category);

      const row = Math.floor(nodesInCategory.length / layoutConfig.columnsPerCategory);
      const col = nodesInCategory.length % layoutConfig.columnsPerCategory;

      return {
        x: categoryConfig.position.x + col * (layoutConfig.nodeWidth + layoutConfig.nodeGapX),
        y: categoryConfig.position.y + row * (layoutConfig.nodeHeight + layoutConfig.nodeGapY),
      };
    },
    [nodes, layoutConfig]
  );

  /**
   * Layout all nodes by category
   */
  const layoutNodes = useCallback(
    (nodesToLayout: DiscoveryNode[]): DiscoveryNode[] => {
      // Group nodes by category
      const nodesByCategory: Record<CanvasCategory, DiscoveryNode[]> = {
        pains: [],
        insights: [],
        opportunities: [],
        recommendations: [],
      };

      nodesToLayout.forEach((node) => {
        const category = getCategoryForType(node.type);
        nodesByCategory[category].push(node);
      });

      // Layout each category
      const layoutedNodes: DiscoveryNode[] = [];

      Object.entries(nodesByCategory).forEach(([category, categoryNodes]) => {
        const categoryConfig = CANVAS_CATEGORIES.find((c) => c.id === category);
        if (!categoryConfig) return;

        categoryNodes.forEach((node, index) => {
          const row = Math.floor(index / layoutConfig.columnsPerCategory);
          const col = index % layoutConfig.columnsPerCategory;

          layoutedNodes.push({
            ...node,
            position: {
              x: categoryConfig.position.x + col * (layoutConfig.nodeWidth + layoutConfig.nodeGapX),
              y:
                categoryConfig.position.y + row * (layoutConfig.nodeHeight + layoutConfig.nodeGapY),
            },
          });
        });
      });

      return layoutedNodes;
    },
    [layoutConfig]
  );

  /**
   * Check if a position would overlap with existing nodes
   */
  const wouldOverlap = useCallback(
    (position: DiscoveryNodePosition, excludeNodeId?: string): boolean => {
      return nodes.some((node) => {
        if (node.id === excludeNodeId) return false;

        const dx = Math.abs(node.position.x - position.x);
        const dy = Math.abs(node.position.y - position.y);

        return (
          dx < layoutConfig.nodeWidth + layoutConfig.nodeGapX &&
          dy < layoutConfig.nodeHeight + layoutConfig.nodeGapY
        );
      });
    },
    [nodes, layoutConfig]
  );

  /**
   * Find next available position that doesn't overlap
   */
  const findNonOverlappingPosition = useCallback(
    (type: DiscoveryNode['type']): DiscoveryNodePosition => {
      let position = calculatePosition(type);
      let attempts = 0;
      const maxAttempts = 50;

      while (wouldOverlap(position) && attempts < maxAttempts) {
        // Try next position in grid
        attempts++;
        const category = getCategoryForType(type);
        const categoryConfig = CANVAS_CATEGORIES.find((c) => c.id === category);

        if (!categoryConfig) break;

        const row = Math.floor(attempts / layoutConfig.columnsPerCategory);
        const col = attempts % layoutConfig.columnsPerCategory;

        position = {
          x: categoryConfig.position.x + col * (layoutConfig.nodeWidth + layoutConfig.nodeGapX),
          y: categoryConfig.position.y + row * (layoutConfig.nodeHeight + layoutConfig.nodeGapY),
        };
      }

      return position;
    },
    [calculatePosition, wouldOverlap, layoutConfig]
  );

  return {
    calculatePosition,
    layoutNodes,
    wouldOverlap,
    findNonOverlappingPosition,
    config: layoutConfig,
  };
};

export default useAutoLayout;
