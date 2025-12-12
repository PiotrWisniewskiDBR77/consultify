import React from 'react';

interface RadarChartProps {
    data: { label: string; value: number }[];
    size: number;
}

export const RadarChart: React.FC<RadarChartProps> = ({ data, size }) => {
    const radius = size / 2;
    const webColor = '#334155'; // slate-700
    const axisColor = '#475569'; // slate-600
    const areaColor = 'rgba(59, 130, 246, 0.5)'; // blue-500 with opacity
    const strokeColor = '#3b82f6'; // blue-500
    const maxVal = 7; // As per the application domain (0-7 score)

    // Calculate points for the web
    const angleSlice = (Math.PI * 2) / data.length;

    // Helper to get coordinates
    const getCoords = (value: number, index: number) => {
        const angle = index * angleSlice - Math.PI / 2; // -PI/2 to start at top
        // Normalize value to radius (0 to maxVal maps to 0 to radius)
        const r = (value / maxVal) * (radius - 20); // -20 for padding
        const x = radius + r * Math.cos(angle);
        const y = radius + r * Math.sin(angle);
        return { x, y };
    };

    // Generate web (concentric polygons)
    const webPoints: string[] = [];
    [1, 2, 3, 4, 5, 6, 7].forEach(level => {
        let points = "";
        data.forEach((_, i) => {
            const { x, y } = getCoords(level, i);
            points += `${x},${y} `;
        });
        webPoints.push(points);
    });

    // Generate data polygon
    let dataPoints = "";
    data.forEach((d, i) => {
        const { x, y } = getCoords(d.value, i);
        dataPoints += `${x},${y} `;
    });

    return (
        <div className="relative flex items-center justify-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Web */}
                {webPoints.map((points, i) => (
                    <polygon
                        key={i}
                        points={points}
                        fill="none"
                        stroke={webColor}
                        strokeWidth="1"
                        opacity={0.3 + (i / 10)}
                    />
                ))}

                {/* Axes */}
                {data.map((_, i) => {
                    const { x, y } = getCoords(maxVal, i);
                    return <line key={i} x1={radius} y1={radius} x2={x} y2={y} stroke={axisColor} strokeWidth="1" />
                })}
                {/* We need to map again to render lines because forEach returns void */}
                {data.map((_, i) => {
                    const { x, y } = getCoords(maxVal, i);
                    return <line key={`axis-${i}`} x1={radius} y1={radius} x2={x} y2={y} stroke={axisColor} strokeWidth="1" opacity="0.5" />
                })}

                {/* Data Area */}
                <polygon points={dataPoints} fill={areaColor} stroke={strokeColor} strokeWidth="2" />

                {/* Labels */}
                {data.map((d, i) => {
                    // Push labels out a bit further than maxVal
                    const angle = i * angleSlice - Math.PI / 2;






                    const textX = radius + (radius - 10) * Math.cos(angle);
                    const textY = radius + (radius - 10) * Math.sin(angle);

                    return (
                        <text
                            key={i}
                            x={textX}
                            y={textY}
                            fill="#94a3b8"
                            fontSize="10"
                            textAnchor="middle"
                            alignmentBaseline="middle"
                        >
                            {/* Shorten labels for chart clarity if needed */}
                            {d.label.split(' ')[0]}
                        </text>
                    )
                })}
            </svg>
        </div>
    );
};
