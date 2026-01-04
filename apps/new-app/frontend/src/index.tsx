/**
 * New Application Fork - Frontend Entry Point
 *
 * This is a skeleton for the new application fork.
 * Use @consultify/shared for common functionality.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
            }}
        >
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚀 New Application</h1>
            <p style={{ fontSize: '1.25rem', opacity: 0.9 }}>Fork of Consultify - Ready for customization</p>
            <div
                style={{
                    marginTop: '2rem',
                    padding: '1rem 2rem',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    backdropFilter: 'blur(10px)',
                }}
            >
                <code>@consultify/shared available</code>
            </div>
        </div>
    );
}

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}

export { App };



