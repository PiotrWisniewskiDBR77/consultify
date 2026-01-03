/**
 * useRealtimeCosts Hook
 * 
 * Provides real-time cost tracking via WebSocket connection.
 * Updates cost data live as AI requests are processed.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface CostUpdate {
    type: 'cost_update';
    userId: string;
    organizationId: string;
    data: {
        requestId: string;
        model: string;
        tokensUsed: number;
        cost: number;
        capability: string;
        tier: string;
        timestamp: string;
    };
}

interface CostSummary {
    totalCostToday: number;
    totalCostThisMonth: number;
    totalRequestsToday: number;
    totalRequestsThisMonth: number;
    totalTokensToday: number;
    totalTokensThisMonth: number;
    lastUpdate: string;
    recentRequests: CostUpdate['data'][];
}

interface UseRealtimeCostsOptions {
    enabled?: boolean;
    maxRecentRequests?: number;
    onCostUpdate?: (update: CostUpdate['data']) => void;
    onBudgetAlert?: (percentage: number) => void;
    budgetLimit?: number;
}

export function useRealtimeCosts(options: UseRealtimeCostsOptions = {}) {
    const {
        enabled = true,
        maxRecentRequests = 10,
        onCostUpdate,
        onBudgetAlert,
        budgetLimit
    } = options;

    const [connected, setConnected] = useState(false);
    const [summary, setSummary] = useState<CostSummary>({
        totalCostToday: 0,
        totalCostThisMonth: 0,
        totalRequestsToday: 0,
        totalRequestsThisMonth: 0,
        totalTokensToday: 0,
        totalTokensThisMonth: 0,
        lastUpdate: new Date().toISOString(),
        recentRequests: []
    });
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    const connect = useCallback(() => {
        if (!enabled) return;

        const token = localStorage.getItem('token');
        if (!token) {
            setError('No authentication token');
            return;
        }

        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
            
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[RealtimeCosts] WebSocket connected');
                setConnected(true);
                setError(null);
                reconnectAttempts.current = 0;

                // Subscribe to cost updates
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    payload: { channel: 'cost_updates' }
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    
                    if (message.type === 'cost_update') {
                        handleCostUpdate(message.data);
                    } else if (message.type === 'cost_summary') {
                        // Initial summary on connect
                        setSummary(prev => ({
                            ...prev,
                            ...message.data,
                            lastUpdate: new Date().toISOString()
                        }));
                    } else if (message.type === 'budget_alert') {
                        if (onBudgetAlert) {
                            onBudgetAlert(message.data.percentage);
                        }
                    }
                } catch (e) {
                    console.error('[RealtimeCosts] Failed to parse message:', e);
                }
            };

            ws.onclose = () => {
                console.log('[RealtimeCosts] WebSocket closed');
                setConnected(false);
                
                // Attempt reconnection
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts.current++;
                        connect();
                    }, delay);
                }
            };

            ws.onerror = (err) => {
                console.error('[RealtimeCosts] WebSocket error:', err);
                setError('Connection error');
            };
        } catch (e) {
            console.error('[RealtimeCosts] Failed to create WebSocket:', e);
            setError('Failed to connect');
        }
    }, [enabled, onBudgetAlert]);

    const handleCostUpdate = useCallback((data: CostUpdate['data']) => {
        setSummary(prev => {
            const now = new Date();
            const requestDate = new Date(data.timestamp);
            const isToday = requestDate.toDateString() === now.toDateString();
            const isThisMonth = requestDate.getMonth() === now.getMonth() && 
                               requestDate.getFullYear() === now.getFullYear();

            const newSummary: CostSummary = {
                ...prev,
                totalCostThisMonth: prev.totalCostThisMonth + data.cost,
                totalRequestsThisMonth: prev.totalRequestsThisMonth + 1,
                totalTokensThisMonth: prev.totalTokensThisMonth + data.tokensUsed,
                lastUpdate: new Date().toISOString(),
                recentRequests: [data, ...prev.recentRequests].slice(0, maxRecentRequests)
            };

            if (isToday) {
                newSummary.totalCostToday = prev.totalCostToday + data.cost;
                newSummary.totalRequestsToday = prev.totalRequestsToday + 1;
                newSummary.totalTokensToday = prev.totalTokensToday + data.tokensUsed;
            }

            // Check budget alert
            if (budgetLimit && onBudgetAlert) {
                const percentage = (newSummary.totalCostThisMonth / budgetLimit) * 100;
                if (percentage >= 70 && prev.totalCostThisMonth / budgetLimit * 100 < 70) {
                    onBudgetAlert(70);
                } else if (percentage >= 85 && prev.totalCostThisMonth / budgetLimit * 100 < 85) {
                    onBudgetAlert(85);
                } else if (percentage >= 95 && prev.totalCostThisMonth / budgetLimit * 100 < 95) {
                    onBudgetAlert(95);
                }
            }

            return newSummary;
        });

        // Call external handler
        if (onCostUpdate) {
            onCostUpdate(data);
        }
    }, [maxRecentRequests, budgetLimit, onBudgetAlert, onCostUpdate]);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        setConnected(false);
    }, []);

    const refresh = useCallback(async () => {
        // Fetch latest summary from API as fallback
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/ai-settings/user/costs?period=30d', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                setSummary(prev => ({
                    ...prev,
                    totalCostThisMonth: data.totalCost || prev.totalCostThisMonth,
                    totalRequestsThisMonth: data.totalRequests || prev.totalRequestsThisMonth,
                    totalTokensThisMonth: data.totalTokens || prev.totalTokensThisMonth,
                    lastUpdate: new Date().toISOString()
                }));
            }
        } catch (e) {
            console.error('[RealtimeCosts] Failed to refresh:', e);
        }
    }, []);

    // Connect on mount
    useEffect(() => {
        if (enabled) {
            connect();
            refresh(); // Initial data fetch
        }

        return () => {
            disconnect();
        };
    }, [enabled, connect, disconnect, refresh]);

    return {
        connected,
        summary,
        error,
        refresh,
        disconnect,
        reconnect: connect
    };
}

// Organization-level hook for admins
export function useRealtimeOrgCosts(organizationId: string, options: UseRealtimeCostsOptions = {}) {
    const {
        enabled = true,
        maxRecentRequests = 20,
        onCostUpdate,
        onBudgetAlert,
        budgetLimit
    } = options;

    const [connected, setConnected] = useState(false);
    const [orgSummary, setOrgSummary] = useState<{
        totalCost: number;
        byUser: Record<string, { cost: number; requests: number; tokens: number }>;
        byTier: Record<string, { cost: number; requests: number }>;
        recentActivity: CostUpdate['data'][];
        lastUpdate: string;
    }>({
        totalCost: 0,
        byUser: {},
        byTier: {},
        recentActivity: [],
        lastUpdate: new Date().toISOString()
    });

    const wsRef = useRef<WebSocket | null>(null);

    const connect = useCallback(() => {
        if (!enabled || !organizationId) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
            
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setConnected(true);
                // Subscribe to org-level cost updates
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    payload: { channel: 'org_cost_updates', organizationId }
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    
                    if (message.type === 'org_cost_update') {
                        const data = message.data;
                        
                        setOrgSummary(prev => ({
                            totalCost: prev.totalCost + data.cost,
                            byUser: {
                                ...prev.byUser,
                                [data.userId]: {
                                    cost: (prev.byUser[data.userId]?.cost || 0) + data.cost,
                                    requests: (prev.byUser[data.userId]?.requests || 0) + 1,
                                    tokens: (prev.byUser[data.userId]?.tokens || 0) + data.tokensUsed
                                }
                            },
                            byTier: {
                                ...prev.byTier,
                                [data.tier]: {
                                    cost: (prev.byTier[data.tier]?.cost || 0) + data.cost,
                                    requests: (prev.byTier[data.tier]?.requests || 0) + 1
                                }
                            },
                            recentActivity: [data, ...prev.recentActivity].slice(0, maxRecentRequests),
                            lastUpdate: new Date().toISOString()
                        }));

                        if (onCostUpdate) {
                            onCostUpdate(data);
                        }

                        // Budget alert check
                        if (budgetLimit && onBudgetAlert) {
                            const newTotal = orgSummary.totalCost + data.cost;
                            const percentage = (newTotal / budgetLimit) * 100;
                            if (percentage >= 95 && (orgSummary.totalCost / budgetLimit) * 100 < 95) {
                                onBudgetAlert(95);
                            }
                        }
                    }
                } catch (e) {
                    console.error('[RealtimeOrgCosts] Parse error:', e);
                }
            };

            ws.onclose = () => setConnected(false);
        } catch (e) {
            console.error('[RealtimeOrgCosts] Connection error:', e);
        }
    }, [enabled, organizationId, maxRecentRequests, onCostUpdate, onBudgetAlert, budgetLimit, orgSummary.totalCost]);

    useEffect(() => {
        if (enabled) connect();
        return () => {
            if (wsRef.current) wsRef.current.close();
        };
    }, [enabled, connect]);

    return {
        connected,
        orgSummary,
        refresh: connect
    };
}

export default useRealtimeCosts;





