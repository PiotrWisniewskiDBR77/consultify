import { apiGet } from './api/baseClient';
export interface Slo { id:string; slo_name:string; target_percentage:number; window_days:number; current_percentage?:number|null; budget_remaining?:number|null }
export async function getTenantSlos():Promise<Slo[]>{return (await apiGet<{slos:Slo[]}>('/enterprise-v4/slos')).slos??[];}
export async function getAiSlaStatus():Promise<Record<string,unknown>>{return apiGet<Record<string,unknown>>('/ai-operations/sla/status');}
