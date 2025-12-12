// components/Megatrend/TrendRadarCard.tsx
// UI component for the "Trend Radar Map" card of the Megatrend Scanner module
// ---------------------------------------------------------------
// Professional, responsive, dark‑mode ready radar visualization.
// Features:
//   • Industry selector (dropdown)
//   • Fetches data from /api/megatrends/radar
//   • Uses existing RadarChart for the grid
//   • Overlays SVG points: colour = type, size = impact, radius = ring
//   • Hover tooltip with emoji, label and short description
//   • Click opens a modal with full trend details (placeholder for AI insights)
//   • Legend, loading spinner, error handling, smooth animations
// ---------------------------------------------------------------

import React, { useEffect, useState, useRef } from "react";
import { RadarChart } from "../RadarChart";

// Types matching the backend response from /api/megatrends/radar
interface RadarMegatrend {
    id: string; // stable key
    label: string;
    type: "Technology" | "Business" | "Societal";
    ring: "Now" | "Watch Closely" | "On the Horizon";
    impact: number; // 1‑7
    description?: string;
}

// Ring order determines distance from centre (inner → outer)
const ringOrder: Record<RadarMegatrend["ring"], number> = {
    Now: 1,
    "Watch Closely": 2,
    "On the Horizon": 3,
};

// Colours and emojis per type
const typeColors: Record<RadarMegatrend["type"], { bg: string; border: string; emoji: string }> = {
    Technology: { bg: "bg-blue-500", border: "border-blue-700", emoji: "🔵" },
    Business: { bg: "bg-purple-500", border: "border-purple-700", emoji: "🟣" },
    Societal: { bg: "bg-orange-500", border: "border-orange-700", emoji: "🟠" },
};

const industryOptions = ["automotive", "FMCG", "machinery", "metal", "plastics", "general"];

export const TrendRadarCard: React.FC = () => {
    const [industry, setIndustry] = useState<string>("automotive");
    const [data, setData] = useState<RadarMegatrend[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
    const [selectedTrend, setSelectedTrend] = useState<RadarMegatrend | null>(null);

    // Responsive size – based on container width (max 500 px)
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<number>(400);
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth;
                setSize(Math.min(width, 500));
            }
        };
        updateSize();
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, []);

    // Load radar data whenever industry changes
    useEffect(() => {
        const fetchRadar = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/megatrends/radar?industry=${encodeURIComponent(industry)}`);
                if (!res.ok) throw new Error("Failed to load radar data");
                const json: RadarMegatrend[] = await res.json();
                setData(json);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchRadar();
    }, [industry]);

    // Helper to compute SVG coordinates (same as RadarChart)
    const radius = size / 2;
    const maxVal = 7; // impact range
    const angleSlice = data.length ? (Math.PI * 2) / data.length : 0;
    const getCoords = (value: number, index: number) => {
        const angle = index * angleSlice - Math.PI / 2; // start at top
        const r = (value / maxVal) * (radius - 30); // 30 px padding for labels
        const x = radius + r * Math.cos(angle);
        const y = radius + r * Math.sin(angle);
        return { x, y };
    };

    // Render SVG points on top of the RadarChart
    const renderPoints = () =>
        data.map((mt, i) => {
            const ringFactor = ringOrder[mt.ring] / 3; // 0.33, 0.66, 1.0
            const baseRadius = (radius - 30) * ringFactor;
            const angle = i * angleSlice - Math.PI / 2;
            const x = radius + baseRadius * Math.cos(angle);
            const y = radius + baseRadius * Math.sin(angle);
            const sizePx = Math.max(6, (mt.impact / maxVal) * 20); // 6‑20 px
            const { bg, border, emoji } = typeColors[mt.type];
            return (
                <g key={mt.id}>
                    <circle
                        cx={x}
                        cy={y}
                        r={sizePx}
                        className={`${bg} ${border} stroke-2 transition-transform duration-200 ease-out hover:scale-125 cursor-pointer`}
                        onMouseEnter={e => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ x: rect.x + rect.width / 2, y: rect.y, text: `${emoji} ${mt.label}: ${mt.description ?? ""}` });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => setSelectedTrend(mt)}
                        aria-label={`Megatrend ${mt.label}, type ${mt.type}, impact ${mt.impact}`}
                    />
                </g>
            );
        });

    // Simple modal for trend details (future AI insights placeholder)
    const DetailModal = ({ trend }: { trend: RadarMegatrend }) => (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50"
            role="dialog"
            aria-modal="true"
            onClick={() => setSelectedTrend(null)}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-md w-full p-6 relative"
                onClick={e => e.stopPropagation()}
            >
                <button
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                    onClick={() => setSelectedTrend(null)}
                    aria-label="Close"
                >
                    ✕
                </button>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">{trend.label}</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{trend.description}</p>
                <div className="flex items-center space-x-4 mb-2">
                    <span className="font-medium">Type:</span>
                    <span>{typeColors[trend.type].emoji} {trend.type}</span>
                </div>
                <div className="flex items-center space-x-4 mb-2">
                    <span className="font-medium">Impact:</span>
                    <span>{trend.impact}/7</span>
                </div>
                <div className="flex items-center space-x-4 mb-2">
                    <span className="font-medium">Ring:</span>
                    <span>{trend.ring}</span>
                </div>
                <div className="border-t pt-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    AI insights will appear here.
                </div>
            </div>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 space-y-4" ref={containerRef}>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Trend Radar Map</h2>
            <div className="flex items-center space-x-3">
                <label htmlFor="industry" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Industry:
                </label>
                <select
                    id="industry"
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    className="mt-1 block w-48 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                    {industryOptions.map(opt => (
                        <option key={opt} value={opt}>
                            {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </option>
                    ))}
                </select>
            </div>

            {loading && (
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                    <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                    <span>Loading radar data…</span>
                </div>
            )}
            {error && <p className="text-red-600 dark:text-red-400">Error: {error}</p>}

            <div className="relative mx-auto" style={{ width: size, height: size }}>
                {/* Base radar grid – dummy max values just to draw the web */}
                <RadarChart data={data.map(d => ({ label: d.label, value: maxVal }))} size={size} />
                {/* Overlay points */}
                <svg className="absolute inset-0" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    {renderPoints()}
                </svg>
                {/* Tooltip */}
                {tooltip && (
                    <div
                        className="absolute bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap shadow-lg"
                        style={{ left: tooltip.x - 50, top: tooltip.y - 40 }}
                    >
                        {tooltip.text}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="flex justify-center space-x-6 mt-4 text-sm text-gray-600 dark:text-gray-300">
                {Object.entries(typeColors).map(([type, { emoji }]) => (
                    <div key={type} className="flex items-center space-x-1">
                        <span>{emoji}</span>
                        <span>{type}</span>
                    </div>
                ))}
                <div className="flex items-center space-x-1">
                    <span className="inline-block w-3 h-3 bg-gray-500 rounded-full"></span>
                    <span>Impact size (larger = stronger)</span>
                </div>
            </div>

            {/* Detail modal */}
            {selectedTrend && <DetailModal trend={selectedTrend} />}
        </div>
    );
};

export default TrendRadarCard;
