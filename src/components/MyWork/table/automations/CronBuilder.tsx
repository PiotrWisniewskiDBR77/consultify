/**
 * CronBuilder — visual cron expression builder with presets and custom input.
 * Validates expressions in real-time and shows a human-readable description.
 */
import { AlertCircle, Check, Clock } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface CronBuilderProps {
  value: string;
  onChange: (cron: string) => void;
  timezone?: string;
  onTimezoneChange?: (tz: string) => void;
}

interface CronPreset {
  id: string;
  label: string;
  cron: string;
}

const PRESETS: CronPreset[] = [
  { id: 'every15min', label: 'Every 15 minutes', cron: '*/15 * * * *' },
  { id: 'everyHour', label: 'Every hour', cron: '0 * * * *' },
  { id: 'dailyAt9am', label: 'Daily at 9am', cron: '0 9 * * *' },
  { id: 'weekdaysAt9am', label: 'Weekdays at 9am', cron: '0 9 * * 1-5' },
  { id: 'weeklyMonday', label: 'Weekly on Monday', cron: '0 9 * * 1' },
  { id: 'monthly1st', label: 'Monthly on 1st', cron: '0 9 1 * *' },
];

const COMMON_TIMEZONES = [
  'UTC',
  'Europe/Warsaw',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

function validateCronLocal(cron: string): { valid: boolean; error?: string; description?: string } {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { valid: false, error: 'Must have 5 fields: minute hour dayOfMonth month dayOfWeek' };
  }

  const fieldNames = ['minute', 'hour', 'day of month', 'month', 'day of week'];
  const ranges: [number, number][] = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 6],
  ];

  for (let i = 0; i < 5; i++) {
    const expr = parts[i];
    if (expr === '*') continue;
    if (expr.startsWith('*/')) {
      const step = parseInt(expr.slice(2), 10);
      if (isNaN(step) || step <= 0 || step > ranges[i][1]) {
        return { valid: false, error: `Invalid ${fieldNames[i]} step: ${expr}` };
      }
      continue;
    }
    const segments = expr.split(',');
    for (const seg of segments) {
      if (seg.includes('-')) {
        const [s, e] = seg.split('-').map(Number);
        if (isNaN(s) || isNaN(e) || s < ranges[i][0] || e > ranges[i][1] || s > e) {
          return { valid: false, error: `Invalid ${fieldNames[i]} range: ${seg}` };
        }
      } else {
        const val = parseInt(seg, 10);
        if (isNaN(val) || val < ranges[i][0] || val > ranges[i][1]) {
          return { valid: false, error: `Invalid ${fieldNames[i]} value: ${seg}` };
        }
      }
    }
  }

  const [min, hour, dom, mon, dow] = parts;
  const pieces: string[] = [];
  if (min === '0' && hour !== '*') pieces.push(`At ${hour}:00`);
  else if (min.startsWith('*/')) pieces.push(`Every ${min.slice(2)} min`);
  else if (min === '*') pieces.push('Every minute');
  else pieces.push(`At minute ${min}`);

  if (dow !== '*') {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (dow === '1-5') pieces.push('on weekdays');
    else if (dow === '0,6') pieces.push('on weekends');
    else
      pieces.push(
        `on ${dow
          .split(',')
          .map((d) => dayNames[parseInt(d, 10)] ?? d)
          .join(', ')}`
      );
  }
  if (dom !== '*') pieces.push(`on day ${dom}`);
  if (mon !== '*') pieces.push(`in month ${mon}`);

  return { valid: true, description: pieces.join(' ') };
}

export const CronBuilder: React.FC<CronBuilderProps> = ({
  value,
  onChange,
  timezone,
  onTimezoneChange,
}) => {
  const { t } = useTranslation();
  const [customMode, setCustomMode] = useState(() => !PRESETS.some((p) => p.cron === value));
  const [customInput, setCustomInput] = useState(value || '');

  useEffect(() => {
    if (!customMode) {
      setCustomInput(value);
    }
  }, [value, customMode]);

  const validation = useMemo(() => validateCronLocal(customInput || value), [customInput, value]);

  const handlePresetClick = useCallback(
    (cron: string) => {
      setCustomMode(false);
      setCustomInput(cron);
      onChange(cron);
    },
    [onChange]
  );

  const handleCustomChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setCustomInput(v);
      setCustomMode(true);
      const check = validateCronLocal(v);
      if (check.valid) {
        onChange(v);
      }
    },
    [onChange]
  );

  const activePreset = PRESETS.find((p) => p.cron === value);

  return (
    <div className="space-y-3">
      {/* Presets */}
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((preset) => {
          const isActive = preset.cron === value && !customMode;
          return (
            <button
              key={preset.cron}
              type="button"
              onClick={() => handlePresetClick(preset.cron)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                isActive
                  ? 'border-c-focus bg-c-surface-raised text-c-text'
                  : 'border-c-border-subtle bg-c-surface hover:border-c-border-subtle'
              }`}
            >
              {isActive && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
              <Clock className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? 'hidden' : ''}`} />
              <span className="truncate">
                {t(`ideas.table.cronPreset.${preset.id}`, preset.label)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Custom input */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-c-text-muted">
          {t('ideas.table.cronExpressionLabel', 'Cron expression (or pick a preset)')}
        </label>
        <input
          type="text"
          value={customMode ? customInput : value}
          onChange={handleCustomChange}
          onFocus={() => setCustomMode(true)}
          placeholder="*/15 * * * *"
          className={`w-full rounded-lg border px-3 py-2 font-mono text-sm ${
            customInput && !validation.valid
              ? 'border-c-danger bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] border-c-danger bg-[color-mix(in_srgb,var(--c-danger)_18%,transparent)]'
              : 'border-c-border-subtle bg-c-surface border-c-border-subtle bg-c-surface-raised'
          }`}
        />
        {customInput && validation.valid && validation.description && (
          <p className="flex items-center gap-1 text-xs text-c-success">
            <Check className="h-3 w-3" />
            {validation.description}
          </p>
        )}
        {customInput && !validation.valid && validation.error && (
          <p className="flex items-center gap-1 text-xs text-c-danger">
            <AlertCircle className="h-3 w-3" />
            {validation.error}
          </p>
        )}
      </div>

      {/* Timezone selector */}
      {onTimezoneChange && (
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-c-text-muted">
            {t('ideas.table.timezoneLabel', 'Timezone')}
          </label>
          <select
            value={timezone || 'UTC'}
            onChange={(e) => onTimezoneChange(e.target.value)}
            className="w-full rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm border-c-border-subtle bg-c-surface-raised"
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default CronBuilder;
