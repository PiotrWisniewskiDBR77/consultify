import { ArrowRight } from 'lucide-react';
import React from 'react';

interface ConvertToButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}

export const ConvertToButton: React.FC<ConvertToButtonProps> = ({
  onClick,
  disabled,
  label = 'Convert to...',
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
  >
    {label}
    <ArrowRight size={15} />
  </button>
);
