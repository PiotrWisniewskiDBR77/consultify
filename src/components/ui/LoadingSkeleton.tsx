/**
 * Loading Skeleton Components
 * Reusable skeleton loaders for different layouts
 */

import './LoadingSkeleton.css';

import React from 'react';

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table-header">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="skeleton skeleton-header-cell" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="skeleton skeleton-cell" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-card-header" />
      <div className="skeleton skeleton-card-text" />
      <div className="skeleton skeleton-card-text short" />
    </div>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="skeleton-dashboard">
      <div className="skeleton-cards-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="skeleton skeleton-chart" />
    </div>
  );
};

export const FormSkeleton: React.FC = () => {
  return (
    <div className="skeleton-form">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton-form-field">
          <div className="skeleton skeleton-label" />
          <div className="skeleton skeleton-input" />
        </div>
      ))}
    </div>
  );
};

export default { TableSkeleton, CardSkeleton, DashboardSkeleton, FormSkeleton };
