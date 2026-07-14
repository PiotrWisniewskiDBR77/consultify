import { Bot, BrainCircuit, FileOutput, LibraryBig, Wand2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

const AI_OS_MAP_ICONS = [Bot, Wand2, BrainCircuit, LibraryBig, FileOutput] as const;

export const AIOsProductMapSection: React.FC = () => {
  const { t } = useTranslation();

  const itemsRaw = t('landing.aiOs.items', { returnObjects: true }) as unknown;
  const items = Array.isArray(itemsRaw)
    ? (itemsRaw as Array<{ badge: string; title: string; description: string }>)
    : [
        {
          badge: 'Assistants',
          title: 'Anna and Teresa are guided entry points into the same governed system.',
          description:
            'Anna handles public product guidance and Teresa handles tenant work, but both belong to one Consultify AI operating environment.',
        },
        {
          badge: 'Prompt OS',
          title: 'Prompt behavior is managed as a governed platform capability.',
          description:
            'Consultify does not rely on hidden prompt fragments. Prompt policy, releases, and runtime behavior form one controlled system.',
        },
        {
          badge: 'Agents',
          title:
            'Agents plan, propose, and coordinate work instead of acting like isolated tricks.',
          description:
            'The AI work model follows a governed lifecycle from ask to plan to approve to apply to audit.',
        },
        {
          badge: 'Knowledge',
          title: 'Knowledge is policy-aware, traceable, and tied to working context.',
          description:
            'Retrieval and memory are governed by scope, privacy, and lineage so users can trust what the system uses.',
        },
        {
          badge: 'Outputs',
          title: 'AI work continues into artifact runs, deliverables, and execution evidence.',
          description:
            'The system carries context into reports, presentations, sheets, and execution-ready outputs instead of stopping at chat answers.',
        },
      ];

  return (
    <section className="py-24 px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-c-border bg-c-surface-raised text-xs font-bold uppercase tracking-[0.2em] text-c-text-secondary">
            <BrainCircuit size={12} className="text-c-accent" />
            {t('landing.aiOs.badge', 'AI operating system')}
          </div>
          <h2 className="mt-5 text-4xl lg:text-5xl font-black text-c-text tracking-tight">
            {t(
              'landing.aiOs.heading',
              'One AI system for assistants, prompts, agents, knowledge, and artifact-native work.'
            )}
          </h2>
          <p className="mt-4 text-base text-c-text-secondary max-w-3xl mx-auto">
            {t(
              'landing.aiOs.sub',
              'Consultify packages strong AI architecture as a visible operating environment: guided assistants, governed prompts, multi-step agents, policy-aware knowledge, and outputs that continue beyond chat.'
            )}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {items.map((item, index) => {
            const Icon = AI_OS_MAP_ICONS[index] ?? BrainCircuit;
            return (
              <div
                key={item.title}
                className="rounded-3xl border border-c-border bg-c-surface p-6 backdrop-blur-xl"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-c-accent/20 bg-c-accent-soft">
                  <Icon size={20} className="text-c-accent" />
                </div>
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-c-accent">
                  {item.badge}
                </div>
                <h3 className="text-lg font-black text-c-text leading-snug">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-c-text-secondary">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-3xl border border-c-border bg-c-surface-raised px-6 py-5 text-center text-sm text-c-text-secondary">
          {t(
            'landing.aiOs.footer',
            'The point is not more AI surfaces. The point is one coherent, governed AI operating environment across chat, execution, knowledge, and outputs.'
          )}
        </div>
      </div>
    </section>
  );
};

export default AIOsProductMapSection;
