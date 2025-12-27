/**
 * Callout Extension
 * 
 * Highlighted callout blocks for important information,
 * warnings, tips, and notes.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import { Info, AlertTriangle, CheckCircle, XCircle, Lightbulb } from 'lucide-react';

interface CalloutAttrs {
    type: 'info' | 'warning' | 'success' | 'danger' | 'tip';
    title?: string;
}

const CALLOUT_STYLES = {
    info: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-l-blue-500',
        icon: Info,
        iconColor: 'text-blue-500',
        defaultTitle: 'Informacja'
    },
    warning: {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-l-amber-500',
        icon: AlertTriangle,
        iconColor: 'text-amber-500',
        defaultTitle: 'Uwaga'
    },
    success: {
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-l-green-500',
        icon: CheckCircle,
        iconColor: 'text-green-500',
        defaultTitle: 'Sukces'
    },
    danger: {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-l-red-500',
        icon: XCircle,
        iconColor: 'text-red-500',
        defaultTitle: 'Ważne'
    },
    tip: {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        border: 'border-l-purple-500',
        icon: Lightbulb,
        iconColor: 'text-purple-500',
        defaultTitle: 'Pro Tip'
    }
};

const CalloutComponent: React.FC<{
    node: { attrs: CalloutAttrs };
    updateAttributes: (attrs: Partial<CalloutAttrs>) => void;
    selected: boolean;
}> = ({ node, updateAttributes, selected, children }) => {
    const attrs = node.attrs;
    const style = CALLOUT_STYLES[attrs.type || 'info'];
    const Icon = style.icon;

    return (
        <NodeViewWrapper
      className= {`premium-callout ${style.bg} ${style.border} ${selected ? 'ring-2 ring-blue-500' : ''}`
}
    >
    <div className="flex items-start gap-3" >
        <Icon className={ `w-5 h-5 mt-0.5 flex-shrink-0 ${style.iconColor}` } />
            < div className = "flex-1 min-w-0" >
            {
                attrs.title && (
                    <div className="font-semibold text-slate-900 dark:text-white mb-1">
                        { attrs.title }
                        </div>
          )
            }
                < div className = "text-slate-700 dark:text-slate-300 prose-sm" >
                    { children }
                    </div>
                    </div>
                    </div>

{/* Type selector on hover */ }
{
    selected && (
        <div className="absolute top-2 right-2 flex gap-1" >
            {(Object.keys(CALLOUT_STYLES) as CalloutAttrs['type'][]).map((type) => {
                const TypeIcon = CALLOUT_STYLES[type].icon;
                return (
                    <button
                key= { type }
                onClick = {() => updateAttributes({ type })
            }
                className = {`p-1.5 rounded ${attrs.type === type
                        ? 'bg-slate-200 dark:bg-slate-600'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
              >
    <TypeIcon className={ `w-4 h-4 ${CALLOUT_STYLES[type].iconColor}` } />
        </button>
            );
          })}
</div>
      )}
</NodeViewWrapper>
  );
};

export const CalloutExtension = Node.create({
    name: 'callout',

    group: 'block',

    content: 'block+',

    addAttributes() {
        return {
            type: { default: 'info' },
            title: { default: '' }
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-callout]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(CalloutComponent);
    }
});

export default CalloutExtension;
