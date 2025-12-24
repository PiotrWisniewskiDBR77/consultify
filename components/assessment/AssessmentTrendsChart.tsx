/**
 * Assessment Trends Chart
 * Line chart showing score evolution over time
 */

import React from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface TrendsChartProps {
    snapshots: Array<{
        snapshot_date: string;
        scores: Record<string, number>;
    }>;
    dimension?: string;
}

export const AssessmentTrendsChart: React.FC<TrendsChartProps> = ({ snapshots, dimension }) => {
    const labels = snapshots.map(s => new Date(s.snapshot_date).toLocaleDateString());

    const datasets = dimension
        ? [{
            label: dimension,
            data: snapshots.map(s => s.scores[dimension] || 0),
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.3
        }]
        : Object.keys(snapshots[0]?.scores || {}).map((dim, index) => ({
            label: dim,
            data: snapshots.map(s => s.scores[dim] || 0),
            borderColor: `hsl(${index * 60}, 70%, 50%)`,
            backgroundColor: `hsla(${index * 60}, 70%, 50%, 0.1)`,
            tension: 0.3
        }));

    const data = { labels, datasets };

    const options = {
        responsive: true,
        plugins: {
            legend: { position: 'top' as const },
            title: { display: true, text: 'Score Evolution Over Time' }
        },
        scales: {
            y: {
                min: 1,
                max: 7,
                ticks: { stepSize: 1 }
            }
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <Line data={data} options={options} />
        </div>
    );
};
