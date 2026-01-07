/**
 * Operational Transform (OT) Tests
 * Tests for text collaboration using OT
 * 
 * @module tests/collaboration/operational-transform.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Operation types for text editing
const createOperation = (type, position, content) => ({
    type, // 'insert' | 'delete' | 'retain'
    position,
    content,
    length: content?.length || 0,
});

// Text document with OT support
const createOTDocument = (initialContent = '') => {
    let content = initialContent;
    const history = [];
    let revision = 0;

    // Apply a single operation
    const applyOp = (op) => {
        switch (op.type) {
            case 'insert':
                content = content.slice(0, op.position) + op.content + content.slice(op.position);
                break;
            case 'delete':
                content = content.slice(0, op.position) + content.slice(op.position + op.length);
                break;
            case 'retain':
                // No change to content
                break;
        }
    };

    return {
        apply: (operation) => {
            applyOp(operation);
            history.push({ operation, revision });
            revision++;
            return revision;
        },

        applyBatch: (operations) => {
            for (const op of operations) {
                applyOp(op);
            }
            history.push({ operations, revision });
            revision++;
            return revision;
        },

        getContent: () => content,
        getRevision: () => revision,
        getHistory: () => [...history],

        insert: (position, text) => {
            return this.apply(createOperation('insert', position, text));
        },

        delete: (position, length) => {
            const deleted = content.slice(position, position + length);
            this.apply(createOperation('delete', position, deleted));
            return deleted;
        },
    };
};

// Transform function for concurrent operations
const transform = (op1, op2) => {
    // op1 is the operation to transform
    // op2 is the operation that was applied first

    const result = { ...op1 };

    if (op1.type === 'insert' && op2.type === 'insert') {
        if (op2.position <= op1.position) {
            result.position = op1.position + op2.length;
        }
    } else if (op1.type === 'insert' && op2.type === 'delete') {
        if (op2.position < op1.position) {
            result.position = Math.max(op2.position, op1.position - op2.length);
        }
    } else if (op1.type === 'delete' && op2.type === 'insert') {
        if (op2.position <= op1.position) {
            result.position = op1.position + op2.length;
        }
    } else if (op1.type === 'delete' && op2.type === 'delete') {
        if (op2.position < op1.position) {
            result.position = Math.max(0, op1.position - op2.length);
        } else if (op2.position < op1.position + op1.length) {
            // Overlapping deletes
            const overlapStart = Math.max(op1.position, op2.position);
            const overlapEnd = Math.min(op1.position + op1.length, op2.position + op2.length);
            result.length = op1.length - (overlapEnd - overlapStart);
        }
    }

    return result;
};

// OT client for handling local and remote operations
const createOTClient = (clientId, document) => {
    let serverRevision = 0;
    const pendingOps = [];
    let sentOp = null;

    return {
        clientId,

        // Apply local operation
        applyLocal: (operation) => {
            document.apply(operation);
            pendingOps.push(operation);
        },

        // Send pending operations to server
        send: () => {
            if (sentOp === null && pendingOps.length > 0) {
                sentOp = pendingOps.shift();
                return {
                    operation: sentOp,
                    revision: serverRevision,
                    clientId,
                };
            }
            return null;
        },

        // Acknowledge that server received our operation
        ack: (newRevision) => {
            serverRevision = newRevision;
            sentOp = null;
        },

        // Receive operation from server (from another client)
        receive: (operation, fromClient) => {
            if (fromClient === clientId) {
                // Our own operation, already applied
                return;
            }

            // Transform pending operations
            for (let i = 0; i < pendingOps.length; i++) {
                pendingOps[i] = transform(pendingOps[i], operation);
            }

            // Transform sent operation if any
            if (sentOp) {
                sentOp = transform(sentOp, operation);
            }

            // Apply the transformed operation
            document.apply(operation);
            serverRevision++;
        },

        getServerRevision: () => serverRevision,
        getPendingCount: () => pendingOps.length,
        hasPendingOp: () => sentOp !== null,
    };
};

// OT Server
const createOTServer = (initialContent = '') => {
    const document = createOTDocument(initialContent);
    const clients = new Map();
    const operationLog = [];

    return {
        getDocument: () => document,

        registerClient: (clientId) => {
            clients.set(clientId, {
                lastRevision: document.getRevision(),
            });
        },

        unregisterClient: (clientId) => {
            clients.delete(clientId);
        },

        receiveOperation: (clientId, operation, clientRevision) => {
            const serverRevision = document.getRevision();

            // Transform against operations the client hasn't seen
            let transformedOp = operation;
            for (let i = clientRevision; i < serverRevision; i++) {
                const serverOp = operationLog[i];
                if (serverOp) {
                    transformedOp = transform(transformedOp, serverOp.operation);
                }
            }

            // Apply to document
            document.apply(transformedOp);
            operationLog.push({
                operation: transformedOp,
                clientId,
                revision: document.getRevision(),
            });

            return {
                operation: transformedOp,
                revision: document.getRevision(),
            };
        },

        getContent: () => document.getContent(),
        getRevision: () => document.getRevision(),
        getOperationLog: () => [...operationLog],
    };
};

describe('OT Document Tests', () => {
    let doc;

    beforeEach(() => {
        doc = createOTDocument('Hello World');
    });

    it('should insert text', () => {
        doc.insert(5, ' Beautiful');

        expect(doc.getContent()).toBe('Hello Beautiful World');
    });

    it('should delete text', () => {
        doc.delete(5, 6); // Delete " World"

        expect(doc.getContent()).toBe('Hello');
    });

    it('should track revision', () => {
        expect(doc.getRevision()).toBe(0);

        doc.insert(0, 'Start: ');

        expect(doc.getRevision()).toBe(1);
    });

    it('should track history', () => {
        doc.insert(0, 'A');
        doc.insert(1, 'B');

        expect(doc.getHistory().length).toBe(2);
    });
});

describe('Transform Function Tests', () => {
    it('should transform insert after insert', () => {
        const op1 = createOperation('insert', 5, 'X');
        const op2 = createOperation('insert', 3, 'YYY');

        const transformed = transform(op1, op2);

        expect(transformed.position).toBe(8); // 5 + 3 (length of YYY)
    });

    it('should transform insert after delete', () => {
        const op1 = createOperation('insert', 10, 'X');
        const op2 = createOperation('delete', 5, 'abc');

        const transformed = transform(op1, op2);

        expect(transformed.position).toBe(7); // 10 - 3
    });

    it('should transform delete after insert', () => {
        const op1 = createOperation('delete', 5, 'ab');
        const op2 = createOperation('insert', 3, 'XXX');

        const transformed = transform(op1, op2);

        expect(transformed.position).toBe(8); // 5 + 3
    });

    it('should transform delete after delete', () => {
        const op1 = createOperation('delete', 10, 'abc');
        const op2 = createOperation('delete', 5, 'xy');

        const transformed = transform(op1, op2);

        expect(transformed.position).toBe(8); // 10 - 2
    });
});

describe('OT Client Tests', () => {
    let doc;
    let client;

    beforeEach(() => {
        doc = createOTDocument('Hello');
        client = createOTClient('client-1', doc);
    });

    it('should apply local operation', () => {
        client.applyLocal(createOperation('insert', 5, ' World'));

        expect(doc.getContent()).toBe('Hello World');
    });

    it('should queue pending operations', () => {
        client.applyLocal(createOperation('insert', 0, 'A'));
        client.applyLocal(createOperation('insert', 1, 'B'));

        expect(client.getPendingCount()).toBe(2);
    });

    it('should send operation', () => {
        client.applyLocal(createOperation('insert', 0, 'X'));

        const sent = client.send();

        expect(sent).not.toBeNull();
        expect(sent.clientId).toBe('client-1');
        expect(sent.operation.content).toBe('X');
    });

    it('should acknowledge sent operation', () => {
        client.applyLocal(createOperation('insert', 0, 'X'));
        client.send();
        client.ack(1);

        expect(client.getServerRevision()).toBe(1);
        expect(client.hasPendingOp()).toBe(false);
    });

    it('should receive and transform remote operation', () => {
        // Local operation pending
        client.applyLocal(createOperation('insert', 5, 'A'));

        // Remote operation arrives
        const remoteOp = createOperation('insert', 0, 'XXX');
        client.receive(remoteOp, 'client-2');

        expect(doc.getContent()).toBe('XXXHelloA');
    });
});

describe('OT Server Tests', () => {
    let server;

    beforeEach(() => {
        server = createOTServer('Hello');
    });

    it('should receive and apply operation', () => {
        server.registerClient('client-1');

        server.receiveOperation('client-1', createOperation('insert', 5, ' World'), 0);

        expect(server.getContent()).toBe('Hello World');
    });

    it('should track revision', () => {
        server.registerClient('client-1');

        server.receiveOperation('client-1', createOperation('insert', 0, 'A'), 0);
        server.receiveOperation('client-1', createOperation('insert', 1, 'B'), 1);

        expect(server.getRevision()).toBe(2);
    });

    it('should transform concurrent operations', () => {
        server.registerClient('client-1');
        server.registerClient('client-2');

        // Both clients see "Hello" (revision 0)
        // Client 1 inserts "A" at position 0
        server.receiveOperation('client-1', createOperation('insert', 0, 'A'), 0);

        // Client 2 also inserts "B" at position 0 (based on revision 0)
        // Server should transform this
        server.receiveOperation('client-2', createOperation('insert', 0, 'B'), 0);

        // Result should have both insertions
        expect(server.getContent()).toContain('A');
        expect(server.getContent()).toContain('B');
    });

    it('should log operations', () => {
        server.registerClient('client-1');

        server.receiveOperation('client-1', createOperation('insert', 0, 'X'), 0);
        server.receiveOperation('client-1', createOperation('insert', 1, 'Y'), 1);

        expect(server.getOperationLog().length).toBe(2);
    });
});
