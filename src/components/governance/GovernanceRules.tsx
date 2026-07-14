import { Gavel, MoreHorizontal, Plus, Search } from 'lucide-react';
import React from 'react';

export const GovernanceRules: React.FC = () => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
            <Gavel className="w-6 h-6 text-indigo-500" />
            Governance Rules
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Define and manage automated system policies.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-600 dark:text-gray-500 dark:text-gray-400" />
            <input
              type="text"
              placeholder="Search rules..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-900 border-none rounded-md focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table
            /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */ className="w-full text-left"
          >
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs font-semibold text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-4">Rule Name</th>
                <th className="px-6 py-4">Scope</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {[
                { name: 'Auto-Reject High Risk', scope: 'Portfolio', active: true },
                { name: 'Audit Force Log level', scope: 'System', active: true },
                { name: 'Consultant Access Bypass', scope: 'Organization', active: false },
              ].map((rule, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-gray-50 dark:bg-navy-800 dark:hover:bg-gray-700/30 transition"
                >
                  <td className="px-6 py-4 text-sm font-medium dark:text-gray-200">{rule.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {rule.scope}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${rule.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-400'}`}
                    >
                      {rule.active ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-gray-600 hover:text-gray-600 dark:text-gray-400 p-1">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
