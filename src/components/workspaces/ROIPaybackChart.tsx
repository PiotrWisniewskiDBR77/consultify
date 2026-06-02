/**
 * ROIPaybackChart - Display ROI and payback metrics
 */

import React from 'react';

interface ROIPaybackChartProps {
  investmentAmount?: number;
  returnAmount?: number;
  paybackMonths?: number;
  economics?: {
    totalCost?: number;
    totalAnnualBenefit?: number;
    overallROI?: number;
    paybackPeriodYears?: number;
  };
}

export const ROIPaybackChart: React.FC<ROIPaybackChartProps> = ({
  investmentAmount = 0,
  returnAmount = 0,
  paybackMonths = 0,
}) => {
  const roi =
    investmentAmount > 0 ? ((returnAmount - investmentAmount) / investmentAmount) * 100 : 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">ROI & Payback</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{roi.toFixed(1)}%</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">ROI</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{paybackMonths}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Payback Months</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary-600">
            ${returnAmount.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Return</div>
        </div>
      </div>
    </div>
  );
};

export default ROIPaybackChart;
