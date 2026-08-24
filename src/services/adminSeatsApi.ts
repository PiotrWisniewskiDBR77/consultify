import { apiGet, apiPut } from './api/baseClient';

export interface SeatConfiguration { total_seats_available?: number; seats_used?: number; seats_remaining?: number; utilization_percent?: string; auto_add_seats_on_invite?: number; auto_add_seats_threshold?: number }
export interface SeatTransaction { id: string; transaction_type: string; seats_count: number; total_amount?: number; triggered_by_email?: string | null; first_name?: string | null; last_name?: string | null; created_at: string }
export async function getAdminSeats(): Promise<SeatConfiguration> { return (await apiGet<{ config: SeatConfiguration }>('/admin/seats')).config; }
export async function getAdminSeatHistory(limit = 50): Promise<SeatTransaction[]> { return (await apiGet<{ transactions: SeatTransaction[] }>(`/admin/seats/history?limit=${limit}`)).transactions ?? []; }
export async function updateAdminSeatAutoAdd(enabled: boolean, threshold: number): Promise<SeatConfiguration> { return (await apiPut<{ config: SeatConfiguration }>('/admin/seats/auto-add', { enabled, threshold })).config; }
