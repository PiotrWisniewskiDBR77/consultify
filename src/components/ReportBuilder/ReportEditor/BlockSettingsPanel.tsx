/**
 * BlockSettingsPanel v2
 *
 * Compact, professional settings panel with progressive disclosure.
 * - Essential settings shown immediately (format + content)
 * - Quality & blueprint hidden behind "Fine-tune" toggle
 * - Toggles rendered in compact 2-column grid
 * - Presets displayed as prominent quick-action chips
 */

import { ChevronDown, ChevronRight, Settings2, Sparkles, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type BlockSettingsDefinition,
  getBlockSettings,
  SETTING_GROUP_LABELS,
  type SettingDefinition,
} from './BlockSettingsRegistry';

// ==========================================
// TYPES
// ==========================================

interface BlockSettingsPanelProps {
  blockType: string;
  blockTypeId?: string;
  blockSettings: Record<string, unknown>;
  onSettingsChange: (settings: Record<string, unknown>) => void;
  isPl: boolean;
  /** Only show settings from these groups. If undefined, show all. */
  includeGroups?: string[];
  /** Exclude settings from these groups. Applied after includeGroups. */
  excludeGroups?: string[];
}

/** Groups that are "essential" and shown by default */
const ESSENTIAL_GROUPS = new Set(['content', 'format', 'filters', 'display']);
/** Groups hidden behind "Fine-tune" expander */
const ADVANCED_GROUPS = new Set(['quality', 'blueprint', 'advanced']);

// ==========================================
// COMPACT SETTING RENDERERS
// ==========================================

const ToggleSetting: React.FC<{
  setting: SettingDefinition;
  value: boolean;
  onChange: (val: boolean) => void;
  isPl: boolean;
  compact?: boolean;
}> = ({ setting, value, onChange, isPl, compact }) => (
  <div
    className={`flex items-center justify-between cursor-pointer group ${compact ? 'py-0.5' : 'py-1'}`}
    onClick={(e) => {
      e.stopPropagation();
      onChange(!value);
    }}
  >
    <span
      className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-medium text-c-text-secondary group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate mr-2`}
    >
      {isPl ? setting.labelPl : setting.label}
    </span>
    <div
      className={`
        relative flex-shrink-0 transition-all rounded-full
        ${compact ? 'w-7 h-4' : 'w-8 h-[18px]'}
        ${value ? 'bg-blue-600' : 'bg-c-border'}
      `}
    >
      <div
        className={`
          absolute top-0.5 rounded-full bg-c-surface shadow transition-transform
          ${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}
          ${value ? (compact ? 'translate-x-3' : 'translate-x-3.5') : 'translate-x-0.5'}
        `}
      />
    </div>
  </div>
);

const NumberSetting: React.FC<{
  setting: SettingDefinition;
  value: number;
  onChange: (val: number) => void;
  isPl: boolean;
}> = ({ setting, value, onChange, isPl }) => (
  <div className="py-1">
    <div className="flex items-center justify-between mb-1">
      <span className="text-[11px] font-medium text-c-text-secondary">
        {isPl ? setting.labelPl : setting.label}
      </span>
      <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 tabular-nums">
        {value}
      </span>
    </div>
    <input
      type="range"
      min={setting.min || 1}
      max={setting.max || 20}
      step={setting.step || 1}
      value={value}
      onChange={(e) => {
        e.stopPropagation();
        onChange(Number(e.target.value));
      }}
      onClick={(e) => e.stopPropagation()}
      className="w-full h-1 bg-c-border-subtle rounded-full appearance-none cursor-pointer
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600
        [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer
        [&::-webkit-slider-thumb]:hover:bg-blue-700"
    />
    <div className="flex justify-between text-[9px] text-c-text-secondary mt-0.5">
      <span>{setting.min || 1}</span>
      <span>{setting.max || 20}</span>
    </div>
  </div>
);

const ButtonGroupSetting: React.FC<{
  setting: SettingDefinition;
  value: string;
  onChange: (val: string) => void;
  isPl: boolean;
}> = ({ setting, value, onChange, isPl }) => (
  <div className="py-1">
    <label className="block text-[11px] font-medium text-c-text-secondary mb-1">
      {isPl ? setting.labelPl : setting.label}
    </label>
    <div className="flex gap-0.5 p-0.5 bg-c-surface-raised rounded-lg">
      {(setting.options || []).map((opt) => (
        <button
          key={opt.value}
          onClick={(e) => {
            e.stopPropagation();
            onChange(opt.value);
          }}
          className={`
            flex-1 py-1 px-1 text-[10px] font-medium rounded-md transition-all
            ${
              value === opt.value
                ? 'bg-blue-600 text-c-text shadow-sm'
                : 'text-c-text-secondary hover:text-c-text'
            }
          `}
        >
          {isPl ? opt.labelPl : opt.label}
        </button>
      ))}
    </div>
  </div>
);

const TextSetting: React.FC<{
  setting: SettingDefinition;
  value: string;
  onChange: (val: string) => void;
  isPl: boolean;
}> = ({ setting, value, onChange, isPl }) => (
  <div className="py-1">
    <label className="block text-[10px] font-medium text-c-text-secondary mb-0.5">
      {isPl ? setting.labelPl : setting.label}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      placeholder={
        isPl
          ? setting.placeholderPl || setting.descriptionPl
          : setting.placeholder || setting.description
      }
      className="w-full px-2 py-1.5 text-[11px] bg-c-surface border border-c-border-subtle rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-c-text-muted"
    />
  </div>
);

const TextareaSetting: React.FC<{
  setting: SettingDefinition;
  value: string;
  onChange: (val: string) => void;
  isPl: boolean;
}> = ({ setting, value, onChange, isPl }) => (
  <div className="py-1">
    <label className="block text-[10px] font-medium text-c-text-secondary mb-0.5">
      {isPl ? setting.labelPl : setting.label}
    </label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      placeholder={
        isPl
          ? setting.placeholderPl || setting.descriptionPl
          : setting.placeholder || setting.description
      }
      className="w-full px-2 py-1.5 text-[11px] bg-c-surface border border-c-border-subtle rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none h-16 placeholder:text-c-text-muted"
    />
  </div>
);

const SelectSetting: React.FC<{
  setting: SettingDefinition;
  value: string;
  onChange: (val: string) => void;
  isPl: boolean;
}> = ({ setting, value, onChange, isPl }) => (
  <div className="py-1">
    <label className="block text-[10px] font-medium text-c-text-secondary mb-0.5">
      {isPl ? setting.labelPl : setting.label}
    </label>
    <select
      value={value}
      onChange={(e) => {
        e.stopPropagation();
        onChange(e.target.value);
      }}
      onClick={(e) => e.stopPropagation()}
      className="w-full px-2 py-1.5 text-[11px] bg-c-surface border border-c-border-subtle rounded-md"
    >
      {(setting.options || []).map((opt) => (
        <option key={opt.value} value={opt.value}>
          {isPl ? opt.labelPl : opt.label}
        </option>
      ))}
    </select>
  </div>
);

// ==========================================
// SETTING RENDERER DISPATCHER
// ==========================================

const SettingRenderer: React.FC<{
  setting: SettingDefinition;
  value: unknown;
  onChange: (val: unknown) => void;
  isPl: boolean;
  compact?: boolean;
}> = ({ setting, value, onChange, isPl, compact }) => {
  switch (setting.type) {
    case 'toggle':
      return (
        <ToggleSetting
          setting={setting}
          value={Boolean(value ?? setting.defaultValue)}
          onChange={onChange}
          isPl={isPl}
          compact={compact}
        />
      );
    case 'number':
      return (
        <NumberSetting
          setting={setting}
          value={Number(value ?? setting.defaultValue ?? 5)}
          onChange={onChange}
          isPl={isPl}
        />
      );
    case 'button-group':
      return (
        <ButtonGroupSetting
          setting={setting}
          value={String(value ?? setting.defaultValue ?? '')}
          onChange={onChange}
          isPl={isPl}
        />
      );
    case 'text':
      return (
        <TextSetting
          setting={setting}
          value={String(value ?? setting.defaultValue ?? '')}
          onChange={onChange}
          isPl={isPl}
        />
      );
    case 'textarea':
      return (
        <TextareaSetting
          setting={setting}
          value={String(value ?? setting.defaultValue ?? '')}
          onChange={onChange}
          isPl={isPl}
        />
      );
    case 'select':
      return (
        <SelectSetting
          setting={setting}
          value={String(value ?? setting.defaultValue ?? '')}
          onChange={onChange}
          isPl={isPl}
        />
      );
    default:
      return null;
  }
};

// ==========================================
// TOGGLE GRID: Renders toggles in a compact 2-col grid
// ==========================================

const ToggleGrid: React.FC<{
  settings: SettingDefinition[];
  values: Record<string, unknown>;
  onUpdate: (key: string, val: unknown) => void;
  isPl: boolean;
}> = ({ settings, values, onUpdate, isPl }) => {
  if (settings.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-0">
      {settings.map((s) => (
        <ToggleSetting
          key={s.key}
          setting={s}
          value={Boolean(values[s.key] ?? s.defaultValue)}
          onChange={(val) => onUpdate(s.key, val)}
          isPl={isPl}
          compact
        />
      ))}
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const BlockSettingsPanel: React.FC<BlockSettingsPanelProps> = ({
  blockType,
  blockTypeId,
  blockSettings,
  onSettingsChange,
  isPl,
  includeGroups,
  excludeGroups,
}) => {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const definition = getBlockSettings(blockType, blockTypeId);

  if (!definition || definition.settings.length === 0) {
    return null;
  }

  // Filter settings by include/exclude groups
  const filteredSettings = definition.settings.filter((s) => {
    if (includeGroups && !includeGroups.includes(s.group)) return false;
    if (excludeGroups && excludeGroups.includes(s.group)) return false;
    return true;
  });

  if (filteredSettings.length === 0) return null;

  const updateSetting = (key: string, value: unknown) => {
    onSettingsChange({ ...blockSettings, [key]: value });
  };

  const applyPreset = (presetValues: Record<string, unknown>) => {
    onSettingsChange({ ...blockSettings, ...presetValues });
  };

  // Split into essential vs advanced
  const essentialSettings = filteredSettings.filter((s) => ESSENTIAL_GROUPS.has(s.group));
  const advancedSettings = filteredSettings.filter((s) => ADVANCED_GROUPS.has(s.group));

  // Separate toggles from non-toggles for compact grid rendering
  const essentialToggles = essentialSettings.filter((s) => s.type === 'toggle');
  const essentialOther = essentialSettings.filter((s) => s.type !== 'toggle');

  // Count non-default advanced settings to show badge
  const advancedNonDefault = advancedSettings.filter((s) => {
    const val = blockSettings[s.key];
    return val !== undefined && val !== s.defaultValue && val !== '' && val !== false;
  }).length;

  return (
    <div className="space-y-2.5" onClick={(e) => e.stopPropagation()}>
      {/* Presets — prominent chips */}
      {definition.presets && definition.presets.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Zap className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] font-semibold text-c-text-secondary uppercase tracking-wider">
              {t('reportBuilder.blockSettingsPanel.presets', 'Presets')}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {definition.presets.map((preset) => (
              <button
                key={preset.id}
                onClick={(e) => {
                  e.stopPropagation();
                  applyPreset(preset.values);
                }}
                className="px-2.5 py-1 text-[10px] font-semibold rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-700 dark:text-blue-300 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/40 dark:hover:to-indigo-900/40 border border-blue-200/50 dark:border-blue-700/30 transition-all hover:shadow-sm"
              >
                <Sparkles className="w-2.5 h-2.5 inline mr-1 -mt-0.5" />
                {isPl ? preset.labelPl : preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Essential non-toggle settings (button groups, numbers, selects) */}
      {essentialOther.length > 0 && (
        <div className="space-y-0.5">
          {essentialOther.map((setting) => (
            <SettingRenderer
              key={setting.key}
              setting={setting}
              value={blockSettings[setting.key]}
              onChange={(val) => updateSetting(setting.key, val)}
              isPl={isPl}
            />
          ))}
        </div>
      )}

      {/* Essential toggles in compact 2-col grid */}
      {essentialToggles.length > 0 && (
        <div className="pt-1">
          <ToggleGrid
            settings={essentialToggles}
            values={blockSettings}
            onUpdate={updateSetting}
            isPl={isPl}
          />
        </div>
      )}

      {/* Advanced section (quality + blueprint) — hidden by default */}
      {advancedSettings.length > 0 && (
        <div className="pt-1 border-t border-c-border-subtle">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAdvanced((prev) => !prev);
            }}
            className="w-full flex items-center justify-between py-1.5 group"
          >
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-c-text-secondary uppercase tracking-wider group-hover:text-c-text-secondary transition-colors">
              <Settings2 className="w-3 h-3" />
              {t('reportBuilder.blockSettingsPanel.fineTune', 'Fine-tune')}
              {advancedNonDefault > 0 && (
                <span className="ml-0.5 min-w-[16px] h-4 px-1 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[9px] font-bold rounded-full inline-flex items-center justify-center">
                  {advancedNonDefault}
                </span>
              )}
            </span>
            {showAdvanced ? (
              <ChevronDown className="w-3 h-3 text-c-text-secondary" />
            ) : (
              <ChevronRight className="w-3 h-3 text-c-text-secondary" />
            )}
          </button>

          {showAdvanced && (
            <div className="space-y-0.5 pt-1 animate-in slide-in-from-top-1 duration-150">
              {/* Advanced toggles in grid */}
              {(() => {
                const advToggles = advancedSettings.filter((s) => s.type === 'toggle');
                const advOther = advancedSettings.filter((s) => s.type !== 'toggle');
                return (
                  <>
                    {advOther.map((setting) => (
                      <SettingRenderer
                        key={setting.key}
                        setting={setting}
                        value={blockSettings[setting.key]}
                        onChange={(val) => updateSetting(setting.key, val)}
                        isPl={isPl}
                        compact
                      />
                    ))}
                    {advToggles.length > 0 && (
                      <div className="pt-0.5">
                        <ToggleGrid
                          settings={advToggles}
                          values={blockSettings}
                          onUpdate={updateSetting}
                          isPl={isPl}
                        />
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BlockSettingsPanel;
