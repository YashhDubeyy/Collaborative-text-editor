import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JwtPayload } from '../middleware/auth';
import { registerDocHandlers } from './handlers';

export interface AuthSocket extends Socket {
  user: JwtPayload;
}

export function setupSocketGateway(httpServer: HttpServer) {
  const io = new SocketServer(httpServer, {
    cors: { origin: 'http://localhost:5173', credentials: true },
    transports: ['websocket', 'polling'],
  });

  // JWT authentication middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) return next(new Error('Authentication error: no token'));
    try {
      (socket as AuthSocket).user = jwt.verify(token, JWT_SECRET) as JwtPayload;
      next();
    } catch {
      next(new Error('Authentication error: invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthSocket;
    console.log(`✅ Connected: ${authSocket.user.username} (${socket.id})`);
    registerDocHandlers(io, authSocket);
    socket.on('disconnect', () => {
      console.log(`❌ Disconnected: ${authSocket.user.username}`);
    });
  });

  return io;
}
