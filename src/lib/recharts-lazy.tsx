/**
 * Lazy-loaded Recharts components
 * Prevents React 19 compatibility issues by loading recharts only when needed
 */

import React, { ComponentType, Suspense } from 'react';

// Create a wrapper component that provides recharts exports
const RechartsProvider: React.FC<{ children: (recharts: any) => React.ReactNode }> = ({
  children,
}) => {
  return (
    <Suspense
      fallback={<div className="flex items-center justify-center p-8">Loading chart...</div>}
    >
      <RechartsLoader>{children}</RechartsLoader>
    </Suspense>
  );
};

const RechartsLoader: React.FC<{ children: (recharts: any) => React.ReactNode }> = ({
  children,
}) => {
  const [recharts, setRecharts] = React.useState<any>(null);

  React.useEffect(() => {
    import('recharts').then((module) => {
      setRecharts(module);
    });
  }, []);

  if (!recharts) {
    return <div className="flex items-center justify-center p-8">Loading chart...</div>;
  }

  return <>{children(recharts)}</>;
};

// Helper to create typed lazy component
const lazyLoad = <T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> => React.lazy(importer);

// Export lazy-loaded components with explicit type assertions (using unknown for non-standard components)
export const LazyBar = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.Bar as unknown as ComponentType<any> }))
);
export const LazyBarChart = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.BarChart as ComponentType<any> }))
);
export const LazyLine = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.Line as ComponentType<any> }))
);
export const LazyLineChart = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.LineChart as ComponentType<any> }))
);
export const LazyPie = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.Pie as unknown as ComponentType<any> }))
);
export const LazyPieChart = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.PieChart as ComponentType<any> }))
);
export const LazyResponsiveContainer = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.ResponsiveContainer as ComponentType<any> }))
);
export const LazyXAxis = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.XAxis as ComponentType<any> }))
);
export const LazyYAxis = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.YAxis as ComponentType<any> }))
);
export const LazyCartesianGrid = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.CartesianGrid as ComponentType<any> }))
);
export const LazyTooltip = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.Tooltip as ComponentType<any> }))
);
export const LazyLegend = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.Legend as ComponentType<any> }))
);
export const LazyCell = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.Cell as ComponentType<any> }))
);
export const LazyArea = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.Area as unknown as ComponentType<any> }))
);
export const LazyAreaChart = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.AreaChart as ComponentType<any> }))
);
export const LazyComposedChart = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.ComposedChart as ComponentType<any> }))
);
export const LazyRadar = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.Radar as unknown as ComponentType<any> }))
);
export const LazyRadarChart = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.RadarChart as ComponentType<any> }))
);
export const LazyReferenceLine = lazyLoad(() =>
  import('recharts').then((mod) => ({ default: mod.ReferenceLine as ComponentType<any> }))
);

export { RechartsProvider };
