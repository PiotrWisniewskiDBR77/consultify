import React from 'react';

import './LoadingSkeleton.css';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="skeleton-table">
      <div
        className="skeleton-table-header"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(150px, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, idx) => (
          <div key={idx} className="skeleton skeleton-header-cell" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="skeleton-table-row"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(150px, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div key={colIdx} className="skeleton skeleton-cell" />
          ))}
        </div>
      ))}
    </div>
  );
};

export default TableSkeleton;
