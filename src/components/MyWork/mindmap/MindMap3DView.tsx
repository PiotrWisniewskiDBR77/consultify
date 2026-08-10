/**
 * MindMap3DView — Lightweight 3D mind map using CSS 3D transforms.
 * No Three.js dependency — pure CSS perspective + translate3d.
 */
import { Box, ChevronLeft, RotateCcw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface MindMap3DViewProps {
  open: boolean;
  onClose: () => void;
  ideaTitle: string;
  nodes: Array<{ id: string; data: any; position: { x: number; y: number } }>;
  edges: Array<{ source: string; target: string }>;
}

const BRANCH_COLORS: Record<string, string> = {
  problem: '#fb7185',
  goal: '#34d399',
  options: '#fbbf24',
  evidence: '#38bdf8',
  risks: '#a78bfa',
  experiments: '#22d3ee',
};

export const MindMap3DView: React.FC<MindMap3DViewProps> = ({
  open,
  onClose,
  ideaTitle,
  nodes,
  edges,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  const [rotateX, setRotateX] = useState(-20);
  const [rotateY, setRotateY] = useState(30);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const positioned3D = useMemo(() => {
    const branchNodes = nodes.filter((n) => n.id.startsWith('branch-'));
    const ideaNodes = nodes.filter((n) => n.id !== 'root' && !n.id.startsWith('branch-'));
    const root = nodes.find((n) => n.id === 'root');

    const items: Array<{
      id: string;
      label: string;
      color: string;
      x: number;
      y: number;
      z: number;
      size: number;
    }> = [];

    if (root) {
      items.push({
        id: root.id,
        label: root.data?.label || ideaTitle,
        color: '#f59e0b',
        x: 0,
        y: 0,
        z: 0,
        size: 28,
      });
    }

    branchNodes.forEach((bn, idx) => {
      const angle = (idx / Math.max(branchNodes.length, 1)) * Math.PI * 2;
      const radius = 200;
      const color = BRANCH_COLORS[bn.data?.branchKey] || '#94a3b8';
      items.push({
        id: bn.id,
        label: bn.data?.label || bn.id,
        color,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * 0.6,
        z: Math.sin(angle) * 80,
        size: 20,
      });

      const children = edges
        .filter((e) => e.source === bn.id)
        .map((e) => ideaNodes.find((n) => n.id === e.target))
        .filter(Boolean);
      children.forEach((child, ci) => {
        const childAngle = angle + (ci - (children.length - 1) / 2) * 0.3;
        const childRadius = radius + 140;
        items.push({
          id: child!.id,
          label: child!.data?.label || child!.id,
          color,
          x: Math.cos(childAngle) * childRadius,
          y: Math.sin(childAngle) * childRadius * 0.6,
          z: Math.sin(childAngle) * 120 + (ci % 2 === 0 ? 30 : -30),
          size: 14,
        });
      });
    });

    return items;
  }, [edges, ideaTitle, nodes]);

  const edgeLines = useMemo(() => {
    return edges
      .map((e) => {
        const src = positioned3D.find((n) => n.id === e.source);
        const tgt = positioned3D.find((n) => n.id === e.target);
        if (!src || !tgt) return null;
        return { source: src, target: tgt };
      })
      .filter(Boolean) as Array<{
      source: (typeof positioned3D)[0];
      target: (typeof positioned3D)[0];
    }>;
  }, [edges, positioned3D]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      setRotateY((prev) => prev + dx * 0.3);
      setRotateX((prev) => Math.max(-80, Math.min(80, prev - dy * 0.3)));
      lastPos.current = { x: e.clientX, y: e.clientY };
    },
    [dragging]
  );

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.max(0.3, Math.min(3, prev - e.deltaY * 0.001)));
  }, []);

  const resetView = useCallback(() => {
    setRotateX(-20);
    setRotateY(30);
    setZoom(1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal bg-c-surface flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-3 bg-c-surface border-b border-c-border-subtle">
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <Box size={16} className="text-c-text-muted" />
        <h2 className="text-sm font-bold text-c-text">{t('ideas.mindmap.n3dView', '3D View')}</h2>
        <span className="text-[10px] text-c-text-secondary ml-2">
          {t('ideas.mindmap.dragRotate', 'Drag to rotate')}
        </span>
        <div className="flex-1" />
        <button
          onClick={resetView}
          className="p-2 rounded-lg text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised transition-colors"
          title={t('ideas.mindmap.resetView', 'Reset view')}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ perspective: '1200px', perspectiveOrigin: '50% 50%' }}
      >
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${zoom})`,
            transition: dragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          {/* Edge lines as pseudo-3D connections */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {edgeLines.map((line, idx) => {
              const cx = (typeof window !== 'undefined' ? window.innerWidth : 1000) / 2;
              const cy = (typeof window !== 'undefined' ? window.innerHeight : 600) / 2;
              return (
                <line
                  key={idx}
                  x1={cx + line.source.x}
                  y1={cy + line.source.y}
                  x2={cx + line.target.x}
                  y2={cy + line.target.y}
                  stroke={line.source.color}
                  strokeWidth={1}
                  opacity={0.25}
                />
              );
            })}
          </svg>

          {/* 3D positioned nodes */}
          {positioned3D.map((node) => (
            <div
              key={node.id}
              className="absolute pointer-events-auto"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate3d(${node.x}px, ${node.y}px, ${node.z}px) translate(-50%, -50%)`,
                transformStyle: 'preserve-3d',
              }}
            >
              <div
                className="px-3 py-1.5 rounded-xl text-c-text font-bold shadow-lg whitespace-nowrap"
                style={{
                  fontSize: `${node.size * 0.55}px`,
                  backgroundColor: `${node.color}cc`,
                  boxShadow: `0 0 ${node.size}px ${node.color}44`,
                  maxWidth: '160px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {node.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MindMap3DView;
