import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { TextOperation } from '../ot/TextOperation';
import { useEditorStore } from '../store/useEditorStore';

const SOCKET_URL = 'http://localhost:3001';

/**
 * Client-side OT State Machine
 *
 * Three states:
 *   synchronized        – No pending ops. Ready to send immediately.
 *   awaiting_confirm    – One op sent to server, waiting for ack.
 *   awaiting_with_buffer – Op sent, AND user typed more (buffered).
 *
 * On server op received:
 *   - synchronized:           apply op directly to editor
 *   - awaiting_confirm:       transform server op against inflight, apply transformed
 *   - awaiting_with_buffer:   transform server op against inflight, then against buffer, apply
 */

type SyncState = 'synchronized' | 'awaiting_confirm' | 'awaiting_with_buffer';

interface CollabSocketOptions {
  token: string;
  docId: string;
  /** Called when we should apply a remote op to the editor */
  onRemoteOp: (op: TextOperation) => void;
  /** Called when initial document state arrives */
  onDocInit: (document: string, revision: number) => void;
}

export function useCollabSocket({
  token,
  docId,
  onRemoteOp,
  onDocInit,
}: CollabSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const syncState = useRef<SyncState>('synchronized');
  const inflight = useRef<TextOperation | null>(null);   // sent, awaiting ack
  const buffer = useRef<TextOperation | null>(null);     // composed while awaiting
  const revision = useRef(0);

  const { setRemoteUsers, updateRemoteCursor, setConnectionStatus } = useEditorStore();

  // ── Send inflight op to server ──────────────────────────────────────────────
  const sendOp = useCallback((op: TextOperation) => {
    socketRef.current?.emit('op', { docId, revision: revision.current, op: op.toJSON() });
  }, [docId]);

  // ── Handle a user keystroke producing a new op ──────────────────────────────
  const sendLocalOp = useCallback((op: TextOperation) => {
    switch (syncState.current) {
      case 'synchronized':
        inflight.current = op;
        syncState.current = 'awaiting_confirm';
        sendOp(op);
        break;
      case 'awaiting_confirm':
        buffer.current = op;
        syncState.current = 'awaiting_with_buffer';
        break;
      case 'awaiting_with_buffer':
        buffer.current = TextOperation.compose(buffer.current!, op);
        break;
    }
  }, [sendOp]);

  // ── Handle remote op from server ────────────────────────────────────────────
  const handleRemoteOp = useCallback((serverOp: TextOperation) => {
    switch (syncState.current) {
      case 'synchronized':
        revision.current++;
        onRemoteOp(serverOp);
        break;

      case 'awaiting_confirm': {
        // Transform server op against our inflight op
        const [, serverOpP] = TextOperation.transform(inflight.current!, serverOp);
        inflight.current = TextOperation.transform(serverOp, inflight.current!)[1];
        revision.current++;
        onRemoteOp(serverOpP);
        break;
      }

      case 'awaiting_with_buffer': {
        // Transform server op against inflight, then against buffer
        let [, serverOpP1] = TextOperation.transform(inflight.current!, serverOp);
        inflight.current = TextOperation.transform(serverOp, inflight.current!)[1];

        const [, serverOpP2] = TextOperation.transform(buffer.current!, serverOpP1);
        buffer.current = TextOperation.transform(serverOpP1, buffer.current!)[1];

        revision.current++;
        onRemoteOp(serverOpP2);
        break;
      }
    }
  }, [onRemoteOp]);

  // ── Handle server ack for our op ─────────────────────────────────────────────
  const handleAck = useCallback(({ revision: serverRev }: { revision: number }) => {
    revision.current = serverRev;
    switch (syncState.current) {
      case 'awaiting_confirm':
        inflight.current = null;
        syncState.current = 'synchronized';
        break;
      case 'awaiting_with_buffer':
        inflight.current = buffer.current;
        buffer.current = null;
        syncState.current = 'awaiting_confirm';
        sendOp(inflight.current!);
        break;
    }
  }, [sendOp]);

  // ── Socket setup / teardown ─────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !docId) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;
    setConnectionStatus('connecting');

    socket.on('connect', () => {
      setConnectionStatus('connected');
      socket.emit('join-doc', { docId });
    });

    socket.on('disconnect', () => setConnectionStatus('disconnected'));
    socket.on('connect_error', () => setConnectionStatus('disconnected'));

    socket.on('doc-init', ({ document, revision: rev }: { document: string; revision: number }) => {
      revision.current = rev;
      syncState.current = 'synchronized';
      inflight.current = null;
      buffer.current = null;
      onDocInit(document, rev);
    });

    socket.on('op', ({ op: opData, socketId }: { op: any; revision: number; socketId: string }) => {
      if (socketId === socket.id) return; // should not happen (server sends to others only)
      handleRemoteOp(TextOperation.fromJSON(opData));
    });

    socket.on('op-ack', handleAck);

    socket.on('presence-update', (users: Array<{ socketId: string; username: string; color: string; cursor?: number }>) => {
      setRemoteUsers(users.filter((u) => u.socketId !== socket.id));
    });

    socket.on('cursor', ({ socketId, username, color, cursor }: any) => {
      updateRemoteCursor(socketId, cursor);
    });

    socket.on('user-joined', ({ socketId, username, color }: any) => {
      setRemoteUsers(useEditorStore.getState().remoteUsers.concat([{ socketId, username, color }]));
    });

    socket.on('user-left', ({ socketId }: { socketId: string }) => {
      setRemoteUsers(useEditorStore.getState().remoteUsers.filter((u) => u.socketId !== socketId));
    });

    return () => {
      socket.emit('leave-doc', { docId });
      socket.disconnect();
      socketRef.current = null;
      setConnectionStatus('disconnected');
      setRemoteUsers([]);
    };
  }, [token, docId]); // eslint-disable-line

  const sendCursor = useCallback((cursor: number) => {
    socketRef.current?.emit('cursor', { docId, cursor });
  }, [docId]);

  return { sendLocalOp, sendCursor };
}
