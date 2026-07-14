/**
 * CapacityForecast - 7-day lookahead with predicted bottlenecks
 * BCG/McKinsey style: Predictive, actionable, visual hierarchy
 */

import { motion } from 'framer-motion';
import { AlertTriangle, Calendar, Clock, TrendingDown, TrendingUp, Users, Zap } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface DayForecast {
  date: Date;
  dayLabel: string;
  capacity: number; // 0-150+ percentage
  plannedTasks: number;
  estimatedHours: number;
  riskLevel: 'low' | 'medium' | 'high';
  bottlenecks: string[];
}

interface CapacityForecastProps {
  forecasts?: DayForecast[];
  loading?: boolean;
  onDayClick?: (date: Date) => void;
}

// Day cell in the forecast
const ForecastDay: React.FC<{
  forecast: DayForecast;
  isToday: boolean;
  onClick?: () => void;
}> = ({ forecast, isToday, onClick }) => {
  const { t } = useTranslation();

  const getCapacityColor = (capacity: number) => {
    if (capacity > 100) return 'bg-danger-500';
    if (capacity > 85) return 'bg-amber-500';
    if (capacity > 60) return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  const getCapacityBgColor = (capacity: number) => {
    if (capacity > 100)
      return 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-500/30';
    if (capacity > 85)
      return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30';
    return 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className={`
                relative p-3 rounded-xl border cursor-pointer transition-all
                ${getCapacityBgColor(forecast.capacity)}
                ${isToday ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-navy-950' : ''}
            `}
    >
      {/* Day Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p
            className={`text-xs font-bold uppercase tracking-wider ${
              isToday
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {forecast.dayLabel}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500">
            {forecast.date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
          </p>
        </div>
        {forecast.riskLevel !== 'low' && (
          <AlertTriangle
            size={14}
            className={
              forecast.riskLevel === 'high' ? 'text-danger-500 animate-pulse' : 'text-amber-500'
            }
          />
        )}
      </div>

      {/* Capacity Bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500 dark:text-slate-400">
            {t('team.forecast.capacity', 'Capacity')}
          </span>
          <span
            className={`font-bold ${
              forecast.capacity > 100
                ? 'text-danger-600 dark:text-danger-400'
                : forecast.capacity > 85
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-navy-900 dark:text-white'
            }`}
          >
            {forecast.capacity}%
          </span>
        </div>
        <div className="h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(forecast.capacity, 100)}%` }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={`h-full ${getCapacityColor(forecast.capacity)} rounded-full`}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <Clock size={10} className="text-slate-500 dark:text-slate-400 dark:text-slate-500" />
          <span className="text-slate-600 dark:text-slate-400">{forecast.estimatedHours}h</span>
        </div>
        <div className="flex items-center gap-1">
          <Zap size={10} className="text-slate-500 dark:text-slate-400 dark:text-slate-500" />
          <span className="text-slate-600 dark:text-slate-400">
            {forecast.plannedTasks} {t('team.forecast.tasks', 'tasks')}
          </span>
        </div>
      </div>

      {/* Bottleneck indicator */}
      {forecast.bottlenecks.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-navy-700">
          <p className="text-[10px] text-danger-600 dark:text-danger-400 font-medium truncate">
            {forecast.bottlenecks[0]}
          </p>
        </div>
      )}

      {/* Today indicator */}
      {isToday && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-navy-900 rounded-full border-2 border-white dark:border-navy-950" />
      )}
    </motion.div>
  );
};

export const CapacityForecast: React.FC<CapacityForecastProps> = ({
  forecasts = [],
  loading = false,
  onDayClick,
}) => {
  const { t } = useTranslation();

  const displayForecasts: DayForecast[] = forecasts;

  const today = new Date().toDateString();

  // Calculate summary stats
  const avgCapacity =
    displayForecasts.length > 0
      ? Math.round(
          displayForecasts.reduce((sum, f) => sum + f.capacity, 0) / displayForecasts.length
        )
      : 0;
  const peakDay =
    displayForecasts.length > 0
      ? displayForecasts.reduce(
          (max, f) => (f.capacity > max.capacity ? f : max),
          displayForecasts[0]
        )
      : null;
  const riskDays = displayForecasts.filter((f) => f.riskLevel !== 'low').length;

  if (loading) {
    return (
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4 animate-pulse">
        <div className="h-6 w-40 bg-slate-200 dark:bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-7 gap-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-100 dark:bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Calendar size={20} className="text-slate-900 dark:text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                {t('team.forecast.title', 'Capacity Forecast')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('team.forecast.subtitle', '7-day lookahead with predictions')}
              </p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('team.forecast.avgCapacity', 'Avg')}
              </p>
              <p
                className={`text-lg font-bold ${
                  avgCapacity > 90 ? 'text-amber-500' : 'text-navy-900 dark:text-white'
                }`}
              >
                {avgCapacity}%
              </p>
            </div>
            {riskDays > 0 && (
              <div className="px-3 py-1.5 rounded-lg bg-danger-100 dark:bg-danger-900/30">
                <div className="flex items-center gap-1.5 text-danger-700 dark:text-danger-300">
                  <AlertTriangle size={14} />
                  <span className="text-sm font-bold">{riskDays}</span>
                  <span className="text-xs">{t('team.forecast.riskDays', 'risk days')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Forecast Grid */}
      <div className="p-4">
        {displayForecasts.length > 0 ? (
          <div className="grid grid-cols-7 gap-2">
            {displayForecasts.map((forecast, idx) => (
              <ForecastDay
                key={idx}
                forecast={forecast}
                isToday={forecast.date.toDateString() === today}
                onClick={() => onDayClick?.(forecast.date)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400 dark:text-slate-500">
            <Calendar size={32} className="mx-auto mb-2 text-slate-700 dark:text-slate-400" />
            <p className="text-sm">{t('team.forecast.noData', 'No capacity data available')}</p>
          </div>
        )}
      </div>

      {/* Peak Alert */}
      {peakDay && peakDay.capacity > 85 && (
        <div className="px-5 py-3 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-500/20">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {t('team.forecast.peakAlert', 'Peak capacity on')} {peakDay.dayLabel} (
                {peakDay.capacity}%)
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-300">
                {t(
                  'team.forecast.peakAdvice',
                  'Consider redistributing tasks or adjusting deadlines'
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default CapacityForecast;
