import { PrismaClient } from '@prisma/client';
import { docServers, OTServer } from '../ot/Server';

const prisma = new PrismaClient();

export const documentService = {
  // ── List all documents accessible to a user ──────────────────────────────
  async findAll(userId: string) {
    return prisma.document.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { isPublic: true },
          { shares: { some: { userId } } },
        ],
      },
      include: {
        owner: { select: { username: true, color: true } },
        shares: { select: { userId: true } },
        _count: { select: { shares: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  },

  // ── Fetch a single document with owner info ───────────────────────────────
  async findById(id: string) {
    return prisma.document.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, username: true, color: true } },
        _count: { select: { shares: true } },
      },
    });
  },

  // ── Create a new document ─────────────────────────────────────────────────
  async create(ownerId: string, title: string) {
    return prisma.document.create({
      data: { title, ownerId, isPublic: false },
      include: {
        owner: { select: { username: true, color: true } },
        _count: { select: { shares: true } },
      },
    });
  },

  // ── Update title ──────────────────────────────────────────────────────────
  async updateTitle(id: string, title: string) {
    return prisma.document.update({ where: { id }, data: { title } });
  },

  // ── Toggle public visibility ──────────────────────────────────────────────
  async setVisibility(id: string, isPublic: boolean) {
    return prisma.document.update({ where: { id }, data: { isPublic } });
  },

  // ── Delete a document ─────────────────────────────────────────────────────
  async delete(id: string) {
    docServers.delete(id);
    return prisma.document.delete({ where: { id } });
  },

  // ── Permission checks ─────────────────────────────────────────────────────
  async canAccess(docId: string, userId: string): Promise<boolean> {
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      include: { shares: { where: { userId } } },
    });
    if (!doc) return false;
    if (doc.isPublic) return true;
    if (doc.ownerId === userId) return true;
    return doc.shares.length > 0;
  },

  async canEdit(docId: string, userId: string): Promise<boolean> {
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      include: { shares: { where: { userId } } },
    });
    if (!doc) return false;
    if (doc.ownerId === userId) return true;
    if (doc.isPublic) return true;
    return doc.shares.some((s) => s.role === 'editor');
  },

  async isOwner(docId: string, userId: string): Promise<boolean> {
    const doc = await prisma.document.findUnique({ where: { id: docId } });
    return doc?.ownerId === userId;
  },

  // ── Share management ──────────────────────────────────────────────────────
  async getShares(docId: string) {
    return prisma.documentShare.findMany({
      where: { documentId: docId },
      include: { user: { select: { id: true, username: true, email: true, color: true } } },
      orderBy: { createdAt: 'asc' },
    });
  },

  async addShare(docId: string, targetUserId: string, role: 'viewer' | 'editor') {
    return prisma.documentShare.upsert({
      where: { documentId_userId: { documentId: docId, userId: targetUserId } },
      create: { documentId: docId, userId: targetUserId, role },
      update: { role },
      include: { user: { select: { id: true, username: true, email: true, color: true } } },
    });
  },

  async removeShare(docId: string, targetUserId: string) {
    return prisma.documentShare.delete({
      where: { documentId_userId: { documentId: docId, userId: targetUserId } },
    });
  },

  async findUserByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  },

  // ── OT persistence ────────────────────────────────────────────────────────
  async persistDocument(docId: string) {
    const server = docServers.get(docId);
    if (!server) return;
    const snap = server.toSnapshot();
    await prisma.document.update({
      where: { id: docId },
      data: { content: snap.document, revision: snap.revision },
    });
  },

  async ensureLoaded(docId: string): Promise<OTServer | null> {
    if (docServers.has(docId)) return docServers.get(docId)!;
    const doc = await prisma.document.findUnique({ where: { id: docId } });
    if (!doc) return null;
    const server = new OTServer(doc.content, doc.revision);
    docServers.set(docId, server);
    return server;
  },
};
