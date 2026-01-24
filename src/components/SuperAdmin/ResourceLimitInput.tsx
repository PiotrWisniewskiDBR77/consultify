import React from 'react';

import './ResourceLimitInput.css';

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
    <div className="resource-limit-input">
      <label className="resource-limit-label">{label}</label>
      <div className="resource-limit-control">
        <input
          type={type}
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="resource-limit-field"
        />
        {unit && <span className="resource-limit-unit">{unit}</span>}
      </div>
    </div>
  );
};

export default ResourceLimitInput;
