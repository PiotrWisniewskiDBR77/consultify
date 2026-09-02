import { ArrowRight, BookOpen, GraduationCap, ShieldCheck } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { PARTNER_DOCS } from '../../config/partnerKnowledge';
import { ROUTES } from '../../routes/routeConfig';

export const ResourcesView: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-full bg-slate-50 dark:bg-navy-950">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900/60 p-8">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Partner Knowledge Hub
          </h1>
          <p className="mt-3 max-w-3xl text-slate-500 dark:text-slate-400">
            Start from canonical public docs, then continue into the partner portal for academy,
            exams, certificates, and gated resources.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => navigate(`${ROUTES.PARTNER.LANDING}?tab=documentation`)}
              className="inline-flex items-center gap-2 rounded-lg bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] px-4 py-2 text-sm font-medium text-white"
            >
              Open portal resources
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(PARTNER_DOCS.overview.href)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-navy-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Open partner docs
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Public docs',
              description:
                'Program overview, application flow, payouts, certification, FAQ, and case studies.',
              icon: BookOpen,
              action: () => navigate(PARTNER_DOCS.overview.href),
            },
            {
              title: 'Partner academy',
              description:
                'Track-based learning paths with modules, exam eligibility, and review states.',
              icon: GraduationCap,
              action: () => navigate(`${ROUTES.PARTNER.LANDING}?tab=learning-path`),
            },
            {
              title: 'Governed readiness',
              description:
                'Operator review, payout readiness, and certificates stay visible in the portal.',
              icon: ShieldCheck,
              action: () => navigate(`${ROUTES.PARTNER.LANDING}?tab=certificates`),
            },
          ].map((item) => (
            <button
              key={item.title}
              onClick={item.action}
              className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900/60 p-6 text-left hover:border-slate-400 dark:hover:border-navy-600 transition-colors"
            >
              <item.icon className="w-6 h-6 text-slate-700 dark:text-slate-300" />
              <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                {item.title}
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResourcesView;
