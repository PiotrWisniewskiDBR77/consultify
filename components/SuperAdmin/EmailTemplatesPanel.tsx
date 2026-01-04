/**
 * EmailTemplatesPanel - Placeholder Component
 *
 * Future functionality: Manage email templates for system notifications.
 */

import { FileText, Mail, Palette, Send } from 'lucide-react';
import React from 'react';

export const EmailTemplatesPanel: React.FC = () => {
    return (
        <div className="p-8">
            <div className="max-w-2xl mx-auto text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-pink-500/20 to-pink-600/10 flex items-center justify-center">
                    <Mail size={32} className="text-pink-400" />
                </div>

                <h2 className="text-2xl font-bold text-white mb-3">Email Templates</h2>

                <p className="text-slate-400 mb-8">
                    Customize email notifications sent to users. Edit templates for welcome emails, reports, alerts, and
                    more.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                        <FileText size={24} className="text-pink-400 mx-auto mb-2" />
                        <div className="text-sm font-medium text-white">Templates</div>
                        <div className="text-xs text-slate-500">Edit email content</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                        <Palette size={24} className="text-violet-400 mx-auto mb-2" />
                        <div className="text-sm font-medium text-white">Branding</div>
                        <div className="text-xs text-slate-500">Custom styling</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                        <Send size={24} className="text-blue-400 mx-auto mb-2" />
                        <div className="text-sm font-medium text-white">Preview & Test</div>
                        <div className="text-xs text-slate-500">Send test emails</div>
                    </div>
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-2 bg-pink-500/10 border border-pink-500/30 rounded-lg text-pink-400 text-sm">
                    <Mail size={16} />
                    Coming Soon
                </div>
            </div>
        </div>
    );
};

export default EmailTemplatesPanel;



