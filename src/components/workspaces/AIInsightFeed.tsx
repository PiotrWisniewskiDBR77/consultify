/**
 * AIInsightFeed - Display AI-generated insights
 */

import React from 'react';

interface AIInsightFeedProps {
  projectId?: string;
  initiativeId?: string;
  limit?: number;
  session?: any;
}

export const AIInsightFeed: React.FC<AIInsightFeedProps> = ({
  projectId,
  initiativeId,
  limit = 10,
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">AI Insights</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">No insights available yet.</p>
    </div>
  );
};

export default AIInsightFeed;
