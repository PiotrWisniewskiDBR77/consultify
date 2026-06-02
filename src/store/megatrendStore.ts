// store/megatrendStore.ts
// Zustand store slice for megatrend data
import { create } from 'zustand';

import { MegatrendDetail } from '../components/Megatrend/TrendDetailCard'; // reuse type definition

interface MegatrendState {
  megatrends: MegatrendDetail[];
  loading: boolean;
  error: string | null;
  fetchMegatrends: (industry?: string) => Promise<void>;
  setMegatrends: (data: MegatrendDetail[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useMegatrendStore = create<MegatrendState>((set) => ({
  megatrends: [],
  loading: false,
  error: null,
  fetchMegatrends: async (industry = 'automotive') => {
    set({ loading: true, error: null });
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
      set({ megatrends: mappedData, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },
  setMegatrends: (data) => set({ megatrends: data }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
