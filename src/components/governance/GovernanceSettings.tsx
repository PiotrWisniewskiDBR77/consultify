import { Bell, Key, Settings, Shield } from 'lucide-react';
import React from 'react';

export const GovernanceSettings: React.FC = () => {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold dark:text-white flex items-center gap-2 mb-8">
        <Settings className="w-6 h-6 text-indigo-500" />
        Governance Configuration
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <SettingsGroup
          title="Audit Strategy"
          icon={<Shield className="w-5 h-5" />}
          description="Configure retention and detail level for audit logs."
        >
          <div className="space-y-4 pt-4">
            <ToggleSetting label="High-Fidelity Logging" active={true} />
            <ToggleSetting label="Log External Exports" active={true} />
            <div className="flex flex-col gap-1">
              <label
                htmlFor="retention-period"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Retention Period (Days)
              </label>
              <input
                id="retention-period"
                type="number"
                defaultValue={90}
                className="w-24 px-3 py-1 bg-gray-50 border-gray-300 rounded dark:bg-gray-900 border"
              />
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup
          title="Security Posture"
          icon={<Key className="w-5 h-5" />}
          description="Global security constraints and MFA requirements."
        >
          <div className="space-y-4 pt-4">
            <ToggleSetting label="Strict RBAC Enforcement" active={true} />
            <ToggleSetting label="MFA for Admin Actions" active={false} />
            <ToggleSetting label="Enable Break-Glass Access" active={true} />
          </div>
        </SettingsGroup>

        <SettingsGroup
          title="Notifications"
          icon={<Bell className="w-5 h-5" />}
          description="Alerting for governance breaches and events."
        >
          <div className="space-y-4 pt-4">
            <ToggleSetting label="Email on Critical Breach" active={true} />
            <ToggleSetting label="Slack/Teams Integration" active={false} />
          </div>
        </SettingsGroup>
      </div>

      <div className="mt-8 flex justify-end">
        <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
          Save Configuration
        </button>
      </div>
    </div>
  );
};

const SettingsGroup: React.FC<{
  title: string;
  icon: React.ReactNode;
  description: string;
  children: React.ReactNode;
}> = ({ title, icon, description, children }) => (
  <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
    <div className="flex items-center gap-3 mb-2">
      <div className="text-gray-400 dark:text-gray-500 dark:text-gray-400">{icon}</div>
      <h3 className="font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
    </div>
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{description}</p>
    <div className="border-t border-gray-50 dark:border-gray-700">{children}</div>
  </div>
);

const ToggleSetting: React.FC<{ label: string; active: boolean }> = ({ label, active }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    <div
      className={`w-10 h-5 rounded-full relative transition-colors ${active ? 'bg-indigo-600' : 'bg-gray-300'}`}
    >
      <div
        className={`absolute top-1 w-3 h-3 bg-white dark:bg-navy-900 rounded-full transition-all ${active ? 'right-1' : 'left-1'}`}
      />
    </div>
  </div>
);
