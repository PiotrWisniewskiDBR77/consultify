import React from 'react';

interface ResourceLimitInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  type?: 'number' | 'text';
}

const ResourceLimitInput: React.FC<ResourceLimitInputProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  type = 'number',
}) => {
  return (
    <div className="mb-6">
      <label className="mb-1 block text-sm font-semibold text-gray-800 dark:text-gray-200">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type={type}
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        {unit && <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">{unit}</span>}
      </div>
    </div>
  );
};

export default ResourceLimitInput;
