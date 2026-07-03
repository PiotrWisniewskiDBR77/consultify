/**
 * WebhookDeliveriesModal - Webhook Delivery History
 *
 * Features:
 * - Delivery history
 * - Request/response viewer
 * - Retry failed deliveries
 */

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code,
  Loader2,
  RefreshCw,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

interface Delivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: string;
  request_headers: string;
  response_status: number;
  response_body: string;
  response_headers: string;
  attempt_count: number;
  duration_ms: number;
  success: number;
  error_message?: string;
  delivered_at: string;
  next_retry_at?: string;
}

interface WebhookDeliveriesModalProps {
  webhookId: string;
  onClose: () => void;
}

export const WebhookDeliveriesModal: React.FC<WebhookDeliveriesModalProps> = ({
  webhookId,
  onClose,
}) => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const result = await Api.get(`/settings/webhooks/${webhookId}/deliveries`);
      setDeliveries(result.deliveries || result || []);
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
    } finally {
      setLoading(false);
    }
  }, [webhookId]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const handleRetry = async (deliveryId: string) => {
    setRetryingIds((prev) => new Set(prev).add(deliveryId));
    try {
      await Api.post(`/settings/webhooks/deliveries/${deliveryId}/retry`, {});
      toast.success('Retry initiated');
      void fetchDeliveries();
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retry delivery';
      toast.error(errorMessage);
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(deliveryId);
        return next;
      });
    }
  };

  const formatJson = (json: string) => {
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  };

  const getStatusIcon = (delivery: Delivery) => {
    if (delivery.success) {
      return <CheckCircle2 size={16} className="text-emerald-400" />;
    }
    if (delivery.next_retry_at) {
      return <Clock size={16} className="text-amber-400" />;
    }
    return <XCircle size={16} className="text-danger-400" />;
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-400';
    if (status >= 400 && status < 500) return 'text-amber-400';
    return 'text-danger-400';
  };

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h3 className="text-lg font-semibold text-white">Delivery History</h3>
            <p className="text-sm text-slate-600 dark:text-slate-500 mt-1">
              Recent webhook deliveries and their status
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDeliveries}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RefreshCw
                size={18}
                className={`text-slate-600 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={18} className="text-slate-600 dark:text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-primary-500" />
            </div>
          ) : deliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600 dark:text-slate-500">
              <Clock size={48} className="mb-4 opacity-50" />
              <p>No deliveries yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="bg-slate-800/50 border border-white/[0.06] rounded-xl overflow-hidden"
                >
                  {/* Delivery Header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/80 transition-colors"
                    onClick={() => setExpandedId(expandedId === delivery.id ? null : delivery.id)}
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIcon(delivery)}
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-white">{delivery.event_type}</span>
                          {delivery.response_status && (
                            <span
                              className={`font-mono text-sm ${getStatusColor(delivery.response_status)}`}
                            >
                              {delivery.response_status}
                            </span>
                          )}
                          {delivery.attempt_count > 1 && (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">
                              Attempt #{delivery.attempt_count}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span>{new Date(delivery.delivered_at).toLocaleString()}</span>
                          <span>{delivery.duration_ms}ms</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!delivery.success && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRetry(delivery.id);
                          }}
                          disabled={retryingIds.has(delivery.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 rounded-lg text-sm transition-colors disabled:opacity-50"
                        >
                          {retryingIds.has(delivery.id) ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <RotateCcw size={14} />
                          )}
                          Retry
                        </button>
                      )}
                      {expandedId === delivery.id ? (
                        <ChevronDown size={18} className="text-slate-600 dark:text-slate-500" />
                      ) : (
                        <ChevronRight size={18} className="text-slate-600 dark:text-slate-500" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedId === delivery.id && (
                    <div className="border-t border-white/[0.06] p-4 space-y-4">
                      {delivery.error_message && (
                        <div className="flex items-start gap-2 p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg">
                          <AlertTriangle size={16} className="text-danger-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-danger-300">{delivery.error_message}</span>
                        </div>
                      )}

                      {/* Request */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Code size={14} className="text-slate-600 dark:text-slate-500" />
                          <span className="text-sm font-medium text-slate-600">
                            Request Payload
                          </span>
                        </div>
                        <pre className="bg-slate-900/50 rounded-lg p-3 text-xs text-slate-600 overflow-x-auto font-mono">
                          {formatJson(delivery.payload)}
                        </pre>
                      </div>

                      {/* Response */}
                      {delivery.response_body && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Code size={14} className="text-slate-600 dark:text-slate-500" />
                            <span className="text-sm font-medium text-slate-600">
                              Response Body
                            </span>
                          </div>
                          <pre className="bg-slate-900/50 rounded-lg p-3 text-xs text-slate-600 overflow-x-auto font-mono max-h-48 overflow-y-auto">
                            {formatJson(delivery.response_body)}
                          </pre>
                        </div>
                      )}

                      {/* Request Headers */}
                      {delivery.request_headers && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Code size={14} className="text-slate-600 dark:text-slate-500" />
                            <span className="text-sm font-medium text-slate-600">
                              Request Headers
                            </span>
                          </div>
                          <pre className="bg-slate-900/50 rounded-lg p-3 text-xs text-slate-600 overflow-x-auto font-mono">
                            {formatJson(delivery.request_headers)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebhookDeliveriesModal;
