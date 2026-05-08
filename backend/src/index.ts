import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { setupSocketGateway } from './socket/gateway';
import authRouter from './routes/auth';
import documentsRouter from './routes/documents';

const prisma = new PrismaClient();
const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));
app.use('/api/auth', authRouter);
app.use('/api/documents', documentsRouter);

setupSocketGateway(httpServer);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, async () => {
  await prisma.$connect();
  console.log(`\n🚀 Collab Editor Backend`);
  console.log(`   REST API : http://localhost:${PORT}/api`);
  console.log(`   WebSocket: ws://localhost:${PORT}\n`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
