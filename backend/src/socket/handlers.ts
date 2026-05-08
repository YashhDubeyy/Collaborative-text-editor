import { Server as SocketServer } from 'socket.io';
import { AuthSocket } from './gateway';
import { TextOperation } from '../ot/TextOperation';
import { getOrCreateDocServer } from '../ot/Server';
import { documentService } from '../services/documentService';

// Debounce timers for DB persistence per document
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
function scheduleSave(docId: string) {
  if (saveTimers.has(docId)) clearTimeout(saveTimers.get(docId)!);
  saveTimers.set(docId, setTimeout(() => {
    documentService.persistDocument(docId).catch(console.error);
  }, 3000));
}

// Track presence: docId → Map<socketId, user info>
const presence = new Map<string, Map<string, { username: string; color: string; cursor?: number }>>();

export function registerDocHandlers(io: SocketServer, socket: AuthSocket) {
  const { userId, username, color } = socket.user;

  // ─── join-doc ──────────────────────────────────────────────────────────────
  socket.on('join-doc', async ({ docId }: { docId: string }) => {
    try {
      // ✅ Access control — check before allowing join
      const allowed = await documentService.canAccess(docId, userId);
      if (!allowed) {
        socket.emit('error', { message: 'Access denied: you do not have permission to view this document' });
        return;
      }

      // Load document into memory
      const server = await documentService.ensureLoaded(docId);
      if (!server) {
        socket.emit('error', { message: 'Document not found' });
        return;
      }

      socket.join(docId);

      if (!presence.has(docId)) presence.set(docId, new Map());
      presence.get(docId)!.set(socket.id, { username, color });

      socket.emit('doc-init', {
        document: server.getDocument(),
        revision: server.getRevision(),
      });

      socket.to(docId).emit('user-joined', { socketId: socket.id, username, color });

      const users = Array.from(presence.get(docId)!.entries()).map(([sid, u]) => ({ socketId: sid, ...u }));
      socket.emit('presence-update', users);

      console.log(`📄 ${username} joined doc ${docId} (rev ${server.getRevision()})`);
    } catch (err) {
      console.error('join-doc error:', err);
      socket.emit('error', { message: 'Failed to join document' });
    }
  });

  // ─── op ────────────────────────────────────────────────────────────────────
  socket.on('op', async ({ docId, revision, op: opData }: {
    docId: string;
    revision: number;
    op: ReturnType<TextOperation['toJSON']>;
  }) => {
    try {
      // ✅ Edit permission check — viewers cannot send ops
      const editable = await documentService.canEdit(docId, userId);
      if (!editable) {
        socket.emit('error', { message: 'Access denied: you only have view permission on this document' });
        return;
      }

      const server = getOrCreateDocServer(docId);
      const op = TextOperation.fromJSON(opData as any);
      const transformedOp = server.receiveOp(revision, op);

      socket.emit('op-ack', { revision: server.getRevision() });

      socket.to(docId).emit('op', {
        op: transformedOp.toJSON(),
        revision: server.getRevision(),
        socketId: socket.id,
        username,
        color,
      });

      scheduleSave(docId);
    } catch (err) {
      console.error('op error:', err);
      socket.emit('error', { message: 'Operation failed — please reload' });
    }
  });

  // ─── cursor ────────────────────────────────────────────────────────────────
  socket.on('cursor', ({ docId, cursor }: { docId: string; cursor: number }) => {
    const docPresence = presence.get(docId);
    if (docPresence?.has(socket.id)) {
      docPresence.get(socket.id)!.cursor = cursor;
    }
    socket.to(docId).emit('cursor', { socketId: socket.id, username, color, cursor });
  });

  // ─── leave-doc / disconnect ────────────────────────────────────────────────
  const handleLeave = (docId: string) => {
    socket.leave(docId);
    presence.get(docId)?.delete(socket.id);
    io.to(docId).emit('user-left', { socketId: socket.id, username });

    const users = Array.from(presence.get(docId)?.entries() ?? []).map(([sid, u]) => ({ socketId: sid, ...u }));
    io.to(docId).emit('presence-update', users);
  };

  socket.on('leave-doc', ({ docId }: { docId: string }) => handleLeave(docId));

  socket.on('disconnect', () => {
    presence.forEach((docMap, docId) => {
      if (docMap.has(socket.id)) handleLeave(docId);
    });
  });
}
