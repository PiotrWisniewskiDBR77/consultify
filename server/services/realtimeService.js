// Simple WebSocket implementation without external dependencies
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_this_in_production';

class RealtimeServiceSimple {
    constructor() {
        this.clients = new Map(); // userId -> { socket, organizationId }
        this.presence = new Map(); // organizationId -> Set of userIds
    }

    initializeSimple(server) {
        server.on('upgrade', (request, socket, head) => {
            const url = new URL(request.url, `http://${request.headers.host}`);

            if (url.pathname !== '/ws') {
                socket.destroy();
                return;
            }

            // Extract token from query
            const token = url.searchParams.get('token');

            if (!token) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }

            try {
                // Verify JWT
                const decoded = jwt.verify(token, JWT_SECRET);
                const { id: userId, organizationId } = decoded;

                // WebSocket handshake
                const key = request.headers['sec-websocket-key'];
                const hash = crypto.createHash('sha1')
                    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
                    .digest('base64');

                socket.write(
                    'HTTP/1.1 101 Switching Protocols\r\n' +
                    'Upgrade: websocket\r\n' +
                    'Connection: Upgrade\r\n' +
                    `Sec-WebSocket-Accept: ${hash}\r\n` +
                    '\r\n'
                );

                // Store client
                this.clients.set(userId, { socket, organizationId });

                // Add to presence
                if (!this.presence.has(organizationId)) {
                    this.presence.set(organizationId, new Set());
                }
                this.presence.get(organizationId).add(userId);

                // Send welcome
                this.sendMessage(socket, {
                    type: 'connected',
                    userId,
                    organizationId
                });

                // Broadcast presence
                this.broadcastPresence(organizationId);

                console.log(`[WS] User ${userId} connected`);

                // Handle messages
                socket.on('data', (buffer) => {
                    try {
                        const message = this.parseFrame(buffer);
                        if (message) {
                            this.handleMessage(userId, organizationId, message);
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                });

                // Handle disconnect
                socket.on('close', () => {
                    this.handleDisconnect(userId, organizationId);
                });

                socket.on('error', () => {
                    this.handleDisconnect(userId, organizationId);
                });

            } catch (error) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
            }
        });

        console.log('[WebSocket] Simple server initialized');
    }

    parseFrame(buffer) {
        try {
            // Simple WebSocket frame parsing (text frames only)
            const firstByte = buffer.readUInt8(0);
            const isFinalFrame = Boolean((firstByte >>> 7) & 0x1);
            const opcode = firstByte & 0xF;

            if (opcode === 0x8) return null; // Close frame
            if (opcode !== 0x1) return null; // Only text frames

            const secondByte = buffer.readUInt8(1);
            const isMasked = Boolean((secondByte >>> 7) & 0x1);
            let payloadLength = secondByte & 0x7F;
            let offset = 2;

            if (payloadLength === 126) {
                payloadLength = buffer.readUInt16BE(2);
                offset = 4;
            } else if (payloadLength === 127) {
                payloadLength = buffer.readUInt32BE(6);
                offset = 10;
            }

            if (isMasked) {
                const maskingKey = buffer.slice(offset, offset + 4);
                offset += 4;
                const payload = buffer.slice(offset, offset + payloadLength);

                for (let i = 0; i < payload.length; i++) {
                    payload[i] ^= maskingKey[i % 4];
                }

                return JSON.parse(payload.toString());
            }

            return JSON.parse(buffer.slice(offset, offset + payloadLength).toString());
        } catch (e) {
            return null;
        }
    }

    createFrame(data) {
        const json = JSON.stringify(data);
        const payload = Buffer.from(json);
        const length = payload.length;

        let frame;
        if (length <= 125) {
            frame = Buffer.allocUnsafe(2 + length);
            frame[0] = 0x81; // FIN + text frame
            frame[1] = length;
            payload.copy(frame, 2);
        } else if (length <= 65535) {
            frame = Buffer.allocUnsafe(4 + length);
            frame[0] = 0x81;
            frame[1] = 126;
            frame.writeUInt16BE(length, 2);
            payload.copy(frame, 4);
        } else {
            frame = Buffer.allocUnsafe(10 + length);
            frame[0] = 0x81;
            frame[1] = 127;
            frame.writeUInt32BE(0, 2);
            frame.writeUInt32BE(length, 6);
            payload.copy(frame, 10);
        }

        return frame;
    }

    sendMessage(socket, data) {
        if (socket.writable) {
            socket.write(this.createFrame(data));
        }
    }

    handleMessage(userId, organizationId, data) {
        const { type, payload } = data;

        switch (type) {
            case 'ping':
                const client = this.clients.get(userId);
                if (client) {
                    this.sendMessage(client.socket, { type: 'pong' });
                }
                break;

            case 'initiative_update':
            case 'task_update':
                this.broadcastToOrganization(organizationId, {
                    type,
                    from: userId,
                    data: payload
                });
                break;
        }
    }

    broadcastToOrganization(organizationId, message, excludeUserId = null) {
        const users = this.presence.get(organizationId);
        if (!users) return;

        users.forEach(userId => {
            if (userId !== excludeUserId) {
                const client = this.clients.get(userId);
                if (client) {
                    this.sendMessage(client.socket, message);
                }
            }
        });
    }

    broadcastPresence(organizationId) {
        const users = this.presence.get(organizationId);
        if (!users) return;

        const message = {
            type: 'presence_update',
            users: Array.from(users),
            count: users.size
        };

        users.forEach(userId => {
            const client = this.clients.get(userId);
            if (client) {
                this.sendMessage(client.socket, message);
            }
        });
    }

    handleDisconnect(userId, organizationId) {
        this.clients.delete(userId);
        if (this.presence.has(organizationId)) {
            this.presence.get(organizationId).delete(userId);
            if (this.presence.get(organizationId).size === 0) {
                this.presence.delete(organizationId);
            } else {
                this.broadcastPresence(organizationId);
            }
        }
        console.log(`[WS] User ${userId} disconnected`);
    }

    // External API
    notifyUpdate(organizationId, eventType, data) {
        this.broadcastToOrganization(organizationId, {
            type: eventType,
            data
        });
    }
}

module.exports = new RealtimeServiceSimple();
