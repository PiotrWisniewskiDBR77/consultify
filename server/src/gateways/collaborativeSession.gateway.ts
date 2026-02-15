/**
 * Collaborative Session Gateway (Enterprise)
 *
 * Real-time multi-user Deep Thinking sessions via WebSocket.
 * Enables:
 * - Shared view of decision report
 * - Real-time voting on options
 * - Inline comments and discussions
 * - Participant presence indicators
 */

import { Server as SocketIOServer, Socket } from 'socket.io';

import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface SessionParticipant {
  id: string;
  name: string;
  role?: string;
  color: string;
  joinedAt: string;
  cursorPosition?: { section: string; offset: number } | null;
  isActive: boolean;
}

export interface SessionVote {
  participantId: string;
  participantName: string;
  optionId: string;
  timestamp: string;
  comment?: string;
}

export interface SessionComment {
  id: string;
  participantId: string;
  participantName: string;
  section: string;
  text: string;
  timestamp: string;
  resolved: boolean;
  resolvedBy?: string | null;
}

export interface CollaborativeSession {
  sessionId: string;
  organizationId: string;
  createdBy: string;
  createdAt: string;
  report: string; // The Deep Thinking report content
  options: Array<{ id: string; name: string }>;
  participants: SessionParticipant[];
  votes: SessionVote[];
  comments: SessionComment[];
  status: 'active' | 'voting' | 'closed';
}

// ==========================================
// SESSION STORE (In-memory for now)
// ==========================================

const sessions = new Map<string, CollaborativeSession>();
const socketToSession = new Map<string, string>();

// Generate distinct colors for participants
const COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E9',
];

// ==========================================
// GATEWAY
// ==========================================

export function initializeCollaborativeGateway(io: SocketIOServer): void {
  const dtNamespace = io.of('/dt');

  dtNamespace.on('connection', (socket: Socket) => {
    logger.info(`[CollaborativeSession] Socket connected: ${socket.id}`);

    // Join session room
    socket.on('join_session', handleJoinSession(socket, dtNamespace));

    // Leave session
    socket.on('leave_session', handleLeaveSession(socket, dtNamespace));

    // Cursor/selection updates
    socket.on('cursor_update', handleCursorUpdate(socket, dtNamespace));

    // Vote on an option
    socket.on('vote', handleVote(socket, dtNamespace));

    // Add comment
    socket.on('add_comment', handleAddComment(socket, dtNamespace));

    // Resolve comment
    socket.on('resolve_comment', handleResolveComment(socket, dtNamespace));

    // Change session status
    socket.on('change_status', handleChangeStatus(socket, dtNamespace));

    // Disconnect
    socket.on('disconnect', () => handleDisconnect(socket, dtNamespace));
  });

  logger.info('[CollaborativeSession] Gateway initialized on /dt namespace');
}

// ==========================================
// EVENT HANDLERS
// ==========================================

function handleJoinSession(socket: Socket, namespace: any) {
  return (payload: {
    sessionId: string;
    participantId: string;
    participantName: string;
    role?: string;
  }) => {
    const { sessionId, participantId, participantName, role } = payload;

    let session = sessions.get(sessionId);
    if (!session) {
      // Create new session if doesn't exist
      session = {
        sessionId,
        organizationId: '',
        createdBy: participantId,
        createdAt: new Date().toISOString(),
        report: '',
        options: [],
        participants: [],
        votes: [],
        comments: [],
        status: 'active',
      };
      sessions.set(sessionId, session);
    }

    // Add participant
    const existingParticipant = session.participants.find((p) => p.id === participantId);
    if (existingParticipant) {
      existingParticipant.isActive = true;
    } else {
      const color = COLORS[session.participants.length % COLORS.length];
      session.participants.push({
        id: participantId,
        name: participantName,
        role,
        color,
        joinedAt: new Date().toISOString(),
        cursorPosition: null,
        isActive: true,
      });
    }

    // Join socket room
    socket.join(`dt:session:${sessionId}`);
    socketToSession.set(socket.id, sessionId);

    // Notify others
    namespace.to(`dt:session:${sessionId}`).emit('participant_joined', {
      participantId,
      participantName,
      participants: session.participants,
    });

    // Send full state to joiner
    socket.emit('session_state', {
      session,
    });

    logger.info(`[CollaborativeSession] ${participantName} joined session ${sessionId}`);
  };
}

function handleLeaveSession(socket: Socket, namespace: any) {
  return () => {
    const sessionId = socketToSession.get(socket.id);
    if (!sessionId) return;

    const session = sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.find(
      (p) => p.isActive && socket.rooms.has(`dt:session:${sessionId}`)
    );

    if (participant) {
      participant.isActive = false;
      namespace.to(`dt:session:${sessionId}`).emit('participant_left', {
        participantId: participant.id,
        participants: session.participants,
      });
    }

    socket.leave(`dt:session:${sessionId}`);
    socketToSession.delete(socket.id);
  };
}

function handleCursorUpdate(socket: Socket, namespace: any) {
  return (payload: { participantId: string; section: string; offset: number }) => {
    const sessionId = socketToSession.get(socket.id);
    if (!sessionId) return;

    const session = sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.find((p) => p.id === payload.participantId);
    if (participant) {
      participant.cursorPosition = { section: payload.section, offset: payload.offset };
    }

    // Broadcast to others (not self)
    socket.to(`dt:session:${sessionId}`).emit('cursor_moved', {
      participantId: payload.participantId,
      cursorPosition: payload,
    });
  };
}

function handleVote(socket: Socket, namespace: any) {
  return (payload: {
    participantId: string;
    participantName: string;
    optionId: string;
    comment?: string;
  }) => {
    const sessionId = socketToSession.get(socket.id);
    if (!sessionId) return;

    const session = sessions.get(sessionId);
    if (!session) return;

    // Remove existing vote from this participant
    session.votes = session.votes.filter((v) => v.participantId !== payload.participantId);

    // Add new vote
    session.votes.push({
      participantId: payload.participantId,
      participantName: payload.participantName,
      optionId: payload.optionId,
      timestamp: new Date().toISOString(),
      comment: payload.comment,
    });

    // Broadcast
    namespace.to(`dt:session:${sessionId}`).emit('vote_updated', {
      votes: session.votes,
      voteSummary: calculateVoteSummary(session),
    });

    logger.info(`[CollaborativeSession] ${payload.participantName} voted for ${payload.optionId}`);
  };
}

function handleAddComment(socket: Socket, namespace: any) {
  return (payload: {
    participantId: string;
    participantName: string;
    section: string;
    text: string;
  }) => {
    const sessionId = socketToSession.get(socket.id);
    if (!sessionId) return;

    const session = sessions.get(sessionId);
    if (!session) return;

    const comment: SessionComment = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      participantId: payload.participantId,
      participantName: payload.participantName,
      section: payload.section,
      text: payload.text,
      timestamp: new Date().toISOString(),
      resolved: false,
      resolvedBy: null,
    };

    session.comments.push(comment);

    namespace.to(`dt:session:${sessionId}`).emit('comment_added', {
      comment,
      comments: session.comments,
    });
  };
}

function handleResolveComment(socket: Socket, namespace: any) {
  return (payload: { commentId: string; resolvedBy: string }) => {
    const sessionId = socketToSession.get(socket.id);
    if (!sessionId) return;

    const session = sessions.get(sessionId);
    if (!session) return;

    const comment = session.comments.find((c) => c.id === payload.commentId);
    if (comment) {
      comment.resolved = true;
      comment.resolvedBy = payload.resolvedBy;
    }

    namespace.to(`dt:session:${sessionId}`).emit('comment_resolved', {
      commentId: payload.commentId,
      resolvedBy: payload.resolvedBy,
      comments: session.comments,
    });
  };
}

function handleChangeStatus(socket: Socket, namespace: any) {
  return (payload: { status: CollaborativeSession['status'] }) => {
    const sessionId = socketToSession.get(socket.id);
    if (!sessionId) return;

    const session = sessions.get(sessionId);
    if (!session) return;

    session.status = payload.status;

    namespace.to(`dt:session:${sessionId}`).emit('status_changed', {
      status: payload.status,
    });

    logger.info(`[CollaborativeSession] Session ${sessionId} status changed to ${payload.status}`);
  };
}

function handleDisconnect(socket: Socket, namespace: any) {
  handleLeaveSession(socket, namespace)();
  logger.info(`[CollaborativeSession] Socket disconnected: ${socket.id}`);
}

// ==========================================
// HELPERS
// ==========================================

function calculateVoteSummary(
  session: CollaborativeSession
): Record<string, { count: number; percentage: number }> {
  const totalVotes = session.votes.length;
  const summary: Record<string, { count: number; percentage: number }> = {};

  for (const option of session.options) {
    const count = session.votes.filter((v) => v.optionId === option.id).length;
    summary[option.id] = {
      count,
      percentage: totalVotes > 0 ? (count / totalVotes) * 100 : 0,
    };
  }

  return summary;
}

// ==========================================
// API FUNCTIONS
// ==========================================

/**
 * Create a new collaborative session
 */
export function createSession(args: {
  sessionId: string;
  organizationId: string;
  createdBy: string;
  report: string;
  options: Array<{ id: string; name: string }>;
}): CollaborativeSession {
  const session: CollaborativeSession = {
    sessionId: args.sessionId,
    organizationId: args.organizationId,
    createdBy: args.createdBy,
    createdAt: new Date().toISOString(),
    report: args.report,
    options: args.options,
    participants: [],
    votes: [],
    comments: [],
    status: 'active',
  };

  sessions.set(args.sessionId, session);
  return session;
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): CollaborativeSession | null {
  return sessions.get(sessionId) || null;
}

/**
 * Close a session
 */
export function closeSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.status = 'closed';
  }
}
