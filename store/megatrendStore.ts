// store/megatrendStore.ts
// Zustand store slice for megatrend data
import { create } from 'zustand';
import { MegatrendDetail } from '../components/Megatrend/TrendDetailCard'; // reuse type definition

interface MegatrendState {
    megatrends: MegatrendDetail[];
    loading: boolean;
    error: string | null;
    fetchMegatrends: () => Promise<void>;
    setMegatrends: (data: MegatrendDetail[]) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
}

export const useMegatrendStore = create<MegatrendState>((set) => ({
    megatrends: [],
    loading: false,
    error: null,
    fetchMegatrends: async () => {
        set({ loading: true, error: null });
        try {
            const res = await fetch('/api/megatrends/radar');
            if (!res.ok) throw new Error('Failed to load megatrends');
            const data: MegatrendDetail[] = await res.json();
            set({ megatrends: data, loading: false });
        } catch (e: any) {
            set({ error: e.message, loading: false });
        }
    },
    setMegatrends: (data) => set({ megatrends: data }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
}));
