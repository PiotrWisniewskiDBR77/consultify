/**
 * Lazy-loaded Recharts components
 * Prevents React 19 compatibility issues by loading recharts only when needed
 */

import React, { Suspense } from 'react';

// Lazy load recharts module
const rechartsModule = React.lazy(() => import('recharts'));

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

// Export lazy-loaded components
export const LazyBar = React.lazy(() => import('recharts').then((mod) => ({ default: mod.Bar })));
export const LazyBarChart = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.BarChart }))
);
export const LazyLine = React.lazy(() => import('recharts').then((mod) => ({ default: mod.Line })));
export const LazyLineChart = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.LineChart }))
);
export const LazyPie = React.lazy(() => import('recharts').then((mod) => ({ default: mod.Pie })));
export const LazyPieChart = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.PieChart }))
);
export const LazyResponsiveContainer = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.ResponsiveContainer }))
);
export const LazyXAxis = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.XAxis }))
);
export const LazyYAxis = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.YAxis }))
);
export const LazyCartesianGrid = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.CartesianGrid }))
);
export const LazyTooltip = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.Tooltip }))
);
export const LazyLegend = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.Legend }))
);
export const LazyCell = React.lazy(() => import('recharts').then((mod) => ({ default: mod.Cell })));
export const LazyArea = React.lazy(() => import('recharts').then((mod) => ({ default: mod.Area })));
export const LazyAreaChart = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.AreaChart }))
);
export const LazyComposedChart = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.ComposedChart }))
);
export const LazyRadar = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.Radar }))
);
export const LazyRadarChart = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.RadarChart }))
);
export const LazyReferenceLine = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.ReferenceLine }))
);

export { RechartsProvider };
