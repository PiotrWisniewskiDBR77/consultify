import { Brain, Plus, RefreshCw, Trash2, Weight } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Api } from '../../../services/api';

interface KnowledgeAssignment {
  id: string;
  worker_id: string;
  knowledge_source_type: string;
  knowledge_doc_id: string | null;
  product_slug: string | null;
  priority_weight: number;
  assigned_at: string;
}

interface KnowledgeAssignmentPanelProps {
  workerId: string;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  product_pill: 'Product Pill',
  tool_pack: 'Tool Pack',
  custom: 'Custom',
};

const AVAILABLE_PRODUCTS = [
  { slug: 'consultify', label: 'Consultify', defaultWeight: 1.2 },
  { slug: 'vector', label: 'DBR77 Vector', defaultWeight: 1.0 },
  { slug: 'dbr77', label: 'DBR77 Ecosystem', defaultWeight: 0.8 },
  { slug: 'iris', label: 'IRIS', defaultWeight: 0.6 },
  { slug: 'digital-twin', label: 'Digital Twin', defaultWeight: 0.6 },
  { slug: 'iiot', label: 'IIoT', defaultWeight: 0.6 },
  { slug: 'marketplace', label: 'Marketplace', defaultWeight: 0.6 },
];

export const KnowledgeAssignmentPanel: React.FC<KnowledgeAssignmentPanelProps> = ({ workerId }) => {
  const [assignments, setAssignments] = useState<KnowledgeAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const response = await Api.get(`/api/virtual-workers/${workerId}/knowledge`);
      const list = response?.data?.data ?? response?.data;
      setAssignments(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to fetch knowledge assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [workerId]);

  const handleRemove = async (assignmentId: string) => {
    try {
      await Api.delete(`/api/virtual-workers/${workerId}/knowledge/${assignmentId}`);
      fetchAssignments();
    } catch (err) {
      console.error('Failed to remove assignment:', err);
    }
  };

  const handleBulkAssign = async () => {
    const assignedSlugs = new Set(assignments.map((a) => a.product_slug));
    const newProducts = AVAILABLE_PRODUCTS.filter((p) => !assignedSlugs.has(p.slug));

    if (newProducts.length === 0) return;

    try {
      await Api.post(`/api/virtual-workers/${workerId}/knowledge/bulk`, {
        products: newProducts.map((p) => ({ slug: p.slug, weight: p.defaultWeight })),
      });
      fetchAssignments();
      setShowAdd(false);
    } catch (err) {
      console.error('Failed to bulk assign:', err);
    }
  };

  const handleAddSingle = async (slug: string, weight: number) => {
    try {
      await Api.post(`/api/virtual-workers/${workerId}/knowledge`, {
        knowledge_source_type: 'product_pill',
        product_slug: slug,
        priority_weight: weight,
      });
      fetchAssignments();
    } catch (err) {
      console.error('Failed to add knowledge:', err);
    }
  };

  const handleWeightChange = async (assignmentId: string, newWeight: number) => {
    try {
      await Api.delete(`/api/virtual-workers/${workerId}/knowledge/${assignmentId}`);
      const assignment = assignments.find((a) => a.id === assignmentId);
      if (assignment) {
        await Api.post(`/api/virtual-workers/${workerId}/knowledge`, {
          knowledge_source_type: assignment.knowledge_source_type,
          product_slug: assignment.product_slug,
          knowledge_doc_id: assignment.knowledge_doc_id,
          priority_weight: newWeight,
        });
      }
      fetchAssignments();
    } catch (err) {
      console.error('Failed to update weight:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const assignedSlugs = new Set(assignments.map((a) => a.product_slug));
  const unassignedProducts = AVAILABLE_PRODUCTS.filter((p) => !assignedSlugs.has(p.slug));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Knowledge Assignments
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {assignments.length} knowledge source{assignments.length !== 1 ? 's' : ''} assigned.
            Higher weight = higher priority in retrieval.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unassignedProducts.length > 0 && (
            <button
              onClick={handleBulkAssign}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-medium"
            >
              <Plus size={14} />
              Assign All Products
            </button>
          )}
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors text-xs font-medium"
          >
            <Plus size={14} />
            Add Single
          </button>
        </div>
      </div>

      {showAdd && unassignedProducts.length > 0 && (
        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Available Products
          </h4>
          <div className="flex flex-wrap gap-2">
            {unassignedProducts.map((product) => (
              <button
                key={product.slug}
                onClick={() => handleAddSingle(product.slug, product.defaultWeight)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-navy-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors text-xs font-medium"
              >
                <Brain size={12} />
                {product.label}
                <span className="text-slate-400 dark:text-slate-500 ml-1">
                  w={product.defaultWeight}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {assignments.map((assignment) => (
          <div
            key={assignment.id}
            className="flex items-center justify-between bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl px-5 py-3"
          >
            <div className="flex items-center gap-3">
              <Brain size={16} className="text-indigo-500" />
              <div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {assignment.product_slug || assignment.knowledge_doc_id || 'Unknown'}
                </span>
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                  {SOURCE_TYPE_LABELS[assignment.knowledge_source_type] ||
                    assignment.knowledge_source_type}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Weight size={14} className="text-slate-400" />
                <select
                  value={assignment.priority_weight}
                  onChange={(e) => handleWeightChange(assignment.id, parseFloat(e.target.value))}
                  className="px-2 py-1 border border-slate-300 dark:border-navy-600 rounded bg-white dark:bg-navy-900 text-slate-900 dark:text-white text-xs"
                >
                  {[0.4, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0].map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => handleRemove(assignment.id)}
                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {assignments.length === 0 && (
          <div className="text-center py-12">
            <Brain className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No knowledge assigned yet. Add product pills to train this worker.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
