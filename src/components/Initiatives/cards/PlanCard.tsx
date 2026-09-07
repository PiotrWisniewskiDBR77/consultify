import React, { useMemo, useState } from 'react';
import { ArtifactPropertiesTable } from '@/components/standard/ArtifactPropertiesTable';
import { DocumentCardMenu5 } from '@/components/standard/DocumentCardMenu5';
import { StandardArtifactShell } from '@/components/standard/StandardArtifactShell';
import type { StandardSekcjaDef } from '@/components/standard/StandardArtifactShell.types';
import { PLAN_CARD_CONTRACT } from '@/components/standard/documentCardContracts';
import { resolveBusinessDisplayLabel } from '@/components/shared/PreviewPane/businessDisplayLabel';
import {
  GeneratorPlanuModal,
  type GeneratorInitiative,
  type GeneratorPlanInput,
  type GeneratorProposalRow,
  type PlanGenerationMode,
} from '../Generator/GeneratorPlanuModal';
// P15-K5 (DEC-421): edytor popytu per rola — jedyny dotyk PlanCard w tym kroku.
import { PlanRoleDemandEditor } from './PlanRoleDemandEditor';

export interface PlanCardScenario { scenarioId: string; name?: string|null; status: 'DRAFT'|'PUBLISHED'|'SUPERSEDED'; scenarioVersion:number; portfolioScenarioId:string; portfolioScenarioVersion:number; windowUnit:string; timezone:string; periods:Array<{periodId:string;start:string;end:string}>; windows:Array<{initiativeId:string;target:string|null;rationale:string;dependencySnapshot:string[];constraintSnapshot:Array<{detail:string}>}>; assumptions:string[]; updatedBy:string; publishedBy:string|null; publishedAt:string|null }

const formatPolishDate = (value: string | null) => {
  if (!value) return 'Nieznane';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Nieznane' : new Intl.DateTimeFormat('pl-PL').format(date);
};
const windowUnitLabel = (value: string) => ({ WEEK: 'Tydzień', MONTH: 'Miesiąc', QUARTER: 'Kwartał' })[value] ?? value;

export function PlanCard({ scenario, initiatives, plannable, proposal, proposalRows, proposalConflicts, savedLabel, busy, onBack, onAnalyze, onGenerate, onReview, onPublish }: { scenario: PlanCardScenario; initiatives:Array<{id:string;name:string;lifecycle?:string}>; plannable?:GeneratorInitiative[]; proposal?:{conflicts:string[];changes:unknown[];status:string}|null; proposalRows?:GeneratorProposalRow[]|null; proposalConflicts?:string[]; savedLabel?:string|null; busy?:boolean; onBack:()=>void; onAnalyze:(mode:PlanGenerationMode)=>void; onGenerate?:(input:GeneratorPlanInput)=>void; onReview:(outcome:'ACCEPT'|'REJECT')=>void; onPublish:()=>void }) {
  const [section, setSection] = useState('horizon'); const [generator, setGenerator] = useState(false); const [readMode, setReadMode] = useState(false);
  const title = resolveBusinessDisplayLabel({displayName:scenario.name,rawId:scenario.scenarioId,fallback:'Plan bez nazwy'});
  const names = useMemo(() => new Map([...initiatives.map((item)=>[item.id,item.name] as const), ...(plannable??[]).map((item)=>[item.id,item.name] as const)]),[initiatives,plannable]);
  const capacityConstraints = useMemo(
    () => [...new Set(scenario.windows.flatMap((window) => window.constraintSnapshot.map((constraint) => constraint.detail)).filter((detail) => detail.trim()))],
    [scenario.windows]
  );
  const box='rounded-xl border border-c-border-subtle bg-c-surface p-4';
  const content: Record<string, React.ReactNode> = {
    horizon: <div className={box}><p>{windowUnitLabel(scenario.windowUnit)} · {scenario.timezone}</p><ul>{scenario.periods.map(p=><li key={p.periodId}>{formatPolishDate(p.start)} – {formatPolishDate(p.end)}</li>)}</ul></div>,
    // P15-K2 (DEC-421): „Zakres inicjatyw" = OKNA PLANU, nie backlog całego modułu.
    // Pomiar 07.09: sekcja renderowała prop `initiatives` (72 pozycje z
    // `InitiativesHub`), więc plan z 5 oknami pokazywał 72 inicjatywy jako swój zakres.
    scope: scenario.windows.length ? <div className={box}>{scenario.windows.map(w=><p key={w.initiativeId}>{names.get(w.initiativeId)??w.initiativeId} · {formatPolishDate(w.target)}</p>)}</div> : <div className={box}><p className="text-sm text-c-text-muted">Plan nie ma jeszcze żadnej inicjatywy w zakresie. Wybierz je w generatorze.</p></div>,
    windows: scenario.windows.length ? <div className={box}>{scenario.windows.map((w,index)=><div key={w.initiativeId} className="border-b border-c-border-subtle py-2"><b>{index+1}. {names.get(w.initiativeId)??'Inicjatywa'}</b><p>{formatPolishDate(w.target)} · {w.rationale}</p></div>)}</div> : null,
    dependencies: proposal?.conflicts.length ? <div className={box}>{proposal.conflicts.map(c=><p key={c}>{c}</p>)}</div> : null,
    capacity: <div className={box}>{capacityConstraints.length?<ul className="mb-3 list-disc pl-4 text-sm text-c-text-muted">{capacityConstraints.map((detail)=><li key={detail}>{detail}</li>)}</ul>:null}<PlanRoleDemandEditor scenarioId={scenario.scenarioId} initiativeNames={names} /></div>,
    decisions: <div className={box}><p>{scenario.publishedAt?`Opublikowano ${formatPolishDate(scenario.publishedAt)}`:'Plan pozostaje szkicem.'}</p>{savedLabel&&<p className="text-sm text-c-text-muted" role="status">{savedLabel}</p>}{scenario.status==='DRAFT'&&<button className="mt-2 rounded-lg border border-c-border px-3 py-2 focus-visible:ring-2 focus-visible:ring-c-focus" onClick={onPublish}>Opublikuj plan</button>}</div>,
  };
  const sections: StandardSekcjaDef[] = PLAN_CARD_CONTRACT.flatMap((item) => content[item.id] ? [{...item, component:content[item.id], aiContract:{none:true as const,reason:item.aiReason}}] : []);
  const rightPanel={actions:{label:'Akcje',children:<button className="rounded-lg border border-c-border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus" onClick={onBack}>Wróć do listy</button>,actionIds:['back']},properties:{label:'Właściwości',children:<ArtifactPropertiesTable propertyLabel="Właściwość" valueLabel="Wartość" rows={[{id:'status',label:'Status',value:scenario.status==='DRAFT'?'Szkic':scenario.status==='PUBLISHED'?'Opublikowany':'Zastąpiony'},{id:'version',label:'Wersja',value:scenario.scenarioVersion,mono:true},{id:'portfolio',label:'Wersja portfela źródłowego',value:scenario.portfolioScenarioVersion,mono:true}]}/>},relations:{label:'Powiązania',children:<p className="text-sm">Portfel źródłowy</p>},evidence:scenario.assumptions.length?{label:'Źródła i założenia',children:<ul className="list-disc pl-4 text-sm">{scenario.assumptions.map(item=><li key={item}>{item}</li>)}</ul>}:{pominieta:true as const,reason:'Brak zapisanych założeń.'},comments:{pominieta:true as const,reason:'Plan nie ma osobnego wątku komentarzy.'},history:{label:'Historia',children:<div className="text-sm">Wersja {scenario.scenarioVersion}</div>}};
  return <StandardArtifactShell karta="plan" klasa="L" header={{title,onTitleChange:()=>undefined,titleReadOnly:true,artifactType:'document' as any,artifactId:scenario.scenarioId,onSave:()=>undefined,saveState:busy?'saving':'saved',lastSavedLabel:savedLabel??undefined,onClose:onBack,statusLabel:scenario.status==='DRAFT'?'Szkic':scenario.status==='PUBLISHED'?'Opublikowany':'Zastąpiony',statusTone:scenario.status==='PUBLISHED'?'approved':'draft'}} primaryAction={{intentionallyNone:true,reason:'Publikacja jest decyzją w sekcji Decyzje.'}} sections={sections} rightPanel={rightPanel} activeSection={section} onSectionChange={setSection} densityMode="n" onDensityModeChange={()=>undefined} toolbar={<DocumentCardMenu5 sections={sections} activeSection={section} onSectionChange={setSection} readMode={readMode} onReadModeChange={scenario.status==='DRAFT'?setReadMode:undefined} ai={{onAnalizuj:()=>onAnalyze('DEPENDENCIES'),analizaWToku:Boolean(busy),kontekstArtefaktu:{title,status:scenario.status,type:'plan'},moznaEdytowac:scenario.status==='DRAFT'&&!readMode,uzupelnijSekcje:{rodzaj:'wlasnaPropozycja',uruchom:()=>onAnalyze('MIXED'),opis:'Solver przygotuje propozycję dla aktywnej sekcji do przeglądu.'},uzupelnijDokument:{rodzaj:'wlasnaPropozycja',uruchom:()=>setGenerator(true),opis:'Generator przygotuje propozycję całego planu; decyzję podejmiesz w oknie przeglądu.'}}}/>} panelAriaLabel="Szczegóły planu" nakladki={<GeneratorPlanuModal open={generator} plannable={plannable??[]} busy={busy} proposal={proposalRows??null} proposalConflicts={proposalConflicts} savedLabel={savedLabel} onClose={()=>setGenerator(false)} onGenerate={(input)=>onGenerate?onGenerate(input):onAnalyze(input.mode)} onReview={onReview}/>}/>;
}
