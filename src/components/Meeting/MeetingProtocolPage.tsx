/**
 * MTG-2a (DEC-607) — `/meetings/:meetingId/protocol`.
 *
 * Thin route wrapper over `MeetingProtocolViewer`. The protocol surface exists
 * only while the `VITE_MEETING_PROTOCOL` flag is ON: when it is OFF the route
 * redirects back to the meeting card, so the document is unreachable by
 * deep-link as well as hidden from the card entry (canon: a new screen ships
 * behind a flag defaulting to OFF until accepted on a screenshot).
 */
import React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';

import { MeetingProtocolViewer } from './MeetingProtocolViewer';
import { isMeetingProtocolEnabled } from './meetingProtocolFlag';

export const MeetingProtocolPage: React.FC = () => {
  const { meetingId = '' } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const objectRoute = `${ROUTES.MEETINGS.ROOT}/${encodeURIComponent(meetingId)}`;

  if (!isMeetingProtocolEnabled()) {
    return <Navigate to={objectRoute} replace />;
  }

  return (
    <div className="h-full min-w-0" data-testid="meeting-protocol-page">
      <MeetingProtocolViewer meetingId={meetingId} onClose={() => navigate(objectRoute)} />
    </div>
  );
};

export default MeetingProtocolPage;
