import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { documentService } from '../services/documentService';

const router = Router();
router.use(authMiddleware);

// ── GET /documents — list accessible documents ──────────────────────────────
router.get('/', async (req: AuthRequest, res) => {
  try {
    const docs = await documentService.findAll(req.user!.userId);
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// ── GET /documents/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const doc = await documentService.findById(req.params.id);
    if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }
    const allowed = await documentService.canAccess(req.params.id, req.user!.userId);
    if (!allowed) { res.status(403).json({ error: 'Access denied' }); return; }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// ── POST /documents — create ────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res) => {
  try {
    const title = req.body.title || 'Untitled Document';
    const doc = await documentService.create(req.user!.userId, title);
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// ── PATCH /documents/:id/title — owner only ─────────────────────────────────
router.patch('/:id/title', async (req: AuthRequest, res) => {
  try {
    const { title } = req.body;
    if (!title) { res.status(400).json({ error: 'title is required' }); return; }
    const owns = await documentService.isOwner(req.params.id, req.user!.userId);
    if (!owns) { res.status(403).json({ error: 'Only the owner can rename this document' }); return; }
    const doc = await documentService.updateTitle(req.params.id, title);
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update title' });
  }
});

// ── PATCH /documents/:id/visibility — owner only ────────────────────────────
router.patch('/:id/visibility', async (req: AuthRequest, res) => {
  try {
    const { isPublic } = req.body;
    if (typeof isPublic !== 'boolean') {
      res.status(400).json({ error: 'isPublic (boolean) is required' }); return;
    }
    const owns = await documentService.isOwner(req.params.id, req.user!.userId);
    if (!owns) { res.status(403).json({ error: 'Only the owner can change visibility' }); return; }
    const doc = await documentService.setVisibility(req.params.id, isPublic);
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update visibility' });
  }
});

// ── DELETE /documents/:id — owner only ─────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const owns = await documentService.isOwner(req.params.id, req.user!.userId);
    if (!owns) { res.status(403).json({ error: 'Only the owner can delete this document' }); return; }
    await documentService.delete(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ── GET /documents/:id/shares — owner only ──────────────────────────────────
router.get('/:id/shares', async (req: AuthRequest, res) => {
  try {
    const owns = await documentService.isOwner(req.params.id, req.user!.userId);
    if (!owns) { res.status(403).json({ error: 'Access denied' }); return; }
    const shares = await documentService.getShares(req.params.id);
    res.json(shares);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shares' });
  }
});

// ── POST /documents/:id/shares — invite by username ─────────────────────────
router.post('/:id/shares', async (req: AuthRequest, res) => {
  try {
    const owns = await documentService.isOwner(req.params.id, req.user!.userId);
    if (!owns) { res.status(403).json({ error: 'Only the owner can invite collaborators' }); return; }

    const { username, role } = req.body;
    if (!username) { res.status(400).json({ error: 'username is required' }); return; }
    const roleVal = (role === 'viewer' || role === 'editor') ? role : 'editor';

    const target = await documentService.findUserByUsername(username);
    if (!target) { res.status(404).json({ error: `User "${username}" not found` }); return; }
    if (target.id === req.user!.userId) {
      res.status(400).json({ error: 'You already own this document' }); return;
    }

    const share = await documentService.addShare(req.params.id, target.id, roleVal);
    res.status(201).json(share);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add collaborator' });
  }
});

// ── DELETE /documents/:id/shares/:targetUserId — revoke ─────────────────────
router.delete('/:id/shares/:targetUserId', async (req: AuthRequest, res) => {
  try {
    const owns = await documentService.isOwner(req.params.id, req.user!.userId);
    if (!owns) { res.status(403).json({ error: 'Only the owner can revoke access' }); return; }
    await documentService.removeShare(req.params.id, req.params.targetUserId);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

export default router;
