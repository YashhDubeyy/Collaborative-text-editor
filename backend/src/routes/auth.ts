import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { signToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// User-assigned colors for presence
const COLORS = [
  '#6366f1', '#ec4899', '#14b8a6', '#f59e0b',
  '#ef4444', '#8b5cf6', '#10b981', '#3b82f6',
];

router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      res.status(400).json({ error: 'email, username and password are required' });
      return;
    }
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      res.status(409).json({ error: 'Email or username already taken' });
      return;
    }
    const hashed = await bcrypt.hash(password, 12);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const user = await prisma.user.create({
      data: { email, username, password: hashed, color },
    });
    const token = signToken({ userId: user.id, username: user.username, email: user.email, color: user.color });
    res.status(201).json({ token, user: { id: user.id, username: user.username, email: user.email, color: user.color } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const token = signToken({ userId: user.id, username: user.username, email: user.email, color: user.color });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, color: user.color } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
