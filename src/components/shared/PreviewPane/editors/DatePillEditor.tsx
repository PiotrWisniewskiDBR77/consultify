import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface DatePillEditorProps {
  value: string;
  onChange: (isoDate: string) => void;
  onClose: () => void;
  /** Minimum selectable date (ISO string) */
  min?: string;
}

export const DatePillEditor: React.FC<DatePillEditorProps> = ({
  value,
  onChange,
  onClose,
  min,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      onClose();
    },
    [onChange, onClose]
  );

  return (
    <div className="min-w-[200px] rounded-xl border border-c-border-subtle bg-c-surface shadow-lg p-3 space-y-2">
      <div className="text-[10px] font-semibold text-c-text-muted uppercase tracking-wider">
        {t('sharedComponents.datePillEditor.selectDate')}
      </div>
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        onChange={handleChange}
        className="w-full h-8 px-2 rounded-lg border border-c-border-subtle bg-transparent text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
        autoFocus
      />
    </div>
  );
};

export default DatePillEditor;
