import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Zap } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { DocumentList } from '../components/DocumentList';
import { useAuth } from '../hooks/useAuth';
import { useEditorStore } from '../store/useEditorStore';
import { Document } from '../store/useEditorStore';

export function DocsPage() {
  const { authFetch, isAuthenticated } = useAuth();
  const { documents, setDocuments } = useEditorStore();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) { navigate('/'); return; }
    loadDocs();
  }, [isAuthenticated]);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/documents');
      if (res.ok) setDocuments(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const handleNewDoc = useCallback(async () => {
    setCreating(true);
    try {
      const res = await authFetch('/documents', {
        method: 'POST',
        body: JSON.stringify({ title: 'Untitled Document' }),
      });
      if (res.ok) {
        const doc: Document = await res.json();
        setDocuments([doc, ...documents]);
        navigate(`/docs/${doc.id}`);
      }
    } finally {
      setCreating(false);
    }
  }, [authFetch, documents, navigate, setDocuments]);

  const handleDelete = useCallback(async (id: string) => {
    await authFetch(`/documents/${id}`, { method: 'DELETE' });
    setDocuments(documents.filter(d => d.id !== id));
  }, [authFetch, documents, setDocuments]);

  return (
    <div className="page">
      <Navbar onNewDoc={handleNewDoc} />
      <main className="docs-main">
        <div className="docs-header">
          <div>
            <h1 className="docs-title">My Documents</h1>
            <p className="docs-subtitle">Real-time collaborative editing, powered by OT</p>
          </div>
          <button className="btn btn-primary" onClick={handleNewDoc} disabled={creating}>
            <Plus size={18} />
            {creating ? 'Creating…' : 'New Document'}
          </button>
        </div>
        <DocumentList documents={documents} onDelete={handleDelete} loading={loading} />
      </main>
    </div>
  );
}
