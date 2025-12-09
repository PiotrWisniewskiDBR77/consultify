import React, { useMemo } from 'react';
import { EconomicsSummary, Language } from '../types';

interface Props {
    economics: EconomicsSummary;
    language: Language;
}

export const ROIPaybackChart: React.FC<Props> = ({ economics, language }) => {
    const { totalCost, totalAnnualBenefit } = economics;

    // Generate data points for 5 years
    // Year 0: -Total Cost
    // Year 1: -Total Cost + Benefit
    // Year 2: -Total Cost + 2*Benefit ...
    const data = useMemo(() => {
        const points = [];
        let cumulative = -totalCost;
        points.push({ year: 0, value: cumulative });

        for (let i = 1; i <= 5; i++) {
            cumulative += totalAnnualBenefit;
            points.push({ year: i, value: cumulative });
        }
        return points;
    }, [totalCost, totalAnnualBenefit]);

    // Chart Dimensions
    const width = 600;
    const height = 300;
    const padding = 40;

    // Scales
    const minVal = -totalCost * 1.2; // Add some buffer below
    const maxVal = Math.max(totalCost * 0.5, data[5].value * 1.1); // Ensure we see positive area
    const valRange = maxVal - minVal;

    const getX = (year: number) => padding + (year / 5) * (width - 2 * padding);
    const getY = (val: number) => height - padding - ((val - minVal) / valRange) * (height - 2 * padding);

    // SVG Path
    const pathData = data.reduce((acc, point, i) => {
        const x = getX(point.year);
        const y = getY(point.value);
        return i === 0 ? `M ${x},${y}` : `${acc} L ${x},${y}`;
    }, '');

    // Zero Line (Break-even)
    const zeroY = getY(0);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">Cumulative Cash Flow (5 Years)</h3>
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
                {/* Grid Lines */}
                <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" />

                {/* Y-Axis Line */}
                <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#334155" strokeWidth="1" />

                {/* Chart Line */}
                <path d={pathData} fill="none" stroke="#60a5fa" strokeWidth="3" />

                {/* Area under curve (gradient logic omitted for simplicity unless requested) */}

                {/* Data Points */}
                {data.map((point) => (
                    <g key={point.year}>
                        <circle
                            cx={getX(point.year)}
                            cy={getY(point.value)}
                            r="4"
                            fill={point.value >= 0 ? '#4ade80' : '#f87171'}
                            stroke="#1e293b"
                            strokeWidth="2"
                        />
                        {/* Tooltip-like Text */}
                        <text
                            x={getX(point.year)}
                            y={getY(point.value) - 10}
                            textAnchor="middle"
                            fill="white"
                            fontSize="10"
                            fontWeight="bold"
                        >
                            ${(point.value / 1000).toFixed(0)}k
                        </text>

                        {/* X-Axis Labels */}
                        <text
                            x={getX(point.year)}
                            y={height - 10}
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize="10"
                        >
                            Y{point.year}
                        </text>
                    </g>
                ))}
            </svg>
            {economics.paybackPeriodYears > 0 && economics.paybackPeriodYears <= 5 && (
                <div className="text-xs text-green-400 mt-2 font-bold animate-pulse">
                    Break-even estimated at Year {economics.paybackPeriodYears.toFixed(1)}
                </div>
            )}
        </div>
    );
};
