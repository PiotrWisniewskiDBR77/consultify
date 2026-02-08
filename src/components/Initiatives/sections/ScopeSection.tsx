/**
 * ScopeSection - In scope, out of scope, kill criteria
 */

import { motion } from 'framer-motion';
import { Loader2, Plus, Scale, Sparkles, X } from 'lucide-react';
import React, { useState } from 'react';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const ScopeSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { initiative, isPolish, isGeneratingAI, handleGenerateAI } = useInitiativeContext();

  const scopeData = initiative?.scope || {};
  const [inScope, setInScope] = useState<string[]>(typeof scopeData === 'object' ? scopeData.inScope || [] : []);
  const [outScope, setOutScope] = useState<string[]>(typeof scopeData === 'object' ? scopeData.outScope || [] : []);
  const [killCriteria, setKillCriteria] = useState<string[]>(
    initiative?.killCriteria || initiative?.kill_criteria || (typeof scopeData === 'object' ? scopeData.killCriteria || [] : [])
  );
  const [newIn, setNewIn] = useState('');
  const [newOut, setNewOut] = useState('');
  const [newKill, setNewKill] = useState('');

  return (
    <CollapsibleSection
      id="scope"
      title={isPolish ? 'Zakres i kryteria rezygnacji' : 'Scope & Kill Criteria'}
      icon={<Scale size={18} className="text-violet-500 dark:text-violet-400" />}
      iconBg="bg-gradient-to-br from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        inScope.length + outScope.length > 0 ? (
          <span className="text-xs text-slate-400">{inScope.length + outScope.length}</span>
        ) : undefined
      }
      actions={
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={async (e) => {
            e.stopPropagation();
            const result = await handleGenerateAI('scope');
            if (result?.parsedContent) {
              const data = result.parsedContent;
              if (data.inScope?.length) setInScope(data.inScope);
              if (data.outOfScope?.length) setOutScope(data.outOfScope);
              if (data.killCriteria?.length) setKillCriteria(data.killCriteria);
            }
          }}
          disabled={isGeneratingAI === 'scope'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
        >
          {isGeneratingAI === 'scope' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          <span>AI</span>
        </motion.button>
      }
    >
      <div className="space-y-5">
        {/* In Scope */}
        <div>
          <label className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-500">✓</div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{isPolish ? 'W zakresie' : 'In Scope'}</span>
          </label>
          <div className="space-y-2 mb-3">
            {inScope.map((item, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/20">
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{item}</span>
                <button onClick={() => setInScope(inScope.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newIn} onChange={(e) => setNewIn(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newIn.trim()) { setInScope([...inScope, newIn.trim()]); setNewIn(''); } }}
              placeholder={isPolish ? 'Dodaj element zakresu...' : 'Add scope item...'}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm" />
            <button onClick={() => { if (newIn.trim()) { setInScope([...inScope, newIn.trim()]); setNewIn(''); } }} disabled={!newIn.trim()}
              className="px-3 py-2 rounded-lg text-emerald-500 border border-emerald-200 dark:border-emerald-500/30 disabled:opacity-50"><Plus size={16} /></button>
          </div>
        </div>

        {/* Out of Scope */}
        <div>
          <label className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-slate-500/20 flex items-center justify-center text-xs font-bold text-slate-500">✗</div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{isPolish ? 'Poza zakresem' : 'Out of Scope'}</span>
          </label>
          <div className="space-y-2 mb-3">
            {outScope.map((item, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-100/50 dark:bg-slate-500/5 border border-slate-200/50 dark:border-slate-500/20">
                <span className="flex-1 text-sm text-slate-500 dark:text-slate-400 line-through">{item}</span>
                <button onClick={() => setOutScope(outScope.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newOut} onChange={(e) => setNewOut(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newOut.trim()) { setOutScope([...outScope, newOut.trim()]); setNewOut(''); } }}
              placeholder={isPolish ? 'Dodaj wykluczenie...' : 'Add exclusion...'}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm" />
            <button onClick={() => { if (newOut.trim()) { setOutScope([...outScope, newOut.trim()]); setNewOut(''); } }} disabled={!newOut.trim()}
              className="px-3 py-2 rounded-lg text-slate-500 border border-slate-200 dark:border-slate-500/30 disabled:opacity-50"><Plus size={16} /></button>
          </div>
        </div>

        {/* Kill Criteria */}
        <div className="pt-4 border-t border-slate-200 dark:border-navy-700">
          <label className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-xs font-bold text-red-500">!</div>
            <span className="text-sm font-semibold text-red-600 dark:text-red-400">{isPolish ? 'Kryteria rezygnacji (Kill Criteria)' : 'Kill Criteria'}</span>
          </label>
          <p className="text-xs text-slate-400 mb-2">{isPolish ? 'Warunki, których spełnienie oznacza natychmiastowe zatrzymanie inicjatywy' : 'Conditions that trigger immediate initiative termination'}</p>
          <div className="space-y-2 mb-3">
            {killCriteria.map((item, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-red-50/50 dark:bg-red-500/5 border border-red-200/50 dark:border-red-500/20">
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{item}</span>
                <button onClick={() => setKillCriteria(killCriteria.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newKill} onChange={(e) => setNewKill(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newKill.trim()) { setKillCriteria([...killCriteria, newKill.trim()]); setNewKill(''); } }}
              placeholder={isPolish ? 'Dodaj kryterium rezygnacji...' : 'Add kill criteria...'}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm" />
            <button onClick={() => { if (newKill.trim()) { setKillCriteria([...killCriteria, newKill.trim()]); setNewKill(''); } }} disabled={!newKill.trim()}
              className="px-3 py-2 rounded-lg text-red-500 border border-red-200 dark:border-red-500/30 disabled:opacity-50"><Plus size={16} /></button>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};
