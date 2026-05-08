import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Trash2, Clock, Globe, Lock, Users, ChevronRight } from 'lucide-react';
import { Document } from '../store/useEditorStore';
import { useAuthStore } from '../store/useEditorStore';

interface DocumentListProps {
  documents: Document[];
  onDelete: (id: string) => void;
  loading: boolean;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function VisibilityBadge({ doc, currentUserId }: { doc: Document; currentUserId: string }) {
  const isOwner = doc.ownerId === currentUserId;
  const shareCount = (doc as any)._count?.shares ?? 0;

  if (doc.isPublic) {
    return <span className="vis-badge badge-public"><Globe size={11} /> Public</span>;
  }
  if (!isOwner) {
    // This user was invited
    return <span className="vis-badge badge-shared"><Users size={11} /> Shared with me</span>;
  }
  if (shareCount > 0) {
    return <span className="vis-badge badge-shared"><Users size={11} /> Shared ({shareCount})</span>;
  }
  return <span className="vis-badge badge-private"><Lock size={11} /> Private</span>;
}

export function DocumentList({ documents, onDelete, loading }: DocumentListProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleting(id);
    await onDelete(id);
    setDeleting(null);
  };

  if (loading) {
    return (
      <div className="doc-list-skeleton">
        {[1, 2, 3].map(i => <div key={i} className="skeleton-card" />)}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="doc-empty">
        <FileText size={48} className="doc-empty-icon" />
        <h3>No documents yet</h3>
        <p>Create your first document to start collaborating</p>
      </div>
    );
  }

  return (
    <div className="doc-list">
      {documents.map(doc => (
        <div
          key={doc.id}
          className="doc-card"
          onClick={() => navigate(`/docs/${doc.id}`)}
        >
          <div className="doc-card-icon">
            <FileText size={20} />
          </div>
          <div className="doc-card-body">
            <h3 className="doc-card-title">{doc.title || 'Untitled'}</h3>
            <div className="doc-card-meta">
              <span><Clock size={12} /> {timeAgo(doc.updatedAt)}</span>
              <span>by {doc.owner?.username ?? 'unknown'}</span>
              <VisibilityBadge doc={doc} currentUserId={user?.id ?? ''} />
            </div>
          </div>
          <div className="doc-card-actions">
            <ChevronRight size={18} className="doc-arrow" />
            {doc.ownerId === user?.id && (
              <button
                id={`doc-delete-${doc.id}`}
                className="btn btn-danger btn-xs"
                onClick={(e) => handleDelete(e, doc.id)}
                disabled={deleting === doc.id}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
