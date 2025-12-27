/**
 * MetricCard Extension
 * 
 * Simple metric display cards with value, label, and optional trend.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Edit3, Check, X } from 'lucide-react';

interface MetricCardAttrs {
    value: string;
    label: string;
    sublabel?: string;
    trend?: 'up' | 'down' | 'neutral';
    variant?: 'primary' | 'success' | 'warning' | 'danger';
}

const VARIANT_STYLES = {
    primary: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    success: 'bg-gradient-to-br from-green-500 to-emerald-600',
    warning: 'bg-gradient-to-br from-amber-500 to-orange-600',
    danger: 'bg-gradient-to-br from-red-500 to-rose-600'
};

const TrendIcon: React.FC<{ trend?: 'up' | 'down' | 'neutral' }> = ({ trend }) => {
    switch (trend) {
        case 'up':
            return <TrendingUp className="w-4 h-4 text-green-300" />;
        case 'down':
            return <TrendingDown className="w-4 h-4 text-red-300" />;
        default:
            return <Minus className="w-4 h-4 text-white/50" />;
    }
};

const MetricCardComponent: React.FC<{
    node: { attrs: MetricCardAttrs };
    updateAttributes: (attrs: Partial<MetricCardAttrs>) => void;
    selected: boolean;
}> = ({ node, updateAttributes, selected }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState(node.attrs);

    const attrs = node.attrs;
    const variantStyle = VARIANT_STYLES[attrs.variant || 'primary'];

    const handleSave = () => {
        updateAttributes(editForm);
        setIsEditing(false);
    };

    return (
        <NodeViewWrapper className= "inline-block" >
        {
            isEditing?(
        <div className = "p-4 bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-600 space-y-3 min-w-[200px]" >
                    <div className="flex justify-between items-center">
        <span className="text-sm font-medium" > Edytuj kartę </span>
            < div className = "flex gap-1" >
                <button onClick={ () => setIsEditing(false) } className = "p-1 text-slate-400 hover:text-red-500" >
                    <X className="w-4 h-4" />
                        </button>
                        < button onClick = { handleSave } className = "p-1 text-slate-400 hover:text-green-500" >
                            <Check className="w-4 h-4" />
                                </button>
                                </div>
                                </div>
                                < input
    type = "text"
    value = { editForm.value }
    onChange = {(e) => setEditForm({ ...editForm, value: e.target.value })}
placeholder = "Wartość"
className = "w-full px-2 py-1 border rounded text-sm"
    />
    <input
            type="text"
value = { editForm.label }
onChange = {(e) => setEditForm({ ...editForm, label: e.target.value })}
placeholder = "Etykieta"
className = "w-full px-2 py-1 border rounded text-sm"
    />
    <select
            value={ editForm.variant }
onChange = {(e) => setEditForm({ ...editForm, variant: e.target.value as MetricCardAttrs['variant'] })}
className = "w-full px-2 py-1 border rounded text-sm"
    >
    <option value="primary" > Niebieski </option>
        < option value = "success" > Zielony </option>
            < option value = "warning" > Pomarańczowy </option>
                < option value = "danger" > Czerwony </option>
                    </select>
                    < select
value = { editForm.trend }
onChange = {(e) => setEditForm({ ...editForm, trend: e.target.value as MetricCardAttrs['trend'] })}
className = "w-full px-2 py-1 border rounded text-sm"
    >
    <option value="neutral" > Neutralny </option>
        < option value = "up" > Wzrost </option>
            < option value = "down" > Spadek </option>
                </select>
                </div>
      ) : (
    <div
          className= {`premium-metric-card ${variantStyle} ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''} group relative`}
onDoubleClick = {() => setIsEditing(true)}
        >
    <button
            onClick={ () => setIsEditing(true) }
className = "absolute top-2 right-2 p-1 bg-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
    >
    <Edit3 className="w-3 h-3" />
        </button>

        < div className = "flex items-center gap-2" >
            <span className="value" > { attrs.value || '0' } </span>
{ attrs.trend && <TrendIcon trend={ attrs.trend } /> }
</div>
    < span className = "label" > { attrs.label || 'Metryka' } </span>
{
    attrs.sublabel && (
        <span className="text-xs opacity-70 mt-1" > { attrs.sublabel } </span>
          )
}
</div>
      )}
</NodeViewWrapper>
  );
};

export const MetricCardExtension = Node.create({
    name: 'metricCard',

    group: 'inline',

    inline: true,

    atom: true,

    addAttributes() {
        return {
            value: { default: '0' },
            label: { default: 'Metryka' },
            sublabel: { default: '' },
            trend: { default: 'neutral' },
            variant: { default: 'primary' }
        };
    },

    parseHTML() {
        return [{ tag: 'span[data-metric-card]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 'data-metric-card': '' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(MetricCardComponent);
    }
});

export default MetricCardExtension;
