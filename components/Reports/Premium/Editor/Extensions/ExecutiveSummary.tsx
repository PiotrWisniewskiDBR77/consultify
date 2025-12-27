/**
 * ExecutiveSummary Extension
 * 
 * Premium block for AI-generated executive summaries
 * with key metrics and insights.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState, useEffect } from 'react';
import { FileText, Sparkles, RefreshCw, Loader2 } from 'lucide-react';

interface ExecutiveSummaryAttrs {
    assessmentId: string;
    content: string;
    keyInsights: string[];
    metrics: { label: string; value: string; trend?: 'up' | 'down' | 'neutral' }[];
    isAIGenerated: boolean;
}

const ExecutiveSummaryComponent: React.FC<{
    node: { attrs: ExecutiveSummaryAttrs };
    updateAttributes: (attrs: Partial<ExecutiveSummaryAttrs>) => void;
    selected: boolean;
}> = ({ node, updateAttributes, selected }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const attrs = node.attrs;

    const handleRegenerate = async () => {
        if (!attrs.assessmentId) return;

        setIsGenerating(true);
        try {
            const response = await fetch('/api/ai/report/executive-summary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ assessmentId: attrs.assessmentId })
            });

            if (response.ok) {
                const data = await response.json();
                updateAttributes({
                    content: data.content,
                    keyInsights: data.keyInsights,
                    metrics: data.metrics,
                    isAIGenerated: true
                });
            }
        } catch (error) {
            console.error('Failed to generate summary:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    // Demo content if empty
    const displayContent = attrs.content || `
Przeprowadzona ocena dojrzałości cyfrowej ujawnia znaczące możliwości transformacji. 
Organizacja aktualnie osiąga średni poziom dojrzałości 3.2/7, z celem na poziomie 5.0/7.

**Kluczowe wnioski:**
Największe luki zidentyfikowano w obszarach Dojrzałości AI (2.0 pkt luki) oraz Zarządzania Danymi (2.0 pkt luki). 
Obszar Cyberbezpieczeństwa stanowi mocną stronę organizacji z najniższą luką (1.0 pkt).

Rekomendowane jest priorytetowe wdrożenie inicjatyw w obszarze automatyzacji procesów 
oraz budowy kompetencji data science, co może przynieść szacowany ROI na poziomie 180% w ciągu 18 miesięcy.
  `.trim();

    const displayMetrics = attrs.metrics?.length ? attrs.metrics : [
        { label: 'Obecna dojrzałość', value: '3.2', trend: 'neutral' as const },
        { label: 'Cel', value: '5.0', trend: 'up' as const },
        { label: 'Całkowita luka', value: '12.8', trend: 'down' as const },
        { label: 'Szacowany ROI', value: '180%', trend: 'up' as const }
    ];

    return (
        <NodeViewWrapper className= {`premium-executive-summary ${selected ? 'ring-2 ring-blue-500' : ''}`
}>
    {/* Header */ }
    < div className = "flex items-center justify-between mb-6" >
        <div className="flex items-center gap-3" >
            <div className="p-2 bg-white/20 rounded-lg" >
                <FileText className="w-6 h-6" />
                    </div>
                    < h2 className = "text-xl font-bold" > Executive Summary </h2>
                        </div>
                        < div className = "flex items-center gap-2" >
                            {
                                attrs.isAIGenerated && (
                                    <span className="flex items-center gap-1 px-2 py-1 bg-white/10 rounded-full text-xs">
                                        <Sparkles className="w-3 h-3" />
              AI
                                    </ span >
          )}
<button
            onClick={ handleRegenerate }
disabled = { isGenerating }
className = "p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
    >
    {
        isGenerating?(
              <Loader2 className = "w-4 h-4 animate-spin" />
            ): (
                <RefreshCw className = "w-4 h-4" />
            )}
</button>
    </div>
    </div>

{/* Metrics Row */ }
<div className="metrics-row mb-6" >
{
    displayMetrics.map((metric, idx) => (
        <div
            key= { idx }
            className = "flex-1 bg-white/10 rounded-lg p-4 text-center"
        >
        <div className="text-2xl font-bold" > { metric.value } </div>
    < div className = "text-sm opacity-80 mt-1" > { metric.label } </div>
    </div>
    ))
}
    </div>

{/* Content */ }
{
    isEditing ? (
        <textarea
          value= { attrs.content }
          onChange = {(e) => updateAttributes({ content: e.target.value })
}
onBlur = {() => setIsEditing(false)}
autoFocus
className = "w-full bg-white/10 rounded-lg p-4 text-white placeholder-white/50 resize-none min-h-[200px] focus:outline-none focus:ring-2 focus:ring-white/30"
    />
      ) : (
    <div
          onClick= {() => setIsEditing(true)}
className = "key-insight cursor-text whitespace-pre-line"
    >
{
    displayContent.split('\n').map((line, i) => (
        <p key= { i } className = "mb-2" >
        {
            line.startsWith('**') && line.endsWith('**')
                ? <strong>{ line.slice(2, -2) } </strong>
                : line
        }
        </p>
    ))
}
    </div>
      )}
</NodeViewWrapper>
  );
};

export const ExecutiveSummaryExtension = Node.create({
    name: 'executiveSummary',

    group: 'block',

    atom: true,

    addAttributes() {
        return {
            assessmentId: { default: null },
            content: { default: '' },
            keyInsights: { default: [] },
            metrics: { default: [] },
            isAIGenerated: { default: false }
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-executive-summary]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-executive-summary': '' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(ExecutiveSummaryComponent);
    }
});

export default ExecutiveSummaryExtension;
