/**
 * IntegrationsPanel - Placeholder Component
 * 
 * Future functionality: Manage webhooks, connectors, and third-party integrations.
 */

import React from 'react';
import { Webhook, Link2, Zap, RefreshCw } from 'lucide-react';

export const IntegrationsPanel: React.FC = () => {
    return (
        <div className="p-8">
            <div className="max-w-2xl mx-auto text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 flex items-center justify-center">
                    <Webhook size={32} className="text-cyan-400" />
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-3">
                    Integrations Hub
                </h2>
                
                <p className="text-slate-400 mb-8">
                    Connect Consultify with your existing tools. Set up webhooks, 
                    configure connectors for Slack, Jira, and more.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                        <Webhook size={24} className="text-cyan-400 mx-auto mb-2" />
                        <div className="text-sm font-medium text-white">Webhooks</div>
                        <div className="text-xs text-slate-500">Event notifications</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                        <Link2 size={24} className="text-emerald-400 mx-auto mb-2" />
                        <div className="text-sm font-medium text-white">Connectors</div>
                        <div className="text-xs text-slate-500">Third-party apps</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                        <RefreshCw size={24} className="text-orange-400 mx-auto mb-2" />
                        <div className="text-sm font-medium text-white">Sync Status</div>
                        <div className="text-xs text-slate-500">Monitor connections</div>
                    </div>
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm">
                    <Zap size={16} />
                    Coming Soon
                </div>
            </div>
        </div>
    );
};

export default IntegrationsPanel;

