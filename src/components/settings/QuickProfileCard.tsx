/**
 * QuickProfileCard - Compact profile card for Settings sidebar
 *
 * Features:
 * - Avatar with edit overlay
 * - Name and role display
 * - Status selector (Online/Away/Busy/DND)
 * - Local time display
 * - "View as" dropdown
 * - Quick actions
 *
 * Inspired by Slack's profile card in settings.
 */

import { Camera, Check, ChevronDown, Circle, Clock, Edit2, Eye, Moon, User } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils';
import { User as UserType } from '../../types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/primitives/Button';

export type PresenceStatus = 'online' | 'away' | 'busy' | 'dnd' | 'offline';

interface QuickProfileCardProps {
  currentUser: UserType;
  onUpdateUser: (updates: Partial<UserType>) => void;
  onEditProfile: () => void;
  className?: string;
}

// Extended user type for presence (not in core User type)
interface UserWithPresence extends UserType {
  presenceStatus?: PresenceStatus;
}

const statusConfig: Record<
  PresenceStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  online: { label: 'Online', color: 'bg-emerald-500', icon: Circle },
  away: { label: 'Away', color: 'bg-amber-500', icon: Clock },
  busy: { label: 'Busy', color: 'bg-danger-500', icon: Circle },
  dnd: { label: 'Do Not Disturb', color: 'bg-danger-600', icon: Moon },
  offline: { label: 'Offline', color: 'bg-c-text-muted', icon: Circle },
};

export const QuickProfileCard: React.FC<QuickProfileCardProps> = ({
  currentUser,
  onUpdateUser,
  onEditProfile,
  className,
}) => {
  const { t } = useTranslation();
  const [localTime, setLocalTime] = useState<string>('');
  const [isViewAsOpen, setIsViewAsOpen] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState<PresenceStatus>('online');

  // User initials for avatar fallback
  const userInitials = useMemo(() => {
    const firstName = currentUser.firstName || currentUser.displayName?.split(' ')[0] || '';
    const lastName = currentUser.lastName || currentUser.displayName?.split(' ')[1] || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U';
  }, [currentUser]);

  // User display name
  const displayName = useMemo(() => {
    if (currentUser.firstName && currentUser.lastName) {
      return `${currentUser.firstName} ${currentUser.lastName}`;
    }
    return currentUser.displayName || currentUser.email || 'User';
  }, [currentUser]);

  // User role display
  const roleDisplay = useMemo(() => {
    const role = currentUser.role || currentUser.jobTitle;
    if (role) {
      return String(role).charAt(0).toUpperCase() + String(role).slice(1).toLowerCase();
    }
    return t('settings.profile.member', 'Team Member');
  }, [currentUser, t]);

  // Update local time every minute
  useEffect(() => {
    const updateTime = () => {
      const timezone = currentUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const time = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: timezone,
      });
      setLocalTime(time);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [currentUser.timezone]);

  // Handle status change
  const handleStatusChange = (newStatus: PresenceStatus) => {
    setPresenceStatus(newStatus);
    // In production, this would also call an API to update presence
    // For now, we just update local state
  };

  return (
    <div className={cn('p-4 border-b border-c-border-subtle dark:border-navy-700', className)}>
      {/* Profile Info */}
      <div className="flex items-start gap-3">
        {/* Avatar with edit overlay */}
        <div className="relative group">
          <Avatar className="w-14 h-14 ring-2 ring-white dark:ring-navy-800 shadow-sm">
            <AvatarImage src={currentUser.avatarUrl} alt={displayName} />
            <AvatarFallback className="bg-gradient-to-br from-c-accent-soft to-c-accent-soft text-white font-semibold text-lg">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={onEditProfile}
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Camera className="w-5 h-5 text-white" />
          </button>
          {/* Status indicator */}
          <span
            className={cn(
              'absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white dark:border-navy-800',
              statusConfig[presenceStatus].color
            )}
          />
        </div>

        {/* Name and role */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-c-text truncate">{displayName}</h3>
          <p className="text-sm text-c-text-muted truncate">{roleDisplay}</p>
          <div className="flex items-center gap-1 mt-1 text-xs text-c-text-secondary">
            <Clock className="w-3 h-3" />
            <span>{localTime} local time</span>
          </div>
        </div>
      </div>

      {/* Status Selector */}
      <div className="mt-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between bg-c-surface border-c-border-subtle dark:border-navy-600"
            >
              <div className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', statusConfig[presenceStatus].color)} />
                <span>
                  {t(`settings.status.${presenceStatus}`, statusConfig[presenceStatus].label)}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-c-text-secondary" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {(Object.keys(statusConfig) as PresenceStatus[]).map((status) => {
              const config = statusConfig[status];
              const isActive = presenceStatus === status;
              return (
                <DropdownMenuItem
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full', config.color)} />
                    <span>{t(`settings.status.${status}`, config.label)}</span>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-c-accent" />}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-c-text-muted">
              <Clock className="w-4 h-4 mr-2" />
              {t('settings.status.setCustom', 'Set a custom status...')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 mt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEditProfile}
          className="flex-1 text-xs text-c-text-secondary hover:text-c-accent"
        >
          <Edit2 className="w-3 h-3 mr-1" />
          {t('settings.profile.edit', 'Edit Profile')}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-xs text-c-text-secondary hover:text-c-accent"
            >
              <Eye className="w-3 h-3 mr-1" />
              {t('settings.profile.viewAs', 'View as...')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              {t('settings.viewAs.public', 'Public Profile')}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              {t('settings.viewAs.teamMember', 'Team Member')}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              {t('settings.viewAs.external', 'External User')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default QuickProfileCard;
