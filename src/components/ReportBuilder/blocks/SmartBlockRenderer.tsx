/**
 * SmartBlockRenderer
 *
 * Intelligently selects the best renderer for block content based on:
 * 1. Block type / renderKind
 * 2. Content format (JSON vs markdown)
 * 3. JSON structure detection
 *
 * This is the central dispatcher for all visual block types.
 */

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';

import { ChartRenderer } from './ChartRenderer';
import { InitiativeCards } from './InitiativeCards';
import { KPICards } from './KPICards';
import { MatrixHeatmap } from './MatrixHeatmap';
import { PrioritizationMatrix } from './PrioritizationMatrix';
import { RoadmapTimeline } from './RoadmapTimeline';

// ==========================================
// TYPES
// ==========================================

interface SmartBlockRendererProps {
  content: string;
  blockType: string;
  renderKind?: string;
  primaryColor?: string;
  accentColor?: string;
  blockSettings?: Record<string, unknown>;
}

// ==========================================
// CONTENT DETECTION
// ==========================================

function detectContentType(content: string): {
  isJson: boolean;
  jsonData?: any;
  jsonType?: string;
} {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return { isJson: false };
  }

  try {
    const parsed = JSON.parse(trimmed);

    // Detect type from JSON structure
    if (parsed.type === 'assessment_matrix')
      return { isJson: true, jsonData: parsed, jsonType: 'matrix' };
    if (parsed.type === 'kpi' || parsed.type === 'dashboard')
      return { isJson: true, jsonData: parsed, jsonType: 'kpi' };
    if (parsed.type === 'roadmap' || parsed.type === 'timeline')
      return { isJson: true, jsonData: parsed, jsonType: 'roadmap' };
    if (parsed.type === 'prioritization' || parsed.type === 'impact_effort')
      return { isJson: true, jsonData: parsed, jsonType: 'prioritization' };
    if (
      parsed.type === 'chart' ||
      parsed.type === 'bar' ||
      parsed.type === 'pie' ||
      parsed.type === 'radar'
    )
      return { isJson: true, jsonData: parsed, jsonType: 'chart' };
    if (parsed.type === 'initiatives' || parsed.type === 'initiative_cards')
      return { isJson: true, jsonData: parsed, jsonType: 'initiatives' };

    // Detect from structure
    if (parsed.axes && Array.isArray(parsed.axes))
      return { isJson: true, jsonData: parsed, jsonType: 'matrix' };
    if (parsed.phases && Array.isArray(parsed.phases))
      return { isJson: true, jsonData: parsed, jsonType: 'roadmap' };
    if (parsed.items && Array.isArray(parsed.items)) {
      const firstItem = parsed.items[0];
      // Initiatives: items with name + strategic properties
      if (
        firstItem?.name &&
        (firstItem?.strategicIntent ||
          firstItem?.strategicRole ||
          firstItem?.relatedGap ||
          firstItem?.effortProfile)
      ) {
        return { isJson: true, jsonData: parsed, jsonType: 'initiatives' };
      }
      if (firstItem?.impact !== undefined || firstItem?.effort !== undefined) {
        return { isJson: true, jsonData: parsed, jsonType: 'prioritization' };
      }
      if (firstItem?.value !== undefined || firstItem?.trend !== undefined) {
        return { isJson: true, jsonData: parsed, jsonType: 'kpi' };
      }
    }
    // { initiatives: [...] } shorthand
    if (parsed.initiatives && Array.isArray(parsed.initiatives)) {
      return { isJson: true, jsonData: parsed, jsonType: 'initiatives' };
    }
    if (parsed.data && Array.isArray(parsed.data))
      return { isJson: true, jsonData: parsed, jsonType: 'chart' };
    if (Array.isArray(parsed)) {
      if (parsed[0]?.score !== undefined || parsed[0]?.value !== undefined) {
        return { isJson: true, jsonData: parsed, jsonType: 'chart' };
      }
    }

    return { isJson: true, jsonData: parsed, jsonType: 'generic' };
  } catch {
    return { isJson: false };
  }
}

// ==========================================
// COMPONENT
// ==========================================

export const SmartBlockRenderer: React.FC<SmartBlockRendererProps> = ({
  content,
  blockType,
  renderKind,
  primaryColor = '#3b82f6',
  accentColor = '#8b5cf6',
  blockSettings,
}) => {
  const detected = useMemo(() => detectContentType(content), [content]);

  // 1. Route by explicit renderKind
  if (renderKind === 'matrix' || blockType === 'matrix') {
    if (detected.isJson && detected.jsonData?.axes) {
      return (
        <MatrixHeatmap
          data={detected.jsonData}
          primaryColor={primaryColor}
          accentColor={accentColor}
        />
      );
    }
  }

  if (
    renderKind === 'chart' ||
    blockType === 'chart' ||
    blockType === 'chart_pie' ||
    blockType === 'chart_bar'
  ) {
    return (
      <ChartRenderer content={content} primaryColor={primaryColor} accentColor={accentColor} />
    );
  }

  // 2. Route by blockType
  if (blockType === 'dashboard' || blockType === 'kpis' || blockType === 'scorecard') {
    if (detected.isJson) {
      return (
        <KPICards
          content={content}
          columns={blockSettings?.columns ? Number(blockSettings.columns) : 3}
          primaryColor={primaryColor}
        />
      );
    }
  }

  if (blockType === 'roadmap' || blockType === 'action_plan') {
    if (detected.isJson) {
      return (
        <RoadmapTimeline
          content={content}
          primaryColor={primaryColor}
          orientation={blockSettings?.orientation as any}
        />
      );
    }
  }

  if (blockType === 'prioritization') {
    if (detected.isJson) {
      return <PrioritizationMatrix content={content} primaryColor={primaryColor} />;
    }
  }

  if (blockType === 'initiatives' || blockType === 'initiative_cards') {
    if (detected.isJson) {
      return (
        <InitiativeCards
          content={content}
          layout={blockSettings?.layout as any}
          columns={blockSettings?.columns ? Number(blockSettings.columns) : 2}
          showEffortBars={blockSettings?.showEffortBars !== false}
          primaryColor={primaryColor}
        />
      );
    }
  }

  // 3. Route by detected JSON type
  if (detected.isJson && detected.jsonType) {
    switch (detected.jsonType) {
      case 'matrix':
        return (
          <MatrixHeatmap
            data={detected.jsonData}
            primaryColor={primaryColor}
            accentColor={accentColor}
          />
        );
      case 'chart':
        return (
          <ChartRenderer content={content} primaryColor={primaryColor} accentColor={accentColor} />
        );
      case 'kpi':
        return <KPICards content={content} columns={3} primaryColor={primaryColor} />;
      case 'roadmap':
        return <RoadmapTimeline content={content} primaryColor={primaryColor} />;
      case 'prioritization':
        return <PrioritizationMatrix content={content} primaryColor={primaryColor} />;
      case 'initiatives':
        return (
          <InitiativeCards
            content={content}
            layout={blockSettings?.layout as any}
            columns={blockSettings?.columns ? Number(blockSettings.columns) : 2}
            showEffortBars={blockSettings?.showEffortBars !== false}
            primaryColor={primaryColor}
          />
        );
    }
  }

  // 4. Default: Markdown rendering
  const truncated = content.length > 2000 ? `${content.slice(0, 2000)}\n\n...` : content;
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed">
      <ReactMarkdown>{truncated}</ReactMarkdown>
    </div>
  );
};

export default SmartBlockRenderer;
