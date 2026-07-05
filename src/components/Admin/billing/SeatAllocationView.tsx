/**
 * SeatAllocationView - Seat allocation dashboard component
 *
 * Features:
 * - Overview cards: "13/17 Core Seats", "4 seats left"
 * - Progress bars for seat usage
 * - "Add seats" link
 * - User list filtered by seat type
 * - Unassigned seats section
 *
 * Design: Dashboard with cards and progress indicators
 */

import {
  AlertCircle,
  ArrowUpRight,
  Check,
  ChevronRight,
  CreditCard,
  HelpCircle,
  Plus,
  Search,
  TrendingUp,
  User,
  Users,
  UserX,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Avatar } from '../../ui/primitives/Avatar';
import { Button } from '../../ui/primitives/Button';
import { Progress } from '../../ui/primitives/Progress';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Seat type definition
export interface SeatType {
  id: string;
  name: string;
  type: 'view-only' | 'core' | 'developer' | 'sales-pro' | 'custom';
  priceMonthly: number;
  totalSeats: number;
  usedSeats: number;
  features: string[];
  color: string;
}

// User with seat assignment
export interface UserSeat {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  seatTypeId?: string;
  assignedAt?: string;
  lastActive?: string;
}

interface SeatAllocationViewProps {
  seatTypes: SeatType[];
  users: UserSeat[];
  onAddSeats?: (seatTypeId: string) => void;
  onAssignSeat?: (userId: string, seatTypeId: string) => void;
  onRemoveSeat?: (userId: string) => void;
  onManageSeats?: () => void;
  className?: string;
}

export const SeatAllocationView: React.FC<SeatAllocationViewProps> = ({
  seatTypes,
  users,
  onAddSeats,
  onAssignSeat,
  onRemoveSeat,
  onManageSeats,
  className,
}) => {
  const { t } = useTranslation();
  const [selectedSeatType, setSelectedSeatType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate totals
  const totals = useMemo(() => {
    const totalSeats = seatTypes.reduce((sum, st) => sum + st.totalSeats, 0);
    const usedSeats = seatTypes.reduce((sum, st) => sum + st.usedSeats, 0);
    const totalCost = seatTypes.reduce((sum, st) => sum + st.priceMonthly * st.usedSeats, 0);

    return { totalSeats, usedSeats, availableSeats: totalSeats - usedSeats, totalCost };
  }, [seatTypes]);

  // Get users for a seat type
  const getUsersForSeatType = useCallback(
    (seatTypeId: string) => {
      return users.filter((u) => u.seatTypeId === seatTypeId);
    },
    [users]
  );

  // Get unassigned users
  const unassignedUsers = useMemo(() => {
    return users.filter((u) => !u.seatTypeId);
  }, [users]);

  // Filter users by search
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.firstName.toLowerCase().includes(query) ||
        u.lastName.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  // Get seat type color classes
  const getSeatTypeColor = (type: SeatType['type']) => {
    switch (type) {
      case 'view-only':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      case 'core':
        return 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300';
      case 'developer':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'sales-pro':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
      default:
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Seats */}
        <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.billing.seats.totalSeats', 'Total Seats')}
            </span>
            <Users size={16} className="text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-navy-900 dark:text-white">
            {totals.usedSeats}/{totals.totalSeats}
          </p>
          <Progress
            value={(totals.usedSeats / totals.totalSeats) * 100}
            size="sm"
            color="primary"
            className="mt-2"
          />
        </div>

        {/* Available Seats */}
        <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.billing.seats.available', 'Available')}
            </span>
            <User size={16} className="text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {totals.availableSeats}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('admin.billing.seats.seatsLeft', 'seats left')}
          </p>
        </div>

        {/* Monthly Cost */}
        <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.billing.seats.monthlyCost', 'Monthly Cost')}
            </span>
            <CreditCard size={16} className="text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-navy-900 dark:text-white">
            ${totals.totalCost.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('admin.billing.seats.forActiveSeats', 'for active seats')}
          </p>
        </div>

        {/* Quick Action */}
        <div className="p-4 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-primary-100">
              {t('admin.billing.seats.needMore', 'Need more seats?')}
            </span>
            <ArrowUpRight size={16} className="text-primary-100" />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onManageSeats}
            className="mt-2 bg-white/20 text-c-text hover:bg-white/30 border-0"
          >
            <Plus size={14} />
            {t('admin.billing.seats.addSeats', 'Add Seats')}
          </Button>
        </div>
      </div>

      {/* Seat Types Breakdown */}
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            {t('admin.billing.seats.seatTypes', 'Seat Types')}
            <Tooltip
              content={t(
                'admin.billing.seats.seatTypesTooltip',
                'Different seat types have different capabilities and pricing'
              )}
            >
              <HelpCircle size={16} className="text-slate-400 dark:text-slate-500" />
            </Tooltip>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {seatTypes.map((seatType) => {
            const usagePercent = (seatType.usedSeats / seatType.totalSeats) * 100;
            const isSelected = selectedSeatType === seatType.id;
            const isNearLimit = usagePercent >= 90;

            return (
              <button
                key={seatType.id}
                onClick={() => setSelectedSeatType(isSelected ? null : seatType.id)}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all',
                  isSelected
                    ? 'border-primary-500 ring-2 ring-primary-500/20'
                    : 'border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-700'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={cn(
                      'px-2 py-1 text-xs font-medium rounded-full',
                      getSeatTypeColor(seatType.type)
                    )}
                  >
                    {seatType.name}
                  </span>
                  {isNearLimit && (
                    <Tooltip content={t('admin.billing.seats.nearLimit', 'Running low on seats')}>
                      <AlertCircle size={16} className="text-amber-500" />
                    </Tooltip>
                  )}
                </div>

                <div className="mb-2">
                  <span className="text-2xl font-bold text-navy-900 dark:text-white">
                    {seatType.usedSeats}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">/{seatType.totalSeats}</span>
                </div>

                <Progress
                  value={usagePercent}
                  size="sm"
                  color={isNearLimit ? 'danger' : 'primary'}
                />

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  ${seatType.priceMonthly}/seat/month
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Seat Type Users */}
      {selectedSeatType && (
        <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
              {seatTypes.find((st) => st.id === selectedSeatType)?.name}{' '}
              {t('admin.billing.seats.users', 'Users')}
            </h3>
            {onAddSeats && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddSeats(selectedSeatType)}
                icon={<Plus size={14} />}
              >
                {t('admin.billing.seats.addMore', 'Add more')}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {getUsersForSeatType(selectedSeatType).map((user) => (
              <div
                key={user.userId}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-900 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    name={`${user.firstName} ${user.lastName}`}
                    src={user.avatarUrl}
                    size="sm"
                  />
                  <div>
                    <p className="font-medium text-navy-900 dark:text-white">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                  </div>
                </div>
                {onRemoveSeat && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveSeat(user.userId)}
                    className="text-slate-400 dark:text-slate-500 hover:text-danger-500"
                  >
                    <UserX size={14} />
                  </Button>
                )}
              </div>
            ))}

            {getUsersForSeatType(selectedSeatType).length === 0 && (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Users size={32} className="mx-auto mb-2 opacity-50" />
                <p>{t('admin.billing.seats.noUsersAssigned', 'No users assigned')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unassigned Users */}
      {unassignedUsers.length > 0 && (
        <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={20} className="text-amber-600 dark:text-amber-400" />
            <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
              {t('admin.billing.seats.unassigned', 'Unassigned Users')} ({unassignedUsers.length})
            </h3>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
            {t(
              'admin.billing.seats.unassignedDesc',
              "These users don't have a seat assigned. They may have limited access."
            )}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unassignedUsers.slice(0, 6).map((user) => (
              <div
                key={user.userId}
                className="flex items-center justify-between p-3 bg-white dark:bg-navy-800 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Avatar
                    name={`${user.firstName} ${user.lastName}`}
                    src={user.avatarUrl}
                    size="xs"
                  />
                  <span className="text-sm text-navy-900 dark:text-white truncate">
                    {user.firstName} {user.lastName}
                  </span>
                </div>
                {onAssignSeat && (
                  <Button variant="ghost" size="sm" className="text-xs">
                    {t('admin.billing.seats.assign', 'Assign')}
                  </Button>
                )}
              </div>
            ))}
          </div>

          {unassignedUsers.length > 6 && (
            <button className="mt-4 text-sm text-amber-700 dark:text-amber-300 hover:underline">
              {t('admin.billing.seats.viewAll', 'View all')} {unassignedUsers.length}{' '}
              {t('admin.billing.seats.unassignedUsers', 'unassigned users')}
              <ChevronRight size={14} className="inline ml-1" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SeatAllocationView;
