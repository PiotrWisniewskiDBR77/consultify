/**
 * TextNode - Simple text annotation
 *
 * Basic text node for annotations and labels.
 * Used in: All diagram types
 */

import React, { memo } from 'react';
import { NodeProps } from 'reactflow';

export interface TextNodeData {
  text: string;
  fontSize?: 'sm' | 'base' | 'lg' | 'xl';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: string;
}

export const TextNode: React.FC<NodeProps<TextNodeData>> = memo(({ data, selected }) => {
  const { text, fontSize = 'base', fontWeight = 'normal', color } = data;

  const fontSizeClasses: Record<string, string> = {
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };

  const fontWeightClasses: Record<string, string> = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  };

  return (
    <div
      className={`
                px-3 py-2 rounded-md transition-all duration-200
                ${fontSizeClasses[fontSize]} ${fontWeightClasses[fontWeight]}
                text-slate-700 dark:text-slate-300
                ${selected ? 'bg-slate-100 dark:bg-slate-800 ring-2 ring-blue-400' : 'bg-transparent'}
            `}
      style={color ? { color } : undefined}
    >
      {text || 'Text'}
    </div>
  );
});

TextNode.displayName = 'TextNode';

export default TextNode;
