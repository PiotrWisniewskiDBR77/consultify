/**
 * ActivityLog - Display user activity history
 */

import React from 'react';

interface ActivityLogProps {
  userId?: string;
  limit?: number;
  currentUser?: any;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ userId, limit = 20, currentUser }) => {
  const targetUserId = userId || currentUser?.id;
  return (
    <div className="bg-c-surface rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Activity Log</h3>
      <p className="text-sm text-c-text-secondary">No activity recorded yet.</p>
    </div>
  );
};

export default ActivityLog;
