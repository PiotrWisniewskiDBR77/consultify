import { useState, useEffect } from 'react';

/**
 * Hook to generate a simple device fingerprint
 * In a real application, you might use a library like @fingerprintjs/fingerprintjs
 */
export const useDeviceFingerprint = () => {
    const [fingerprint, setFingerprint] = useState<string>('');

    useEffect(() => {
        const generateFingerprint = async () => {
            // Collect available entropy
            const components = [
                navigator.userAgent,
                navigator.language,
                new Date().getTimezoneOffset(),
                screen.width + 'x' + screen.height,
                screen.colorDepth,
                // @ts-ignore
                navigator.hardwareConcurrency,
                // @ts-ignore
                navigator.deviceMemory,
            ];

            // Create a simple hash
            const str = components.join('|');
            const msgBuffer = new TextEncoder().encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            setFingerprint(hashHex);
        };

        generateFingerprint();
    }, []);

    return fingerprint;
};
