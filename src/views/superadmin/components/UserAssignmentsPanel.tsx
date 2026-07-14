/**
 * UserAssignmentsPanel - Display and manage user assignments
 */

import React from 'react';

interface UserAssignmentsPanelProps {
  userId: string;
  userName?: string;
  onClose?: () => void;
  onSave?: () => void;
  onAssign?: (projectId: string) => void;
  onUnassign?: (projectId: string) => void;
}

export const UserAssignmentsPanel: React.FC<UserAssignmentsPanelProps> = ({
  userId,
  onAssign,
  onUnassign,
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">User Assignments</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        No assignments found for user {userId}.
      </p>
    </div>
  );
};

export default UserAssignmentsPanel;
