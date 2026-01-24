/**
 * InlineAssist
 * Micro-suggestion hint component for form fields.
 */

import { Sparkles } from 'lucide-react';
import React from 'react';

interface InlineAssistProps {
  hint: string;
}

export const InlineAssist: React.FC<InlineAssistProps> = ({ hint }) => (
  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
    <Sparkles className="w-3 h-3 text-primary-500" />
    <span>{hint}</span>
  </div>
);

export default InlineAssist;
