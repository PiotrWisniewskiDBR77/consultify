import React from 'react';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
}

export const SmartDiagramBlock: React.FC<Props> = ({ block, theme }) => {
  const diagramKind = (block.content.diagram_kind as string) || 'process_steps';
  const items = (block.content.items as { label: string; description?: string }[]) || [
    { label: 'Discover' },
    { label: 'Analyze' },
    { label: 'Design' },
    { label: 'Implement' },
  ];

  switch (diagramKind) {
    case 'funnel':
      return <FunnelDiagram items={items} theme={theme} />;
    case 'matrix_2x2':
    case 'swot':
      return <MatrixDiagram items={items} theme={theme} kind={diagramKind} />;
    case 'pyramid':
      return <PyramidDiagram items={items} theme={theme} />;
    case 'timeline_horizontal':
    case 'timeline_vertical':
      return (
        <TimelineDiagram items={items} theme={theme} vertical={diagramKind.includes('vertical')} />
      );
    default:
      return <ProcessSteps items={items} theme={theme} />;
  }
};

const ProcessSteps: React.FC<{
  items: { label: string; description?: string }[];
  theme: CuratedColorSet;
}> = ({ items, theme }) => (
  <div className="flex items-center gap-1">
    {items.map((item, i) => (
      <React.Fragment key={i}>
        <div
          className="flex-1 rounded-lg p-2 text-center"
          style={{ backgroundColor: theme.chartPalette[i % theme.chartPalette.length] + '20' }}
        >
          <div
            className="w-6 h-6 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: theme.chartPalette[i % theme.chartPalette.length] }}
          >
            {i + 1}
          </div>
          <p className="text-[10px] font-semibold" style={{ color: theme.colors.heading }}>
            {item.label}
          </p>
        </div>
        {i < items.length - 1 && <div className="text-slate-600 text-lg flex-shrink-0">&rarr;</div>}
      </React.Fragment>
    ))}
  </div>
);

const FunnelDiagram: React.FC<{ items: { label: string }[]; theme: CuratedColorSet }> = ({
  items,
  theme,
}) => (
  <div className="flex flex-col items-center gap-1">
    {items.map((item, i) => {
      const widthPercent = 100 - (i / items.length) * 50;
      return (
        <div
          key={i}
          className="rounded py-1.5 text-center text-[10px] font-semibold text-white"
          style={{
            width: `${widthPercent}%`,
            backgroundColor: theme.chartPalette[i % theme.chartPalette.length],
          }}
        >
          {item.label}
        </div>
      );
    })}
  </div>
);

const MatrixDiagram: React.FC<{
  items: { label: string; description?: string }[];
  theme: CuratedColorSet;
  kind: string;
}> = ({ items, theme, kind }) => {
  const labels =
    kind === 'swot'
      ? ['Strengths', 'Weaknesses', 'Opportunities', 'Threats']
      : items.map((i) => i.label);
  const quadrants = labels.slice(0, 4);

  return (
    <div className="grid grid-cols-2 gap-1">
      {quadrants.map((label, i) => (
        <div
          key={i}
          className="rounded-lg p-2.5 text-center"
          style={{ backgroundColor: theme.chartPalette[i % theme.chartPalette.length] + '15' }}
        >
          <p className="text-[10px] font-bold" style={{ color: theme.colors.heading }}>
            {label}
          </p>
          {items[i]?.description && (
            <p className="text-[9px] mt-0.5" style={{ color: theme.colors.textSecondary }}>
              {items[i].description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

const PyramidDiagram: React.FC<{ items: { label: string }[]; theme: CuratedColorSet }> = ({
  items,
  theme,
}) => (
  <div className="flex flex-col items-center gap-0.5">
    {items.map((item, i) => {
      const widthPercent = 30 + (i / Math.max(items.length - 1, 1)) * 70;
      return (
        <div
          key={i}
          className="rounded py-1.5 text-center text-[10px] font-semibold text-white"
          style={{
            width: `${widthPercent}%`,
            backgroundColor: theme.chartPalette[i % theme.chartPalette.length],
          }}
        >
          {item.label}
        </div>
      );
    })}
  </div>
);

const TimelineDiagram: React.FC<{
  items: { label: string; description?: string }[];
  theme: CuratedColorSet;
  vertical: boolean;
}> = ({ items, theme, vertical }) => {
  if (vertical) {
    return (
      <div
        className="flex flex-col gap-2 pl-4 border-l-2"
        style={{ borderColor: theme.colors.primary + '30' }}
      >
        {items.map((item, i) => (
          <div key={i} className="relative">
            <div
              className="absolute -left-[21px] w-3 h-3 rounded-full"
              style={{ backgroundColor: theme.chartPalette[i % theme.chartPalette.length] }}
            />
            <p className="text-[10px] font-semibold" style={{ color: theme.colors.heading }}>
              {item.label}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4">
      {items.map((item, i) => (
        <div key={i} className="flex-1 text-center">
          <div
            className="w-4 h-4 rounded-full mx-auto mb-1"
            style={{ backgroundColor: theme.chartPalette[i % theme.chartPalette.length] }}
          />
          <p className="text-[10px] font-semibold" style={{ color: theme.colors.heading }}>
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
};
