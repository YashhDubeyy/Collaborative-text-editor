import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Pencil, UserPlus } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { CollabEditor } from '../components/Editor/CollabEditor';
import { PresenceBar } from '../components/Editor/PresenceBar';
import { ShareModal } from '../components/ShareModal';
import { useCollabSocket } from '../hooks/useCollabSocket';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore, useEditorStore } from '../store/useEditorStore';
import { WifiOff, Loader2 } from 'lucide-react';
import { TextOperation } from '../ot/TextOperation';

export function EditorPage() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const { token, authFetch } = useAuth();
  const { user } = useAuthStore();
  const { currentDoc, setCurrentDoc, updateDocTitle, remoteUsers, connectionStatus } = useEditorStore();

  const [docReady, setDocReady] = useState(false);
  const [hasConnected, setHasConnected] = useState(false);
  const [initialDoc, setInitialDoc] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [docIsPublic, setDocIsPublic] = useState(false);

  // Ref to insert text into the editor (for image uploads)
  const insertAtCursorRef = useRef<((text: string) => void) | null>(null);

  const applyRemoteRef = useRef<((op: TextOperation) => void) | null>(null);

  const isOwner = currentDoc?.ownerId === user?.id;

  // ── Load document meta ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!docId) return;
    authFetch(`/documents/${docId}`).then(async (res) => {
      if (!res.ok) { navigate('/docs'); return; }
      const doc = await res.json();
      setCurrentDoc(doc);
      setTitleInput(doc.title);
      setDocIsPublic(doc.isPublic);
    });
    return () => setCurrentDoc(null);
  }, [docId]);

  // ── Socket / OT integration ─────────────────────────────────────────────────
  const handleDocInit = useCallback((document: string, _revision: number) => {
    setInitialDoc(document);
    setDocReady(true);
    setHasConnected(true);
  }, []);

  const handleRemoteOp = useCallback((op: TextOperation) => {
    applyRemoteRef.current?.(op);
  }, []);

  const { sendLocalOp, sendCursor } = useCollabSocket({
    token: token!,
    docId: docId!,
    onDocInit: handleDocInit,
    onRemoteOp: handleRemoteOp,
  });

  // ── Title editing ───────────────────────────────────────────────────────────
  const saveTitle = async () => {
    if (!titleInput.trim() || titleInput === currentDoc?.title) { setEditingTitle(false); return; }
    await authFetch(`/documents/${docId}/title`, {
      method: 'PATCH',
      body: JSON.stringify({ title: titleInput.trim() }),
    });
    updateDocTitle(docId!, titleInput.trim());
    setEditingTitle(false);
  };

  // ── Image Upload ────────────────────────────────────────────────────────────
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleImageFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // reset so same file can be picked again
    e.target.value = '';
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await authFetch('/uploads/image', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      // Use relative URL — proxied through Vite dev server (/uploads → backend)
      const mdText = `![${file.name.replace(/\.[^.]+$/, '')}](${url})`;
      insertAtCursorRef.current?.(mdText);
    } catch (err) {
      console.error('Image upload error:', err);
    }
  }, [authFetch]);

  // ── Share link copy ─────────────────────────────────────────────────────────
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="page editor-page">
      <Navbar />
      <div className="editor-toolbar">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/docs')}>
          <ArrowLeft size={16} /> Docs
        </button>

        <div className="editor-title-wrap">
          {editingTitle && isOwner ? (
            <input
              className="editor-title-input"
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
              autoFocus
            />
          ) : (
            <button
              className={`editor-title-btn ${isOwner ? '' : 'editor-title-btn-readonly'}`}
              onClick={() => isOwner && setEditingTitle(true)}
            >
              {currentDoc?.title || 'Untitled'}
              {isOwner && <Pencil size={14} className="edit-icon" />}
            </button>
          )}
        </div>

        <div className="editor-toolbar-right">
          <PresenceBar />
          <button id="editor-copy-link-btn" className="btn btn-ghost btn-sm" onClick={copyLink} title="Copy share link">
            {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy Link</>}
          </button>
          {isOwner && (
            <button
              id="editor-share-btn"
              className="btn btn-primary btn-sm"
              onClick={() => setShowShare(true)}
              title="Share & Permissions"
            >
              <UserPlus size={15} /> Share
            </button>
          )}
        </div>
      </div>

      {hasConnected && connectionStatus === 'disconnected' && (
        <div className="offline-banner">
          <WifiOff size={13} /> You are offline — changes won't sync until reconnected.
        </div>
      )}
      {hasConnected && connectionStatus === 'connecting' && (
        <div className="reconnecting-banner">
          <Loader2 size={13} className="spin-icon" /> Reconnecting to document…
        </div>
      )}

      <div className="editor-body">
        {!docReady ? (
          <div className="editor-loading">
            <div className="spinner" />
            <span>Connecting to document…</span>
          </div>
        ) : (
          <CollabEditor
            initialDoc={initialDoc}
            onLocalOp={sendLocalOp}
            onCursorChange={sendCursor}
            applyRemoteRef={applyRemoteRef}
            remoteUsers={remoteUsers}
            onImageUpload={handleImageUpload}
            insertTextRef={insertAtCursorRef}
          />
        )}
      </div>

      {/* Hidden file input for image uploads */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageFileChange}
      />

      {showShare && currentDoc && (
        <ShareModal
          docId={docId!}
          docTitle={currentDoc.title}
          isPublic={docIsPublic}
          onClose={() => setShowShare(false)}
          onVisibilityChange={(val) => setDocIsPublic(val)}
        />
      )}
    </div>
  );
}
