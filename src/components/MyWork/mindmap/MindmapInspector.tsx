import { Bold, Brush, Layout, Palette } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

type InspectorTab = 'style' | 'layout' | 'theme';

export interface MindmapInspectorProps {
  selectedNodeId?: string;
  selectedNodeData?: Record<string, any>;
  currentStructure: string;
  currentLayoutMode: string;
  onUpdateNode: (nodeId: string, patch: Record<string, any>) => void;
  onSetStructure: (structure: string) => void;
  onSetLayoutMode: (mode: string) => void;
  onApplyTheme: (themeId: string) => void;
}

const BRANCH_STYLES = ['curved', 'straight', 'step'] as const;
const FONT_SIZES = [10, 11, 12, 14, 16] as const;
// Node text-color swatches = DATA (categorical). Canonical identity palette.
const NODE_COLOR_PALETTE = [
  'var(--c-tag-2)',
  'var(--c-tag-1)',
  'var(--c-success)',
  'var(--c-warning)',
  'var(--c-danger)',
  'var(--c-tag-4)',
  'var(--c-tag-3)',
  'var(--c-tag-8)',
];

const STRUCTURES = [
  { id: 'mindmap', labelEn: 'Mindmap' },
  { id: 'org_chart', labelEn: 'Org chart' },
  { id: 'tree_right', labelEn: 'Tree right' },
  { id: 'fishbone', labelEn: 'Fishbone' },
  { id: 'timeline', labelEn: 'Timeline' },
  { id: 'semantic', labelEn: 'Semantic' },
] as const;

const LAYOUT_MODES = [
  { id: 'tree', labelEn: 'Tree' },
  { id: 'radial', labelEn: 'Radial' },
  { id: 'force', labelEn: 'Force' },
] as const;

const THEMES = [
  {
    id: 'default',
    labelEn: 'Default',
    colors: ['var(--c-tag-10)', 'var(--c-info)', 'var(--c-tag-8)', 'var(--c-surface-raised)'],
  },
  {
    id: 'ocean',
    labelEn: 'Ocean',
    colors: ['var(--c-tag-12)', 'var(--c-tag-1)', 'var(--c-info)', 'var(--c-surface-raised)'],
  },
  {
    id: 'forest',
    labelEn: 'Forest',
    colors: ['var(--c-success)', 'var(--c-tag-6)', 'var(--c-success)', 'var(--c-surface-raised)'],
  },
  {
    id: 'sunset',
    labelEn: 'Sunset',
    colors: ['var(--c-warning)', 'var(--c-tag-9)', 'var(--c-warning)', 'var(--c-surface-raised)'],
  },
  {
    id: 'midnight',
    labelEn: 'Midnight',
    colors: ['var(--c-tag-2)', 'var(--c-tag-3)', 'var(--c-tag-2)', 'var(--c-surface-raised)'],
  },
  {
    id: 'minimal',
    labelEn: 'Minimal',
    colors: [
      'var(--c-tag-8)',
      'var(--c-border-strong)',
      'var(--c-text-secondary)',
      'var(--c-surface-raised)',
    ],
  },
] as const;

const TAB_BTN =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors';
const TAB_ACTIVE = 'bg-c-surface text-c-text dark:bg-c-surface-raised dark:text-c-text shadow-sm';
const TAB_INACTIVE =
  'text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised';

const CTRL_ROW = 'flex items-center gap-2';
const CTRL_LABEL = 'text-[11px] text-c-text-secondary dark:text-c-text-muted w-24 shrink-0';
const PILL_BTN =
  'h-7 px-2.5 rounded-lg text-[10px] font-medium bg-c-surface-raised dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors';
const PILL_ACTIVE =
  'h-7 px-2.5 rounded-lg text-[10px] font-semibold bg-c-surface-raised dark:bg-c-surface text-c-text dark:text-c-text ring-1 ring-c-border dark:ring-c-border';

export const MindmapInspector: React.FC<MindmapInspectorProps> = ({
  selectedNodeId,
  selectedNodeData,
  currentStructure,
  currentLayoutMode,
  onUpdateNode,
  onSetStructure,
  onSetLayoutMode,
  onApplyTheme,
}) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<InspectorTab>('style');
  const [autoLayout, setAutoLayout] = useState(true);

  const patchNode = useCallback(
    (patch: Record<string, any>) => {
      if (selectedNodeId) onUpdateNode(selectedNodeId, patch);
    },
    [selectedNodeId, onUpdateNode]
  );

  const nodeStyle = selectedNodeData?.style || {};

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-c-surface-raised dark:bg-c-surface-raised">
        {[
          { id: 'style' as const, icon: Brush, labelEn: 'Style' },
          { id: 'layout' as const, icon: Layout, labelEn: 'Layout' },
          { id: 'theme' as const, icon: Palette, labelEn: 'Theme' },
        ].map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`${TAB_BTN} ${tab === tb.id ? TAB_ACTIVE : TAB_INACTIVE}`}
          >
            <tb.icon size={12} />
            {t(`myWorkMindmap.inspector.tab.${tb.id}`, tb.labelEn)}
          </button>
        ))}
      </div>

      {/* ── Style tab ── */}
      {tab === 'style' && (
        <div className="space-y-3">
          {!selectedNodeId ? (
            <div className="text-[11px] text-c-text-secondary dark:text-c-text-secondary italic py-4 text-center">
              {t('ideas.mindmap.selectNodeEditItsStyle', 'Select a node to edit its style')}
            </div>
          ) : (
            <>
              {/* Branch style */}
              <div className={CTRL_ROW}>
                <span className={CTRL_LABEL}>{t('ideas.mindmap.branchStyle', 'Branch style')}</span>
                <div className="flex gap-1">
                  {BRANCH_STYLES.map((s) => (
                    <button
                      key={s}
                      onClick={() => patchNode({ style: { ...nodeStyle, lineStyle: s } })}
                      className={nodeStyle.lineStyle === s ? PILL_ACTIVE : PILL_BTN}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Node width */}
              <div className={CTRL_ROW}>
                <span className={CTRL_LABEL}>{t('ideas.mindmap.nodeWidth', 'Node width')}</span>
                <input
                  type="range"
                  min={120}
                  max={400}
                  step={10}
                  value={nodeStyle.width || 200}
                  onChange={(e) =>
                    patchNode({ style: { ...nodeStyle, width: Number(e.target.value) } })
                  }
                  className="flex-1 h-1.5 accent-c-text"
                />
                <span className="text-[10px] text-c-text-secondary w-8 text-right">
                  {nodeStyle.width || 200}
                </span>
              </div>

              {/* Font size */}
              <div className={CTRL_ROW}>
                <span className={CTRL_LABEL}>{t('ideas.mindmap.fontSize', 'Font size')}</span>
                <div className="flex gap-1">
                  {FONT_SIZES.map((fs) => (
                    <button
                      key={fs}
                      onClick={() => patchNode({ style: { ...nodeStyle, fontSize: fs } })}
                      className={nodeStyle.fontSize === fs ? PILL_ACTIVE : PILL_BTN}
                    >
                      {fs}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font weight */}
              <div className={CTRL_ROW}>
                <span className={CTRL_LABEL}>{t('ideas.mindmap.bold', 'Bold')}</span>
                <button
                  onClick={() => patchNode({ style: { ...nodeStyle, bold: !nodeStyle.bold } })}
                  className={nodeStyle.bold ? PILL_ACTIVE : PILL_BTN}
                >
                  <Bold size={12} />
                </button>
              </div>

              {/* Text color */}
              <div className={CTRL_ROW}>
                <span className={CTRL_LABEL}>{t('ideas.mindmap.textColor', 'Text color')}</span>
                <div className="flex gap-1.5">
                  {NODE_COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => patchNode({ style: { ...nodeStyle, color: c } })}
                      className={`w-5 h-5 rounded-full border-2 shadow-sm hover:scale-110 transition-transform ${
                        nodeStyle.color === c
                          ? 'border-c-text ring-2 ring-c-border-strong'
                          : 'border-c-border-subtle dark:border-c-border-subtle'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Background opacity */}
              <div className={CTRL_ROW}>
                <span className={CTRL_LABEL}>{t('ideas.mindmap.bgOpacity', 'Bg opacity')}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={nodeStyle.fillOpacity ?? 100}
                  onChange={(e) =>
                    patchNode({ style: { ...nodeStyle, fillOpacity: Number(e.target.value) } })
                  }
                  className="flex-1 h-1.5 accent-c-text"
                />
                <span className="text-[10px] text-c-text-secondary w-8 text-right">
                  {nodeStyle.fillOpacity ?? 100}%
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Layout tab ── */}
      {tab === 'layout' && (
        <div className="space-y-3">
          {/* Structure type */}
          <div>
            <div className="text-[10px] font-medium text-c-text-secondary dark:text-c-text-secondary mb-1.5 uppercase tracking-wide">
              {t('ideas.mindmap.structureType', 'Structure type')}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {STRUCTURES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSetStructure(s.id)}
                  className={currentStructure === s.id ? PILL_ACTIVE : PILL_BTN}
                >
                  {t(`myWorkMindmap.inspector.structure.${s.id}`, s.labelEn)}
                </button>
              ))}
            </div>
          </div>

          {/* Layout mode */}
          <div>
            <div className="text-[10px] font-medium text-c-text-secondary dark:text-c-text-secondary mb-1.5 uppercase tracking-wide">
              {t('ideas.mindmap.layoutMode', 'Layout mode')}
            </div>
            <div className="flex gap-1.5">
              {LAYOUT_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onSetLayoutMode(m.id)}
                  className={currentLayoutMode === m.id ? PILL_ACTIVE : PILL_BTN}
                >
                  {t(`myWorkMindmap.inspector.layout.${m.id}`, m.labelEn)}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-layout toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoLayout}
              onChange={(e) => setAutoLayout(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-c-text"
            />
            <span className="text-[11px] text-c-text-secondary dark:text-c-text-muted">
              {t('ideas.mindmap.autoLayoutChanges', 'Auto-layout on changes')}
            </span>
          </label>
        </div>
      )}

      {/* ── Theme tab ── */}
      {tab === 'theme' && (
        <div className="grid grid-cols-1 gap-2">
          {THEMES.map((theme) => (
            <div
              key={theme.id}
              className="flex items-center gap-3 p-2.5 rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface-raised hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
            >
              <div className="flex gap-0.5 shrink-0">
                {theme.colors.map((c, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-sm first:rounded-l-md last:rounded-r-md"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <span className="flex-1 text-[11px] font-medium text-c-text-secondary dark:text-c-text-muted">
                {t(`myWorkMindmap.inspector.theme.${theme.id}`, theme.labelEn)}
              </span>
              <button
                onClick={() => onApplyTheme(theme.id)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-c-surface-raised dark:bg-c-surface text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
              >
                {t('ideas.mindmap.apply', 'Apply')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MindmapInspector;
