import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, LogOut, Plus, Zap } from 'lucide-react';
import { useAuthStore } from '../store/useEditorStore';
import { useEditorStore } from '../store/useEditorStore';

interface NavbarProps {
  onNewDoc?: () => void;
}

export function Navbar({ onNewDoc }: NavbarProps) {
  const { user, clearAuth } = useAuthStore();
  const { connectionStatus } = useEditorStore();
  const navigate = useNavigate();

  const handleLogout = () => { clearAuth(); navigate('/'); };

  const statusColor =
    connectionStatus === 'connected' ? '#22c55e' :
    connectionStatus === 'connecting' ? '#f59e0b' : '#ef4444';
  const statusLabel =
    connectionStatus === 'connected' ? 'Live' :
    connectionStatus === 'connecting' ? 'Connecting…' : 'Offline';

  return (
    <nav className="navbar">
      <Link to="/docs" className="navbar-brand">
        <Zap size={20} className="brand-icon" />
        <span>CollabEdit</span>
      </Link>

      <div className="navbar-center">
        {connectionStatus !== 'disconnected' && (
          <div className="status-pill">
            <span className="status-dot" style={{ background: statusColor }} />
            <span>{statusLabel}</span>
          </div>
        )}
      </div>

      <div className="navbar-actions">
        {onNewDoc && (
          <button className="btn btn-primary btn-sm" onClick={onNewDoc}>
            <Plus size={15} /> New Doc
          </button>
        )}
        {user && (
          <div className="user-chip">
            <span
              className="user-avatar"
              style={{ background: user.color }}
            >
              {user.username[0].toUpperCase()}
            </span>
            <span className="user-name">{user.username}</span>
          </div>
        )}
        <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Logout">
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  );
}
