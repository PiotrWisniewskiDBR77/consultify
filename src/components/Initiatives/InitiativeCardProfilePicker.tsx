import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Api } from '@/services/api';
import { INITIATIVE_CARD_REGISTRY, type InitiativeCardKey } from '@/contracts/initiatives-execution/cardRegistry';

type ProfilePreview = {
  initiativeVersion: number;
  profile: { templateId: string; version: number; contentHash: string; profileKey: string;
    cards: Array<{cardKey: string; included: boolean; position: number; requiredness: 'REQUIRED' | 'OPTIONAL'; requiredFields: string[]; reviewRequired: boolean}> };
  impact: { newlyRequired: string[]; omitted: string[]; preservedContent: Array<{cardKey: string; cardVersion: number}>; unresolvedReviews: string[]; waiverRequired: string[] };
};
/** The existing template API provides configured profiles; the browser never invents requirements. */
export function InitiativeCardProfilePicker({ initiativeId, canEdit, onChanged }: {
  initiativeId: string; canEdit: boolean; onChanged: () => Promise<void>;
}) {
  const { i18n } = useTranslation(); const pl = i18n.language.startsWith('pl');
  const [templates,setTemplates] = useState<Array<{id:string;name:string}>>([]);
  const [selected,setSelected] = useState(''); const [preview,setPreview] = useState<ProfilePreview|null>(null);
  const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  const requestId = useRef(''); const active = useRef(true);
  useEffect(()=>{ active.current=true; void Api.get('/initiatives/templates').then((result:{templates?:Array<{id:string;name:string;sectionConfig?:Record<string,unknown>}>})=>{
    if(active.current)setTemplates((result.templates||[]).filter(template=>Boolean(template.sectionConfig?.initiativeCardProfile)));
  }).catch((e:Error)=>active.current&&setError(e.message));return()=>{active.current=false;};},[initiativeId]);
  const act=async(apply:boolean)=>{
    if(busy||!canEdit)return;setBusy(true);setError('');
    try {
      if(apply && preview){
        await Api.post(`/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/card-selection`,{
          expectedVersion:preview.initiativeVersion,clientRequestId:requestId.current,registryVersion:1,
          profile:{templateId:preview.profile.templateId,version:preview.profile.version,contentHash:preview.profile.contentHash},
          cards:preview.profile.cards.map(card=>({cardKey:card.cardKey,included:card.included,position:card.position,requiredness:card.requiredness,waiverDecisionId:null}))
        });
        if(!active.current)return;await onChanged();if(active.current)setPreview(null);
      } else {
        const value:ProfilePreview=await Api.get(`/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}/card-profile-preview?templateId=${encodeURIComponent(selected)}`);
        if(!active.current)return;requestId.current=crypto.randomUUID();setPreview(value);
      }
    }catch(e){if(active.current)setError(e instanceof Error?e.message:String(e));}finally{if(active.current)setBusy(false);}
  };
  const label=(key:string)=>INITIATIVE_CARD_REGISTRY[key as InitiativeCardKey]?.label||key;
  return <details className="space-y-3 border border-c-border rounded p-3">
    <summary>{pl?'Profil kart i wpływ zmiany':'Card profile and change impact'}</summary>
    {error&&<p role="alert">{error}</p>}
    {!templates.length&&<p>{pl?'Brak skonfigurowanych profili kart w dostępnych szablonach. Wymagana jest konfiguracja szablonu przez administratora projektu.':'No configured card profiles are available in the accessible templates. A project administrator must configure a template.'}</p>}
    <label>{pl?'Szablon profilu':'Profile template'}<select aria-label={pl?'Szablon profilu':'Profile template'} className="block bg-c-bg border border-c-border p-2" value={selected} disabled={!canEdit||busy} onChange={e=>{setSelected(e.target.value);setPreview(null);}}><option value="">{pl?'Wybierz szablon':'Select a template'}</option>{templates.map(template=><option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
    {canEdit&&<button disabled={busy||!selected} onClick={()=>void act(false)}>{pl?'Sprawdź wpływ profilu':'Preview profile impact'}</button>}
    {preview&&<div className="space-y-2">
      <p>{preview.profile.profileKey} · {pl?'wersja':'version'} {preview.profile.version}</p>
      <p>{pl?'Nowo wymagane karty':'Newly required cards'}: {preview.impact.newlyRequired.map(label).join(', ')||'—'}</p>
      <p>{pl?'Pominięte karty':'Omitted cards'}: {preview.impact.omitted.map(label).join(', ')||'—'}</p>
      <p>{pl?'Zachowane wersje treści':'Preserved content versions'}: {preview.impact.preservedContent.map(card=>`${label(card.cardKey)} v${card.cardVersion}`).join(', ')||'—'}</p>
      <p>{pl?'Nierozstrzygnięte przeglądy':'Unresolved reviews'}: {preview.impact.unresolvedReviews.map(label).join(', ')||'—'}</p>
      <p>{pl?'Po zmianie gotowość zostanie oceniona ponownie.':'Readiness must be evaluated again after this change.'}</p>
      {preview.impact.waiverRequired.length>0?<p role="alert">{pl?'Zmiana wymaga zweryfikowanego odstępstwa. Nie można jej zastosować.':'This change requires a verified waiver and cannot be applied.'}</p>:canEdit&&<button disabled={busy} onClick={()=>void act(true)}>{pl?'Zastosuj profil':'Apply profile'}</button>}
    </div>}
  </details>;
}
