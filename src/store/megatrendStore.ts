// store/megatrendStore.ts
// Zustand store slice for megatrend data
import { create } from 'zustand';

import { MegatrendDetail } from '../components/Megatrend/TrendDetailCard'; // reuse type definition

/**
 * F3b (DEC-463): set when the backend couldn't find rows for the requested
 * industry and degraded to the 'general' baseline instead of 503ing (see
 * server/src/models/megatrend.ts getBaselineTrends). Lets the UI say "no
 * megatrends for X yet — showing general" instead of silently rendering an
 * unrelated industry's trends, or a scary "not configured" error.
 */
export interface MegatrendFallbackNotice {
  requestedIndustry: string;
  fallbackIndustry: string;
}

interface MegatrendState {
  megatrends: MegatrendDetail[];
  loading: boolean;
  error: string | null;
  fallback: MegatrendFallbackNotice | null;
  fetchMegatrends: (industry?: string) => Promise<void>;
  setMegatrends: (data: MegatrendDetail[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useMegatrendStore = create<MegatrendState>((set) => ({
  megatrends: [],
  loading: false,
  error: null,
  fallback: null,
  // NOTE: 'general' — NOT 'automotive' (F3b, DEC-463). This default only
  // applies if a caller omits `industry` entirely; MegatrendsWorkspace always
  // passes the organization's own industry (or 'general' itself already).
  fetchMegatrends: async (industry = 'general') => {
    set({ loading: true, error: null, fallback: null });
    try {
      // Use relative path to allow Vite proxy to handle the request (avoiding CORS)
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      };

      const res = await fetch(`/api/megatrends/baseline?industry=${encodeURIComponent(industry)}`, {
        headers,
      });

      if (!res.ok) {
        // Surface the backend's friendly message (e.g. the 503 not_configured userMessage)
        // so the UI can render a clean empty/error state instead of a silent failure.
        let userMessage = 'Failed to load megatrends';
        try {
          const body = await res.clone().json();
          if (body?.userMessage) userMessage = String(body.userMessage);
        } catch {
          /* non-JSON body — keep the generic message */
        }
        throw new Error(userMessage);
      }

      let data: any[];
      try {
        data = await res.json();
      } catch (jsonError) {
        // If JSON fails, it might be HTML (404/500 fallback)
        const text = await res.clone().text();
        console.error('[Megatrend] Failed to parse API response:', text.substring(0, 200));
        throw new Error('Invalid API response format (Server restart may be required)');
      }
      // Map backend shape (from MegatrendService) to frontend shape (MegatrendDetail)
      const mappedData: MegatrendDetail[] = data.map((item) => ({
        id: item.id,
        label: item.label,
        shortDescription: item.description,
        type: item.type,
        industryImpact: item.industryImpact || 'Loading insight...',
        companyImpact: item.companyImpact || 'Analyzing...',
        impactScore: item.baseImpactScore,
        likelihood: item.likelihood || 'Medium',
        unavoidability: item.unavoidability || 'High',
        competitivePressure: item.competitivePressure || 'Medium',
        aiSuggestion: {
          ring: item.initialRing,
          risks: [],
          opportunities: [],
          actions: [],
        },
      }));

      // F3b: see server/src/routes/megatrend.routes.ts — a fallback response
      // is still a plain 200 array (backward-compatible body), the marker
      // rides on two response headers instead.
      const fallbackIndustry = res.headers.get('X-Megatrend-Fallback-Industry');
      const fallback: MegatrendFallbackNotice | null = fallbackIndustry
        ? {
            requestedIndustry: res.headers.get('X-Megatrend-Requested-Industry') || industry,
            fallbackIndustry,
          }
        : null;

      set({ megatrends: mappedData, loading: false, fallback });
    } catch (e: any) {
      set({ error: e.message, loading: false, fallback: null });
    }
  },
  setMegatrends: (data) => set({ megatrends: data }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
