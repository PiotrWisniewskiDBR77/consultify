import { useEffect } from 'react';
import { useAIContext, ScreenContextData } from '../contexts/AIContext';

export const useScreenContext = (
    screenId: string,
    title: string,
    data: any,
    description?: string
) => {
    const { setScreenContext } = useAIContext();

    useEffect(() => {
        const context: ScreenContextData = {
            screenId,
            title,
            data,
            description
        };

        // Set context on mount/update
        setScreenContext(context);

        // Optional: Clear context on unmount? 
        // Usually we want the LAST active context to remain until a new one takes over, 
        // or we can set to null. Setting to null prevents "stale" context if we navigate to a page that DOESN'T use the hook.
        // Let's safe clear it.
        return () => {
            // We only clear if the current context ID matches ours (avoid race conditions if next page mounted first)
            // Limitation: context state is simple value. 
            // For simplicity, we just won't clear it on unmount, expecting the next page to Overwrite it.
            // Or we can leave it. Stale context > No context? 
            // Decision: Leave it for now. Next screen overwrites.
        };
    }, [screenId, title, JSON.stringify(data), description, setScreenContext]);
};
