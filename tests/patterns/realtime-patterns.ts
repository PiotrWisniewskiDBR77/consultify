/**
 * Real-time & WebSocket Testing Patterns
 *
 * Patterns for testing real-time communication stability and correctness.
 */

export const RealtimePatterns = {
  /**
   * Connection lifecycle management
   */
  connection: {
    simulateReconnection: async (socket: any, attempts: number) => {
      for (let i = 0; i < attempts; i++) {
        socket.emit('disconnect');
        await new Promise((r) => setTimeout(r, 10));
        socket.emit('connect');
      }
      return socket.connected;
    },

    testHeartbeat: (socket: any, intervalMs: number) => {
      const heartbeats: number[] = [];
      socket.on('ping', () => heartbeats.push(Date.now()));
      return heartbeats;
    },
  },

  /**
   * Message ordering & reliability
   */
  messaging: {
    testMessageOrdering: (messages: { seq: number }[]) => {
      for (let i = 1; i < messages.length; i++) {
        if (messages[i].seq !== messages[i - 1].seq + 1) return false;
      }
      return true;
    },

    simulatePacketLoss: (sendFn: (msg: any) => void, lossRate: number) => {
      return (msg: any) => {
        if (Math.random() > lossRate) {
          sendFn(msg);
        }
      };
    },
  },

  /**
   * State synchronization
   */
  synchronization: {
    testConsistency: (clientState: any, serverState: any) => {
      return JSON.stringify(clientState) === JSON.stringify(serverState);
    },

    simulateLatency: (socket: any, ms: number) => {
      const originalEmit = socket.emit;
      socket.emit = (...args: any[]) => {
        setTimeout(() => originalEmit.apply(socket, args), ms);
      };
    },
  },
};
