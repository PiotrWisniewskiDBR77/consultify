/**
 * Shared Resource Limit Input Component
 * Reusable slider/input for resource limits
 */

import './ResourceLimitInput.css';

import React from 'react';

interface ResourceLimitInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  helpText?: string;
  type?: 'slider' | 'number';
}

export const ResourceLimitInput: React.FC<ResourceLimitInputProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  helpText,
  type = 'slider',
}) => {
  return (
    <div className="resource-limit-input">
      <div className="limit-header">
        <label>{label}</label>
        <span className="limit-value">
          {value.toLocaleString()} {unit}
        </span>
      </div>

      {type === 'slider' ? (
        <>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="limit-slider"
          />
          <div className="slider-labels">
            <span>{min.toLocaleString()}</span>
            <span>{max.toLocaleString()}</span>
          </div>
        </>
      ) : (
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="limit-number-input"
        />
      )}

      {helpText && <small className="help-text">{helpText}</small>}
    </div>
  );
};

export default ResourceLimitInput;
