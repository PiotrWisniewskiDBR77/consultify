/**
 * CellRenderer — Per-type cell components for the Idea Table.
 * Each cell type renders inline with edit support.
 */
import {
  Calendar,
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  RefreshCw,
  Star,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ColorCell,
  CurrencyCell,
  EmailCell,
  EmojiCell,
  FileCell,
  PhoneCell,
  RelationCell,
  RollupCell,
} from './NewColumnRenderers';
import { coerceValue } from './PropertyRegistry';
import type { ColumnDef, ColumnType } from './tableTypes';
import { evaluateFormula, SELECT_COLORS } from './tableTypes';

/**
 * Staly, ciemny atrament plakietek wyboru w tabeli pomyslow. Dobrany tak, by
 * z tlem rozjasnionym do >=65% bieli dawac >=7:1 nawet dla czarnego wejscia
 * (patrz komentarz w `SelectCell`).
 */
const BADGE_INK = '#0f172a';

/**
 * Czy wartosc jest kolorem, ktory przegladarka przyjmie w `color-mix()`.
 * `optionColors` bywa wypelnione nazwa palety ('slate'), a nie kolorem CSS —
 * wtedy cala deklaracja tla jest odrzucana i plakietka zostaje przezroczysta.
 * `var(--...)` przepuszczamy wprost: `CSS.supports` nie rozwija zmiennych,
 * a tokeny palety sa nasze i zawsze rozwijaja sie do koloru.
 */
function isCssColorValue(value: string): boolean {
  if (!value) return false;
  if (value.startsWith('var(')) return true;
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return true;
  return CSS.supports('color', value);
}

interface CellProps {
  column: ColumnDef;
  value: any;
  rowData: Record<string, any>;
  onChange: (value: any) => void;
  locked?: boolean;
  allNodes?: { id: string; label?: string }[];
  onAIRefresh?: () => void;
  /** Nazwa rekordu (np. label pomysłu) — do budowy nazw dostępności (aria-label) komórek. */
  rowLabel?: string;
}

/** Buduje nazwę dostępności "kolumna — wiersz" dla kontrolek edycji komórki (a11y). */
function useCellA11yName(column: ColumnDef, rowLabel?: string): string {
  const { t } = useTranslation();
  return rowLabel
    ? t('ideas.table.a11y.editCellFor', '{{column}} — {{row}}', {
        column: column.header,
        row: rowLabel,
      })
    : column.header;
}

// ── Text Cell ────────────────────────────────────────────────────────────────

const TextCell: React.FC<CellProps> = ({ column, value, onChange, locked, rowLabel }) => (
  <input
    value={String(value ?? '')}
    onChange={(e) => onChange(e.target.value)}
    disabled={locked}
    aria-label={useCellA11yName(column, rowLabel)}
    className="w-full bg-transparent border-0 outline-none text-xs text-c-text px-1 py-0.5 focus:ring-2 focus:ring-blue-500/30 rounded"
    onClick={(e) => e.stopPropagation()}
  />
);

// ── Number Cell ──────────────────────────────────────────────────────────────

const NumberCell: React.FC<CellProps> = ({ column, value, onChange, locked, rowLabel }) => (
  <input
    type="number"
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    disabled={locked}
    aria-label={useCellA11yName(column, rowLabel)}
    className="w-full bg-transparent border-0 outline-none text-xs text-c-text px-1 py-0.5 focus:ring-2 focus:ring-blue-500/30 rounded text-right tabular-nums"
    onClick={(e) => e.stopPropagation()}
  />
);

// ── Select Cell ──────────────────────────────────────────────────────────────

const SelectCell: React.FC<CellProps> = ({ column, value, onChange, locked }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options = column.options || [];
  const colors = column.optionColors || {};

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const rawBgColor =
    colors[String(value)] ||
    SELECT_COLORS[options.indexOf(String(value)) % SELECT_COLORS.length] ||
    '#e0e7ff';
  // ★ axe `color-contrast` (odbior G06 runda 2, idea-table-timeline-stuck):
  // `optionColors` bywa wypelnione NAZWA palety ('slate'/'amber'/'emerald'),
  // a nie kolorem CSS. Cala deklaracja tla byla wtedy odrzucana przez
  // przegladarke — badge zostawal BEZ tla, a jasny tekst ladowal wprost na
  // tle strony (zmierzone 1.04:1, 5 wezlow). Kolor spoza CSS zastepujemy
  // tokenem palety po indeksie opcji, zeby opcje dalej roznily sie barwa.
  const bgColor = isCssColorValue(rawBgColor)
    ? rawBgColor
    : SELECT_COLORS[Math.max(0, options.indexOf(String(value))) % SELECT_COLORS.length] ||
      '#e0e7ff';

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      {/* axe `color-contrast`: `bgColor` moze byc DOWOLNY (wybor uzytkownika,
          wartosc legacy, token palety). Poprzednie podejscie — bialy tekst na
          tle przyciemnionym o 35% czerni — nie domykalo progu dla jasnych
          pasteli, ktore realnie siedza w `optionColors`
          (#d1fae5/#fef3c7/#fce7f3/#fee2e2 z IdeaTableTool i FrameworkGenerator:
          po zmieszaniu z czernia bialy tekst dawal ~2,6:1).
          Kierunek odwrocony i domkniety arytmetycznie: tlo rozjasniamy do
          co najmniej 65% bieli, a tekst jest staly i ciemny. Najgorszy
          mozliwy przypadek (tlo = czern) daje #a6a6a6 pod #0f172a = 7,0:1,
          najlepszy (tlo = biel) 17:1 — prog 4,5:1 spelniony dla KAZDEGO
          wejscia, bez zgadywania. Ten sam kierunek co siostrzany StatusCell
          nizej (jasny pastel + ciemny tekst) — jedna rodzina wizualna. */}
      <button
        onClick={() => !locked && setOpen(!open)}
        disabled={locked}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors"
        style={{
          backgroundColor: `color-mix(in srgb, ${bgColor} 35%, white 65%)`,
          color: BADGE_INK,
        }}
      >
        {value || '—'}
        {!locked && <ChevronDown size={10} />}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-36 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl p-1 max-h-48 overflow-auto">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] hover:bg-c-surface-raised transition-colors flex items-center gap-2"
            >
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{
                  backgroundColor:
                    colors[opt] || SELECT_COLORS[options.indexOf(opt) % SELECT_COLORS.length],
                }}
              />
              {opt}
            </button>
          ))}
          {value && (
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] text-c-text-secondary hover:bg-c-surface-raised transition-colors"
            >
              {t('ideas.table.cellEditor.clear', 'Clear')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── MultiSelect Cell ─────────────────────────────────────────────────────────

const MultiSelectCell: React.FC<CellProps> = ({ column, value, onChange, locked }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options = column.options || [];
  const colors = column.optionColors || {};
  const selected: string[] = Array.isArray(value) ? value : value ? [String(value)] : [];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
    onChange(next);
  };

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => !locked && setOpen(!open)}
        disabled={locked}
        className="inline-flex items-center gap-0.5 flex-wrap max-w-full"
      >
        {selected.length === 0 && <span className="text-[10px] text-c-text-secondary">—</span>}
        {selected.map((s) => (
          <span
            key={s}
            className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold"
            // Ta sama rodzina co `SelectCell` wyzej (ten sam `optionColors`,
            // ta sama lista `SELECT_COLORS`): staly ciemny tekst na tokenie
            // palety nie domykal progu (np. --c-tag-1 #3b8ea5 pod #334155 =
            // 2,76:1). Tlo rozjasniane do >=65% bieli daje gwarancje >=7:1.
            style={{
              backgroundColor: `color-mix(in srgb, ${
                isCssColorValue(colors[s])
                  ? colors[s]
                  : SELECT_COLORS[Math.max(0, options.indexOf(s)) % SELECT_COLORS.length] ||
                    '#e0e7ff'
              } 35%, white 65%)`,
              color: BADGE_INK,
            }}
          >
            {s}
          </span>
        ))}
        {!locked && <ChevronDown size={10} className="text-c-text-secondary ml-0.5" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-40 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl p-1 max-h-48 overflow-auto">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] hover:bg-c-surface-raised transition-colors flex items-center gap-2"
            >
              <span
                className={`w-3 h-3 rounded-sm border flex items-center justify-center ${selected.includes(opt) ? 'bg-c-surface border-c-border-subtle' : 'border-c-border-subtle'}`}
              >
                {selected.includes(opt) && <Check size={8} className="text-c-surface" />}
              </span>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Date Cell ────────────────────────────────────────────────────────────────

const DateCell: React.FC<CellProps> = ({ column, value, onChange, locked, rowLabel }) => (
  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
    <Calendar size={11} className="text-c-text-secondary flex-shrink-0" />
    <input
      type="date"
      value={value ? String(value).slice(0, 10) : ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={locked}
      aria-label={useCellA11yName(column, rowLabel)}
      className="bg-transparent border-0 outline-none text-xs text-c-text focus:ring-2 focus:ring-blue-500/30 rounded"
    />
  </div>
);

// ── Checkbox Cell ────────────────────────────────────────────────────────────

const CheckboxCell: React.FC<CellProps> = ({ column, value, onChange, locked, rowLabel }) => (
  <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
    <button
      onClick={() => !locked && onChange(!value)}
      disabled={locked}
      aria-label={useCellA11yName(column, rowLabel)}
      aria-pressed={!!value}
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
        value ? 'bg-c-text border-c-text text-c-bg' : 'border-c-border-subtle hover:border-c-border'
      }`}
    >
      {value && <Check size={12} aria-hidden="true" />}
    </button>
  </div>
);

// ── Rating Cell ──────────────────────────────────────────────────────────────

const RatingCell: React.FC<CellProps> = ({ column, value, onChange, locked, rowLabel }) => {
  const { t } = useTranslation();
  const rating = Number(value) || 0;
  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => !locked && onChange(rating === star ? 0 : star)}
          disabled={locked}
          aria-label={t('ideas.table.a11y.ratingStarFor', '{{column}}: {{star}} of 5 — {{row}}', {
            column: column.header,
            star,
            row: rowLabel || column.header,
          })}
          aria-pressed={star <= rating}
          className="p-0 transition-colors"
        >
          <Star
            aria-hidden="true"
            size={14}
            className={star <= rating ? 'text-amber-400 fill-amber-400' : 'text-c-text-secondary'}
          />
        </button>
      ))}
    </div>
  );
};

// ── Person Cell ──────────────────────────────────────────────────────────────

const PersonCell: React.FC<CellProps> = ({ column, value, onChange, locked, rowLabel }) => (
  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
    <div className="w-5 h-5 rounded-full bg-c-text-secondary flex items-center justify-center text-[8px] font-bold text-c-surface flex-shrink-0">
      {String(value || '?')
        .charAt(0)
        .toUpperCase()}
    </div>
    <input
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      disabled={locked}
      placeholder="—"
      aria-label={useCellA11yName(column, rowLabel)}
      className="flex-1 bg-transparent border-0 outline-none text-xs text-c-text focus:ring-2 focus:ring-blue-500/30 rounded"
    />
  </div>
);

// ── URL Cell ─────────────────────────────────────────────────────────────────

const UrlCell: React.FC<CellProps> = ({ column, value, onChange, locked, rowLabel }) => (
  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
    <input
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      disabled={locked}
      placeholder="https://..."
      aria-label={useCellA11yName(column, rowLabel)}
      className="flex-1 bg-transparent border-0 outline-none text-xs text-blue-600 dark:text-blue-400 underline focus:ring-2 focus:ring-blue-500/30 rounded"
    />
    {value && (
      <a
        href={String(value)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-c-text-secondary hover:text-blue-500"
      >
        <ExternalLink size={11} />
      </a>
    )}
  </div>
);

// ── Progress Cell ────────────────────────────────────────────────────────────

const ProgressCell: React.FC<CellProps> = ({ column, value, onChange, locked, rowLabel }) => {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="flex items-center gap-2 w-full" onClick={(e) => e.stopPropagation()}>
      <div className="flex-1 h-2 rounded-full bg-c-border-subtle overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-danger-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <input
        type="number"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
        disabled={locked}
        aria-label={useCellA11yName(column, rowLabel)}
        className="w-10 bg-transparent border-0 outline-none text-[10px] text-c-text-secondary text-right tabular-nums"
      />
      <span className="text-[9px] text-c-text-secondary">%</span>
    </div>
  );
};

// ── Formula Cell ─────────────────────────────────────────────────────────────

const FormulaCell: React.FC<CellProps> = ({ column, rowData }) => {
  const result = evaluateFormula(column.formula || '', rowData);
  return (
    <span className="text-xs text-c-text-secondary tabular-nums font-medium px-1">{result}</span>
  );
};

// ── AI Generated Cell ────────────────────────────────────────────────────────

const AIGeneratedCell: React.FC<CellProps> = ({ value, onAIRefresh, locked }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <span className="flex-1 text-xs text-c-text truncate">
        {value || (
          <span className="text-c-text-secondary italic">
            {t('ideas.table.cellRenderer.aiPending', 'AI pending...')}
          </span>
        )}
      </span>
      {!locked && onAIRefresh && (
        <button
          onClick={onAIRefresh}
          className="p-0.5 rounded text-c-text-secondary hover:bg-c-surface-raised transition-colors"
          title={t('ideas.table.cellRenderer.regenerate', 'Regenerate')}
        >
          <RefreshCw size={10} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

// ── Main CellRenderer ────────────────────────────────────────────────────────

const WrappedFileCell: React.FC<CellProps> = ({ value, onChange, locked }) => (
  <FileCell value={value} onChange={onChange} locked={locked} />
);
const WrappedRelationCell: React.FC<CellProps> = ({ value, onChange, locked, allNodes }) => (
  <RelationCell
    value={value}
    onChange={onChange}
    locked={locked}
    allNodes={(allNodes || []).map((n) => ({ id: n.id, label: n.label || n.id }))}
  />
);
const WrappedRollupCell: React.FC<CellProps> = ({ value, onChange, locked }) => (
  <RollupCell value={value} onChange={onChange} locked={locked} />
);
const WrappedEmojiCell: React.FC<CellProps> = ({ column, value, onChange, locked, rowLabel }) => (
  <EmojiCell
    value={value}
    onChange={onChange}
    locked={locked}
    column={column}
    rowLabel={rowLabel}
  />
);
const WrappedColorCell: React.FC<CellProps> = ({ column, value, onChange, locked, rowLabel }) => (
  <ColorCell
    value={value}
    onChange={onChange}
    locked={locked}
    column={column}
    rowLabel={rowLabel}
  />
);
const WrappedCurrencyCell: React.FC<CellProps> = ({
  column,
  value,
  onChange,
  locked,
  rowLabel,
}) => (
  <CurrencyCell
    value={value}
    onChange={onChange}
    locked={locked}
    column={column}
    rowLabel={rowLabel}
  />
);
const WrappedPhoneCell: React.FC<CellProps> = ({ column, value, onChange, locked, rowLabel }) => (
  <PhoneCell
    value={value}
    onChange={onChange}
    locked={locked}
    column={column}
    rowLabel={rowLabel}
  />
);
const WrappedEmailCell: React.FC<CellProps> = ({ column, value, onChange, locked, rowLabel }) => (
  <EmailCell
    value={value}
    onChange={onChange}
    locked={locked}
    column={column}
    rowLabel={rowLabel}
  />
);

// ── Status Cell (semantic status with fixed states) ─────────────────────────

const STATUS_DISPLAY: Record<string, { en: string; pl: string; bg: string }> = {
  todo: { en: 'To Do', pl: 'Do zrobienia', bg: '#e0e7ff' },
  in_progress: { en: 'In Progress', pl: 'W toku', bg: '#fef3c7' },
  done: { en: 'Done', pl: 'Gotowe', bg: '#d1fae5' },
  blocked: { en: 'Blocked', pl: 'Zablokowane', bg: '#fee2e2' },
};

const StatusCell: React.FC<CellProps> = ({ column, value, onChange, locked }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const statusOptions = column.options?.length ? column.options : Object.keys(STATUS_DISPLAY);
  // 2026-08-10 (E13 visual audit, doc 11 §3.7 "labels use business
  // language"): `display?.en` was hardcoded regardless of app language — the
  // pl/en pair in STATUS_DISPLAY existed but was never read for pl, so a PL
  // session always showed "To Do"/"In Progress"/… on Table status pills.
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = String(value ?? 'todo');
  const display = STATUS_DISPLAY[current];
  const rawStatusBg = column.optionColors?.[current] || display?.bg || '#e0e7ff';
  // Odsiew jak w `SelectCell`: nazwa palety ('slate') nie jest kolorem CSS —
  // deklaracja tla zostalaby odrzucona, a ciemny tekst plakietki wyladowalby
  // na tle strony (w motywie ciemnym: ciemne na ciemnym).
  const bg = isCssColorValue(rawStatusBg) ? rawStatusBg : display?.bg || '#e0e7ff';
  const label = (isPl ? display?.pl : display?.en) || current;

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      {/* NIE `--c-tag-foreground` tutaj (jak w SelectCell wyzej): STATUS_DISPLAY
          to WLASNA, oddzielna paleta JASNYCH pasteli (#e0e7ff/#fef3c7/#d1fae5/
          #fee2e2) zaprojektowana pod CIEMNY tekst (8.4-9.3:1) — bialy tekst na
          nich dawal 1.1-1.2:1 (odbior G06, zmierzone). */}
      <button
        onClick={() => !locked && setOpen(!open)}
        disabled={locked}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors"
        style={{ backgroundColor: bg, color: '#334155' }}
      >
        {label}
        {!locked && <ChevronDown size={10} />}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-40 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl p-1">
          {statusOptions.map((opt) => {
            const d = STATUS_DISPLAY[opt];
            return (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] hover:bg-c-surface-raised transition-colors flex items-center gap-2"
              >
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{
                    backgroundColor: isCssColorValue(column.optionColors?.[opt] || '')
                      ? column.optionColors?.[opt]
                      : d?.bg || '#e0e7ff',
                  }}
                />
                {(isPl ? d?.pl : d?.en) || opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── System-managed cells (read-only) ────────────────────────────────────────

const SystemTimestampCell: React.FC<CellProps> = ({ value }) => {
  if (!value) return <span className="text-[10px] text-c-text-secondary">—</span>;
  const d = new Date(value);
  const str = isNaN(d.getTime())
    ? String(value)
    : d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
  return <span className="text-[10px] text-c-text-muted tabular-nums">{str}</span>;
};

const SystemUserCell: React.FC<CellProps> = ({ value }) => {
  if (!value) return <span className="text-[10px] text-c-text-secondary">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-c-text-secondary">
      <span className="w-4 h-4 rounded-full bg-c-border-subtle flex items-center justify-center text-[8px] font-bold uppercase">
        {String(value).charAt(0)}
      </span>
      {String(value)}
    </span>
  );
};

const RENDERERS: Record<ColumnType, React.FC<CellProps>> = {
  text: TextCell,
  number: NumberCell,
  select: SelectCell,
  multiselect: MultiSelectCell,
  status: StatusCell,
  date: DateCell,
  checkbox: CheckboxCell,
  rating: RatingCell,
  person: PersonCell,
  url: UrlCell,
  progress: ProgressCell,
  formula: FormulaCell,
  ai_generated: AIGeneratedCell,
  file: WrappedFileCell,
  relation: WrappedRelationCell,
  rollup: WrappedRollupCell,
  emoji: WrappedEmojiCell,
  color: WrappedColorCell,
  currency: WrappedCurrencyCell,
  phone: WrappedPhoneCell,
  email: WrappedEmailCell,
  created_time: SystemTimestampCell,
  created_by: SystemUserCell,
  last_edited_time: SystemTimestampCell,
  last_edited_by: SystemUserCell,
};

export const CellRenderer: React.FC<CellProps> = (props) => {
  const Renderer = RENDERERS[props.column.type] || TextCell;
  const coercedOnChange = useCallback(
    (val: any) => props.onChange(coerceValue(props.column.type, val)),
    [props.column.type, props.onChange]
  );
  return <Renderer {...props} onChange={coercedOnChange} />;
};

export default CellRenderer;
