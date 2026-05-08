import React, { useEffect, useState, useCallback } from 'react';
import { X, UserPlus, Globe, Lock, Trash2, Crown, Eye, Pencil, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface ShareUser {
  id: string;
  username: string;
  email: string;
  color: string;
}

interface Share {
  id: string;
  userId: string;
  role: 'viewer' | 'editor';
  user: ShareUser;
}

interface Props {
  docId: string;
  docTitle: string;
  isPublic: boolean;
  onClose: () => void;
  onVisibilityChange: (isPublic: boolean) => void;
}

export function ShareModal({ docId, docTitle, isPublic, onClose, onVisibilityChange }: Props) {
  const { authFetch } = useAuth();
  const [shares, setShares] = useState<Share[]>([]);
  const [loadingShares, setLoadingShares] = useState(true);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [togglingVis, setTogglingVis] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    setLoadingShares(true);
    try {
      const res = await authFetch(`/documents/${docId}/shares`);
      if (res.ok) setShares(await res.json());
    } finally {
      setLoadingShares(false);
    }
  }, [docId, authFetch]);

  useEffect(() => { loadShares(); }, [loadShares]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setInviting(true);
    setInviteError(null);
    try {
      const res = await authFetch(`/documents/${docId}/shares`, {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) { setInviteError(data.error || 'Failed to invite'); return; }
      setShares(prev => [...prev, data]);
      setUsername('');
    } catch {
      setInviteError('Network error');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setRemovingId(userId);
    try {
      await authFetch(`/documents/${docId}/shares/${userId}`, { method: 'DELETE' });
      setShares(prev => prev.filter(s => s.userId !== userId));
    } finally {
      setRemovingId(null);
    }
  };

  const handleToggleVisibility = async () => {
    setTogglingVis(true);
    try {
      const res = await authFetch(`/documents/${docId}/visibility`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublic: !isPublic }),
      });
      if (res.ok) onVisibilityChange(!isPublic);
    } finally {
      setTogglingVis(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Share document">

        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <UserPlus size={18} className="modal-title-icon" />
            <div>
              <h2 className="modal-title">Share Document</h2>
              <p className="modal-subtitle" title={docTitle}>{docTitle}</p>
            </div>
          </div>
          <button id="share-modal-close" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">

          {/* Visibility Toggle */}
          <div className="visibility-section">
            <div className="visibility-info">
              <div className={`vis-icon ${isPublic ? 'vis-icon-public' : 'vis-icon-private'}`}>
                {isPublic ? <Globe size={16} /> : <Lock size={16} />}
              </div>
              <div>
                <p className="vis-label">{isPublic ? 'Public — anyone with the link can view & edit' : 'Private — only invited people can access'}</p>
                <p className="vis-hint">Click to {isPublic ? 'make private' : 'make public'}</p>
              </div>
            </div>
            <button
              id="share-visibility-toggle"
              className={`toggle-pill ${isPublic ? 'toggle-pill-public' : 'toggle-pill-private'}`}
              onClick={handleToggleVisibility}
              disabled={togglingVis}
            >
              {togglingVis
                ? <Loader2 size={14} className="spin" />
                : isPublic ? <><Globe size={13} /> Public</> : <><Lock size={13} /> Private</>
              }
            </button>
          </div>

          <div className="modal-divider" />

          {/* Invite Form */}
          <form className="invite-form" onSubmit={handleInvite}>
            <p className="invite-label">Invite by username</p>
            <div className="invite-row">
              <input
                id="share-username-input"
                className="invite-input"
                type="text"
                placeholder="Enter username…"
                value={username}
                onChange={e => { setUsername(e.target.value); setInviteError(null); }}
                disabled={inviting}
                autoComplete="off"
              />
              <select
                id="share-role-select"
                className="invite-role-select"
                value={role}
                onChange={e => setRole(e.target.value as 'editor' | 'viewer')}
                disabled={inviting}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                id="share-invite-btn"
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={inviting || !username.trim()}
              >
                {inviting ? <Loader2 size={14} className="spin" /> : <UserPlus size={14} />}
                Invite
              </button>
            </div>
            {inviteError && <p className="invite-error">{inviteError}</p>}
          </form>

          <div className="modal-divider" />

          {/* Collaborators List */}
          <div className="collaborators-section">
            <p className="collaborators-label">
              {loadingShares ? 'Loading…' : shares.length === 0 ? 'No collaborators yet' : `${shares.length} collaborator${shares.length > 1 ? 's' : ''}`}
            </p>

            {loadingShares ? (
              <div className="collab-loading"><Loader2 size={20} className="spin" /></div>
            ) : (
              <ul className="collaborator-list">
                {shares.map((share) => (
                  <li key={share.id} className="collaborator-row">
                    <div className="collab-avatar" style={{ background: share.user.color }}>
                      {share.user.username[0].toUpperCase()}
                    </div>
                    <div className="collab-info">
                      <span className="collab-name">{share.user.username}</span>
                      <span className="collab-email">{share.user.email}</span>
                    </div>
                    <span className={`role-badge role-badge-${share.role}`}>
                      {share.role === 'editor' ? <><Pencil size={10} /> Editor</> : <><Eye size={10} /> Viewer</>}
                    </span>
                    <button
                      id={`share-remove-${share.userId}`}
                      className="collab-remove-btn"
                      title="Revoke access"
                      onClick={() => handleRemove(share.userId)}
                      disabled={removingId === share.userId}
                    >
                      {removingId === share.userId
                        ? <Loader2 size={14} className="spin" />
                        : <Trash2 size={14} />
                      }
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>

        <div className="modal-footer">
          <p className="modal-footer-tip">
            <Crown size={12} /> You are the owner of this document
          </p>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Done</button>
        </div>

      </div>
    </div>
  );
}
