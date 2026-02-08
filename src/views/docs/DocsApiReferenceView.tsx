/**
 * API Reference View
 *
 * Interactive API documentation portal with OpenAPI spec rendering.
 * Features: Endpoint explorer, code samples, try-it-out functionality.
 *
 * Route: /docs/api
 */

import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  Key,
  Lock,
  Play,
  Search,
  Terminal,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/primitives/Button';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description?: string;
  tag: string;
  operationId: string;
  parameters?: ApiParameter[];
  requestBody?: {
    required: boolean;
    content: Record<string, { schema: unknown; example?: unknown }>;
  };
  responses: Record<string, { description: string; content?: Record<string, unknown> }>;
}

interface ApiParameter {
  name: string;
  in: 'query' | 'path' | 'header';
  description?: string;
  required?: boolean;
  schema: { type: string; enum?: string[]; default?: unknown };
}

interface ApiTag {
  name: string;
  description: string;
  endpoints: ApiEndpoint[];
}

// ============================================
// MOCK DATA - Based on OpenAPI Spec
// ============================================

const API_TAGS: ApiTag[] = [
  {
    name: 'Initiatives',
    description:
      'Manage transformation initiatives - the core building blocks of your digital transformation journey.',
    endpoints: [
      {
        method: 'GET',
        path: '/initiatives',
        summary: 'List initiatives',
        tag: 'Initiatives',
        operationId: 'listInitiatives',
        responses: { '200': { description: 'List of initiatives' } },
      },
      {
        method: 'POST',
        path: '/initiatives',
        summary: 'Create initiative',
        tag: 'Initiatives',
        operationId: 'createInitiative',
        responses: { '201': { description: 'Initiative created' } },
      },
      {
        method: 'GET',
        path: '/initiatives/{id}',
        summary: 'Get initiative',
        tag: 'Initiatives',
        operationId: 'getInitiative',
        responses: { '200': { description: 'Initiative details' } },
      },
      {
        method: 'PUT',
        path: '/initiatives/{id}',
        summary: 'Update initiative',
        tag: 'Initiatives',
        operationId: 'updateInitiative',
        responses: { '200': { description: 'Initiative updated' } },
      },
      {
        method: 'DELETE',
        path: '/initiatives/{id}',
        summary: 'Delete initiative',
        tag: 'Initiatives',
        operationId: 'deleteInitiative',
        responses: { '204': { description: 'Initiative deleted' } },
      },
      {
        method: 'PATCH',
        path: '/initiatives/{id}/status',
        summary: 'Update initiative status',
        tag: 'Initiatives',
        operationId: 'updateInitiativeStatus',
        responses: { '200': { description: 'Status updated' } },
      },
    ],
  },
  {
    name: 'Tasks',
    description:
      'Task management for initiative execution. Tasks can be assigned to team members and tracked through status workflows.',
    endpoints: [
      {
        method: 'GET',
        path: '/tasks',
        summary: 'List tasks',
        tag: 'Tasks',
        operationId: 'listTasks',
        responses: { '200': { description: 'List of tasks' } },
      },
      {
        method: 'POST',
        path: '/tasks',
        summary: 'Create task',
        tag: 'Tasks',
        operationId: 'createTask',
        responses: { '201': { description: 'Task created' } },
      },
      {
        method: 'GET',
        path: '/tasks/{id}',
        summary: 'Get task',
        tag: 'Tasks',
        operationId: 'getTask',
        responses: { '200': { description: 'Task details' } },
      },
      {
        method: 'PUT',
        path: '/tasks/{id}',
        summary: 'Update task',
        tag: 'Tasks',
        operationId: 'updateTask',
        responses: { '200': { description: 'Task updated' } },
      },
      {
        method: 'DELETE',
        path: '/tasks/{id}',
        summary: 'Delete task',
        tag: 'Tasks',
        operationId: 'deleteTask',
        responses: { '204': { description: 'Task deleted' } },
      },
    ],
  },
  {
    name: 'Decisions',
    description:
      'Track and manage decisions throughout the transformation process with approval workflows.',
    endpoints: [
      {
        method: 'GET',
        path: '/decisions',
        summary: 'List decisions',
        tag: 'Decisions',
        operationId: 'listDecisions',
        responses: { '200': { description: 'List of decisions' } },
      },
      {
        method: 'POST',
        path: '/decisions',
        summary: 'Create decision',
        tag: 'Decisions',
        operationId: 'createDecision',
        responses: { '201': { description: 'Decision created' } },
      },
      {
        method: 'POST',
        path: '/decisions/{id}/approve',
        summary: 'Approve decision',
        tag: 'Decisions',
        operationId: 'approveDecision',
        responses: { '200': { description: 'Decision approved' } },
      },
      {
        method: 'POST',
        path: '/decisions/{id}/reject',
        summary: 'Reject decision',
        tag: 'Decisions',
        operationId: 'rejectDecision',
        responses: { '200': { description: 'Decision rejected' } },
      },
    ],
  },
  {
    name: 'Users',
    description: 'User management and profile endpoints.',
    endpoints: [
      {
        method: 'GET',
        path: '/users/me',
        summary: 'Get current user',
        tag: 'Users',
        operationId: 'getCurrentUser',
        responses: { '200': { description: 'User profile' } },
      },
      {
        method: 'GET',
        path: '/users',
        summary: 'List users',
        tag: 'Users',
        operationId: 'listUsers',
        responses: { '200': { description: 'List of users' } },
      },
    ],
  },
  {
    name: 'Webhooks',
    description: 'Configure webhook endpoints to receive real-time notifications.',
    endpoints: [
      {
        method: 'GET',
        path: '/webhooks',
        summary: 'List webhooks',
        tag: 'Webhooks',
        operationId: 'listWebhooks',
        responses: { '200': { description: 'List of webhooks' } },
      },
      {
        method: 'POST',
        path: '/webhooks',
        summary: 'Create webhook',
        tag: 'Webhooks',
        operationId: 'createWebhook',
        responses: { '201': { description: 'Webhook created' } },
      },
      {
        method: 'POST',
        path: '/webhooks/{id}/test',
        summary: 'Test webhook',
        tag: 'Webhooks',
        operationId: 'testWebhook',
        responses: { '200': { description: 'Test event sent' } },
      },
    ],
  },
  {
    name: 'Analytics',
    description: 'Access analytics and reporting data for your transformation initiatives.',
    endpoints: [
      {
        method: 'GET',
        path: '/analytics/dashboard',
        summary: 'Get dashboard metrics',
        tag: 'Analytics',
        operationId: 'getDashboardMetrics',
        responses: { '200': { description: 'Dashboard metrics' } },
      },
      {
        method: 'GET',
        path: '/analytics/initiatives/{id}/insights',
        summary: 'Get initiative insights',
        tag: 'Analytics',
        operationId: 'getInitiativeInsights',
        responses: { '200': { description: 'Initiative insights' } },
      },
    ],
  },
  {
    name: 'AI',
    description: 'AI-powered endpoints for insights, recommendations, and intelligent automation.',
    endpoints: [
      {
        method: 'POST',
        path: '/ai/analyze',
        summary: 'Analyze content with AI',
        tag: 'AI',
        operationId: 'analyzeContent',
        responses: { '200': { description: 'Analysis results' } },
      },
      {
        method: 'POST',
        path: '/ai/recommend',
        summary: 'Get AI recommendations',
        tag: 'AI',
        operationId: 'getRecommendations',
        responses: { '200': { description: 'Recommendations' } },
      },
    ],
  },
];

// ============================================
// HELPER COMPONENTS
// ============================================

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-500/20 text-green-400 border-green-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PUT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  PATCH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={cn(
        'px-2 py-0.5 text-xs font-mono font-semibold rounded border',
        METHOD_COLORS[method] || 'bg-gray-500/20 text-gray-400'
      )}
    >
      {method}
    </span>
  );
}

function CodeBlock({
  code,
  language = 'bash',
  showCopy = true,
}: {
  code: string;
  language?: string;
  showCopy?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 overflow-x-auto">
        <code className="text-sm text-zinc-300 font-mono">{code}</code>
      </pre>
      {showCopy && (
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-2 rounded bg-zinc-800 hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? (
            <Check size={14} className="text-green-400" />
          ) : (
            <Copy size={14} className="text-zinc-400" />
          )}
        </button>
      )}
    </div>
  );
}

function EndpointCard({
  endpoint,
  isExpanded,
  onToggle,
}: {
  endpoint: ApiEndpoint;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const curlExample = `curl -X ${endpoint.method} \\
  "https://api.consultify.app/v1${endpoint.path}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`;

  const jsExample = `const response = await fetch(
  "https://api.consultify.app/v1${endpoint.path}",
  {
    method: "${endpoint.method}",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "Content-Type": "application/json"
    }
  }
);
const data = await response.json();`;

  return (
    <motion.div
      layout
      className="border border-zinc-700/50 rounded-lg overflow-hidden hover:border-zinc-600 transition-colors"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-zinc-800/50 transition-colors"
      >
        <MethodBadge method={endpoint.method} />
        <code className="text-sm text-zinc-200 font-mono flex-1">{endpoint.path}</code>
        <span className="text-sm text-zinc-400 hidden md:block">{endpoint.summary}</span>
        {isExpanded ? (
          <ChevronDown size={16} className="text-zinc-500" />
        ) : (
          <ChevronRight size={16} className="text-zinc-500" />
        )}
      </button>

      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-zinc-700/50 p-4 bg-zinc-800/30"
        >
          <p className="text-zinc-400 text-sm mb-4">{endpoint.description || endpoint.summary}</p>

          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-2 flex items-center gap-2">
                <Terminal size={14} />
                cURL
              </h4>
              <CodeBlock code={curlExample} language="bash" />
            </div>

            <div>
              <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-2 flex items-center gap-2">
                <Code2 size={14} />
                JavaScript
              </h4>
              <CodeBlock code={jsExample} language="javascript" />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button size="sm" variant="outline" className="gap-2">
                <Play size={14} />
                Try it out
              </Button>
              <Button size="sm" variant="ghost" className="gap-2">
                <ExternalLink size={14} />
                Full reference
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DocsApiReferenceView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set());
  const [expandedTags, setExpandedTags] = useState<Set<string>>(
    new Set(API_TAGS.map((t) => t.name))
  );

  const filteredTags = useMemo(() => {
    if (!searchQuery) return API_TAGS;

    const query = searchQuery.toLowerCase();
    return API_TAGS.map((tag) => ({
      ...tag,
      endpoints: tag.endpoints.filter(
        (e) =>
          e.path.toLowerCase().includes(query) ||
          e.summary.toLowerCase().includes(query) ||
          e.method.toLowerCase().includes(query)
      ),
    })).filter((tag) => tag.endpoints.length > 0);
  }, [searchQuery]);

  const toggleEndpoint = (operationId: string) => {
    setExpandedEndpoints((prev) => {
      const next = new Set(prev);
      if (next.has(operationId)) {
        next.delete(operationId);
      } else {
        next.add(operationId);
      }
      return next;
    });
  };

  const toggleTag = (tagName: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagName)) {
        next.delete(tagName);
      } else {
        next.add(tagName);
      }
      return next;
    });
  };

  const totalEndpoints = API_TAGS.reduce((sum, tag) => sum + tag.endpoints.length, 0);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-blue-900/20 to-zinc-950 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Code2 className="text-blue-400" size={32} />
              <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                v1.0.0
              </span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">API Reference</h1>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-8">
              Complete REST API documentation for the Consultify platform. Build integrations and
              automate your transformation workflows.
            </p>

            {/* Quick Stats */}
            <div className="flex items-center justify-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-zinc-400">{totalEndpoints} Endpoints</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-zinc-500" />
                <span className="text-zinc-400">JWT Authentication</span>
              </div>
              <div className="flex items-center gap-2">
                <Key size={14} className="text-zinc-500" />
                <span className="text-zinc-400">API Keys Supported</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Search & Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Search Bar */}
        <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-sm pb-4 mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search endpoints... (e.g., GET /initiatives)"
              className="pl-12 h-12 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>
        </div>

        {/* Quick Start */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8"
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BookOpen size={20} className="text-blue-400" />
            Quick Start
          </h2>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div className="p-4 bg-zinc-800/50 rounded-lg">
              <div className="text-2xl font-bold text-white mb-1">1</div>
              <p className="text-sm text-zinc-400">Generate an API key in Settings → API Keys</p>
            </div>
            <div className="p-4 bg-zinc-800/50 rounded-lg">
              <div className="text-2xl font-bold text-white mb-1">2</div>
              <p className="text-sm text-zinc-400">Include the key in the Authorization header</p>
            </div>
            <div className="p-4 bg-zinc-800/50 rounded-lg">
              <div className="text-2xl font-bold text-white mb-1">3</div>
              <p className="text-sm text-zinc-400">Make requests to api.consultify.app/v1</p>
            </div>
          </div>
          <CodeBlock
            code={`curl -X GET "https://api.consultify.app/v1/initiatives" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
          />
        </motion.div>

        {/* API Tags & Endpoints */}
        <div className="space-y-6">
          {filteredTags.map((tag, index) => (
            <motion.div
              key={tag.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + index * 0.05 }}
            >
              <button
                onClick={() => toggleTag(tag.name)}
                className="w-full flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:bg-zinc-800/50 transition-colors mb-3"
              >
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-white">{tag.name}</h3>
                  <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                    {tag.endpoints.length} endpoints
                  </span>
                </div>
                {expandedTags.has(tag.name) ? (
                  <ChevronDown size={20} className="text-zinc-500" />
                ) : (
                  <ChevronRight size={20} className="text-zinc-500" />
                )}
              </button>

              {expandedTags.has(tag.name) && (
                <div className="space-y-2 pl-4">
                  <p className="text-sm text-zinc-500 mb-3">{tag.description}</p>
                  {tag.endpoints.map((endpoint) => (
                    <EndpointCard
                      key={endpoint.operationId}
                      endpoint={endpoint}
                      isExpanded={expandedEndpoints.has(endpoint.operationId)}
                      onToggle={() => toggleEndpoint(endpoint.operationId)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Rate Limits Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6"
        >
          <h2 className="text-lg font-semibold text-white mb-4">Rate Limits</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="pb-2">Plan</th>
                  <th className="pb-2">Requests/min</th>
                  <th className="pb-2">Requests/day</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr className="border-b border-zinc-800/50">
                  <td className="py-3">Free</td>
                  <td>60</td>
                  <td>1,000</td>
                </tr>
                <tr className="border-b border-zinc-800/50">
                  <td className="py-3">Professional</td>
                  <td>300</td>
                  <td>10,000</td>
                </tr>
                <tr>
                  <td className="py-3">Enterprise</td>
                  <td>1,000+</td>
                  <td>Unlimited</td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Footer CTA */}
        <div className="mt-12 text-center">
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ArrowRight size={16} />
            Back to Documentation Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default DocsApiReferenceView;
