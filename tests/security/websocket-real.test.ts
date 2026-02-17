/**
 * Real WebSocket Security Tests (P0)
 *
 * Tests the ACTUAL CollaborativeSessionGateway.ts logic.
 * Verifies:
 * - Session state management (in-memory)
 * - Message handling for collaborative tasks
 * - Vote aggregation logic
 * - Participant tracking
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initializeCollaborativeGateway,
  createSession,
  getSession,
} from '../../server/src/gateways/collaborativeSession.gateway';

// Mock the Logger to avoid import resolution issues during testing
vi.mock('../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Real WebSocket Gateway (P0)', () => {
  let mockIo: any;
  let mockNamespace: any;
  let mockSocket: any;
  let registeredHandlers: Record<string, Function> = {};

  beforeEach(() => {
    registeredHandlers = {};

    // Mock Socket.IO structure
    mockNamespace = {
      on: vi.fn(),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };

    mockIo = {
      of: vi.fn().mockReturnValue(mockNamespace),
    };

    mockSocket = {
      id: 'test-socket-id',
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
      to: vi.fn().mockReturnThis(),
      rooms: new Set(),
      on: vi.fn((event, handler) => {
        registeredHandlers[event] = handler;
      }),
    };

    initializeCollaborativeGateway(mockIo);

    // Simulate a connection
    const connectionHandler = mockNamespace.on.mock.calls[0][1];
    connectionHandler(mockSocket);
  });

  describe('Session Management', () => {
    it('should create and retrieve a real session', () => {
      const sessionId = 'session-123';
      createSession({
        sessionId,
        organizationId: 'org-abc',
        createdBy: 'user-1',
        report: 'Test Report',
        options: [{ id: 'opt-1', name: 'Option 1' }],
      });

      const session = getSession(sessionId);
      expect(session).not.toBeNull();
      expect(session?.sessionId).toBe(sessionId);
      expect(session?.status).toBe('active');
    });

    it('should handle join_session correctly', () => {
      const sessionId = 'session-join';
      createSession({
        sessionId,
        organizationId: 'org-1',
        createdBy: 'admin',
        report: 'R',
        options: [],
      });

      const joinHandler = registeredHandlers['join_session'];
      joinHandler({
        sessionId,
        participantId: 'p-1',
        participantName: 'Player 1',
      });

      expect(mockSocket.join).toHaveBeenCalledWith(`dt:session:${sessionId}`);

      const session = getSession(sessionId);
      expect(session?.participants).toHaveLength(1);
      expect(session?.participants[0].name).toBe('Player 1');

      // Should emit to the room
      expect(mockNamespace.to).toHaveBeenCalledWith(`dt:session:${sessionId}`);
      expect(mockNamespace.emit).toHaveBeenCalledWith(
        'participant_joined',
        expect.objectContaining({
          participantName: 'Player 1',
        })
      );
    });
  });

  describe('Collaborative Actions', () => {
    const sessionId = 'session-actions';

    beforeEach(() => {
      createSession({
        sessionId,
        organizationId: 'org-1',
        createdBy: 'admin',
        report: 'R',
        options: [{ id: 'opt-1', name: 'Option 1' }],
      });

      // Join the session first to set socketToSession mapping
      registeredHandlers['join_session']({
        sessionId,
        participantId: 'p-1',
        participantName: 'Player 1',
      });
    });

    it('should aggregate votes correctly', () => {
      const voteHandler = registeredHandlers['vote'];

      voteHandler({
        participantId: 'p-1',
        participantName: 'Player 1',
        optionId: 'opt-1',
      });

      const session = getSession(sessionId);
      expect(session?.votes).toHaveLength(1);
      expect(session?.votes[0].optionId).toBe('opt-1');

      // Verify broadcast with summary
      expect(mockNamespace.emit).toHaveBeenCalledWith(
        'vote_updated',
        expect.objectContaining({
          voteSummary: expect.objectContaining({
            'opt-1': { count: 1, percentage: 100 },
          }),
        })
      );
    });

    it('should handle adding comments', () => {
      const commentHandler = registeredHandlers['add_comment'];

      commentHandler({
        participantId: 'p-1',
        participantName: 'Player 1',
        section: 'intro',
        text: 'Nice report!',
      });

      const session = getSession(sessionId);
      expect(session?.comments).toHaveLength(1);
      expect(session?.comments[0].text).toBe('Nice report!');

      expect(mockNamespace.emit).toHaveBeenCalledWith(
        'comment_added',
        expect.objectContaining({
          comment: expect.objectContaining({ text: 'Nice report!' }),
        })
      );
    });
  });
});
