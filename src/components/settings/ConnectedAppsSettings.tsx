/**
 * ConnectedAppsSettings — real integration catalog
 *
 * Four categories: Email & Communication, Calendar, Task Management, Cloud Storage.
 * Every app has a real brand SVG icon, description, and a working Connect button.
 */

import {
  AlertCircle,
  AlertTriangle,
  Check,
  Clock,
  ExternalLink,
  GitMerge,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';
import { EmptyState } from '@/components/ui/composed';
import { LoadingState } from '@/components/ui/primitives';

import {
  type Provider,
  type UserIntegration,
  useUserIntegrations,
} from '../../hooks/useUserIntegrations';
import { getHeaders } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import MappingDriftPanel from './integrations/MappingDriftPanel';

// ─── Brand SVG Icons ─────────────────────────────────────────────────────────

const GmailIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"
      fill="#EA4335"
    />
  </svg>
);

const OutlookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      d="M24 7.387v10.478c0 .23-.08.424-.238.576a.806.806 0 01-.588.234h-8.42v-8.07l1.2.9 1.845-1.26V7.387l-1.845 1.26-1.2-.9v-.36h8.42c.234 0 .43.078.588.234.158.152.238.346.238.576z"
      fill="#0078D4"
    />
    <path
      d="M14.754 10.605v-8.07h8.42c.234 0 .43.078.588.234.158.152.238.346.238.576v3.642l-3.045 2.078-1.2-.9-1.845 1.26V7.387l1.845-1.26 1.2.9v.36h-6.2z"
      fill="#0078D4"
      opacity=".5"
    />
    <path
      d="M0 7.5v9c0 .828.672 1.5 1.5 1.5h12c.828 0 1.5-.672 1.5-1.5v-9c0-.828-.672-1.5-1.5-1.5h-12C.672 6 0 6.672 0 7.5z"
      fill="#0078D4"
    />
    <ellipse cx="7.5" cy="12" rx="3.5" ry="3" fill="#fff" />
  </svg>
);

const SlackIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313z"
      fill="#E01E5A"
    />
    <path
      d="M8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312z"
      fill="#36C5F0"
    />
    <path
      d="M18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zm-1.271 0a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312z"
      fill="#2EB67D"
    />
    <path
      d="M15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zm0-1.271a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z"
      fill="#ECB22E"
    />
  </svg>
);

const TeamsIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      d="M20.625 6h-3.375v3.375h3.375c.621 0 1.125-.504 1.125-1.125v-1.125c0-.621-.504-1.125-1.125-1.125z"
      fill="#5059C9"
    />
    <circle cx="19.5" cy="3.75" r="1.875" fill="#5059C9" />
    <circle cx="13.5" cy="3" r="2.625" fill="#7B83EB" />
    <path
      d="M17.25 6H9.75c-.621 0-1.125.504-1.125 1.125v7.5c0 3.107 2.518 5.625 5.625 5.625s5.625-2.518 5.625-5.625v-7.5c0-.621-.504-1.125-1.125-1.125z"
      fill="#7B83EB"
    />
    <path
      d="M13.875 6H9.75c-.621 0-1.125.504-1.125 1.125v7.5c0 2.486 1.614 4.594 3.85 5.337.577.192 1.193.288 1.825.288.316 0 .625-.03.925-.075V6.075A1.126 1.126 0 0013.875 6z"
      fill="#7B83EB"
      opacity=".5"
    />
    <path
      d="M2.25 8.25h9c.621 0 1.125.504 1.125 1.125v7.5c0 .621-.504 1.125-1.125 1.125h-9c-.621 0-1.125-.504-1.125-1.125v-7.5c0-.621.504-1.125 1.125-1.125z"
      fill="#4B53BC"
    />
    <path d="M9.375 11.25H8.25v3.375h-1.5V11.25H5.625v-1.125h3.75v1.125z" fill="#fff" />
  </svg>
);

const GoogleCalendarIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path d="M18.316 5.684H5.684v12.632h12.632V5.684z" fill="#fff" />
    <path
      d="M18.316 24L24 18.316V5.684L18.316 0H5.684L0 5.684v12.632L5.684 24h12.632z"
      fill="#fff"
    />
    <path d="M13.895 12.379l1.263-1.684 1.684 1.263-.842 1.263-2.105-.842z" fill="#EA4335" />
    <path d="M8.842 9.053l1.684-1.264 1.263 1.685-1.684 1.263-1.263-1.684z" fill="#34A853" />
    <path d="M8.842 14.947l1.263-1.684 1.684 1.263-1.263 1.684-1.684-1.263z" fill="#4285F4" />
    <path d="M13.895 11.621l1.684-1.263 1.263 1.684-1.684 1.263-1.263-1.684z" fill="#FBBC04" />
    <path d="M5.684 0L0 5.684h5.684V0z" fill="#188038" />
    <path d="M24 5.684L18.316 0v5.684H24z" fill="#1967D2" />
    <path d="M18.316 24l5.684-5.684h-5.684V24z" fill="#1967D2" />
    <path d="M0 18.316L5.684 24v-5.684H0z" fill="#34A853" />
    <rect x="7" y="7" width="10" height="10" rx="1" fill="#fff" />
    <path d="M9 10h6M9 12h6M9 14h4" stroke="#4285F4" strokeWidth=".75" fill="none" />
  </svg>
);

const OutlookCalendarIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <rect width="24" height="24" rx="4" fill="#0078D4" />
    <rect x="4" y="4" width="16" height="16" rx="2" fill="#fff" />
    <rect x="4" y="4" width="16" height="5" rx="2" fill="#0078D4" />
    <text
      x="12"
      y="16"
      textAnchor="middle"
      fill="#0078D4"
      fontSize="7"
      fontWeight="bold"
      fontFamily="Arial"
    >
      31
    </text>
  </svg>
);

const AppleCalendarIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <rect width="24" height="24" rx="5" fill="#FF3B30" />
    <rect x="2" y="6" width="20" height="16" rx="3" fill="#fff" />
    <rect x="2" y="6" width="20" height="5" fill="#FF3B30" />
    <text
      x="12"
      y="19"
      textAnchor="middle"
      fill="#333"
      fontSize="8"
      fontWeight="bold"
      fontFamily="Arial"
    >
      17
    </text>
    <rect x="6" y="3" width="2" height="5" rx="1" fill="#666" />
    <rect x="16" y="3" width="2" height="5" rx="1" fill="#666" />
  </svg>
);

const CalendlyIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <circle cx="12" cy="12" r="12" fill="#006BFF" />
    <path
      d="M15.634 8.366a5.165 5.165 0 00-7.268 0 5.165 5.165 0 000 7.268 5.165 5.165 0 007.268 0 5.165 5.165 0 000-7.268zm-1.06 6.208a3.644 3.644 0 01-5.148 0 3.644 3.644 0 010-5.148 3.644 3.644 0 015.148 0 3.644 3.644 0 010 5.148z"
      fill="#fff"
    />
    <path d="M12 9.5v3l2.5 1.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none" />
  </svg>
);

const JiraIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      d="M11.571 11.513H0a5.218 5.218 0 005.232 5.215h2.13v2.057A5.215 5.215 0 0012.577 24V12.518a1.005 1.005 0 00-1.006-1.005z"
      fill="#2684FF"
    />
    <path
      d="M17.362 5.727H5.791a5.218 5.218 0 005.232 5.215h2.13v2.057a5.215 5.215 0 005.215 5.215V6.732a1.005 1.005 0 00-1.006-1.005z"
      fill="url(#jira-a)"
      opacity=".8"
    />
    <path
      d="M23.153 0H11.582a5.218 5.218 0 005.232 5.215h2.13v2.057A5.215 5.215 0 0024.159 12.487V1.005A1.005 1.005 0 0023.153 0z"
      fill="url(#jira-b)"
      opacity=".8"
    />
    <defs>
      <linearGradient
        id="jira-a"
        x1="12.959"
        y1="5.634"
        x2="7.012"
        y2="11.841"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#0052CC" />
        <stop offset="1" stopColor="#2684FF" />
      </linearGradient>
      <linearGradient
        id="jira-b"
        x1="18.75"
        y1="-.106"
        x2="12.803"
        y2="6.101"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#0052CC" />
        <stop offset="1" stopColor="#2684FF" />
      </linearGradient>
    </defs>
  </svg>
);

const AsanaIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <circle cx="12" cy="6.562" r="4.781" fill="#F06A6A" />
    <circle cx="4.781" cy="17.438" r="4.781" fill="#F06A6A" />
    <circle cx="19.219" cy="17.438" r="4.781" fill="#F06A6A" />
  </svg>
);

const TrelloIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <rect width="24" height="24" rx="4" fill="#0079BF" />
    <rect x="3.5" y="3.5" width="7" height="14" rx="1.5" fill="#fff" />
    <rect x="13.5" y="3.5" width="7" height="9" rx="1.5" fill="#fff" />
  </svg>
);

const ClickUpIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      d="M3.434 16.066l3.066-2.349c1.6 2.09 3.17 3.033 5.5 3.033 2.33 0 3.9-.943 5.5-3.033l3.066 2.349C18.166 19.266 15.666 20.75 12 20.75s-6.166-1.484-8.566-4.684z"
      fill="#7B68EE"
    />
    <path d="M12 7.25l-5.5 4.717 2.6 3.033L12 12.717 14.9 15l2.6-3.033L12 7.25z" fill="#49CCF9" />
  </svg>
);

const MondayIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <circle cx="4.5" cy="16.5" r="2.5" fill="#FF3D57" />
    <ellipse cx="9.5" cy="12" rx="2.5" ry="6" fill="#FF3D57" transform="rotate(-15 9.5 12)" />
    <ellipse cx="16" cy="12" rx="2.5" ry="6" fill="#FFCB00" transform="rotate(-15 16 12)" />
    <circle cx="21" cy="16.5" r="2.5" fill="#00CA72" />
  </svg>
);

const NotionIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.09 2.14c-.42-.326-.98-.7-2.055-.607L3.01 2.721c-.467.047-.56.28-.374.466l1.823 1.021z"
      fill="#000"
    />
    <path
      d="M5.252 7.075v12.635c0 .7.373.933 1.12.886l14.475-.84c.747-.047.84-.467.84-1.027V6.282c0-.56-.187-.84-.654-.793l-15.128.886c-.513.047-.653.327-.653.7z"
      fill="#fff"
      stroke="#000"
      strokeWidth=".5"
    />
    <path
      d="M17.318 8.2c.094.42 0 .84-.42.886l-.7.14v9.334c-.607.327-1.167.514-1.634.514-.747 0-.933-.234-1.494-.934l-4.574-7.186v6.952l1.447.327s0 .84-1.167.84l-3.22.187c-.093-.187 0-.654.327-.747l.84-.233V9.854l-1.167-.094c-.093-.42.14-1.026.793-1.073l3.454-.233 4.76 7.28V9.527l-1.214-.14c-.093-.514.28-.886.747-.933l3.222-.254z"
      fill="#000"
    />
  </svg>
);

const TodoistIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <rect width="24" height="24" rx="5" fill="#E44332" />
    <path
      d="M5 8.5l2.5 1.5L12 7.5l4.5 2.5L19 8.5"
      stroke="#fff"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M5 12.5l2.5 1.5L12 11.5l4.5 2.5L19 12.5"
      stroke="#fff"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M5 16.5l2.5 1.5L12 15.5l4.5 2.5L19 16.5"
      stroke="#fff"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

const LinearIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      d="M2.513 12.833l8.654 8.654a9.952 9.952 0 01-8.654-8.654zM1.573 10.555a10.002 10.002 0 0011.872 11.872L1.573 10.555zM12.167 2.513l-9.654 9.654a9.952 9.952 0 019.654-9.654zM13.445 1.573a10.002 10.002 0 00-11.872 11.872L13.445 1.573zM22.427 13.445a10.002 10.002 0 01-11.872 11.872l11.872-11.872zM21.487 11.167a9.952 9.952 0 00-9.654-9.654l9.654 9.654z"
      fill="#5E6AD2"
    />
  </svg>
);

const GoogleDriveIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path d="M8.267 14.68l-1.6 2.76H22.4l1.6-2.76z" fill="#3777E3" />
    <path d="M14.133 3.6L8.267 14.68l1.6 2.76L15.733 6.36z" fill="#FFCF63" />
    <path d="M14.133 3.6H8.4L2.533 14.68h5.734z" fill="#11A861" />
    <path d="M14.133 3.6l5.867 10.08 1.6 2.76-5.867-10.08z" fill="#FFCF63" opacity=".6" />
    <path d="M20 13.68L14.133 3.6h5.734L24 13.68z" fill="#EA4335" opacity=".8" />
  </svg>
);

const OneDriveIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path
      d="M14.22 7.07c-1.3-1.15-3-1.82-4.82-1.82-2.88 0-5.37 1.66-6.56 4.07A5.997 5.997 0 000 15c0 3.31 2.69 6 6 6h12.5c3.04 0 5.5-2.46 5.5-5.5 0-2.77-2.04-5.06-4.7-5.45-.42-1.22-1.27-2.24-2.38-2.93z"
      fill="#0078D4"
    />
    <path
      d="M9.4 5.25c1.82 0 3.52.67 4.82 1.82 1.11.69 1.96 1.71 2.38 2.93A5.502 5.502 0 0122 15.5c0 .17-.01.34-.03.5H18.5C15.46 16 13 13.54 13 10.5c0-.55.08-1.08.23-1.58A6.002 6.002 0 009.4 5.25z"
      fill="#0078D4"
      opacity=".7"
    />
  </svg>
);

const DropboxIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path d="M12 2L6 6l6 4-6 4 6 4 6-4-6-4 6-4z" fill="#0061FF" />
    <path d="M6 6l6 4-6 4 6 4" fill="#0061FF" opacity=".6" />
    <path d="M18 6l-6 4 6 4-6 4" fill="#0061FF" opacity=".6" />
    <path d="M6 6L0 10l6 4-6 4 6 4" fill="#0061FF" opacity=".3" />
    <path d="M18 6l6 4-6 4 6 4-6 4" fill="#0061FF" opacity=".3" />
  </svg>
);

const BoxIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path d="M22.5 14.004L12 21l-10.5-6.996V9.996L12 3l10.5 6.996v4.008z" fill="#0061D5" />
    <path d="M12 3L1.5 9.996 12 16.992l10.5-6.996L12 3z" fill="#0061D5" />
    <path d="M12 16.992L1.5 9.996v4.008L12 21l10.5-6.996V9.996L12 16.992z" fill="#003D8F" />
  </svg>
);

// ─── Catalog definition ──────────────────────────────────────────────────────

type CatalogCategory = 'email' | 'calendar' | 'task_management' | 'cloud_storage';

interface CatalogApp {
  id: string;
  name: string;
  category: CatalogCategory;
  description: string;
  features: string[];
  icon: React.FC;
  authType: 'oauth2' | 'api_key' | 'token' | 'basic';
  configFields: string[];
}

const CATEGORY_META: Record<CatalogCategory, { labelKey: string; fallback: string }> = {
  email: { labelKey: 'settings.integrations.cat.email', fallback: 'Email & Communication' },
  calendar: { labelKey: 'settings.integrations.cat.calendar', fallback: 'Calendar' },
  task_management: { labelKey: 'settings.integrations.cat.taskMgmt', fallback: 'Task Management' },
  cloud_storage: { labelKey: 'settings.integrations.cat.cloud', fallback: 'Cloud Storage' },
};

const CATALOG: CatalogApp[] = [
  // Email & Communication
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'email',
    description: 'Sync emails, contacts and labels from your Gmail account',
    features: ['Email sync', 'Contact import', 'Label mapping'],
    icon: GmailIcon,
    authType: 'oauth2',
    configFields: [],
  },
  {
    id: 'outlook',
    name: 'Microsoft Outlook',
    category: 'email',
    description: 'Connect your Outlook mailbox for email and contact sync',
    features: ['Email sync', 'Contact import', 'Folder mapping'],
    icon: OutlookIcon,
    authType: 'oauth2',
    configFields: [],
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'email',
    description: 'Receive notifications and create tasks directly from Slack',
    features: ['Real-time notifications', 'Interactive actions', 'Channel sync'],
    icon: SlackIcon,
    authType: 'oauth2',
    configFields: [],
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    category: 'email',
    description: 'Get notified in Teams and sync meeting data',
    features: ['Adaptive cards', 'Meeting sync', 'Channel notifications'],
    icon: TeamsIcon,
    authType: 'oauth2',
    configFields: ['tenant_id'],
  },

  // Calendar
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    category: 'calendar',
    description: 'Two-way sync of events, reminders and shared calendars',
    features: ['Event sync', 'Reminders', 'Shared calendars'],
    icon: GoogleCalendarIcon,
    authType: 'oauth2',
    configFields: [],
  },
  {
    id: 'outlook_calendar',
    name: 'Outlook Calendar',
    category: 'calendar',
    description: 'Sync your Outlook calendar events and availability',
    features: ['Event sync', 'Availability', 'Room booking'],
    icon: OutlookCalendarIcon,
    authType: 'oauth2',
    configFields: [],
  },
  {
    id: 'apple_calendar',
    name: 'Apple Calendar (iCal)',
    category: 'calendar',
    description: 'Connect via CalDAV for iCloud calendar sync',
    features: ['CalDAV sync', 'Reminders'],
    icon: AppleCalendarIcon,
    authType: 'basic',
    configFields: ['caldav_url'],
  },
  {
    id: 'calendly',
    name: 'Calendly',
    category: 'calendar',
    description: 'Import scheduled meetings and availability windows',
    features: ['Scheduling sync', 'Availability', 'Event types'],
    icon: CalendlyIcon,
    authType: 'oauth2',
    configFields: [],
  },

  // Task Management
  {
    id: 'jira',
    name: 'Jira',
    category: 'task_management',
    description: 'Bi-directional sync of issues, sprints and boards',
    features: ['Issue sync', 'Sprint tracking', 'Status mapping'],
    icon: JiraIcon,
    authType: 'oauth2',
    configFields: ['site_url'],
  },
  {
    id: 'asana',
    name: 'Asana',
    category: 'task_management',
    description: 'Sync tasks, projects and portfolios with Asana',
    features: ['Task sync', 'Project mapping', 'Portfolios'],
    icon: AsanaIcon,
    authType: 'oauth2',
    configFields: [],
  },
  {
    id: 'trello',
    name: 'Trello',
    category: 'task_management',
    description: 'Sync boards, lists and cards with Trello',
    features: ['Board sync', 'Card mapping', 'Checklists'],
    icon: TrelloIcon,
    authType: 'token',
    configFields: [],
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    category: 'task_management',
    description: 'Connect tasks, spaces and goals from ClickUp',
    features: ['Task sync', 'Space mapping', 'Goals'],
    icon: ClickUpIcon,
    authType: 'oauth2',
    configFields: [],
  },
  {
    id: 'monday',
    name: 'Monday.com',
    category: 'task_management',
    description: 'Sync boards, items and workspaces from Monday',
    features: ['Board sync', 'Item mapping', 'Automations'],
    icon: MondayIcon,
    authType: 'api_key',
    configFields: ['api_token'],
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'task_management',
    description: 'Sync databases, pages and task lists from Notion',
    features: ['Database sync', 'Page import', 'Task lists'],
    icon: NotionIcon,
    authType: 'oauth2',
    configFields: [],
  },
  {
    id: 'todoist',
    name: 'Todoist',
    category: 'task_management',
    description: 'Sync tasks, projects and labels from Todoist',
    features: ['Task sync', 'Project mapping', 'Labels'],
    icon: TodoistIcon,
    authType: 'oauth2',
    configFields: [],
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'task_management',
    description: 'Sync issues, projects and cycles from Linear',
    features: ['Issue sync', 'Cycle tracking', 'Project mapping'],
    icon: LinearIcon,
    authType: 'oauth2',
    configFields: [],
  },

  // Cloud Storage
  {
    id: 'google_drive',
    name: 'Google Drive',
    category: 'cloud_storage',
    description: 'Access and sync files, folders and shared drives',
    features: ['File sync', 'Shared drives', 'Search'],
    icon: GoogleDriveIcon,
    authType: 'oauth2',
    configFields: [],
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    category: 'cloud_storage',
    description: 'Connect your OneDrive for file sync and sharing',
    features: ['File sync', 'SharePoint', 'Sharing'],
    icon: OneDriveIcon,
    authType: 'oauth2',
    configFields: [],
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    category: 'cloud_storage',
    description: 'Sync files and folders from your Dropbox account',
    features: ['File sync', 'Folder mapping', 'Sharing'],
    icon: DropboxIcon,
    authType: 'oauth2',
    configFields: [],
  },
  {
    id: 'box',
    name: 'Box',
    category: 'cloud_storage',
    description: 'Enterprise file sync with Box workflows',
    features: ['File sync', 'Workflows', 'Governance'],
    icon: BoxIcon,
    authType: 'oauth2',
    configFields: [],
  },
];

const ALL_CATEGORIES: Array<{ id: 'all' | CatalogCategory; labelKey: string; fallback: string }> = [
  { id: 'all', labelKey: 'settings.integrations.cat.all', fallback: 'All' },
  { id: 'email', labelKey: 'settings.integrations.cat.email', fallback: 'Email & Communication' },
  { id: 'calendar', labelKey: 'settings.integrations.cat.calendar', fallback: 'Calendar' },
  {
    id: 'task_management',
    labelKey: 'settings.integrations.cat.taskMgmt',
    fallback: 'Task Management',
  },
  { id: 'cloud_storage', labelKey: 'settings.integrations.cat.cloud', fallback: 'Cloud Storage' },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface ConnectedAppsSettingsProps {
  className?: string;
}

export const ConnectedAppsSettings: React.FC<ConnectedAppsSettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<'all' | CatalogCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [connectModalApp, setConnectModalApp] = useState<CatalogApp | null>(null);
  const [draftConfig, setDraftConfig] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [mappingIntegrationId, setMappingIntegrationId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Availability map from the server: which connectors actually have backend
  // credentials configured (e.g. *_CLIENT_ID env). OAuth providers without
  // credentials return 503 on connect, so we gate their Connect button.
  const [availability, setAvailability] = useState<Record<
    string,
    { configured: boolean; authType: string }
  > | null>(null);
  const [availabilityState, setAvailabilityState] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );

  const { integrations, providers, connectedCount, loading, error, disconnect, refresh } =
    useUserIntegrations();

  const loadAvailability = useCallback(async (signal?: AbortSignal) => {
    setAvailabilityState('loading');
    setAvailability(null);
    try {
      const resp = await fetch('/api/settings/integrations/oauth/status', {
        credentials: 'include',
        headers: getHeaders(),
        signal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (!data?.availability || typeof data.availability !== 'object') {
        throw new Error('OAuth provider availability was missing');
      }
      setAvailability(
        data.availability as Record<string, { configured: boolean; authType: string }>
      );
      setAvailabilityState('ready');
    } catch (error) {
      if (signal?.aborted) return;
      console.error('[ConnectedAppsSettings] Availability error:', error);
      setAvailability(null);
      setAvailabilityState('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadAvailability(controller.signal);
    return () => controller.abort();
  }, [loadAvailability]);

  const connectedMap = useMemo(() => {
    const map = new Map<string, UserIntegration>();
    for (const i of integrations) {
      map.set(i.provider, i);
    }
    for (const p of providers) {
      if (p.isConnected && p.connection) {
        map.set(p.id, p.connection);
      }
    }
    return map;
  }, [integrations, providers]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CATALOG.filter((app) => {
      if (selectedCategory !== 'all' && app.category !== selectedCategory) return false;
      if (q && !app.name.toLowerCase().includes(q) && !app.description.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [selectedCategory, searchQuery]);

  // An OAuth/token provider is "unavailable" when the server reports it has no
  // backend credentials configured — connecting would 503. basic (CalDAV) and
  // api_key providers use user-supplied credentials, so they're never gated.
  const isProviderUnavailable = useCallback(
    (app: CatalogApp): boolean => {
      if (app.authType === 'basic' || app.authType === 'api_key') return false;
      if (availabilityState !== 'ready' || !availability) return true;
      const entry = availability[app.id];
      return entry?.configured !== true;
    },
    [availability, availabilityState]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: CATALOG.length };
    for (const app of CATALOG) {
      counts[app.category] = (counts[app.category] || 0) + 1;
    }
    return counts;
  }, []);

  const fetchIntegrationSnapshot = useCallback(async () => {
    const response = await fetch('/api/settings/integrations', {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to confirm integration status');
    }
    const data = await response.json();
    return {
      integrations: Array.isArray(data?.integrations)
        ? (data.integrations as UserIntegration[])
        : [],
      providers: Array.isArray(data?.providers) ? (data.providers as Provider[]) : [],
    };
  }, []);

  const snapshotHasActiveProvider = useCallback(
    (snapshot: { integrations: UserIntegration[]; providers: Provider[] }, providerId: string) =>
      snapshot.integrations.some(
        (integration) => integration.provider === providerId && integration.status === 'active'
      ) ||
      snapshot.providers.some(
        (provider) =>
          provider.id === providerId &&
          provider.isConnected &&
          provider.connection?.status === 'active'
      ),
    []
  );

  // api_key providers (e.g. Monday.com) are inserted by the server as 'pending'
  // rather than 'active' — the key is validated asynchronously. Accept either
  // status as a successful connection so we don't show a false error toast.
  const snapshotHasConnectedProvider = useCallback(
    (snapshot: { integrations: UserIntegration[]; providers: Provider[] }, providerId: string) =>
      snapshot.integrations.some(
        (integration) =>
          integration.provider === providerId &&
          (integration.status === 'active' || integration.status === 'pending')
      ) ||
      snapshot.providers.some(
        (provider) =>
          provider.id === providerId &&
          (provider.isConnected ||
            provider.connection?.status === 'active' ||
            provider.connection?.status === 'pending')
      ),
    []
  );

  // Handle OAuth success/error from redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthSuccess = params.get('oauth_success');
    const oauthError = params.get('oauth_error');
    if (oauthSuccess) {
      void (async () => {
        try {
          const snapshot = await fetchIntegrationSnapshot();
          if (!snapshotHasActiveProvider(snapshot, oauthSuccess)) {
            throw new Error('OAuth connection was not confirmed by the server');
          }
          toast.success(
            t('settings.integrations.oauthSuccess', `Connected to ${oauthSuccess} successfully!`)
          );
          await refresh();
        } catch (err: unknown) {
          const message = normalizeApiErrorMessage(err, 'Failed to confirm OAuth connection');
          setActionError(message);
          toast.error(message);
        } finally {
          window.history.replaceState({}, '', window.location.pathname);
        }
      })();
    } else if (oauthError) {
      toast.error(`OAuth error: ${oauthError}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchIntegrationSnapshot, refresh, snapshotHasActiveProvider, t]);

  const startOAuthFlow = useCallback(
    async (connectorId: string) => {
      try {
        const resp = await fetch(`/api/settings/integrations/oauth/start/${connectorId}`, {
          credentials: 'include',
          headers: getHeaders(),
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        } else {
          toast.error('No authorization URL returned');
        }
      } catch (err: unknown) {
        toast.error(
          normalizeApiErrorMessage(
            err,
            t('settings.integrations.connectError', 'Failed to initiate connection')
          )
        );
      }
    },
    [t]
  );

  const handleConnect = useCallback(
    async (app: CatalogApp) => {
      if (app.authType === 'basic') {
        const draft: Record<string, string> = { username: '', password: '' };
        if (app.configFields.includes('caldav_url')) draft.serverUrl = 'https://caldav.icloud.com/';
        setDraftConfig(draft);
        setConnectModalApp(app);
      } else if (app.configFields.length > 0 || app.authType === 'api_key') {
        const draft: Record<string, string> = {};
        app.configFields.forEach((f) => {
          draft[f] = '';
        });
        setDraftConfig(draft);
        setConnectModalApp(app);
      } else if (app.authType === 'oauth2' || app.authType === 'token') {
        await startOAuthFlow(app.id);
      } else {
        await startOAuthFlow(app.id);
      }
    },
    [startOAuthFlow]
  );

  const handleDisconnect = useCallback(
    async (appId: string) => {
      const confirmed = window.confirm(
        t(
          'settings.integrations.disconnectConfirm',
          'Are you sure you want to disconnect this integration?'
        )
      );
      if (!confirmed) return;
      try {
        setActionError(null);
        const resp = await fetch(`/api/settings/integrations/${appId}/oauth-disconnect`, {
          method: 'POST',
          credentials: 'include',
        });
        if (resp.ok) {
          const snapshot = await fetchIntegrationSnapshot();
          if (snapshotHasActiveProvider(snapshot, appId)) {
            throw new Error('Integration disconnect was not confirmed by the server');
          }
          await refresh();
          toast.success(t('settings.integrations.disconnected', 'Disconnected successfully'));
        } else {
          const disconnected = await disconnect(appId);
          if (!disconnected) {
            throw new Error('Failed to disconnect');
          }
          const snapshot = await fetchIntegrationSnapshot();
          if (snapshotHasActiveProvider(snapshot, appId)) {
            throw new Error('Integration disconnect was not confirmed by the server');
          }
          toast.success(t('settings.integrations.disconnected', 'Disconnected successfully'));
        }
      } catch (err: unknown) {
        const message = normalizeApiErrorMessage(err, 'Failed to disconnect integration');
        setActionError(message);
        toast.error(message);
      }
    },
    [disconnect, fetchIntegrationSnapshot, refresh, snapshotHasActiveProvider, t]
  );

  const handleTest = useCallback(
    async (appId: string) => {
      setTestingProvider(appId);
      try {
        const resp = await fetch(`/api/settings/integrations/${appId}/oauth-test`, {
          method: 'POST',
          credentials: 'include',
        });
        const result = await resp.json();
        if (result.success) {
          toast.success(t('settings.integrations.testSuccess', 'Connection working!'));
        } else {
          toast.error(
            result.error || t('settings.integrations.testFailed', 'Connection test failed')
          );
        }
      } catch {
        toast.error(t('settings.integrations.testFailed', 'Connection test failed'));
      } finally {
        setTestingProvider(null);
      }
    },
    [t]
  );

  const openConnectModal = useCallback(
    (app: CatalogApp) => {
      handleConnect(app);
    },
    [handleConnect]
  );

  const submitConnectModal = useCallback(async () => {
    if (!connectModalApp) return;
    setConnecting(true);
    try {
      if (connectModalApp.authType === 'basic') {
        const resp = await fetch(`/api/settings/integrations/${connectModalApp.id}/basic-connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            username: draftConfig.username || '',
            password: draftConfig.password || '',
            serverUrl: draftConfig.serverUrl || '',
          }),
        });
        if (!resp.ok) throw new Error('Connection failed');
        const snapshot = await fetchIntegrationSnapshot();
        if (!snapshotHasActiveProvider(snapshot, connectModalApp.id)) {
          throw new Error('Integration connection was not confirmed by the server');
        }
        toast.success(t('settings.integrations.connected', 'Connected successfully'));
        setConnectModalApp(null);
        await refresh();
      } else {
        // For providers requiring config (Jira site_url, Teams tenant_id, Monday api_token, etc.)
        // submit the config first so the backend can use it during/after OAuth
        if (connectModalApp.configFields.length > 0) {
          const configPayload: Record<string, string> = {};
          for (const field of connectModalApp.configFields) {
            const val = draftConfig[field]?.trim();
            if (!val) {
              toast.error(
                t(
                  'settings.integrations.fieldRequired',
                  `Please fill in ${field.replace(/_/g, ' ')}`
                )
              );
              setConnecting(false);
              return;
            }
            configPayload[field] = val;
          }

          // For api_key auth (e.g. Monday), we connect directly with the token — no OAuth redirect
          if (connectModalApp.authType === 'api_key') {
            const resp = await fetch(`/api/settings/integrations/${connectModalApp.id}/connect`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ config: configPayload }),
            });
            if (!resp.ok) {
              const err = await resp.json().catch(() => ({}));
              throw new Error(err.error || 'Connection failed');
            }
            const snapshot = await fetchIntegrationSnapshot();
            if (!snapshotHasConnectedProvider(snapshot, connectModalApp.id)) {
              throw new Error('Integration connection was not confirmed by the server');
            }
            toast.success(t('settings.integrations.connected', 'Connected successfully'));
            setConnectModalApp(null);
            await refresh();
            setConnecting(false);
            return;
          }

          // For OAuth providers with config: store config before redirecting
          await fetch(`/api/settings/integrations/${connectModalApp.id}/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ config: configPayload }),
          });
        }

        await startOAuthFlow(connectModalApp.id);
        setConnectModalApp(null);
      }
    } catch (err: unknown) {
      toast.error(
        normalizeApiErrorMessage(
          err,
          t('settings.integrations.connectError', 'Failed to initiate connection')
        )
      );
    } finally {
      setConnecting(false);
    }
  }, [
    connectModalApp,
    draftConfig,
    fetchIntegrationSnapshot,
    refresh,
    snapshotHasActiveProvider,
    snapshotHasConnectedProvider,
    startOAuthFlow,
    t,
  ]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div>
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <Link2 size={20} />
            {t('settings.integrations.appsTitle', 'Connected Apps')}
          </h3>
        </div>
        <LoadingState variant="spinner" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <Link2 size={20} />
            {t('settings.integrations.appsTitle', 'Connected Apps')}
          </h3>
          <p className="text-sm text-c-text-muted mt-1">
            {t(
              'settings.integrations.appsDesc',
              'Connect your favourite tools. We use secure OAuth — we never store your passwords.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connectedCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-full">
              <Check size={12} />
              {connectedCount} connected
            </span>
          )}
          <button
            onClick={refresh}
            className="p-2 text-c-text-secondary hover:text-brand rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-700 transition-colors"
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Search */}
      {actionError && <Banner variant="danger" title={actionError} />}

      {availabilityState === 'error' && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-danger-500/30 bg-danger-500/10 p-3"
        >
          <span className="text-sm text-danger-600 dark:text-danger-300">
            {t(
              'settings.integrations.availabilityError',
              'Provider availability could not be verified. OAuth connections remain disabled.'
            )}
          </span>
          <button
            type="button"
            onClick={() => void loadAvailability()}
            className="shrink-0 rounded-md border border-danger-500/40 px-3 py-1.5 text-xs font-medium text-danger-700 dark:text-danger-200"
          >
            {t('common.retry', 'Retry')}
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-c-text-secondary" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('settings.integrations.searchPlaceholder', 'Search apps...')}
          className="w-full pl-10 pr-10 py-2.5 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-xl text-sm text-c-text placeholder-c-text-muted focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-c-accent"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label={t('myWork.filters.clearSearch', 'Clear search')}
            title={t('myWork.filters.clearSearch', 'Clear search')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-c-text-secondary hover:text-c-text-secondary"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === cat.id
                ? 'bg-navy-900 text-white shadow-sm'
                : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700'
            }`}
          >
            {t(cat.labelKey, cat.fallback)}
            <span
              className={`ml-1.5 ${selectedCategory === cat.id ? 'text-white/70' : 'text-c-text-secondary'}`}
            >
              {categoryCounts[cat.id] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && <Banner variant="danger" title={error} />}

      {/* App cards */}
      {filtered.length === 0 ? (
        <EmptyState preset="search" title={t('settings.integrations.noResults', 'No apps found')} />
      ) : (
        Object.entries(CATEGORY_META)
          .filter(([catId]) => selectedCategory === 'all' || selectedCategory === catId)
          .map(([catId, meta]) => {
            const apps = filtered.filter((a) => a.category === catId);
            if (apps.length === 0) return null;
            return (
              <div key={catId}>
                {selectedCategory === 'all' && (
                  <h4 className="text-xs font-semibold text-c-text-muted uppercase tracking-wider mb-3">
                    {t(meta.labelKey, meta.fallback)}
                  </h4>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {apps.map((app) => {
                    const connection = connectedMap.get(app.id);
                    const isConnected = connection?.status === 'active';
                    const isError = connection?.status === 'error';
                    const isExpired = connection?.status === 'expired';
                    const needsReauth = isError || isExpired;
                    const unavailable = isProviderUnavailable(app);
                    const Icon = app.icon;

                    return (
                      <div
                        key={app.id}
                        className={`group relative p-4 rounded-xl border transition-all hover:shadow-md ${
                          isConnected
                            ? 'bg-green-50/40 dark:bg-green-900/10 border-green-200 dark:border-green-900/30'
                            : needsReauth
                              ? 'bg-amber-50/40 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'
                              : 'bg-c-surface-raised border-c-border-subtle dark:border-navy-700 hover:border-brand/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div
                            className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl ${
                              isConnected
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : 'bg-c-surface-raised'
                            }`}
                          >
                            <Icon />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-c-text">{app.name}</span>
                              {isConnected && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">
                                  <Check size={8} /> {t('common.connected', 'Connected')}
                                </span>
                              )}
                              {needsReauth && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                                  {isExpired ? <Clock size={8} /> : <AlertTriangle size={8} />}
                                  {isExpired
                                    ? t('common.expired', 'Expired')
                                    : t('common.error', 'Error')}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-c-text-muted mt-0.5 line-clamp-2">
                              {app.description}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {app.features.map((f) => (
                                <span
                                  key={f}
                                  className="text-[10px] text-c-text-muted bg-c-surface-raised px-1.5 py-0.5 rounded"
                                >
                                  {f}
                                </span>
                              ))}
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded ${app.authType === 'oauth2' ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400' : app.authType === 'basic' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400' : 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400'}`}
                              >
                                {app.authType === 'oauth2'
                                  ? 'OAuth 2.0'
                                  : app.authType === 'basic'
                                    ? 'CalDAV'
                                    : app.authType === 'token'
                                      ? 'Token'
                                      : 'API Key'}
                              </span>
                            </div>
                          </div>

                          {/* Action */}
                          <div className="flex-shrink-0 flex items-center gap-1">
                            {isConnected && (
                              <>
                                <button
                                  onClick={() => handleTest(app.id)}
                                  disabled={testingProvider === app.id}
                                  className="p-1.5 text-c-text-secondary hover:text-brand rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-700 transition-colors disabled:opacity-50"
                                  title="Test connection"
                                >
                                  {testingProvider === app.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <RefreshCw size={14} />
                                  )}
                                </button>
                                <button
                                  onClick={() => setMappingIntegrationId(app.id)}
                                  className="p-1.5 text-c-text-secondary hover:text-brand rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-700 transition-colors"
                                  title={t('settings.integrations.viewMappings', 'View Mappings')}
                                >
                                  <GitMerge size={14} />
                                </button>
                                <button
                                  onClick={() => handleDisconnect(app.id)}
                                  className="px-2.5 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
                                >
                                  {t('common.disconnect', 'Disconnect')}
                                </button>
                              </>
                            )}
                            {needsReauth && !unavailable && (
                              <button
                                onClick={() => openConnectModal(app)}
                                className="px-2.5 py-1 text-xs font-medium text-amber-600 border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                              >
                                {t('common.reconnect', 'Reconnect')}
                              </button>
                            )}
                            {!isConnected && unavailable && (
                              <span
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-c-text-muted bg-c-surface-raised rounded-lg cursor-not-allowed"
                                aria-label={`${app.name} unavailable`}
                                title={t(
                                  'settings.integrations.notConfigured',
                                  'This integration is not available yet — it has not been configured on the server.'
                                )}
                              >
                                <Clock size={12} />
                                {t('settings.integrations.comingSoon', 'Coming soon')}
                              </span>
                            )}
                            {!isConnected && !needsReauth && !unavailable && (
                              <button
                                onClick={() => openConnectModal(app)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white dark:text-navy-950 bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] dark:hover:bg-[#DDE5EF] rounded-lg transition-colors shadow-sm"
                              >
                                <ExternalLink size={12} />
                                {t('common.connect', 'Connect')}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Error detail */}
                        {connection?.lastError && (
                          <div className="mt-2 p-2 bg-danger-50 dark:bg-danger-900/20 rounded text-xs text-danger-600 dark:text-danger-400">
                            {connection.lastError}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
      )}

      {/* Connect modal (for apps that need config fields) */}
      {connectModalApp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setConnectModalApp(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 p-5 border-b border-c-border-subtle dark:border-navy-700">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-c-surface-raised">
                {React.createElement(connectModalApp.icon)}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-c-text">
                  {t('settings.integrations.connectProvider', 'Connect {{name}}', {
                    name: connectModalApp.name,
                  })}
                </h4>
                <p className="text-xs text-c-text-muted mt-0.5">
                  {connectModalApp.authType === 'basic'
                    ? 'Provide your Apple ID and app-specific password.'
                    : 'Provide the required configuration below.'}
                </p>
              </div>
              <button
                onClick={() => setConnectModalApp(null)}
                className="p-1.5 text-c-text-secondary hover:text-c-text-secondary dark:hover:text-white rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {connectModalApp.authType === 'basic' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-c-text-secondary">
                      Apple ID Email
                    </label>
                    <input
                      value={draftConfig.username || ''}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({ ...prev, username: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-sm text-c-text placeholder-c-text-muted focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)]"
                      placeholder="your@icloud.com"
                      type="email"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-c-text-secondary">
                      App-Specific Password
                    </label>
                    <input
                      value={draftConfig.password || ''}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({ ...prev, password: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-sm text-c-text placeholder-c-text-muted focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)]"
                      placeholder="xxxx-xxxx-xxxx-xxxx"
                      type="password"
                    />
                  </div>
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <p className="font-medium">How to generate an app-specific password:</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-blue-600 dark:text-blue-400">
                      <li>
                        Go to{' '}
                        <a
                          href="https://appleid.apple.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          appleid.apple.com
                        </a>
                      </li>
                      <li>Sign In &amp; Security &rarr; App-Specific Passwords</li>
                      <li>Generate a password labeled "Consultify"</li>
                    </ol>
                  </div>
                </>
              ) : (
                connectModalApp.configFields.map((field) => (
                  <div key={field} className="space-y-1">
                    <label className="text-xs font-medium text-c-text-secondary capitalize">
                      {field.replace(/_/g, ' ')}
                    </label>
                    <input
                      value={draftConfig[field] || ''}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({ ...prev, [field]: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-sm text-c-text placeholder-c-text-muted focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)]"
                      placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                    />
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-end gap-2 p-5 pt-0">
              <button
                onClick={() => setConnectModalApp(null)}
                className="px-4 py-2 text-sm rounded-lg border border-c-border-subtle dark:border-navy-700 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-800 transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={submitConnectModal}
                disabled={connecting}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950 transition-colors disabled:opacity-50 shadow-sm"
              >
                {connecting
                  ? t('common.connecting', 'Connecting...')
                  : t('common.connect', 'Connect')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mapping Drift Panel (per-integration detail view) */}
      {mappingIntegrationId && (
        <div className="rounded-xl border border-c-border-subtle dark:border-navy-700/50 bg-c-surface-raised p-4">
          <MappingDriftPanel
            integrationId={mappingIntegrationId}
            onBack={() => setMappingIntegrationId(null)}
          />
        </div>
      )}

      {/* Footer note */}
      <div className="text-xs text-c-text-muted bg-c-surface-raised rounded-xl p-3.5 space-y-1">
        <p className="font-medium text-c-text-secondary">
          {t('settings.integrations.note', 'Note:')}
        </p>
        <ul className="list-disc list-inside space-y-0.5 text-c-text-secondary">
          <li>
            {t(
              'settings.integrations.notePersonal',
              'These are your personal connections — only you can see and manage them.'
            )}
          </li>
          <li>
            {t(
              'settings.integrations.noteOAuth',
              'We use secure OAuth 2.0 — we never store your passwords.'
            )}
          </li>
          <li>
            {t(
              'settings.integrations.noteAdmin',
              'Your admin can see which apps you have connected, but not your credentials.'
            )}
          </li>
        </ul>
      </div>
    </div>
  );
};

export default ConnectedAppsSettings;
