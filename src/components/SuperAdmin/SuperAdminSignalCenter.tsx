import { AlertCircle, MessageSquare, PhoneIncoming, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { useOnClickOutside } from '../../hooks/useOnClickOutside'; // Assuming we have this, or I'll implement a simple ref check
import { Api } from '../../services/api';
import { Notification } from '../../types';
import { SignalNode } from './SignalNode';

interface SignalGroup {
  system: Notification[];
  client: Notification[];
  feedback: Notification[];
}

export const SuperAdminSignalCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<SignalGroup>({
    system: [],
    client: [],
    feedback: [],
  });
  const [selectedType, setSelectedType] = useState<'system' | 'client' | 'feedback' | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSelectedType(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSignals = async () => {
    try {
      // Use dedicated SuperAdmin signals endpoint
      const token = localStorage.getItem('token');
      const response = await fetch('/api/superadmin/signals', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const allSignals = await response.json();

      // Group by type
      const system = allSignals.filter((n: any) => n.type === 'SYSTEM_ALERT');
      const client = allSignals.filter((n: any) => n.type === 'CLIENT_TICKET');
      const feedback = allSignals.filter((n: any) => n.type === 'USER_FEEDBACK');

      queueMicrotask(() => setNotifications({ system, client, feedback }));
    } catch (error) {
      console.error('Failed to fetch signals', error);
    }
  };

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Temp: Seed data for demonstration if empty (to verify UI)
  // REMOVE THIS IN PRODUCTION or if real data exists
  useEffect(() => {
    if (
      notifications.system.length === 0 &&
      notifications.client.length === 0 &&
      notifications.feedback.length === 0
    ) {
      // Simulate for visual check (as per plan's manual verification step)
      // In real code, we'd rely on the API.
      // I will leave this commented out and rely on manual seeding or real api.
    }
  }, []);

  const handleDismiss = async (id: string, type: keyof SignalGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await Api.markNotificationRead(id);
      // Optimistic update
      setNotifications((prev) => ({
        ...prev,
        [type]: prev[type].filter((n) => n.id !== id),
      }));
    } catch (error) {
      console.error('Failed to dismiss', error);
    }
  };

  const getTypeLabel = (type: 'system' | 'client' | 'feedback') => {
    switch (type) {
      case 'system':
        return 'System Alerts';
      case 'client':
        return 'Client Requests';
      case 'feedback':
        return 'User Feedback';
    }
  };

  const getTypeColor = (type: 'system' | 'client' | 'feedback') => {
    switch (type) {
      case 'system':
        return 'text-red-500';
      case 'client':
        return 'text-amber-500 dark:text-amber-400';
      case 'feedback':
        return 'text-cyan-600 dark:text-cyan-400';
    }
  };

  return (
    <div
      className="relative flex items-center gap-2 mr-4 bg-white dark:bg-navy-900/50 p-1.5 rounded-xl border border-slate-200 dark:border-navy-700 backdrop-blur-sm shadow-sm dark:shadow-none"
      ref={containerRef}
    >
      {/* SYSTEM - HIGH PRIORITY */}
      <SignalNode
        type="system"
        icon={AlertCircle}
        label="System Alerts"
        count={notifications.system.length}
        colorClass="text-red-500"
        active={selectedType === 'system'}
        onClick={() => setSelectedType(selectedType === 'system' ? null : 'system')}
      />

      <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />

      {/* CLIENT - MEDIUM PRIORITY */}
      <SignalNode
        type="client"
        icon={PhoneIncoming}
        label="Client Tickets"
        count={notifications.client.length}
        colorClass="text-amber-500 dark:text-amber-400"
        active={selectedType === 'client'}
        onClick={() => setSelectedType(selectedType === 'client' ? null : 'client')}
      />

      <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />

      {/* FEEDBACK - LOW PRIORITY */}
      <SignalNode
        type="feedback"
        icon={MessageSquare}
        label="Feedback"
        count={notifications.feedback.length}
        colorClass="text-cyan-600 dark:text-cyan-400"
        active={selectedType === 'feedback'}
        onClick={() => setSelectedType(selectedType === 'feedback' ? null : 'feedback')}
      />

      {/* POPOVER LIST */}
      {selectedType && (
        <div className="absolute top-full right-0 mt-3 w-80 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden z-[100] animate-in slide-in-from-top-2">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 flex items-center justify-between">
            <h3 className={`font-semibold text-sm ${getTypeColor(selectedType)}`}>
              {getTypeLabel(selectedType)}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {notifications[selectedType].length} Active
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {notifications[selectedType].length === 0 ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs">
                No active signals in this category.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {notifications[selectedType].map((item) => (
                  <div
                    key={item.id}
                    className="p-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group relative"
                  >
                    <div className="pr-6">
                      <p className="text-xs text-slate-800 dark:text-white font-medium mb-1">
                        {item.title || 'Untitled Signal'}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {item.message || 'No details provided.'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDismiss(item.id, selectedType, e)}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
