import React from 'react';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

const skeletonBase = 'animate-pulse rounded bg-gray-200 dark:bg-gray-700';

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
      <div
        className="mb-4 grid gap-4 border-b-2 border-gray-200 pb-4 dark:border-gray-700"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(150px, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, idx) => (
          <div key={idx} className={`${skeletonBase} h-5`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="mb-3 grid gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(150px, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div key={colIdx} className={`${skeletonBase} h-4`} />
          ))}
        </div>
      ))}
    </div>
  );
};

export default TableSkeleton;
