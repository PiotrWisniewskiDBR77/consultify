import React from 'react';

interface TaskInboxProps {
    onEditTask: (id: string) => void;
}

export const TaskInbox: React.FC<TaskInboxProps> = ({ onEditTask }) => {
    return (
        <div className="p-4 bg-white dark:bg-navy-800 rounded-xl shadow-sm">
            <h2 className="text-lg font-bold mb-4">Task Inbox</h2>
            <p className="text-slate-500">Full task list with filters filters coming soon...</p>
        </div>
    );
};
