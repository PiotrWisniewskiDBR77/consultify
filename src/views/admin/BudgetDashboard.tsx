/**
 * Budget Dashboard - Admin View
 * Organization admins can view their budget status and expenses
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import api from '../../services/api';
import './BudgetDashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface BudgetStatus {
  monthlyBudget: number;
  spent: number;
  remaining: number;
  percentageUsed: number;
  alertThreshold: number;
  exceeded: boolean;
  approachingLimit: boolean;
  periodStart: string;
  periodEnd: string;
}

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  recordedAt: string;
}

export const BudgetDashboard: React.FC = () => {
  const [category, setCategory] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Fetch budget status
  const { data: budgetStatus, isLoading: budgetLoading } = useQuery<BudgetStatus>({
    queryKey: ['budgetStatus'],
    queryFn: async () => {
      const response = await api.get('/api/admin/budget');
      return response.data.budget;
    },
  });

  // Fetch expenses
  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', category, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((page - 1) * pageSize).toString(),
      });
      if (category) params.append('category', category);

      const response = await api.get(`/api/admin/budget/expenses?${params}`);
      return response.data.expenses as Expense[];
    },
  });

  // Calculate category breakdown
  const categoryTotals = expensesData?.reduce(
    (acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    },
    {} as Record<string, number>
  );

  // Prepare chart data
  const lineChartData = {
    labels:
      expensesData
        ?.slice()
        .reverse()
        .map((e) => new Date(e.recordedAt).toLocaleDateString()) || [],
    datasets: [
      {
        label: 'Expenses Over Time',
        data:
          expensesData
            ?.slice()
            .reverse()
            .reduce((acc, expense) => {
              const last = acc.length > 0 ? acc[acc.length - 1] : 0;
              acc.push(last + expense.amount);
              return acc;
            }, [] as number[]) || [],
        borderColor: 'rgb(79, 70, 229)',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const pieChartData = {
    labels: Object.keys(categoryTotals || {}),
    datasets: [
      {
        data: Object.values(categoryTotals || {}),
        backgroundColor: ['#4f46e5', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'],
      },
    ],
  };

  const isApproachingLimit = budgetStatus?.approachingLimit || false;
  const isExceeded = budgetStatus?.exceeded || false;

  return (
    <div className="budget-dashboard">
      <div className="dashboard-header">
        <h1>Budget & Usage</h1>
        <p className="subtitle">Monitor your organization's budget and resource spending</p>
      </div>

      {budgetLoading ? (
        <div className="loading">Loading budget data...</div>
      ) : budgetStatus ? (
        <>
          {/* Budget Overview Cards */}
          <div className="budget-overview">
            <div className="overview-card">
              <div className="card-icon">💰</div>
              <div className="card-content">
                <label>Monthly Budget</label>
                <span className="value">${budgetStatus.monthlyBudget.toFixed(2)}</span>
                <small>
                  Period: {new Date(budgetStatus.periodStart).toLocaleDateString()} -{' '}
                  {new Date(budgetStatus.periodEnd).toLocaleDateString()}
                </small>
              </div>
            </div>

            <div className="overview-card">
              <div className="card-icon">📊</div>
              <div className="card-content">
                <label>Spent</label>
                <span className="value spent">${budgetStatus.spent.toFixed(2)}</span>
                <small>{budgetStatus.percentageUsed.toFixed(1)}% of budget</small>
              </div>
            </div>

            <div className="overview-card">
              <div className="card-icon">💵</div>
              <div className="card-content">
                <label>Remaining</label>
                <span className="value remaining">${budgetStatus.remaining.toFixed(2)}</span>
                <small>Available this period</small>
              </div>
            </div>
          </div>

          {/* Budget Progress Bar */}
          <div className="budget-progress-section">
            <div className="progress-header">
              <h3>Budget Usage</h3>
              {isExceeded && <span className="alert-badge exceeded">Budget Exceeded!</span>}
              {!isExceeded && isApproachingLimit && (
                <span className="alert-badge warning">Approaching Limit</span>
              )}
            </div>

            <div className="progress-bar-container">
              <div className="progress-bar">
                <div
                  className={`progress-fill ${isExceeded ? 'exceeded' : isApproachingLimit ? 'warning' : ''}`}
                  style={{ width: `${Math.min(budgetStatus.percentageUsed, 100)}%` }}
                />
                <div
                  className="threshold-marker"
                  style={{ left: `${budgetStatus.alertThreshold * 100}%` }}
                  title={`Alert threshold: ${(budgetStatus.alertThreshold * 100).toFixed(0)}%`}
                />
              </div>
              <div className="progress-labels">
                <span>0%</span>
                <span className="current-percentage">
                  {budgetStatus.percentageUsed.toFixed(1)}%
                </span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="charts-grid">
            <div className="chart-card">
              <h3>Spending Trend</h3>
              <div className="chart-container">
                <Line
                  data={lineChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: (value) => `$${value}`,
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>

            <div className="chart-card">
              <h3>Spending by Category</h3>
              <div className="chart-container">
                <Pie
                  data={pieChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <p>
            No budget information available. Contact your administrator to set up budget tracking.
          </p>
        </div>
      )}

      {/* Expenses Table */}
      <div className="expenses-section">
        <div className="section-header">
          <h2>Expense History</h2>
          <div className="filters">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="category-filter"
            >
              <option value="">All Categories</option>
              <option value="TOKENS">Tokens</option>
              <option value="STORAGE">Storage</option>
              <option value="COMPUTE">Compute</option>
              <option value="API">API</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        {expensesLoading ? (
          <div className="loading">Loading expenses...</div>
        ) : expensesData && expensesData.length > 0 ? (
          <>
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {expensesData.map((expense) => (
                  <tr key={expense.id}>
                    <td>{new Date(expense.recordedAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`category-badge ${expense.category.toLowerCase()}`}>
                        {expense.category}
                      </span>
                    </td>
                    <td>{expense.description}</td>
                    <td className="amount">${expense.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="pagination">
              <button
                className="btn-secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span className="page-info">Page {page}</span>
              <button
                className="btn-secondary"
                onClick={() => setPage((p) => p + 1)}
                disabled={expensesData.length < pageSize}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p>No expenses recorded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetDashboard;
